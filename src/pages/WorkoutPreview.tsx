import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { metconInstruction, metconSubtitle } from '../engine/metconInstructions'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useWorkout } from '../features/workout/WorkoutContext'
import { aggiornaProgramma, salvaAllenamento } from '../lib/api'
import { findExerciseReplacements, type ReplacementCandidate } from '../engine/replacement'
import { recordExerciseFeedback } from '../engine/feedback'
import {
  EXPERIENCE_LABELS, GOAL_LABELS, isLaggingNote, MODE_LABELS, MUSCLE_LABELS, SPLIT_LABELS,
  type Exercise, type ExerciseFeedbackReason, type Gear, type GeneratedWorkout, type PrescribedExercise, type WeeklyProgram, type WeeklyProgramConfig,
} from '../types'

export default function WorkoutPreview() {
  const { user } = useAuth()
  const { workout, setWorkout, generationConfig, setGenerationConfig, catalog, weeklyProgram, setWeeklyProgram, startWorkoutSession, rejectedExerciseIds, rejectExercise } = useWorkout()
  const naviga = useNavigate()
  const [stato, setStato] = useState<'fermo' | 'salvo' | 'salvato' | 'errore'>('fermo')
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [feedbackTarget, setFeedbackTarget] = useState<{ block: number; exercise: number } | null>(null)
  // Passo 2 dello swap: valorizzato solo dopo che l'utente ha scelto il motivo (avviaSostituzione),
  // mostra la lista di alternative raggruppate per attrezzatura invece di applicare la prima trovata.
  const [swapReason, setSwapReason] = useState<{ reason: ExerciseFeedbackReason; permanent: boolean } | null>(null)
  // Modifiche non ancora salvate (riordino via drag): finche' non si conferma, la lista mostrata
  // (displayed) riflette il riordino ma workout/weeklyProgram restano quelli confermati - da qui
  // il pulsante Salva/Annulla che compare solo quando c'e' un pendingWorkout.
  const [pendingWorkout, setPendingWorkout] = useState<GeneratedWorkout | null>(null)
  const exerciseKey = useStableKeys<PrescribedExercise>()

  if (!workout) {
    return (
      <div className="px-5 pt-12">
        <h1 className="font-display font-extrabold uppercase text-3xl tracking-tight">
          Nessun allenamento
        </h1>
        <p className="mt-3 text-slate2 text-[15px]">Torna indietro e generane uno.</p>
        <button className="btn mt-6" onClick={() => naviga('/')}>
          Vai a Crea
        </button>
      </div>
    )
  }

  const displayed = pendingWorkout ?? workout
  const riscaldamento = displayed.blocks.find((b) => b.kind === 'warmup')
  const principale = displayed.blocks.find((b) => b.kind === 'main')
  const metcon = displayed.blocks.find((b) => b.kind === 'metcon')

  // Unico punto di scrittura per un workout confermato: aggiorna la sessione attiva e, se il
  // workout appartiene a una seduta di un WeeklyProgram (session_id), congela anche li' il nuovo
  // ordine/contenuto cosi' riaprendo quel giorno in futuro si ritrova la modifica invece di
  // perderla (prima di questo, ne' il riordino ne' una sostituzione sopravvivevano alla riapertura
  // del giorno). Un eventuale configPatch aggiorna insieme le preferenze globali del programma.
  async function persistWorkout(next: GeneratedWorkout, configPatch?: Partial<WeeklyProgramConfig>) {
    setWorkout(next)
    setPendingWorkout(null)
    if (!weeklyProgram) return
    const belongsToSession = !!next.session_id && weeklyProgram.week.some((s) => s.id === next.session_id)
    const week = belongsToSession
      ? weeklyProgram.week.map((s) => (s.id === next.session_id ? { ...s, generated_workout: next } : s))
      : weeklyProgram.week
    const config = configPatch ? { ...weeklyProgram.config, ...configPatch } : weeklyProgram.config
    if (week === weeklyProgram.week && config === weeklyProgram.config) return
    const updated: WeeklyProgram = { ...weeklyProgram, week, config }
    setWeeklyProgram(updated)
    if (user && updated.persisted) {
      try { await aggiornaProgramma(user.id, updated) } catch (reason) {
        setMessaggio(reason instanceof Error ? reason.message : 'Modifica salvata solo su questo dispositivo: sincronizzazione fallita.')
      }
    }
  }

  function reorderBlock(kind: 'main' | 'metcon', from: number, to: number) {
    if (from === to) return
    setPendingWorkout((current) => {
      const base = current ?? workout
      if (!base) return current
      return {
        ...base,
        blocks: base.blocks.map((block) => {
          if (block.kind !== kind) return block
          const exercises = [...block.exercises]
          const [moved] = exercises.splice(from, 1)
          exercises.splice(to, 0, moved)
          return { ...block, exercises }
        }),
      }
    })
  }

  /** Passo 1 -> 2: il motivo è già una decisione reale (registra il feedback adattivo e
   *  esclude temporaneamente l'esercizio), ma non applica ancora nulla — apre la lista di
   *  alternative fra cui l'utente sceglie (sez. Smart Exercise Swap). */
  function avviaSostituzione(reason: ExerciseFeedbackReason, permanent: boolean) {
    if (!feedbackTarget || !user) return
    const current = displayed.blocks[feedbackTarget.block].exercises[feedbackTarget.exercise]
    const original = catalog.find((exercise) => exercise.id === current.exercise_id)
    if (!original) return
    rejectExercise(original.id)
    recordExerciseFeedback(user.id, original, reason, permanent)
    setSwapReason({ reason, permanent })
  }

  /** Candidati per il passo 2, raggruppabili per attrezzatura in UI: stessa logica di prima
   *  (motivo, attrezzatura disponibile, esclusi, apprendimento adattivo) ma restituisce la
   *  lista intera (findExerciseReplacements) invece di applicare subito il primo risultato. */
  function candidatiSostituzione(): ReplacementCandidate[] {
    if (!feedbackTarget || !generationConfig || !swapReason || !user) return []
    const current = displayed.blocks[feedbackTarget.block].exercises[feedbackTarget.exercise]
    const original = catalog.find((exercise) => exercise.id === current.exercise_id)
    if (!original) return []
    const { reason } = swapReason
    const available = reason === 'unavailable'
      ? generationConfig.equipment.available.filter((item) => !original.required_equipment.includes(item))
      : generationConfig.equipment.available
    const equipment = { ...generationConfig.equipment, available }
    const used = new Set(displayed.blocks.flatMap((block) => block.exercises.map((exercise) => exercise.exercise_id)))
    const adaptive = recordExerciseFeedback(user.id, original, reason, swapReason.permanent)
    return findExerciseReplacements(current, catalog, equipment, {
      excludedExerciseIds: generationConfig.preferences.excluded_exercise_ids,
    }, used, { reason, rejectedIds: new Set([...rejectedExerciseIds, original.id]), adaptivePreferences: adaptive, experience: generationConfig.experience, preferredIds: new Set(generationConfig.preferences.preferred_exercise_ids), split: generationConfig.current_day })
  }

  /** Passo 2: applica l'alternativa scelta dall'utente. Serie/ripetizioni/recupero non
   *  cambiano — restano quelle già prescritte, solo l'identità dell'esercizio cambia. */
  function applicaSostituzione(replacement: Exercise) {
    if (!feedbackTarget || !generationConfig || !swapReason) return
    const { block: blockIndex, exercise: exerciseIndex } = feedbackTarget
    const { reason, permanent } = swapReason
    const current = displayed.blocks[blockIndex].exercises[exerciseIndex]
    const original = catalog.find((exercise) => exercise.id === current.exercise_id)
    if (!original) return
    const available = reason === 'unavailable'
      ? generationConfig.equipment.available.filter((item) => !original.required_equipment.includes(item))
      : generationConfig.equipment.available
    const equipment = { ...generationConfig.equipment, available }
    const blocks = displayed.blocks.map((block, index) => index !== blockIndex ? block : {
      ...block, exercises: block.exercises.map((exercise, itemIndex) => itemIndex !== exerciseIndex ? exercise : {
        ...exercise, exercise_id: replacement.id, name: replacement.name,
        muscle: replacement.primary_muscles[0] ?? null, instructions: replacement.instructions,
      }),
    })
    const excluded = permanent || reason === 'discomfort' ? [...new Set([...generationConfig.preferences.excluded_exercise_ids, original.id])] : generationConfig.preferences.excluded_exercise_ids
    setGenerationConfig({ ...generationConfig, equipment, preferences: { ...generationConfig.preferences, excluded_exercise_ids: excluded } })
    void persistWorkout({ ...displayed, blocks }, { equipment, preferences: { ...generationConfig.preferences, excluded_exercise_ids: excluded } })
    setFeedbackTarget(null)
    setSwapReason(null)
    setMessaggio(reason === 'discomfort' ? `${current.name} sostituito con ${replacement.name}. Se il dolore persiste, interrompi l’esercizio e valuta un professionista qualificato.` : `${current.name} sostituito con ${replacement.name}. Il resto del workout non è cambiato.`)
  }

  function annullaSostituzione() {
    setFeedbackTarget(null)
    setSwapReason(null)
  }

  async function salva() {
    if (!user || !workout) return
    setStato('salvo')
    try {
      await salvaAllenamento(user.id, displayed, undefined, generationConfig)
      setStato('salvato')
      setMessaggio('Lo trovi in Salvati.')
    } catch (e) {
      setStato('errore')
      setMessaggio(e instanceof Error ? e.message : 'Non salvato.')
    }
  }

  return (
    <div className="px-5 pt-12 pb-8">
      {weeklyProgram && weeklyProgram.config.program_kind === 'program' && weeklyProgram.week.length > 1 && (
        <button
          onClick={() => naviga('/crea')}
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-bold uppercase text-cyan-300 hover:text-white"
        >
          ← Torna alla Settimana
        </button>
      )}
      <p className="eyebrow mb-2">{EXPERIENCE_LABELS[displayed.experience]} · {GOAL_LABELS[displayed.goal]}</p>
      <h1 className="font-display font-extrabold uppercase leading-[0.9] tracking-tight text-[2.4rem]">
        {displayed.split ? SPLIT_LABELS[displayed.split] : MODE_LABELS[displayed.mode]}
      </h1>

      <div className="mt-4 flex flex-wrap items-baseline gap-6 font-data">
        <span>
          <span className="text-3xl">{displayed.duration_min}</span>
          <span className="text-slate2 text-[13px]"> min</span>
        </span>
        <span><span className="text-3xl">{displayed.max_duration_min ?? Math.ceil(displayed.duration_min * 1.15)}</span><span className="text-slate2 text-[13px]"> min max</span></span>
        <span>
          <span className="text-3xl">{(principale?.exercises.length ?? 0) + (metcon?.exercises.length ?? 0)}</span>
          <span className="text-slate2 text-[13px]"> esercizi</span>
        </span>
        {!!displayed.est_kcal && (
          <span>
            <span className="text-3xl">~{displayed.est_kcal}</span>
            <span className="text-slate2 text-[13px]"> kcal stimate</span>
          </span>
        )}
      </div>

      {displayed.warnings.map((w, i) => (
        <p key={i} className="mt-4 rounded-lg border border-amber2/40 bg-amber2/10 px-3 py-2.5 text-[13px] text-amber2">
          {w}
        </p>
      ))}

      {/* Riscaldamento */}
      {riscaldamento && riscaldamento.exercises.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="field-label !mb-0">Riscaldamento</h2>
            <span className="font-data text-[11px] text-slate2">{riscaldamento.duration_min} min</span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {riscaldamento.exercises.map((e, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 border-b border-edge/60 pb-1.5">
                <span className="text-[14px] text-slate2">{e.name}</span>
                <span className="font-data text-[12px] whitespace-nowrap">{e.reps}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Allenamento */}
      {principale && principale.exercises.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="field-label !mb-0">
              {displayed.mode === 'crossfit' ? 'Forza/Skill' : displayed.mode === 'crossfit_hybrid' ? 'Forza + Cardio' : 'Allenamento'}
            </h2>
            {principale.exercises.length > 1 && <span className="font-data text-[10px] text-slate2">⠿ trascina per riordinare</span>}
          </div>
          <ReorderableList
            items={principale.exercises}
            getKey={exerciseKey}
            onReorder={(from, to) => reorderBlock('main', from, to)}
            renderItem={(e, i, handle) => (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="font-data text-[13px] text-slate2 w-4 shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[15px] leading-snug">{e.name}</p>
                    <p className="mt-1 flex flex-wrap items-baseline gap-x-3 font-data text-[12px] text-slate2">
                      <span className="text-chalk text-[15px]">
                        {e.sets}<span className="text-slate2 text-[12px]">×</span>{e.reps}
                      </span>
                      <span>recupero {formattaRec(e.rest_sec)}</span>
                    </p>
                  </div>
                  <span className="font-data text-[9px] uppercase tracking-[0.12em] text-slate2 shrink-0">
                    {e.role === 'compound' ? 'base' : e.role === 'metcon' ? 'cardio' : 'isol.'}
                  </span>
                  {handle}
                </div>
                {(e.muscle || isLaggingNote(e.note) || e.note === 'avvicinamento' || e.note === 'top_set' || e.note === 'back_off' || e.note === 'fst7_finisher') && (
                  <p className="mt-1.5 pl-7 flex flex-wrap items-center gap-2 font-data text-[10px] uppercase tracking-[0.12em] text-slate2">
                    {e.muscle && <span>{MUSCLE_LABELS[e.muscle]}</span>}
                    {isLaggingNote(e.note) && (
                      <span className="rounded-full border border-amber2/40 bg-amber2/15 px-2 py-0.5 text-amber2">
                        {e.note?.includes('richiamo') ? 'Richiamo 3x · carenza' : 'Carenza'}
                      </span>
                    )}
                    {e.note === 'avvicinamento' && (
                      <span className="rounded-full border border-slate2/40 bg-slate2/15 px-2 py-0.5 text-slate2">
                        Avvicinamento · carico crescente
                      </span>
                    )}
                    {e.note === 'top_set' && (
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2 py-0.5 text-emerald-300">
                        Top Set · 6-8 rep @ RIR 0
                      </span>
                    )}
                    {e.note === 'back_off' && (
                      <span className="rounded-full border border-cyan-400/40 bg-cyan-400/15 px-2 py-0.5 text-cyan-300">
                        Back-Off · 10-12 rep (-15/20% peso)
                      </span>
                    )}
                    {e.note === 'fst7_finisher' && (
                      <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-400/15 px-2 py-0.5 text-fuchsia-300">
                        FST-7 · 7 serie @ 30s
                      </span>
                    )}
                  </p>
                )}
                {e.instructions && (
                  <p className="mt-1.5 pl-7 text-[12px] text-slate2 leading-relaxed">{e.instructions}</p>
                )}
                <button className="mt-3 pl-7 font-data text-[10px] uppercase tracking-wider text-amber2" onClick={() => setFeedbackTarget({ block: displayed.blocks.indexOf(principale), exercise: i })}>↻ Sostituisci</button>
              </>
            )}
          />
        </section>
      )}

      {/* Metcon */}
      {metcon && metcon.exercises.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="field-label !mb-0">{metcon.title}</h2>
            <span className="font-data text-[11px] text-slate2">{metconSubtitle(metcon)}</span>
          </div>
          <ReorderableList
            className="mt-3 space-y-2.5"
            items={metcon.exercises}
            getKey={exerciseKey}
            onReorder={(from, to) => reorderBlock('metcon', from, to)}
            renderItem={(e, i, handle) => (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="font-data text-[13px] text-slate2 w-4 shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[15px] leading-snug">{e.name}</p>
                    <p className="mt-1 text-chalk font-data text-[15px]">
                      {e.reps}{e.note ? <span className="text-slate2 text-[12px]"> · {e.note}</span> : null}
                    </p>
                  </div>
                  {handle}
                </div>
                {e.instructions && (
                  <p className="mt-1.5 pl-7 text-[12px] text-slate2 leading-relaxed">{e.instructions}</p>
                )}
                <button className="mt-3 pl-7 font-data text-[10px] uppercase tracking-wider text-amber2" onClick={() => setFeedbackTarget({ block: displayed.blocks.indexOf(metcon), exercise: i })}>↻ Sostituisci</button>
              </>
            )}
          />
          <p className="mt-2 text-[12px] leading-relaxed text-slate2">{metconInstruction(metcon)}</p>
        </section>
      )}

      {messaggio && (
        <p className={`mt-6 text-[13px] ${stato === 'errore' ? 'text-amber2' : 'text-slate2'}`} role="status">
          {messaggio}
        </p>
      )}
      {feedbackTarget && !swapReason ? (
        <FeedbackPanel
          exerciseName={displayed.blocks[feedbackTarget.block].exercises[feedbackTarget.exercise].name}
          onCancel={annullaSostituzione}
          onSubmit={avviaSostituzione}
        />
      ) : null}
      {feedbackTarget && swapReason ? (
        <SwapPicker
          exerciseName={displayed.blocks[feedbackTarget.block].exercises[feedbackTarget.exercise].name}
          candidates={candidatiSostituzione()}
          onCancel={annullaSostituzione}
          onPick={applicaSostituzione}
        />
      ) : null}

      {/* Azioni */}
      <div className="mt-8 space-y-2.5">
        <button className="btn !py-4 text-lg" onClick={() => { startWorkoutSession(displayed, generationConfig); naviga('/avvia') }}>
          Inizia
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            className="rounded-xl border border-cyan-500/40 bg-cyan-500/20 py-3.5 font-display text-[12px] font-bold uppercase tracking-[0.14em] text-cyan-300 active:bg-cyan-500/30 disabled:opacity-40"
            onClick={salva}
            disabled={stato === 'salvo' || stato === 'salvato'}
          >
            {stato === 'salvato' ? '✓ Salvato' : '💾 Salva in Libreria'}
          </button>
          <button
            className="rounded-xl border border-edge bg-steel py-3.5 font-data text-[11px] uppercase tracking-[0.14em] text-chalk active:bg-edge"
            onClick={() => naviga('/')}
          >
            Torna alla settimana
          </button>
        </div>
      </div>

      {/* Barra Salva/Annulla riordino */}
      {pendingWorkout && (
        <div className="fixed inset-x-4 bottom-4 z-40 flex items-center gap-2.5 rounded-2xl border border-cyan-500/40 bg-ink/95 p-3 shadow-2xl backdrop-blur">
          <p className="flex-1 text-[12px] text-slate-300">Ordine esercizi modificato</p>
          <button
            className="rounded-xl border border-edge bg-steel px-4 py-2.5 font-data text-[11px] uppercase tracking-wider text-chalk active:bg-edge"
            onClick={() => setPendingWorkout(null)}
          >
            Annulla
          </button>
          <button
            className="rounded-xl bg-cyan-500/90 px-4 py-2.5 font-display text-[11px] font-bold uppercase tracking-wider text-ink active:bg-cyan-400"
            onClick={() => void persistWorkout(pendingWorkout)}
          >
            Salva
          </button>
        </div>
      )}

      {/* Modal Gratificante di Salvataggio */}
      {stato === 'salvato' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-modal-in">
          <div className="w-full max-w-sm rounded-2xl glass-card border border-emerald-500/50 p-6 text-center space-y-4 shadow-2xl glow-emerald">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-3xl border border-emerald-500/40">
              🎉
            </div>
            <div>
              <h2 className="font-display text-xl font-bold uppercase text-white">
                Allenamento Salvato!
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                “{displayed.name}” è stato aggiunto con successo alla tua libreria.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              {weeklyProgram && weeklyProgram.config.program_kind === 'program' && weeklyProgram.week.length > 1 && (
                <button
                  onClick={() => naviga('/crea')}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 font-display text-sm font-bold uppercase text-white shadow-lg glow-cyan"
                >
                  📅 Torna alla Settimana
                </button>
              )}
              <button
                onClick={() => naviga('/salvati')}
                className={`w-full rounded-xl py-3.5 font-display text-sm font-bold uppercase text-white shadow-lg ${
                  weeklyProgram && weeklyProgram.config.program_kind === 'program' && weeklyProgram.week.length > 1
                    ? 'glass-card !text-slate-300 hover:!text-white'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 glow-emerald'
                }`}
              >
                📂 Vai alla Libreria Salvati
              </button>
              <button
                onClick={() => naviga('/')}
                className="w-full rounded-xl glass-card py-3 font-display text-xs font-bold uppercase text-slate-300 hover:text-white"
              >
                🏠 Torna alla Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const FEEDBACK_REASONS: { value: ExerciseFeedbackReason; label: string }[] = [
  { value: 'dislike', label: 'Non mi piace' }, { value: 'unavailable', label: 'Attrezzatura non disponibile' },
  { value: 'too_hard', label: 'Troppo difficile' }, { value: 'too_easy', label: 'Troppo facile' },
  { value: 'discomfort', label: 'Dolore o disagio' }, { value: 'prefer_other', label: 'Preferisco un altro movimento' },
]

function FeedbackPanel({ exerciseName, onCancel, onSubmit }: { exerciseName: string; onCancel: () => void; onSubmit: (reason: ExerciseFeedbackReason, permanent: boolean) => void }) {
  const [reason, setReason] = useState<ExerciseFeedbackReason>('dislike')
  const [permanent, setPermanent] = useState(false)
  return <div className="fixed inset-0 z-40 grid items-end bg-black/70 p-4 sm:items-center"><section role="dialog" aria-modal="true" aria-labelledby="feedback-title" className="mx-auto w-full max-w-md rounded-2xl border border-edge bg-ink p-5"><p className="eyebrow">{exerciseName}</p><h2 id="feedback-title" className="mt-2 font-display text-xl font-bold uppercase">Perché vuoi sostituirlo?</h2><div className="mt-4 space-y-2">{FEEDBACK_REASONS.map((item) => <label key={item.value} className="flex items-center gap-3 rounded-xl border border-edge p-3 text-sm"><input type="radio" name="feedback-reason" checked={reason === item.value} onChange={() => setReason(item.value)} />{item.label}</label>)}</div><label className="mt-4 flex items-start gap-3 text-sm text-slate2"><input className="mt-1" type="checkbox" checked={permanent} onChange={(event) => setPermanent(event.target.checked)} /><span>Non mostrarlo più nelle prossime generazioni.</span></label>{reason === 'discomfort' ? <p className="mt-3 text-xs text-amber2">Non è una diagnosi: se il dolore persiste, interrompi l’esercizio e valuta un professionista qualificato.</p> : null}<div className="mt-5 grid grid-cols-2 gap-2"><button className="rounded-xl border border-edge py-3 text-sm" onClick={onCancel}>Annulla</button><button className="rounded-xl bg-chalk py-3 text-sm font-semibold text-ink" onClick={() => onSubmit(reason, permanent)}>Sostituisci</button></div></section></div>
}

/** Raggruppa le alternative per attrezzatura (sez. Smart Exercise Swap): l'utente vede solo
 *  quello che ha davvero in palestra, non un punteggio astratto. Kettlebell/cardio non compaiono
 *  qui: le alternative bicipiti/tricipiti/spalle che alimentano questo picker non li usano mai. */
const SWAP_EQUIPMENT_GROUPS: { label: string; gear: Gear[] }[] = [
  { label: 'Manubri & Panca', gear: ['dumbbell', 'barbell'] },
  { label: 'Corpo Libero & Sbarra', gear: ['bodyweight'] },
  { label: 'Cavi & Elastici', gear: ['cable'] },
  { label: 'Macchine & Guidati', gear: ['machine'] },
]

function SwapPicker({ exerciseName, candidates, onCancel, onPick }: {
  exerciseName: string
  candidates: ReplacementCandidate[]
  onCancel: () => void
  onPick: (exercise: Exercise) => void
}) {
  const groups = SWAP_EQUIPMENT_GROUPS
    .map((group) => ({ ...group, items: candidates.filter(({ exercise }) => group.gear.includes(exercise.equipment)) }))
    .filter((group) => group.items.length > 0)
  const restanti = candidates.filter(({ exercise }) => !SWAP_EQUIPMENT_GROUPS.some((group) => group.gear.includes(exercise.equipment)))

  return (
    <div className="fixed inset-0 z-40 grid items-end bg-black/70 p-4 sm:items-center">
      <section role="dialog" aria-modal="true" aria-labelledby="swap-title" className="mx-auto w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border border-edge bg-ink p-5">
        <p className="eyebrow">{exerciseName}</p>
        <h2 id="swap-title" className="mt-2 font-display text-xl font-bold uppercase">Con cosa la sostituisci?</h2>
        {candidates.length === 0 ? (
          <p className="mt-4 text-sm text-slate2">Nessuna alternativa compatibile disponibile con questa attrezzatura.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="field-label">{group.label}</p>
                <div className="space-y-2">
                  {group.items.map(({ exercise }) => (
                    <button key={exercise.id} className="slab w-full !py-3" onClick={() => onPick(exercise)}>
                      <p className="text-[14px] font-medium">{exercise.name}</p>
                      {exercise.focus_portion && <p className="mt-0.5 font-data text-[10px] uppercase tracking-[0.1em] text-slate2">stesso angolo di lavoro</p>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {restanti.length > 0 && (
              <div>
                <p className="field-label">Altro</p>
                <div className="space-y-2">
                  {restanti.map(({ exercise }) => (
                    <button key={exercise.id} className="slab w-full !py-3" onClick={() => onPick(exercise)}>
                      <p className="text-[14px] font-medium">{exercise.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <button className="mt-5 w-full rounded-xl border border-edge py-3 text-sm" onClick={onCancel}>Annulla</button>
      </section>
    </div>
  )
}

function formattaRec(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`
}

/** Assegna e ricorda una chiave stabile per ogni oggetto esercizio (per identita', non per indice
 *  o per exercise_id, che puo' ripetersi): un riordino sposta gli stessi oggetti nell'array, cosi'
 *  React riusa gli stessi nodi DOM invece di rimontarli, e il drag in corso (con la relativa
 *  pointer capture) sopravvive al cambio di posizione nella lista. */
function useStableKeys<T extends object>() {
  const map = useRef(new WeakMap<T, string>())
  const counter = useRef(0)
  return (item: T): string => {
    let key = map.current.get(item)
    if (!key) {
      key = `k${counter.current++}`
      map.current.set(item, key)
    }
    return key
  }
}

interface DragState {
  itemKey: string
  index: number
  pointerId: number
  startY: number
  top: number
  left: number
  width: number
  translateY: number
}

/**
 * Lista riordinabile con una maniglia (⠿) dedicata invece del tieni-premuto sull'intera riga: la
 * prima versione (pointerdown ovunque sulla riga + timer di pressione lunga) perdeva quasi sempre
 * il gesto, perche' durante l'attesa la riga aveva ancora touch-action:pan-y e un minimo tremore
 * verticale della mano faceva scattare lo scroll nativo della lista prima del timer, cancellando
 * il puntatore (pointercancel) senza mai attivare il drag. La maniglia ha touch-action:none fin da
 * subito (non solo a drag attivo), quindi il browser non ha mai occasione di intercettare il tocco
 * come scroll: il resto della riga resta scrollabile normalmente. Presa la maniglia, un elemento
 * "fantasma" a position:fixed segue il dito, mentre l'elemento reale (invisibile ma ancora nel
 * flusso) si riordina dal vivo confrontando la posizione Y del puntatore con il punto medio degli
 * altri elementi.
 */
function ReorderableList<T>({
  items,
  getKey,
  onReorder,
  renderItem,
  className = 'space-y-2.5',
}: {
  items: T[]
  getKey: (item: T) => string
  onReorder: (from: number, to: number) => void
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode
  className?: string
}) {
  const containerRef = useRef<HTMLOListElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  function onHandlePointerDown(key: string, index: number, event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const li = event.currentTarget.closest('li')
    if (!li) return
    event.preventDefault()
    const rect = li.getBoundingClientRect()
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* capture opzionale */ }
    setDrag({ itemKey: key, index, pointerId: event.pointerId, startY: event.clientY, top: rect.top, left: rect.left, width: rect.width, translateY: 0 })
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12)
  }

  function onHandlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!drag || event.pointerId !== drag.pointerId) return
    event.preventDefault()
    const translateY = event.clientY - drag.startY
    const container = containerRef.current
    let nextIndex = drag.index
    if (container) {
      const others = Array.from(container.children).filter(
        (child): child is HTMLLIElement => child instanceof HTMLLIElement && child.dataset.dragKey !== drag.itemKey
      )
      nextIndex = others.length
      for (let i = 0; i < others.length; i++) {
        const rect = others[i].getBoundingClientRect()
        if (event.clientY < rect.top + rect.height / 2) { nextIndex = i; break }
      }
    }
    if (nextIndex !== drag.index) onReorder(drag.index, nextIndex)
    setDrag({ ...drag, translateY, index: nextIndex })
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    if (drag && event.pointerId === drag.pointerId) setDrag(null)
  }

  return (
    <ol ref={containerRef} className={`relative ${className}`}>
      {items.map((item, index) => {
        const key = getKey(item)
        const dragging = drag?.itemKey === key
        const handle = (
          <button
            type="button"
            aria-label="Trascina per riordinare"
            className="shrink-0 -m-2 p-2 text-base leading-none text-slate2 active:text-white"
            style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => onHandlePointerDown(key, index, event)}
            onPointerMove={onHandlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            ⠿
          </button>
        )
        return (
          <li key={key} data-drag-key={key} className={`slab !py-3.5 ${dragging ? 'opacity-0' : ''}`}>
            {renderItem(item, index, handle)}
          </li>
        )
      })}
      {drag && items[drag.index] && (
        <li
          className="pointer-events-none fixed z-50 list-none slab !py-3.5"
          style={{
            top: drag.top, left: drag.left, width: drag.width,
            transform: `translateY(${drag.translateY}px) scale(1.02)`,
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
          }}
        >
          {renderItem(items[drag.index], drag.index, null)}
        </li>
      )}
    </ol>
  )
}
