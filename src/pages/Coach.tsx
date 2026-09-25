/**
 * Coach (Fasi 3-4, 25/09).
 *  - Primo colloquio in chat -> proposta di piano verificata dal codice -> Accetta.
 *  - Piano attivo a rotazione ("fai la prossima"), versioni con le differenze.
 *  - "Parla col coach" in qualsiasi momento: può cambiare il piano subito (senza limiti di cambi).
 *  - Controllo ogni 4 settimane con le 10 domande di Rossi; il controllo finisce nella cartella.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useSettings } from '../features/profile/useSettings'
import { useCartella } from '../features/cartella/useCartella'
import { useCoach, type MessaggioCoach } from '../features/coach/useCoach'
import { useWorkout } from '../features/workout/WorkoutContext'
import { controllaPiano, differenzePiani, normalizzaPiano, sedutaComeWorkout, type CoachPlan, type EsitoControlli } from '../features/coach/plan'
import { clienteConosciuto, leggiRispostaCoach, messaggioContesto, promptSistema, unisciCartella, type TipoConversazione } from '../features/coach/prompt'
import { cartellaInMarkdown, normalizzaCartella, vietatiDallaCartella } from '../features/cartella/cartella'
import { FileCartella } from '../features/cartella/FileCartella'
import { chiediJsonAlLlm, type LlmMessage } from '../lib/deepseek'
import { caricaCatalogo, elencoStorico } from '../lib/api'
import { determinaFase, escludiPerFastidi, patchCambioCalorie } from '../engine/nutrition'
import { isExerciseAvailable } from '../generators/equipment'
import { MUSCLE_LABELS, type CompletedWorkout, type Exercise } from '../types'

const GIORNI_CONTROLLO = 28
const DAY = 86_400_000

function TabellaVolume({ esito }: { esito: EsitoControlli }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left font-data text-[12px]">
        <thead className="text-slate-400"><tr><th className="py-1 pr-2 font-normal">Muscolo</th><th className="py-1 px-1 text-center font-normal">Serie/sett</th><th className="py-1 px-1 text-center font-normal">Volte</th><th className="py-1 pl-1 text-center font-normal">Range</th></tr></thead>
        <tbody>
          {esito.volume.map((r) => {
            const fuori = r.serie < r.target[0] || r.serie > r.target[1]
            return (
              <tr key={r.muscolo} className="border-t border-edge/60">
                <td className="py-1 pr-2">{MUSCLE_LABELS[r.muscolo]}{r.carenza && <span className="ml-1 text-amber-300">★</span>}</td>
                <td className={`py-1 px-1 text-center ${fuori ? 'text-amber-300' : 'text-emerald-300'}`}>{r.serie}</td>
                <td className="py-1 px-1 text-center">{r.frequenza}</td>
                <td className="py-1 pl-1 text-center text-slate-400">{r.target[0]}-{r.target[1]}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-slate-500">★ carenza · range indicativi per la tua fase</p>
    </div>
  )
}

function Sedute({ plan, prossima, onInizia }: { plan: CoachPlan; prossima?: number; onInizia?: (i: number) => void }) {
  const [aperta, setAperta] = useState<number | null>(prossima ?? 0)
  return (
    <ol className="space-y-2">
      {plan.sedute.map((sd, i) => (
        <li key={i} className={`rounded-xl border p-3 ${i === prossima ? 'border-cyan-400/60 bg-cyan-500/5' : 'border-edge'}`}>
          <button className="flex w-full items-center justify-between text-left" onClick={() => setAperta(aperta === i ? null : i)} aria-expanded={aperta === i}>
            <span className="font-display text-sm font-bold uppercase">{String.fromCharCode(65 + i)} · {sd.nome}</span>
            <span className="font-data text-[11px] text-slate2">{i === prossima ? 'PROSSIMA' : `${sd.esercizi.length} esercizi`}</span>
          </button>
          {aperta === i && sd.logica && <p className="mt-2 break-words rounded-lg bg-steel/60 p-2 text-[12px] leading-relaxed text-chalk">{sd.logica}</p>}
          {aperta === i && (
            <ol className="mt-2 space-y-1.5">
              {sd.esercizi.map((e, k) => (
                <li key={k} className="break-words text-[13px]">
                  <span className="font-data text-slate2">{k + 1}.</span> {e.nome}
                  <span className="ml-1 font-data text-[12px] text-slate2">{e.serie}×{e.reps}{e.rir ? ` · RIR ${e.rir}` : ''}</span>
                  {e.tecnica && <span className="block text-[11px] text-amber2">{e.tecnica}</span>}
                  {e.nota && <span className="block text-[11px] text-slate2">Perché: {e.nota}</span>}
                  {e.alternativa && <span className="block text-[11px] text-slate2">Alternativa: {e.alternativa}</span>}
                </li>
              ))}
            </ol>
          )}
          {onInizia && <button className="mt-2 w-full rounded-lg bg-emerald-500/15 py-2 text-xs font-bold uppercase text-emerald-300" onClick={() => onInizia(i)}>▶ Inizia {sd.nome}</button>}
        </li>
      ))}
    </ol>
  )
}

/** Carichi registrati per gli esercizi del piano (ultime 3 volte): li vede il coach. */
function carichiDelPiano(plan: CoachPlan | undefined, storico: CompletedWorkout[]): Record<string, { data: string; kg: number }[]> {
  if (!plan) return {}
  const ids = new Map(plan.sedute.flatMap((sd) => sd.esercizi.map((e) => [e.exercise_id, e.nome] as const)))
  const out: Record<string, { data: string; kg: number }[]> = {}
  for (const w of storico) for (const b of w.blocks) for (const e of b.exercises) {
    const nome = ids.get(e.exercise_id)
    if (!nome || e.logged_weight_kg === undefined) continue
    const lista = (out[nome] ??= [])
    if (lista.length < 3 && !lista.some((x) => x.data === w.completed_at.slice(0, 10))) lista.push({ data: w.completed_at.slice(0, 10), kg: e.logged_weight_kg })
  }
  return out
}

