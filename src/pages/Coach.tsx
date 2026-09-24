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
import { leggiRispostaCoach, messaggioContesto, promptSistema, unisciCartella, type TipoConversazione } from '../features/coach/prompt'
import { normalizzaCartella, vietatiDallaCartella } from '../features/cartella/cartella'
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
          {aperta === i && (
            <ol className="mt-2 space-y-1.5">
              {sd.esercizi.map((e, k) => (
                <li key={k} className="text-[13px]">
                  <span className="font-data text-slate2">{k + 1}.</span> {e.nome}
                  <span className="ml-1 font-data text-[12px] text-slate2">{e.serie}×{e.reps}{e.rir ? ` · RIR ${e.rir}` : ''}</span>
                  {e.tecnica && <span className="block text-[11px] text-amber2">{e.tecnica}</span>}
                  {e.nota && <span className="block text-[11px] text-slate2">{e.nota}</span>}
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
  const { messaggi, piano, versioni, aggiungi, cancellaConversazione, accettaPiano, impostaProssima } = useCoach(user?.id)
  const { catalog: ctxCatalog, setCatalog, setWorkout, setGenerationConfig } = useWorkout()
  const [catalogo, setCatalogo] = useState<Exercise[]>(ctxCatalog ?? [])
  const [storico, setStorico] = useState<CompletedWorkout[]>([])
  const [testo, setTesto] = useState('')
  const [attesa, setAttesa] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  /** Conversazione aperta sopra il piano attivo (null = si vede il piano). */
  const [aperta, setAperta] = useState<TipoConversazione | null>(null)
  const fondo = useRef<HTMLDivElement>(null)
  const fase = determinaFase(profile, calorieLog)

  useEffect(() => {
    if (catalogo.length) return
    caricaCatalogo().then((items) => { setCatalogo(items); setCatalog(items) }).catch(() => setErrore('Catalogo non caricato.'))
  }, [catalogo.length, setCatalog])
  useEffect(() => { if (user) elencoStorico(user.id).then(setStorico).catch(() => undefined) }, [user])
  useEffect(() => { fondo.current?.scrollIntoView({ behavior: 'smooth' }) }, [messaggi, attesa, aperta])

  const catalogoCoach = useMemo(() => {
    const vietati = new Set(vietatiDallaCartella(cartella, catalogo))
    const disponibili = catalogo.filter((e) => !vietati.has(e.id) && isExerciseAvailable(e, settings?.equipment ?? 'full_gym', settings?.available_equipment ?? null))
    return escludiPerFastidi(disponibili, profile?.joint_issues)
  }, [catalogo, cartella, settings, profile])
  const ctxControlli = { catalog: catalogo, cartella, fastidi: profile?.joint_issues ?? [], phase: fase?.training_phase ?? null, step: fase?.training_step ?? null }

  // Senza piano si è nel primo colloquio; con il piano si apre la conversazione scelta.
  const tipo: TipoConversazione | null = !piano ? 'colloquio' : aperta
  const conversazione = (messaggi ?? []).filter((m) => m.kind === tipo)

  const perLlm = (m: MessaggioCoach): LlmMessage => {
    if (m.role === 'utente') return { role: 'user', content: m.content }
    const p = (m.meta as { piano?: unknown } | null)?.piano
    return { role: 'assistant', content: p ? `${m.content}\n[PIANO PROPOSTO] ${JSON.stringify(p)}` : m.content }
  }

  async function invia(kind: TipoConversazione, contenuto: string, nascosto = false, tentativo = false, storiaBase?: MessaggioCoach[]) {
    if (!cartella || (attesa && !tentativo)) return
    setErrore(null); setAttesa(true)
    try {
      const base = (storiaBase ?? (messaggi ?? []).filter((m) => m.kind === kind)).slice(-40)
      const mio = await aggiungi({ role: 'utente', kind, content: contenuto, meta: nascosto ? { nascosto: true } : null })
      const contesto = messaggioContesto({
        profile, fase, cartella, catalogo: catalogoCoach,
        pianoAttivo: piano?.plan ?? null,
        diarioPeso: bodyLog.slice(-12).map((e) => ({ data: e.created_at.slice(0, 10), peso: e.weight_kg, girovita: e.waist_cm, piatto: e.feels_flat })),
        carichi: carichiDelPiano(piano?.plan, storico),
        storicoCalorie: calorieLog.slice(-10).map((e) => ({ data: e.created_at.slice(0, 10), kcal: e.kcal })),
      })
      const risposta = leggiRispostaCoach(await chiediJsonAlLlm([
        { role: 'system', content: promptSistema(kind) },
        { role: 'user', content: `CONTESTO DEL CLIENTE (leggilo prima di tutto): ${contesto}` },
        ...[...base, mio].map(perLlm),
      ]))
      if (risposta.aggiorna_cartella) await salvaCartella(unisciCartella(cartella, risposta.aggiorna_cartella, catalogo))
      const plan = risposta.piano ? normalizzaPiano(risposta.piano, catalogo) : null
      const esito = plan ? controllaPiano(plan, ctxControlli) : null
      // Il piano salvato si normalizza come quello nuovo: il confronto avviene sugli stessi id.
      const differenze = plan && piano ? differenzePiani(normalizzaPiano(piano.plan, catalogo) ?? piano.plan, plan) : null
      const suo = await aggiungi({
        role: 'coach', kind, content: risposta.messaggio,
        meta: { opzioni: risposta.opzioni, categoria: risposta.categoria, piano: plan, esito, differenze, calorie: risposta.calorie, controllo: risposta.controllo },
      })
      if (plan && esito && esito.errori.length && !tentativo) {
        await invia(kind, `Il controllo dell'app ha trovato questi errori nel piano: ${esito.errori.join(' ')} Correggili e rimanda il piano intero.`, true, true, [...base, mio, suo])
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
      await aggiungi({ role: 'utente', kind, content: 'Ho accettato.', meta: { accettato: true } })
      if (kind !== 'chat') setAperta(null)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non salvato.')
    }
  }

  function inizia(i: number) {
    if (!piano) return
    const carenze = cartella?.carenze.map((c) => c.muscolo) ?? []
    setGenerationConfig(null)
    setWorkout(sedutaComeWorkout(piano.plan.sedute[i], catalogo, cartella, carenze))
    void impostaProssima((i + 1) % piano.plan.sedute.length)
    navigate('/allenamento')
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
      <main className="px-5 pb-28 pt-10">
        <button className="font-data text-xs text-slate2" onClick={() => navigate('/')}>← Indietro</button>
        <p className="eyebrow mt-3">Il mio piano · versione {piano.version}</p>
        <h1 className="mt-1 font-display text-[2rem] font-extrabold uppercase leading-none">{piano.plan.titolo}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate2">
          {piano.plan.sedute.length} sedute a rotazione, {piano.plan.giorni_settimana} a settimana, ~{piano.plan.durata_min} min. Fai sempre la prossima della lista.
          {piano.plan.calorie ? ` Calorie ${piano.plan.calorie} kcal.` : ''}
          {piano.plan.macro.proteine_g ? ` Proteine ${piano.plan.macro.proteine_g} g, grassi ${piano.plan.macro.grassi_g ?? '—'} g, carboidrati ${piano.plan.macro.carboidrati_g ?? '—'} g.` : ''}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-3 text-sm font-bold text-cyan-200" onClick={() => setAperta('chat')}>💬 Parla col coach</button>
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
                <li key={v.id} className="border-b border-edge/60 pb-1.5">
                  <span className="text-chalk">v{v.version}</span> · {new Date(v.created_at).toLocaleDateString('it-IT')} · {v.source === 'colloquio' ? 'primo colloquio' : v.source === 'controllo' ? 'controllo' : 'modifica in chat'}
                  {v.note && <span className="block">{v.note}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        <button className="mt-8 w-full rounded-xl border border-edge py-3 text-sm text-slate2" onClick={() => { if (confirm('Rifare il primo colloquio da capo? Il piano attuale resta valido finché non ne accetti uno nuovo.')) { void cancellaConversazione('colloquio'); setAperta('colloquio') } }}>
          Rifai il colloquio da capo
        </button>
      </main>
    )
  }

  const kind = tipo ?? 'colloquio'
  const visibili = conversazione.filter((m) => !(m.meta as { nascosto?: boolean } | null)?.nascosto)
  const ultimo = visibili[visibili.length - 1]
  const titolo = kind === 'colloquio' ? 'Primo colloquio' : kind === 'controllo' ? 'Controllo periodico' : 'Parla col coach'
  const spiegazione = kind === 'colloquio'
    ? 'Una domanda alla volta, poi il piano su misura. Il coach aggiorna la tua cartella mentre parlate.'
    : kind === 'controllo'
      ? 'Il coach ha letto tutto: peso, girovita e carichi li conosce già. Rispondi alle domande e ti dirà cosa cambiare.'
      : 'Scrivi quando vuoi: un esercizio che non senti, uno slot in cui arrivi stanco, un dubbio. Se serve cambia il piano subito.'
  return (
    <main className="flex min-h-dvh flex-col px-4 pb-40 pt-8">
      <button className="self-start font-data text-xs text-slate2" onClick={() => (piano ? setAperta(null) : navigate('/'))}>← {piano ? 'Torna al piano' : 'Indietro'}</button>
      <h1 className="mt-3 font-display text-[1.8rem] font-extrabold uppercase leading-none">{titolo}</h1>
      <p className="mt-2 text-sm text-slate2">{spiegazione}</p>

      <div className="mt-5 flex-1 space-y-3">
        {kind === 'colloquio' && visibili.length === 0 && (
          <button className="btn" disabled={attesa || !catalogo.length} onClick={() => { void invia('colloquio', 'Ciao, iniziamo il colloquio.') }}>Inizia il colloquio</button>
        )}
        {kind === 'chat' && visibili.length === 0 && <p className="text-sm text-slate2">Scrivi qui sotto la tua domanda.</p>}
        {visibili.map((m) => (
          <Bolla key={m.id} m={m} ultimo={m === ultimo} attesa={attesa} haPiano={!!piano}
            onOpzione={(o) => { void invia(kind, o) }} onAccetta={(meta) => { void accetta(kind, meta) }} />
        ))}
        {attesa && <p className="text-sm text-slate2" role="status">Il coach sta scrivendo…</p>}
        {errore && <p className="text-sm text-amber2" role="alert">{errore}</p>}
        <div ref={fondo} />
      </div>

      {(visibili.length > 0 || kind === 'chat') && (
        <div className="fixed inset-x-0 bottom-20 z-10 mx-auto flex max-w-lg gap-2 bg-ink/95 px-4 py-2">
          <textarea className="input min-h-12 flex-1" rows={2} placeholder="Scrivi al coach…" value={testo} onChange={(e) => setTesto(e.target.value)} />
          <button className="rounded-xl bg-cyan-500/25 px-4 font-bold text-cyan-200 disabled:opacity-40" disabled={attesa || !testo.trim()} onClick={() => { const t = testo.trim(); setTesto(''); void invia(kind, t) }}>Invia</button>
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

function Bolla({ m, ultimo, attesa, haPiano, onOpzione, onAccetta }: {
  m: MessaggioCoach; ultimo: boolean; attesa: boolean; haPiano: boolean
  onOpzione: (o: string) => void; onAccetta: (meta: MetaCoach) => void
}) {
  const meta = (m.meta ?? {}) as MetaCoach
  if (m.role === 'utente') return <p className={`ml-10 rounded-2xl rounded-br-sm p-3 text-sm ${meta.accettato ? 'bg-emerald-500/15 text-emerald-200' : 'bg-cyan-500/15 text-chalk'}`}>{m.content}</p>
  const proposta = !!meta.piano || !!meta.calorie || !!meta.controllo
  const bloccato = !!meta.esito?.errori.length
  const etichetta = meta.piano ? (haPiano ? 'Accetta le modifiche' : 'Accetta il piano') : meta.controllo ? 'Salva il controllo' : `Passa a ${meta.calorie} kcal`
  return (
    <div className="mr-6 space-y-2">
      <p className="whitespace-pre-line rounded-2xl rounded-bl-sm border border-edge bg-steel/60 p-3 text-sm leading-relaxed text-chalk">{m.content}</p>
      {proposta && (
        <div className="rounded-2xl border border-cyan-500/40 p-3 space-y-3">
          {meta.differenze && (
            <div>
              <p className="field-label">Cosa cambia</p>
              <ul className="space-y-1 text-[12px] text-chalk">{meta.differenze.map((d, i) => <li key={i}>• {d}</li>)}</ul>
            </div>
          )}
          {meta.piano && <><p className="font-display text-sm font-bold uppercase">{haPiano ? 'Piano aggiornato' : 'Proposta'}: {meta.piano.titolo}</p><Sedute plan={meta.piano} /></>}
          {meta.calorie && !meta.piano && <p className="text-sm text-chalk">Nuove calorie proposte: <span className="font-data">{meta.calorie} kcal</span> (il volume della scheda seguirà dopo una settimana).</p>}
          {meta.controllo && <p className="text-[12px] text-slate2">Il controllo verrà salvato nello storico della tua cartella.</p>}
          {meta.esito && meta.esito.errori.length > 0 && <ul className="space-y-1 text-[12px] text-red-300">{meta.esito.errori.map((e, i) => <li key={i}>✕ {e}</li>)}</ul>}
          {meta.esito && meta.esito.avvisi.length > 0 && <ul className="space-y-1 text-[12px] text-amber2">{meta.esito.avvisi.map((e, i) => <li key={i}>! {e}</li>)}</ul>}
          {meta.esito && <TabellaVolume esito={meta.esito} />}
          {ultimo && <button className="btn" disabled={attesa || bloccato} onClick={() => onAccetta(meta)}>{bloccato ? 'Il coach deve correggere gli errori' : etichetta}</button>}
          {ultimo && <p className="text-[11px] text-slate2">Vuoi cambiare qualcosa? Scrivilo qui sotto.</p>}
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
