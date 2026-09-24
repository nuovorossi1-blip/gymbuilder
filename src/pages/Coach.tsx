/**
 * Coach (Fase 3, 25/09): primo colloquio in chat, proposta di piano verificata dal codice,
 * piano attivo a rotazione ("fai la prossima"). I controlli periodici e "Parla col coach" in
 * qualsiasi momento arrivano con la Fase 4.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useSettings } from '../features/profile/useSettings'
import { useCartella } from '../features/cartella/useCartella'
import { useCoach, type MessaggioCoach } from '../features/coach/useCoach'
import { useWorkout } from '../features/workout/WorkoutContext'
import { controllaPiano, normalizzaPiano, sedutaComeWorkout, type CoachPlan, type EsitoControlli } from '../features/coach/plan'
import { leggiRispostaCoach, messaggioContesto, promptSistemaColloquio, unisciCartella } from '../features/coach/prompt'
import { vietatiDallaCartella } from '../features/cartella/cartella'
import { CARTELLA_VUOTA } from '../features/cartella/types'
import { chiediJsonAlLlm, type LlmMessage } from '../lib/deepseek'
import { caricaCatalogo } from '../lib/api'
import { determinaFase, escludiPerFastidi, patchCambioCalorie } from '../engine/nutrition'
import { isExerciseAvailable } from '../generators/equipment'
import { MUSCLE_LABELS, type Exercise } from '../types'

function TabellaVolume({ esito }: { esito: EsitoControlli }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left font-data text-[12px]">
        <thead className="text-slate-400"><tr><th className="py-1 pr-2 font-normal">Muscolo</th><th className="py-1 px-1 text-center font-normal">Serie/sett</th><th className="py-1 pl-1 text-center font-normal">Volte/sett</th></tr></thead>
        <tbody>
          {esito.volume.map((r) => (
            <tr key={r.muscolo} className="border-t border-edge/60">
              <td className="py-1 pr-2">{MUSCLE_LABELS[r.muscolo]}{r.carenza && <span className="ml-1 text-amber-300">★</span>}</td>
              <td className="py-1 px-1 text-center">{r.serie}</td>
              <td className="py-1 pl-1 text-center">{r.frequenza}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

export default function Coach() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile, calorieLog, settings, saveProfile } = useSettings(user?.id)
  const { cartella, salva: salvaCartella } = useCartella(user?.id)
  const { messaggi, piano, aggiungi, cancellaConversazione, accettaPiano, impostaProssima } = useCoach(user?.id)
  const { catalog: ctxCatalog, setCatalog, setWorkout, setGenerationConfig } = useWorkout()
  const [catalogo, setCatalogo] = useState<Exercise[]>(ctxCatalog ?? [])
  const [testo, setTesto] = useState('')
  const [attesa, setAttesa] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [nuovoColloquio, setNuovoColloquio] = useState(false)
  const fondo = useRef<HTMLDivElement>(null)
  const fase = determinaFase(profile, calorieLog)

  useEffect(() => {
    if (catalogo.length) return
    caricaCatalogo().then((items) => { setCatalogo(items); setCatalog(items) }).catch(() => setErrore('Catalogo non caricato.'))
  }, [catalogo.length, setCatalog])
  useEffect(() => { fondo.current?.scrollIntoView({ behavior: 'smooth' }) }, [messaggi, attesa])

  // Catalogo che il coach può usare: attrezzatura, fastidi e vietati della cartella già tolti.
  const catalogoCoach = useMemo(() => {
    const vietati = new Set(vietatiDallaCartella(cartella, catalogo))
    const disponibili = catalogo.filter((e) => !vietati.has(e.id) && isExerciseAvailable(e, settings?.equipment ?? 'full_gym', settings?.available_equipment ?? null))
    return escludiPerFastidi(disponibili, profile?.joint_issues)
  }, [catalogo, cartella, settings, profile])
  const ctxControlli = { catalog: catalogo, cartella, fastidi: profile?.joint_issues ?? [], phase: fase?.training_phase ?? null }

  const colloquio = (messaggi ?? []).filter((m) => m.kind === 'colloquio')
  const mostraChat = !piano || nuovoColloquio

  // Nella storia per l'LLM la risposta del coach include il piano che aveva proposto: serve per
  // correggerlo o modificarlo senza riscriverlo da zero.
  const perLlm = (m: MessaggioCoach): LlmMessage => {
    if (m.role === 'utente') return { role: 'user', content: m.content }
    const piano = (m.meta as { piano?: unknown } | null)?.piano
    return { role: 'assistant', content: piano ? `${m.content}\n[PIANO PROPOSTO] ${JSON.stringify(piano)}` : m.content }
  }

  async function invia(contenuto: string, nascosto = false, tentativoCorrezione = false, storiaBase?: MessaggioCoach[]) {
    if (!cartella || (attesa && !tentativoCorrezione)) return
    setErrore(null); setAttesa(true)
    try {
      const base = storiaBase ?? colloquio
      const mio = await aggiungi({ role: 'utente', kind: 'colloquio', content: contenuto, meta: nascosto ? { nascosto: true } : null })
      const risposta = leggiRispostaCoach(await chiediJsonAlLlm([
        { role: 'system', content: promptSistemaColloquio() },
        { role: 'user', content: `CONTESTO DEL CLIENTE (leggilo prima di tutto): ${messaggioContesto({ profile, fase, cartella: cartella ?? CARTELLA_VUOTA, catalogo: catalogoCoach })}` },
        ...[...base, mio].map(perLlm),
      ]))
      if (risposta.aggiorna_cartella) await salvaCartella(unisciCartella(cartella, risposta.aggiorna_cartella, catalogo))
      const plan = risposta.piano ? normalizzaPiano(risposta.piano, catalogo) : null
      const esito = plan ? controllaPiano(plan, ctxControlli) : null
      const suo = await aggiungi({ role: 'coach', kind: 'colloquio', content: risposta.messaggio, meta: { opzioni: risposta.opzioni, categoria: risposta.categoria, piano: plan, esito } })
      if (plan && esito && esito.errori.length && !tentativoCorrezione) {
        // Il codice ha trovato errori: il coach li corregge da solo una volta, prima di mostrarli.
        await invia(`Il controllo dell'app ha trovato questi errori nel piano: ${esito.errori.join(' ')} Correggili e rimanda il piano intero.`, true, true, [...base, mio, suo])
      }
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Il coach non ha risposto.')
    } finally {
      setAttesa(false)
    }
  }

  async function accetta(plan: CoachPlan) {
    try {
      await accettaPiano(plan, 'colloquio')
      if (cartella && (plan.macro.proteine_g || plan.macro.grassi_g || plan.macro.carboidrati_g)) await salvaCartella({ ...cartella, macro: plan.macro })
      if (profile && plan.calorie && plan.calorie !== profile.daily_kcal) await saveProfile(patchCambioCalorie(profile, plan.calorie))
      setNuovoColloquio(false)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Piano non salvato.')
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

  if (messaggi === null || piano === undefined || !cartella) return <main className="px-5 pt-12"><p className="text-slate2">Carico il Coach…</p></main>

  if (!mostraChat && piano) {
    const esito = controllaPiano(piano.plan, ctxControlli)
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
        {piano.plan.note && <p className="mt-3 rounded-xl border border-edge bg-steel/50 p-3 text-[13px] leading-relaxed text-chalk">{piano.plan.note}</p>}
        <div className="mt-5"><Sedute plan={piano.plan} prossima={piano.next_index} onInizia={inizia} /></div>
        <h2 className="mt-8 field-label">Volume settimanale (calcolato dall'app)</h2>
        <TabellaVolume esito={esito} />
        {esito.avvisi.length > 0 && <ul className="mt-3 space-y-1 text-[12px] text-amber2">{esito.avvisi.map((a, i) => <li key={i}>{a}</li>)}</ul>}
        <div className="mt-8 space-y-2">
          <p className="rounded-xl border border-dashed border-edge p-3 text-xs text-slate2">"Parla col coach" e i controlli ogni 4 settimane arrivano con la prossima fase.</p>
          <button className="w-full rounded-xl border border-edge py-3 text-sm text-slate2" onClick={() => { if (confirm('Rifare il primo colloquio? Il piano attuale resta valido finché non ne accetti uno nuovo.')) { void cancellaConversazione('colloquio'); setNuovoColloquio(true) } }}>
            Rifai il colloquio da capo
          </button>
        </div>
      </main>
    )
  }

  const visibili = colloquio.filter((m) => !(m.meta as { nascosto?: boolean } | null)?.nascosto)
  const ultimo = visibili[visibili.length - 1]
  return (
    <main className="flex min-h-dvh flex-col px-4 pb-40 pt-8">
      <button className="self-start font-data text-xs text-slate2" onClick={() => (piano ? setNuovoColloquio(false) : navigate('/'))}>← Indietro</button>
      <h1 className="mt-3 font-display text-[1.8rem] font-extrabold uppercase leading-none">Il tuo Coach</h1>
      <p className="mt-2 text-sm text-slate2">Primo colloquio: una domanda alla volta, poi il piano su misura. Il coach aggiorna la tua cartella mentre parlate.</p>

      <div className="mt-5 flex-1 space-y-3">
        {visibili.length === 0 && (
          <button className="btn" disabled={attesa || !catalogo.length} onClick={() => { void invia('Ciao, iniziamo il colloquio.') }}>Inizia il colloquio</button>
        )}
        {visibili.map((m) => <Bolla key={m.id} m={m} ultimo={m === ultimo} attesa={attesa} onOpzione={(o) => { void invia(o) }} onAccetta={(p) => { void accetta(p) }} />)}
        {attesa && <p className="text-sm text-slate2" role="status">Il coach sta scrivendo…</p>}
        {errore && <p className="text-sm text-amber2" role="alert">{errore}</p>}
        <div ref={fondo} />
      </div>

      {visibili.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-10 mx-auto flex max-w-lg gap-2 bg-ink/95 px-4 py-2">
          <textarea className="input min-h-12 flex-1" rows={2} placeholder="Rispondi al coach…" value={testo} onChange={(e) => setTesto(e.target.value)} />
          <button className="rounded-xl bg-cyan-500/25 px-4 font-bold text-cyan-200 disabled:opacity-40" disabled={attesa || !testo.trim()} onClick={() => { const t = testo.trim(); setTesto(''); void invia(t) }}>Invia</button>
        </div>
      )}
    </main>
  )
}

function Bolla({ m, ultimo, attesa, onOpzione, onAccetta }: { m: MessaggioCoach; ultimo: boolean; attesa: boolean; onOpzione: (o: string) => void; onAccetta: (p: CoachPlan) => void }) {
  const meta = (m.meta ?? {}) as { opzioni?: string[]; piano?: CoachPlan | null; esito?: EsitoControlli | null }
  if (m.role === 'utente') return <p className="ml-10 rounded-2xl rounded-br-sm bg-cyan-500/15 p-3 text-sm text-chalk">{m.content}</p>
  return (
    <div className="mr-6 space-y-2">
      <p className="whitespace-pre-line rounded-2xl rounded-bl-sm border border-edge bg-steel/60 p-3 text-sm leading-relaxed text-chalk">{m.content}</p>
      {meta.piano && meta.esito && (
        <div className="rounded-2xl border border-cyan-500/40 p-3 space-y-3">
          <p className="font-display text-sm font-bold uppercase">Proposta: {meta.piano.titolo}</p>
          <Sedute plan={meta.piano} />
          {meta.esito.errori.length > 0 && <ul className="space-y-1 text-[12px] text-red-300">{meta.esito.errori.map((e, i) => <li key={i}>✕ {e}</li>)}</ul>}
          {meta.esito.avvisi.length > 0 && <ul className="space-y-1 text-[12px] text-amber2">{meta.esito.avvisi.map((e, i) => <li key={i}>! {e}</li>)}</ul>}
          <TabellaVolume esito={meta.esito} />
          {ultimo && (
            <button className="btn" disabled={attesa || meta.esito.errori.length > 0} onClick={() => onAccetta(meta.piano!)}>
              {meta.esito.errori.length ? 'Il coach deve correggere gli errori' : 'Accetta il piano'}
            </button>
          )}
          {ultimo && <p className="text-[11px] text-slate2">Vuoi cambiare qualcosa? Scrivilo qui sotto: il coach rimanda il piano corretto.</p>}
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