export default function Coach() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile, calorieLog, bodyLog, settings, saveProfile } = useSettings(user?.id)
  const { cartella, salva: salvaCartella } = useCartella(user?.id)
  const { messaggi, piano, versioni, aggiungi, eliminaMessaggi, eliminaPiano, cancellaConversazione, accettaPiano, impostaProssima } = useCoach(user?.id)
  const { catalog: ctxCatalog, setCatalog, setWorkout, setGenerationConfig } = useWorkout()
  const [catalogo, setCatalogo] = useState<Exercise[]>(ctxCatalog ?? [])
  const [storico, setStorico] = useState<CompletedWorkout[]>([])
  const [testo, setTesto] = useState('')
  const [attesa, setAttesa] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  /** Conversazione aperta sopra il piano attivo (null = si vede il piano). */
  const [aperta, setAperta] = useState<TipoConversazione | null>(null)
  /** Conversazione di "Parla col coach" aperta (ogni "Nuova chat" ne crea una). */
  const [thread, setThread] = useState<string | null>(null)
  const [menuNuovo, setMenuNuovo] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fase = determinaFase(profile, calorieLog)
  // Ti conosce già (cartella compilata, controlli o programma)? Allora niente anamnesi: ripresa.
  const conosciuto = clienteConosciuto(cartella, !!piano)

  useEffect(() => {
    if (catalogo.length) return
    caricaCatalogo().then((items) => { setCatalogo(items); setCatalog(items) }).catch(() => setErrore('Catalogo non caricato.'))
  }, [catalogo.length, setCatalog])
  useEffect(() => { if (user) elencoStorico(user.id).then(setStorico).catch(() => undefined) }, [user])
  // Si scorre solo la lista dei messaggi (scrollIntoView spostava anche la pagina e l'intestazione
  // finiva fuori dallo schermo sul telefono).
  const listaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = listaRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messaggi, attesa, aperta, thread])

  const catalogoCoach = useMemo(() => {
    const vietati = new Set(vietatiDallaCartella(cartella, catalogo))
    const disponibili = catalogo.filter((e) => !vietati.has(e.id) && isExerciseAvailable(e, settings?.equipment ?? 'full_gym', settings?.available_equipment ?? null))
    return escludiPerFastidi(disponibili, profile?.joint_issues)
  }, [catalogo, cartella, settings, profile])
  const ctxControlli = { catalog: catalogo, cartella, fastidi: profile?.joint_issues ?? [], phase: fase?.training_phase ?? null, step: fase?.training_step ?? null }

  // Senza piano si è nel primo colloquio; con il piano si apre la conversazione scelta.
  const tipo: TipoConversazione | null = aperta ?? (piano ? null : 'colloquio')
  const nellaConversazione = (m: MessaggioCoach, kind: TipoConversazione, t: string | null) =>
    m.kind === kind && (kind !== 'chat' || (m.thread_id ?? 'prima') === (t ?? 'prima'))
  const conversazione = (messaggi ?? []).filter((m) => tipo !== null && nellaConversazione(m, tipo, thread))

  // Storico delle chat con il coach: una voce per conversazione, dalla più recente.
  const storicoChat = useMemo(() => {
    const gruppi = new Map<string, MessaggioCoach[]>()
    for (const m of messaggi ?? []) if (m.kind === 'chat') {
      const k = m.thread_id ?? 'prima'
      gruppi.set(k, [...(gruppi.get(k) ?? []), m])
    }
    return [...gruppi.entries()].map(([id, lista]) => {
      const primoUtente = lista.find((m) => m.role === 'utente' && !(m.meta as { nascosto?: boolean } | null)?.nascosto)
      return { id, inizio: lista[0].created_at, ultimo: lista[lista.length - 1].created_at, titolo: (primoUtente?.content ?? lista.find((m) => m.role === 'coach')?.content ?? 'Chat').slice(0, 60) }
    }).sort((a, b) => b.ultimo.localeCompare(a.ultimo))
  }, [messaggi])

  const perLlm = (m: MessaggioCoach): LlmMessage => {
    if (m.role === 'utente') return { role: 'user', content: m.content }
    const p = (m.meta as { piano?: unknown } | null)?.piano
    return { role: 'assistant', content: p ? `${m.content}\n[PIANO PROPOSTO] ${JSON.stringify(p)}` : m.content }
  }

  async function invia(kind: TipoConversazione, contenuto: string, nascosto = false, tentativo = false, storiaBase?: MessaggioCoach[], threadForzato?: string | null) {
    if (!cartella || (attesa && !tentativo)) return
    setErrore(null); setAttesa(true)
    const t = kind === 'chat' ? (threadForzato !== undefined ? threadForzato : thread) : null
    try {
      const base = (storiaBase ?? (messaggi ?? []).filter((m) => nellaConversazione(m, kind, t))).slice(-40)
      const mio = await aggiungi({ role: 'utente', kind, content: contenuto, meta: nascosto ? { nascosto: true } : null, thread_id: t })
      const contesto = messaggioContesto({
        profile, fase, cartella, catalogo: catalogoCoach,
        pianoAttivo: piano?.plan ?? null,
        diarioPeso: bodyLog.slice(-12).map((e) => ({ data: e.created_at.slice(0, 10), peso: e.weight_kg, girovita: e.waist_cm, piatto: e.feels_flat })),
        carichi: carichiDelPiano(piano?.plan, storico),
        storicoCalorie: calorieLog.slice(-10).map((e) => ({ data: e.created_at.slice(0, 10), kcal: e.kcal })),
        allenamentiFatti: storico.slice(0, 15).map((w) => ({ data: w.completed_at.slice(0, 10), nome: w.name, minuti: Math.round(w.duration_sec / 60), voto: w.rating })),
      })
      const risposta = leggiRispostaCoach(await chiediJsonAlLlm([
        { role: 'system', content: promptSistema(kind, conosciuto) },
        { role: 'user', content: `CONTESTO DEL CLIENTE (leggilo prima di tutto): ${contesto}` },
        ...[...base, mio].map(perLlm),
      ]))
      if (risposta.aggiorna_cartella) await salvaCartella(unisciCartella(cartella, risposta.aggiorna_cartella, catalogo))
      const plan = risposta.piano ? normalizzaPiano(risposta.piano, catalogo) : null
      const esito = plan ? controllaPiano(plan, ctxControlli) : null
      // Il piano salvato si normalizza come quello nuovo: il confronto avviene sugli stessi id.
      const differenze = plan && piano ? differenzePiani(normalizzaPiano(piano.plan, catalogo) ?? piano.plan, plan) : null
      const suo = await aggiungi({
        role: 'coach', kind, content: risposta.messaggio, thread_id: t,
        meta: { opzioni: risposta.opzioni, categoria: risposta.categoria, piano: plan, esito, differenze, calorie: risposta.calorie, controllo: risposta.controllo },
      })
      // Alcuni modelli annunciano il piano ("ora te lo preparo") senza consegnarlo: glielo si
      // richiede subito, una volta, senza che il cliente debba insistere.
      const annunciato = kind === 'colloquio' && !plan && ((risposta.categoria ?? 0) >= 8 || /prepar|ecco il (tuo )?(piano|programma)|costruisco|elaboro|a breve|un momento/i.test(risposta.messaggio))
      if (annunciato && !tentativo) {
        await invia(kind, 'Consegna adesso il piano completo dentro "piano", in questa stessa risposta, con una breve spiegazione della logica.', true, true, [...base, mio, suo], t)
        return
      }
      if (plan && esito && esito.errori.length && !tentativo) {
        await invia(kind, `Il controllo dell'app ha trovato questi errori nel piano: ${esito.errori.join(' ')} Correggili e rimanda il piano intero.`, true, true, [...base, mio, suo], t)
      }
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Il coach non ha risposto.')
    } finally {
      setAttesa(false)
    }
  }

  /** Accetta quello che il coach propone: piano (nuova versione), calorie (con la scala), controllo (nella cartella). */
  async function accetta(kind: TipoConversazione, meta: MetaCoach) {
    try {
      if (meta.piano) {
        await accettaPiano(meta.piano, kind, meta.differenze?.join(' ') ?? undefined)
        if (cartella && (meta.piano.macro.proteine_g || meta.piano.macro.grassi_g || meta.piano.macro.carboidrati_g)) await salvaCartella({ ...cartella, macro: meta.piano.macro })
      }
      const kcal = meta.piano?.calorie ?? meta.calorie
      if (profile && kcal && kcal !== profile.daily_kcal) await saveProfile(patchCambioCalorie(profile, kcal))
      if (meta.controllo && cartella) {
        const nuovo = normalizzaCartella({ ...cartella, controlli: [...cartella.controlli, meta.controllo] }, catalogo)
        await salvaCartella(nuovo)
      }
      await aggiungi({ role: 'utente', kind, content: 'Ho accettato.', meta: { accettato: true }, thread_id: kind === 'chat' ? thread : null })
      if (kind !== 'chat') setAperta(null)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non salvato.')
    }
  }

  function scaricaProposta(plan: CoachPlan) {
    if (!cartella) return
    const md = cartellaInMarkdown({ cartella, profile, calorieLog, bodyLog, program: null, coachPlan: plan })
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `coaching_${new Date().toISOString().slice(0, 10)}.md`; a.click()
    URL.revokeObjectURL(url)
  }

  function inizia(i: number) {
    if (!piano) return
    const carenze = cartella?.carenze.map((c) => c.muscolo) ?? []
    setGenerationConfig(null)
    setWorkout(sedutaComeWorkout(piano.plan.sedute[i], catalogo, cartella, carenze))
    void impostaProssima((i + 1) % piano.plan.sedute.length)
    navigate('/allenamento')
  }

  /** "Parla col coach": dopo un programma nuovo (o la prima volta) si apre una chat pulita e il
   *  coach la inizia lui; altrimenti si riprende l'ultima conversazione. */
  async function apriChat(nuova = false) {
    setAperta('chat')
    const ultima = storicoChat[0]
    const vecchia = !ultima || (piano && ultima.ultimo < piano.created_at)
    if (!nuova && !vecchia) { setThread(ultima.id); return }
    const id = crypto.randomUUID()
    setThread(id)
    await invia('chat', '[APERTURA]', true, false, [], id)
  }

  /** Correggi l'ultimo messaggio: si toglie (con le risposte successive) e torna nel campo. */
  async function correggi(m: MessaggioCoach) {
    const dopo = conversazione.filter((x) => x.created_at >= m.created_at).map((x) => x.id)
    await eliminaMessaggi(dopo)
    setTesto(m.content)
    inputRef.current?.focus()
  }

  /** Non ti piace: elimina definitivamente il programma attivo e ricomincia dal coach. */
  async function eliminaEPrepraNuovo() {
    if (!piano) return
    if (!confirm(`Eliminare definitivamente "${piano.plan.titolo}" (versione ${piano.version})? Poi il coach ne prepara uno nuovo.`)) return
    try {
      await eliminaPiano(piano.id)
      await cancellaConversazione('colloquio')
      setAperta(null)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Programma non eliminato.')
    }
  }

  async function iniziaControllo() {
    await cancellaConversazione('controllo')
    setAperta('controllo')
    await invia('controllo', 'Ciao, facciamo il controllo.', false, false, [])
  }

  if (messaggi === null || piano === undefined || !cartella) return <main className="px-5 pt-12"><p className="text-slate2">Carico il Coach…</p></main>

  if (piano && !tipo) {
    const esito = controllaPiano(piano.plan, ctxControlli)
    const ultimoControllo = cartella.controlli[cartella.controlli.length - 1]?.data
    const riferimento = Math.max(new Date(piano.created_at).getTime(), ultimoControllo ? new Date(ultimoControllo).getTime() || 0 : 0)
    const traGiorni = Math.ceil((riferimento + GIORNI_CONTROLLO * DAY - Date.now()) / DAY)
    return (
      <main className="overflow-x-hidden px-5 pb-28 pt-10">
        <button className="font-data text-xs text-slate2" onClick={() => navigate('/')}>← Indietro</button>
        <p className="eyebrow mt-3">Il mio piano · versione {piano.version}</p>
        <h1 className="mt-1 break-words font-display text-[2rem] font-extrabold uppercase leading-none">{piano.plan.titolo}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate2">
          {piano.plan.sedute.length} sedute a rotazione, {piano.plan.giorni_settimana} a settimana, ~{piano.plan.durata_min} min. Fai sempre la prossima della lista.
          {piano.plan.calorie ? ` Calorie ${piano.plan.calorie} kcal.` : ''}
          {piano.plan.macro.proteine_g ? ` Proteine ${piano.plan.macro.proteine_g} g, grassi ${piano.plan.macro.grassi_g ?? '—'} g, carboidrati ${piano.plan.macro.carboidrati_g ?? '—'} g.` : ''}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-3 text-sm font-bold text-cyan-200" onClick={() => { void apriChat() }}>💬 Parla col coach</button>
          {storicoChat.length > 0 && (
            <button className="col-span-2 order-last rounded-xl border border-edge py-2.5 text-xs text-slate-300" onClick={() => { setAperta('chat'); setThread(storicoChat[0].id) }}>
              🗂 Conversazioni precedenti ({storicoChat.length})
            </button>
          )}
          <button className={`rounded-xl border py-3 text-sm font-bold ${traGiorni <= 0 ? 'border-amber-400/60 bg-amber-400/10 text-amber-200' : 'border-edge text-slate-300'}`} onClick={() => { void iniziaControllo() }}>
            📋 {traGiorni <= 0 ? 'È ora del controllo' : `Controllo tra ${traGiorni} gg`}
          </button>
        </div>

        {piano.plan.note && <p className="mt-4 rounded-xl border border-edge bg-steel/50 p-3 text-[13px] leading-relaxed text-chalk">{piano.plan.note}</p>}
        <div className="mt-5"><Sedute plan={piano.plan} prossima={piano.next_index} onInizia={inizia} /></div>
        <h2 className="mt-8 field-label">Volume settimanale (calcolato dall'app)</h2>
        <TabellaVolume esito={esito} />
        {esito.avvisi.length > 0 && <ul className="mt-3 space-y-1 text-[12px] text-amber2">{esito.avvisi.map((a, i) => <li key={i}>{a}</li>)}</ul>}

        {versioni.length > 1 && (
          <section className="mt-8">
            <h2 className="field-label">Versioni del piano</h2>
            <ul className="space-y-1.5 text-[12px] text-slate2">
              {versioni.map((v) => (
                <li key={v.id} className="flex items-start justify-between gap-2 border-b border-edge/60 pb-1.5">
                  <span>
                    <span className="text-chalk">v{v.version}</span> · {new Date(v.created_at).toLocaleDateString('it-IT')} · {v.source === 'colloquio' ? 'primo colloquio' : v.source === 'controllo' ? 'controllo' : 'modifica in chat'}
                    {v.id === piano.id && <span className="text-emerald-300"> · attiva</span>}
                    {v.note && <span className="block">{v.note}</span>}
                  </span>
                  {v.id !== piano.id && (
                    <button aria-label={`Elimina versione ${v.version}`} className="shrink-0 rounded-lg border border-edge px-2 py-1 text-[11px]" onClick={() => { if (confirm(`Eliminare definitivamente la versione ${v.version}?`)) void eliminaPiano(v.id) }}>🗑</button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="mt-8">
          <h2 className="field-label">Il tuo file (cartella + programma)</h2>
          <p className="mb-2 text-xs text-slate2">Lo puoi scaricare e ricaricare in qualsiasi momento, qualunque LLM usi.</p>
          <FileCartella catalog={catalogo} cartella={cartella} onCartella={async (c) => { await salvaCartella(c) }} compatto />
        </section>
        <button className="mt-8 w-full rounded-xl border border-red-500/40 bg-red-500/10 py-3 text-sm font-bold text-red-300" onClick={() => { void eliminaEPrepraNuovo() }}>
          🗑 Non mi piace: elimina e creane uno nuovo
        </button>
        <button className="mt-2 w-full rounded-xl border border-edge py-3 text-sm text-slate2" onClick={() => { if (confirm('Rifare il primo colloquio da capo? Il piano attuale resta valido finché non ne accetti uno nuovo.')) { void cancellaConversazione('colloquio'); setAperta('colloquio') } }}>
          Rifai il colloquio da capo
        </button>
      </main>
    )
  }

  const kind = tipo ?? 'colloquio'
  const visibili = conversazione.filter((m) => !(m.meta as { nascosto?: boolean } | null)?.nascosto)
  const ultimo = visibili[visibili.length - 1]
  const ultimoMio = [...visibili].reverse().find((m) => m.role === 'utente' && !(m.meta as MetaCoach | null)?.accettato)
  const titolo = kind === 'colloquio' ? (conosciuto ? 'Riprendiamo' : 'Primo colloquio') : kind === 'controllo' ? 'Controllo' : 'Parla col coach'
  const spiegazione = kind === 'colloquio'
    ? conosciuto
      ? 'Il coach ha letto la tua cartella: riassume quello che sa, ti fa solo le domande che mancano e ti consegna il programma spiegando ogni scelta.'
      : 'Una domanda alla volta, poi il programma su misura. Il coach aggiorna la tua cartella mentre parlate.'
    : kind === 'controllo'
      ? 'Il coach ha letto tutto: peso, girovita e carichi li conosce già. Rispondi alle domande e ti dirà cosa cambiare.'
      : 'Chiedi informazioni, spiegazioni o modifiche al programma quando vuoi.'

  // Menu delle conversazioni (25/09, Rossi: "non vedo le conversazioni precedenti"): sempre
  // visibile, con primo colloquio, controllo e tutte le chat.
  const haColloquio = (messaggi ?? []).some((m) => m.kind === 'colloquio')
  const haControllo = (messaggi ?? []).some((m) => m.kind === 'controllo')
  const valoreMenu = kind === 'chat' ? `chat:${thread ?? 'prima'}` : kind
  function scegliConversazione(v: string) {
    if (v.startsWith('chat:')) { setAperta('chat'); setThread(v.slice(5)); return }
    setAperta(v as TipoConversazione)
  }

  async function nuova(tipoNuovo: 'chat' | 'cambio' | 'programma' | 'controllo') {
    setMenuNuovo(false)
    if (tipoNuovo === 'chat') { await apriChat(true); return }
    if (tipoNuovo === 'cambio') {
      const id = crypto.randomUUID()
      setAperta('chat'); setThread(id)
      setTesto('Vorrei cambiare il programma: ')
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }
    if (tipoNuovo === 'controllo') { await iniziaControllo(); return }
    if (!confirm('Creare un programma nuovo? Il coach riparte dalla tua cartella; quello attuale resta finché non accetti il nuovo.')) return
    await cancellaConversazione('colloquio')
    setAperta('colloquio')
  }

  function inviaDalCampo() {
    const t = testo.trim()
    if (!t || attesa) return
    setTesto('')
    void invia(kind, t)
  }

  return (
    // Layout da app di messaggi: intestazione fissa, messaggi che scorrono, campo in basso sopra
    // la barra di navigazione (72 px). Niente contenuto più largo dello schermo.
    <main className="fixed inset-x-0 top-0 mx-auto flex h-[calc(100dvh-68px-env(safe-area-inset-bottom))] max-w-lg flex-col overflow-hidden">
      <header className="shrink-0 border-b border-edge bg-ink/95 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button className="shrink-0 rounded-lg px-2 py-1.5 font-data text-xs text-slate2" onClick={() => (piano ? setAperta(null) : navigate('/'))} aria-label={piano ? 'Torna al programma' : 'Indietro'}>←</button>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-extrabold uppercase">{titolo}</h1>
          <div className="relative shrink-0">
            <button className="rounded-lg border border-cyan-500/40 px-3 py-1.5 text-xs font-bold text-cyan-200" aria-expanded={menuNuovo} onClick={() => setMenuNuovo((v) => !v)}>＋ Nuova</button>
            {menuNuovo && (
              <div className="absolute right-0 top-full z-20 mt-1 w-64 space-y-1 rounded-xl border border-edge bg-ink p-2 shadow-2xl">
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-steel" onClick={() => { void nuova('chat') }}>💬 Nuova chat<span className="block text-[11px] text-slate2">domande, spiegazioni, come va</span></button>
                {piano && <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-steel" onClick={() => { void nuova('cambio') }}>✏️ Cambia il programma<span className="block text-[11px] text-slate2">scrivi cosa non ti va</span></button>}
                {piano && <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-steel" onClick={() => { void nuova('controllo') }}>📋 Fai il controllo<span className="block text-[11px] text-slate2">le 10 domande, a che punto sei</span></button>}
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-steel" onClick={() => { void nuova('programma') }}>🆕 Programma nuovo<span className="block text-[11px] text-slate2">il coach ne costruisce un altro</span></button>
              </div>
            )}
          </div>
        </div>
        <select className="input mt-2 w-full min-w-0 !py-2 text-sm" value={valoreMenu} onChange={(e) => scegliConversazione(e.target.value)} aria-label="Conversazioni precedenti">
          {(haColloquio || !piano) && <option value="colloquio">{conosciuto ? '🧑‍🏫 Colloquio / ripresa' : '🧑‍🏫 Primo colloquio'}</option>}
          {haControllo && <option value="controllo">📋 Ultimo controllo</option>}
          {kind === 'chat' && !storicoChat.some((c) => c.id === (thread ?? 'prima')) && <option value={`chat:${thread ?? 'prima'}`}>💬 Nuova chat</option>}
          {storicoChat.map((c) => (
            <option key={c.id} value={`chat:${c.id}`}>💬 {new Date(c.inizio).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} · {c.titolo}</option>
          ))}
        </select>
      </header>

      <div ref={listaRef} className="min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3">
        {visibili.length === 0 && <p className="text-sm text-slate2">{spiegazione}</p>}
        {kind === 'colloquio' && visibili.length === 0 && (
          <button className="btn" disabled={attesa || !catalogo.length} onClick={() => { void invia('colloquio', conosciuto ? 'Ciao, riprendiamo: hai la mia cartella.' : 'Ciao, iniziamo il colloquio.') }}>{conosciuto ? 'Riprendi con il coach' : 'Inizia il colloquio'}</button>
        )}
        {kind === 'chat' && visibili.length === 0 && !attesa && (
          <div className="flex flex-wrap gap-2">
            {['Com’è andata con il programma: ti racconto', 'A che punto sono con il mio obiettivo?', 'Un esercizio non lo sento bene', 'Spiegami perché hai scelto questi esercizi'].map((o) => (
              <button key={o} className="rounded-full border border-cyan-500/40 px-3 py-1.5 text-xs text-cyan-200" onClick={() => { void invia('chat', o) }}>{o}</button>
            ))}
          </div>
        )}
        {visibili.map((m) => (
          <Bolla key={m.id} m={m} ultimo={m === ultimo} attesa={attesa} haPiano={!!piano}
            onOpzione={(o) => { void invia(kind, o) }} onAccetta={(meta) => { void accetta(kind, meta) }}
            onDomanda={() => inputRef.current?.focus()} onScarica={scaricaProposta}
            onCorreggi={m === ultimoMio && !attesa ? () => { void correggi(m) } : undefined} />
        ))}
        {kind === 'colloquio' && !attesa && visibili.length >= 6 && !visibili.some((m) => (m.meta as MetaCoach | null)?.piano) && (
          <button className="w-full rounded-xl border border-amber-400/50 bg-amber-400/10 py-3 text-sm font-bold text-amber-200" onClick={() => { void invia('colloquio', 'Consegna adesso il piano completo dentro "piano", con una breve spiegazione della logica.', true) }}>
            📋 Genera il programma adesso
          </button>
        )}
        {attesa && <p className="text-sm text-slate2" role="status">Il coach sta scrivendo…</p>}
        {errore && <p className="break-words text-sm text-amber2" role="alert">{errore}</p>}
      </div>

      {(visibili.length > 0 || kind === 'chat') && (
        <div className="flex shrink-0 items-end gap-2 border-t border-edge bg-ink px-3 py-2">
          <textarea
            ref={inputRef}
            className="input min-w-0 flex-1 resize-none !py-2.5 text-base leading-snug"
            rows={Math.min(4, Math.max(1, testo.split('\n').length, Math.ceil(testo.length / 34)))}
            placeholder="Scrivi al coach…"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
          />
          <button className="h-11 w-11 shrink-0 rounded-xl bg-cyan-500/25 text-lg font-bold text-cyan-200 disabled:opacity-40" aria-label="Invia" disabled={attesa || !testo.trim()} onClick={inviaDalCampo}>➤</button>
        </div>
      )}
    </main>
  )
}

interface MetaCoach {
  opzioni?: string[]
  piano?: CoachPlan | null
  esito?: EsitoControlli | null
  differenze?: string[] | null
  calorie?: number | null
  controllo?: Record<string, unknown> | null
  accettato?: boolean
}

function Bolla({ m, ultimo, attesa, haPiano, onOpzione, onAccetta, onDomanda, onScarica, onCorreggi }: {
  m: MessaggioCoach; ultimo: boolean; attesa: boolean; haPiano: boolean
  onOpzione: (o: string) => void; onAccetta: (meta: MetaCoach) => void
  onDomanda: () => void; onScarica: (p: CoachPlan) => void; onCorreggi?: () => void
}) {
  const meta = (m.meta ?? {}) as MetaCoach
  if (m.role === 'utente') return (
    <div className="ml-10">
      <p className={`whitespace-pre-line break-words rounded-2xl rounded-br-sm p-3 text-sm ${meta.accettato ? 'bg-emerald-500/15 text-emerald-200' : 'bg-cyan-500/15 text-chalk'}`}>{m.content}</p>
      {onCorreggi && <button className="mt-1 block w-full text-right text-[11px] text-slate2 underline" onClick={onCorreggi}>✏️ Correggi questo messaggio</button>}
    </div>
  )
  const proposta = !!meta.piano || !!meta.calorie || !!meta.controllo
  const bloccato = !!meta.esito?.errori.length
  const etichetta = meta.piano ? (haPiano ? '✅ Mi piace, salva le modifiche' : '✅ Mi piace, salvalo') : meta.controllo ? 'Salva il controllo' : `Passa a ${meta.calorie} kcal`
  return (
    <div className="mr-4 min-w-0 space-y-2">
      <p className="whitespace-pre-line break-words rounded-2xl rounded-bl-sm border border-edge bg-steel/60 p-3 text-sm leading-relaxed text-chalk">{m.content}</p>
      {proposta && (
        <div className="min-w-0 rounded-2xl border border-cyan-500/40 p-3 space-y-3">
          {meta.differenze && (
            <div>
              <p className="field-label">Cosa cambia</p>
              <ul className="space-y-1 text-[12px] text-chalk">{meta.differenze.map((d, i) => <li key={i}>• {d}</li>)}</ul>
            </div>
          )}
          {meta.piano && (
            <>
              <p className="break-words font-display text-base font-bold uppercase text-cyan-200">📋 {haPiano ? 'Ecco il programma aggiornato' : 'Ecco il tuo programma'}: {meta.piano.titolo}</p>
              {meta.piano.note && <p className="break-words text-[12px] leading-relaxed text-slate2">{meta.piano.note}</p>}
              {/* Programma e volume ripiegati: la chat resta leggibile sul telefono. */}
              <details open={!haPiano && ultimo} className="rounded-xl border border-edge">
                <summary className="cursor-pointer px-3 py-2.5 text-sm font-bold text-chalk">Vedi le sedute ({meta.piano.sedute.length})</summary>
                <div className="space-y-3 p-2"><Sedute plan={meta.piano} /></div>
              </details>
            </>
          )}
          {meta.calorie && !meta.piano && <p className="text-sm text-chalk">Nuove calorie proposte: <span className="font-data">{meta.calorie} kcal</span> (il volume della scheda seguirà dopo una settimana).</p>}
          {meta.controllo && <p className="text-[12px] text-slate2">Il controllo verrà salvato nello storico della tua cartella.</p>}
          {meta.esito && meta.esito.errori.length > 0 && <ul className="space-y-1 text-[12px] text-red-300">{meta.esito.errori.map((e, i) => <li key={i}>✕ {e}</li>)}</ul>}
          {meta.esito && meta.esito.avvisi.length > 0 && <ul className="space-y-1 text-[12px] text-amber2">{meta.esito.avvisi.map((e, i) => <li key={i}>! {e}</li>)}</ul>}
          {meta.esito && (
            <details className="rounded-xl border border-edge">
              <summary className="cursor-pointer px-3 py-2.5 text-sm font-bold text-chalk">Volume settimanale</summary>
              <div className="p-2"><TabellaVolume esito={meta.esito} /></div>
            </details>
          )}
          {ultimo && <button className="btn" disabled={attesa || bloccato} onClick={() => onAccetta(meta)}>{bloccato ? 'Il coach deve correggere gli errori' : etichetta}</button>}
          {ultimo && (
            <div className="grid grid-cols-2 gap-2">
              <button className="rounded-xl border border-edge py-2.5 text-xs" onClick={onDomanda}>❓ Ho una domanda / cambio qualcosa</button>
              {meta.piano && <button className="rounded-xl border border-edge py-2.5 text-xs" onClick={() => onScarica(meta.piano!)}>⬇ Scarica .md</button>}
            </div>
          )}
        </div>
      )}
      {ultimo && !attesa && meta.opzioni && meta.opzioni.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {meta.opzioni.map((o) => <button key={o} className="rounded-full border border-cyan-500/40 px-3 py-1.5 text-xs text-cyan-200" onClick={() => onOpzione(o)}>{o}</button>)}
        </div>
      )}
    </div>
  )
}
