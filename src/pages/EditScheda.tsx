/**
 * "Modifica scheda" (26/09, punto 2 del piano con Rossi): modifiche PERMANENTI.
 *  - /modifica?s=<id>      scheda salvata (Le mie schede, sedute salvate): si aggiorna la scheda;
 *  - /modifica?coach=<i>   seduta i del programma del coach: diventa una nuova versione.
 * Si può cambiare esercizio (prima quelli dello stesso muscolo, poi la ricerca in tutto il
 * catalogo), serie, ripetizioni, RIR, spostare su/giù, togliere e aggiungere.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BackButton } from '../components/BackButton'
import { useAuth } from '../features/auth/AuthProvider'
import { useWorkout } from '../features/workout/WorkoutContext'
import { useSettings } from '../features/profile/useSettings'
import { useCoach } from '../features/coach/useCoach'
import { useCartella } from '../features/cartella/useCartella'
import { differenzePiani, normalizzaPiano, type CoachEsercizio, type CoachPlan } from '../features/coach/plan'
import { confrontaConScheletro, costruisciScheletro } from '../features/coach/scheletro'
import { aggiornaSalvato, caricaCatalogo, elencoSalvati } from '../lib/api'
import { determinaFase, escludiPerFastidi } from '../engine/nutrition'
import { isExerciseAvailable } from '../generators/equipment'
import { MUSCLE_LABELS, type Exercise, type PrescribedExercise, type SavedWorkout } from '../types'

type Riga = CoachEsercizio & { originale?: PrescribedExercise }

const normT = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function Scelta({ catalogo, muscolo, onScegli, onChiudi }: { catalogo: Exercise[]; muscolo?: string | null; onScegli: (e: Exercise) => void; onChiudi: () => void }) {
  const [q, setQ] = useState('')
  const stesso = muscolo ? catalogo.filter((e) => e.primary_muscles[0] === muscolo) : []
  const trovati = q.trim().length >= 2 ? catalogo.filter((e) => normT(e.name).includes(normT(q.trim()))).slice(0, 30) : []
  const Voce = ({ e }: { e: Exercise }) => (
    <li>
      <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-steel" onClick={() => onScegli(e)}>
        {e.name}
        <span className="block text-[11px] text-slate2">{MUSCLE_LABELS[e.primary_muscles[0]]} · {e.roles.includes('compound') ? 'multiarticolare' : 'isolamento'} · {String(e.equipment)}</span>
      </button>
    </li>
  )
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/95 pt-[max(1rem,env(safe-area-inset-top))]" role="dialog" aria-modal="true" aria-label="Scegli l'esercizio">
      <div className="flex items-center gap-2 px-4 pb-2">
        <input autoFocus className="input flex-1" placeholder="Cerca un esercizio…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="rounded-lg px-3 py-2 text-lg text-slate2" aria-label="Chiudi" onClick={onChiudi}>✕</button>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-28">
        {trovati.length > 0 && <li className="px-3 pt-2 text-[11px] uppercase tracking-wider text-slate2">Risultati</li>}
        {trovati.map((e) => <Voce key={`q-${e.id}`} e={e} />)}
        {stesso.length > 0 && <li className="px-3 pt-3 text-[11px] uppercase tracking-wider text-slate2">Stesso muscolo ({MUSCLE_LABELS[stesso[0].primary_muscles[0]]})</li>}
        {stesso.map((e) => <Voce key={`m-${e.id}`} e={e} />)}
        {!trovati.length && !stesso.length && <li className="px-3 py-4 text-sm text-slate2">Scrivi almeno 2 lettere per cercare nel catalogo.</li>}
      </ul>
    </div>
  )
}

export default function EditScheda() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { settings, profile, calorieLog } = useSettings(user?.id)
  const { piano, accettaPiano } = useCoach(user?.id)
  const { cartella } = useCartella(user?.id)
  const { catalog: ctxCatalog, setCatalog } = useWorkout()
  const [catalogo, setCatalogo] = useState<Exercise[]>(ctxCatalog ?? [])
  const [salvata, setSalvata] = useState<SavedWorkout | null>(null)
  const [righe, setRighe] = useState<Riga[] | null>(null)
  const [scelta, setScelta] = useState<{ indice: number | null } | null>(null)
  const [stato, setStato] = useState<'idle' | 'salvo' | 'errore'>('idle')
  const [msg, setMsg] = useState<string | null>(null)
  const idSalvata = params.get('s')
  const iCoach = params.get('coach') !== null ? Number(params.get('coach')) : null

  useEffect(() => {
    if (catalogo.length) return
    caricaCatalogo().then((items) => { setCatalogo(items); setCatalog(items) }).catch(() => undefined)
  }, [catalogo.length, setCatalog])

  // Esercizi sceglibili: attrezzatura della palestra e fastidi articolari del profilo.
  const disponibili = useMemo(() => escludiPerFastidi(
    catalogo.filter((e) => !e.roles.includes('warmup') && isExerciseAvailable(e, settings?.equipment ?? 'full_gym', settings?.available_equipment ?? null)),
    profile?.joint_issues,
  ), [catalogo, settings, profile])

  useEffect(() => {
    if (righe || !user) return
    if (idSalvata) {
      elencoSalvati(user.id).then((lista) => {
        const s = lista.find((x) => x.id === idSalvata)
        if (!s) { setMsg('Scheda non trovata.'); return }
        setSalvata(s)
        const main = s.blocks.filter((b) => b.kind === 'main').flatMap((b) => b.exercises)
        setRighe(main.map((e) => ({ exercise_id: e.exercise_id, nome: e.name, serie: e.sets, reps: e.reps, rir: e.rir ?? '', recupero_sec: e.rest_sec, nota: e.note, tecnica: e.technique, originale: e })))
      }).catch(() => setMsg('Scheda non trovata.'))
    } else if (iCoach !== null && piano) {
      const sd = piano.plan.sedute[iCoach]
      if (!sd) { setMsg('Seduta non trovata.'); return }
      setRighe(sd.esercizi.map((e) => ({ ...e })))
    }
  }, [righe, user, idSalvata, iCoach, piano])

  const byId = useMemo(() => new Map(catalogo.map((e) => [e.id, e])), [catalogo])
  const titolo = salvata?.name ?? (iCoach !== null && piano ? `${piano.plan.sedute[iCoach]?.nome} · ${piano.plan.titolo}` : 'Scheda')

  const set = (i: number, p: Partial<Riga>) => setRighe((r) => r!.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const sposta = (i: number, d: -1 | 1) => setRighe((r) => {
    const a = [...r!]
    const j = i + d
    if (j < 0 || j >= a.length) return a
    ;[a[i], a[j]] = [a[j], a[i]]
    return a
  })

  function scegli(e: Exercise) {
    if (!scelta) return
    const nuova: Riga = { exercise_id: e.id, nome: e.name, serie: 3, reps: e.default_reps ?? '10-12', rir: '1', recupero_sec: e.default_rest ?? 90 }
    setRighe((r) => (scelta.indice === null ? [...r!, nuova] : r!.map((x, j) => (j === scelta.indice ? { ...x, exercise_id: e.id, nome: e.name, originale: undefined } : x))))
    setScelta(null)
  }

  // Per le sedute del coach: la modifica rispetta ancora le regole (scheletro)? Si avvisa, non si blocca.
  const avvisiRegole = useMemo(() => {
    if (iCoach === null || !piano || !cartella || !righe) return []
    const fase = determinaFase(profile, calorieLog)
    const sch = costruisciScheletro({
      giorni: cartella.giorni_settimana ?? piano.plan.giorni_settimana, carenze: cartella.carenze.map((c) => c.muscolo),
      forti: cartella.punti_forti.map((p) => p.muscolo), step: fase?.training_step ?? null,
      prestazioni: cartella.esercizi_da_migliorare.flatMap((e) => { const ex = byId.get(e.exercise_id ?? ''); return ex ? [{ exercise_id: ex.id, nome: ex.name, muscolo: ex.primary_muscles[0], multiarticolare: ex.roles.includes('compound'), unita: e.unita }] : [] }),
    })
    const nome = piano.plan.sedute[iCoach]?.nome
    const plan: CoachPlan = { ...piano.plan, sedute: [{ ...piano.plan.sedute[iCoach], esercizi: righe }] }
    return confrontaConScheletro(plan, { ...sch, sedute: sch.sedute.filter((s) => s.nome === nome) }, catalogo).filter((e) => !e.startsWith('Le sedute devono'))
  }, [iCoach, piano, cartella, righe, profile, calorieLog, byId, catalogo])

  async function salva() {
    if (!righe || !user) return
    if (righe.length === 0) { setMsg('La scheda deve avere almeno un esercizio.'); return }
    if (avvisiRegole.length && !confirm(`La seduta non segue le tue regole in ${avvisiRegole.length} punti. Salvare comunque?`)) return
    setStato('salvo'); setMsg(null)
    try {
      if (salvata) {
        const esercizi: PrescribedExercise[] = righe.map((r) => {
          const ex = byId.get(r.exercise_id)
          const base = r.originale && r.originale.exercise_id === r.exercise_id ? r.originale : undefined
          return {
            ...(base ?? {}),
            exercise_id: r.exercise_id, name: ex?.name ?? r.nome,
            role: base?.role ?? (ex?.roles.includes('compound') ? 'compound' : 'isolation'),
            muscle: base?.muscle ?? ex?.primary_muscles[0] ?? null,
            sets: r.serie, reps: r.reps, rir: r.rir || undefined, rest_sec: r.recupero_sec,
            instructions: base?.instructions ?? ex?.instructions ?? undefined,
          }
        })
        let messo = false
        const blocks = salvata.blocks.flatMap((b) => {
          if (b.kind !== 'main') return [b]
          if (messo) return []
          messo = true
          return [{ ...b, exercises: esercizi }]
        })
        await aggiornaSalvato(salvata.id, { blocks })
      } else if (piano && iCoach !== null) {
        const prima = normalizzaPiano(piano.plan, catalogo) ?? piano.plan
        const dopo: CoachPlan = { ...piano.plan, sedute: piano.plan.sedute.map((sd, j) => (j === iCoach ? { ...sd, esercizi: righe.map((r) => { const copia: Riga = { ...r }; delete copia.originale; return copia }) } : sd)) }
        await accettaPiano(dopo, 'chat', `Modifica manuale: ${differenzePiani(prima, dopo).join(' ')}`)
      }
      navigate(-1)
    } catch (e) {
      setStato('errore'); setMsg(e instanceof Error ? e.message : 'Modifiche non salvate.')
    }
  }

  if (!righe) return <main className="px-5 pt-10"><BackButton />{msg ? <p className="text-amber2">{msg}</p> : <p className="text-slate2">Carico la scheda…</p>}</main>

  return (
    <main className="px-4 pb-48 pt-8">
      <BackButton />
      <p className="eyebrow">Modifica scheda{iCoach !== null ? ' · diventa una nuova versione del programma' : ''}</p>
      <h1 className="mt-1 break-words font-display text-2xl font-extrabold uppercase">{titolo}</h1>
      <ol className="mt-4 space-y-2">
        {righe.map((r, i) => (
          <li key={i} className="rounded-xl border border-edge p-3">
            <div className="flex items-start gap-2">
              <span className="pt-2 font-data text-xs text-slate2">{i + 1}.</span>
              <button className="min-w-0 flex-1 rounded-lg border border-edge px-3 py-2 text-left text-sm" onClick={() => setScelta({ indice: i })} aria-label={`Cambia ${r.nome}`}>
                <span className="block break-words text-chalk">{byId.get(r.exercise_id)?.name ?? r.nome}</span>
                <span className="block text-[11px] text-cyan-300">Tocca per cambiare esercizio</span>
              </button>
              <div className="flex flex-col gap-1">
                <button className="rounded-md border border-edge px-2 text-sm disabled:opacity-30" aria-label="Sposta su" disabled={i === 0} onClick={() => sposta(i, -1)}>↑</button>
                <button className="rounded-md border border-edge px-2 text-sm disabled:opacity-30" aria-label="Sposta giù" disabled={i === righe.length - 1} onClick={() => sposta(i, 1)}>↓</button>
              </div>
              <button className="rounded-md border border-red-500/40 px-2 py-1 text-sm text-red-300" aria-label={`Togli ${r.nome}`} onClick={() => setRighe((x) => x!.filter((_, j) => j !== i))}>🗑</button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className="block"><span className="field-label">Serie</span>
                <input className="input" inputMode="numeric" value={r.serie} onChange={(e) => set(i, { serie: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} />
              </label>
              <label className="block"><span className="field-label">Ripetizioni</span>
                <input className="input" value={r.reps} onChange={(e) => set(i, { reps: e.target.value.slice(0, 20) })} />
              </label>
              <label className="block"><span className="field-label">RIR</span>
                <input className="input" value={r.rir} onChange={(e) => set(i, { rir: e.target.value.slice(0, 10) })} />
              </label>
            </div>
          </li>
        ))}
      </ol>
      <button className="mt-3 w-full rounded-xl border border-dashed border-edge py-3 text-sm text-slate2" onClick={() => setScelta({ indice: null })}>+ Aggiungi esercizio</button>
      {avvisiRegole.length > 0 && (
        <details className="mt-4 rounded-xl border border-amber-400/40">
          <summary className="cursor-pointer px-3 py-2 text-[12px] font-bold text-amber-200">Non segue le tue regole in {avvisiRegole.length} punti</summary>
          <ul className="space-y-1 p-3 text-[12px] text-amber2">{avvisiRegole.map((a, i) => <li key={i}>! {a}</li>)}</ul>
        </details>
      )}
      {msg && <p className="mt-3 text-sm text-amber2" role="alert">{msg}</p>}
      <div className="fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-20 mx-auto max-w-lg px-4">
        <button className="btn shadow-lg" disabled={stato === 'salvo'} onClick={() => { void salva() }}>{stato === 'salvo' ? 'Salvataggio…' : 'Salva le modifiche'}</button>
      </div>
      {scelta && (
        <Scelta
          catalogo={disponibili}
          muscolo={scelta.indice !== null ? byId.get(righe[scelta.indice].exercise_id)?.primary_muscles[0] : null}
          onScegli={scegli}
          onChiudi={() => setScelta(null)}
        />
      )}
    </main>
  )
}
