import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useWorkout } from '../features/workout/WorkoutContext'
import { salvaAllenamento } from '../lib/api'
import { findExerciseReplacement } from '../engine/replacement'
import { recordExerciseFeedback } from '../engine/feedback'
import { EXPERIENCE_LABELS, GOAL_LABELS, MODE_LABELS, MUSCLE_LABELS, SPLIT_LABELS, type ExerciseFeedbackReason, type WorkoutBlock } from '../types'

export default function WorkoutPreview() {
  const { user } = useAuth()
  const { workout, setWorkout, generationConfig, setGenerationConfig, catalog, weeklyProgram, setWeeklyProgram, rejectedExerciseIds, rejectExercise } = useWorkout()
  const naviga = useNavigate()
  const [stato, setStato] = useState<'fermo' | 'salvo' | 'salvato' | 'errore'>('fermo')
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [feedbackTarget, setFeedbackTarget] = useState<{ block: number; exercise: number } | null>(null)

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

  const riscaldamento = workout.blocks.find((b) => b.kind === 'warmup')
  const principale = workout.blocks.find((b) => b.kind === 'main')
  const metcon = workout.blocks.find((b) => b.kind === 'metcon')

  function cambiaEsercizio(blockIndex: number, exerciseIndex: number, reason: ExerciseFeedbackReason, permanent: boolean) {
    if (!workout || !generationConfig || !user) return
    const current = workout.blocks[blockIndex].exercises[exerciseIndex]
    const original = catalog.find((exercise) => exercise.id === current.exercise_id)
    if (!original) return
    rejectExercise(original.id)
    const adaptive = recordExerciseFeedback(user.id, original, reason, permanent)
    const available = reason === 'unavailable'
      ? generationConfig.equipment.available.filter((item) => !original.required_equipment.includes(item))
      : generationConfig.equipment.available
    const equipment = { ...generationConfig.equipment, available }
    const used = new Set(workout.blocks.flatMap((block) => block.exercises.map((exercise) => exercise.exercise_id)))
    const replacement = findExerciseReplacement(current, catalog, equipment, {
      excludedExerciseIds: generationConfig.preferences.excluded_exercise_ids,
      bodyweightPolicy: generationConfig.preferences.bodyweight_policy,
      elasticPolicy: generationConfig.preferences.elastic_policy,
    }, used, { reason, rejectedIds: new Set([...rejectedExerciseIds, original.id]), adaptivePreferences: adaptive, experience: generationConfig.experience, preferredIds: new Set(generationConfig.preferences.preferred_exercise_ids) })
    if (!replacement) { setMessaggio('Nessuna alternativa compatibile disponibile.'); return }
    const blocks = workout.blocks.map((block, index) => index !== blockIndex ? block : {
      ...block, exercises: block.exercises.map((exercise, itemIndex) => itemIndex !== exerciseIndex ? exercise : {
        ...exercise, exercise_id: replacement.id, name: replacement.name,
        muscle: replacement.primary_muscles[0] ?? null, instructions: replacement.instructions,
      }),
    })
    setWorkout({ ...workout, blocks })
    const excluded = permanent || reason === 'discomfort' ? [...new Set([...generationConfig.preferences.excluded_exercise_ids, original.id])] : generationConfig.preferences.excluded_exercise_ids
    const nextConfig = { ...generationConfig, equipment, preferences: { ...generationConfig.preferences, excluded_exercise_ids: excluded } }
    setGenerationConfig(nextConfig)
    if (weeklyProgram) setWeeklyProgram({ ...weeklyProgram, config: { ...weeklyProgram.config, equipment, preferences: { ...weeklyProgram.config.preferences, excluded_exercise_ids: excluded } } })
    setFeedbackTarget(null)
    setMessaggio(reason === 'discomfort' ? `${current.name} sostituito con ${replacement.name}. Se il dolore persiste, interrompi l’esercizio e valuta un professionista qualificato.` : `${current.name} sostituito con ${replacement.name}. Il resto del workout non è cambiato.`)
  }

  async function salva() {
    if (!user || !workout) return
    setStato('salvo')
    try {
      await salvaAllenamento(user.id, workout, undefined, generationConfig)
      setStato('salvato')
      setMessaggio('Lo trovi in Salvati.')
    } catch (e) {
      setStato('errore')
      setMessaggio(e instanceof Error ? e.message : 'Non salvato.')
    }
  }

  return (
    <div className="px-5 pt-12 pb-8">
      <p className="eyebrow mb-2">{EXPERIENCE_LABELS[workout.experience]} · {GOAL_LABELS[workout.goal]}</p>
      <h1 className="font-display font-extrabold uppercase leading-[0.9] tracking-tight text-[2.4rem]">
        {workout.split ? SPLIT_LABELS[workout.split] : MODE_LABELS[workout.mode]}
      </h1>

      <div className="mt-4 flex flex-wrap items-baseline gap-6 font-data">
        <span>
          <span className="text-3xl">{workout.duration_min}</span>
          <span className="text-slate2 text-[13px]"> min</span>
        </span>
        <span><span className="text-3xl">{workout.max_duration_min ?? Math.ceil(workout.duration_min * 1.15)}</span><span className="text-slate2 text-[13px]"> min max</span></span>
        <span>
          <span className="text-3xl">{(principale?.exercises.length ?? 0) + (metcon?.exercises.length ?? 0)}</span>
          <span className="text-slate2 text-[13px]"> esercizi</span>
        </span>
        {!!workout.est_kcal && (
          <span>
            <span className="text-3xl">~{workout.est_kcal}</span>
            <span className="text-slate2 text-[13px]"> kcal stimate</span>
          </span>
        )}
      </div>

      {workout.warnings.map((w, i) => (
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
          <h2 className="field-label">
            {workout.mode === 'crossfit' ? 'Forza/Skill' : workout.mode === 'crossfit_hybrid' ? 'Forza + Cardio' : 'Allenamento'}
          </h2>
          <ol className="space-y-2.5">
            {principale.exercises.map((e, i) => (
              <li key={i} className="slab !py-3.5">
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
                </div>
                {e.muscle && (
                  <p className="mt-1.5 pl-7 font-data text-[10px] uppercase tracking-[0.12em] text-slate2">
                    {MUSCLE_LABELS[e.muscle]}
                  </p>
                )}
                {e.instructions && (
                  <p className="mt-1.5 pl-7 text-[12px] text-slate2 leading-relaxed">{e.instructions}</p>
                )}
                <button className="mt-3 pl-7 font-data text-[10px] uppercase tracking-wider text-amber2" onClick={() => setFeedbackTarget({ block: workout.blocks.indexOf(principale), exercise: i })}>↻ Sostituisci</button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Metcon */}
      {metcon && metcon.exercises.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="field-label !mb-0">{metcon.title}</h2>
            <span className="font-data text-[11px] text-slate2">{sottotitoloMetcon(metcon)}</span>
          </div>
          <ol className="mt-3 space-y-2.5">
            {metcon.exercises.map((e, i) => (
              <li key={i} className="slab !py-3.5">
                <div className="flex items-baseline gap-3">
                  <span className="font-data text-[13px] text-slate2 w-4 shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[15px] leading-snug">{e.name}</p>
                    <p className="mt-1 text-chalk font-data text-[15px]">
                      {e.reps}{e.note ? <span className="text-slate2 text-[12px]"> · {e.note}</span> : null}
                    </p>
                  </div>
                </div>
                {e.instructions && (
                  <p className="mt-1.5 pl-7 text-[12px] text-slate2 leading-relaxed">{e.instructions}</p>
                )}
                <button className="mt-3 pl-7 font-data text-[10px] uppercase tracking-wider text-amber2" onClick={() => setFeedbackTarget({ block: workout.blocks.indexOf(metcon), exercise: i })}>↻ Sostituisci</button>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[12px] text-slate2">{descrizioneMetcon(metcon)}</p>
        </section>
      )}

      {messaggio && (
        <p className={`mt-6 text-[13px] ${stato === 'errore' ? 'text-amber2' : 'text-slate2'}`} role="status">
          {messaggio}
        </p>
      )}
      {feedbackTarget ? <FeedbackPanel exerciseName={workout.blocks[feedbackTarget.block].exercises[feedbackTarget.exercise].name} onCancel={() => setFeedbackTarget(null)} onSubmit={(reason, permanent) => cambiaEsercizio(feedbackTarget.block, feedbackTarget.exercise, reason, permanent)} /> : null}

      {/* Azioni */}
      <div className="mt-8 space-y-2.5">
        <button className="btn !py-4 text-lg" onClick={() => naviga('/avvia')}>
          Inizia
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            className="rounded-xl border border-edge bg-steel py-3.5 font-data text-[11px] uppercase tracking-[0.14em] text-chalk active:bg-edge disabled:opacity-40"
            onClick={salva}
            disabled={stato === 'salvo' || stato === 'salvato'}
          >
            {stato === 'salvato' ? 'Salvato' : 'Salva'}
          </button>
          <button
            className="rounded-xl border border-edge bg-steel py-3.5 font-data text-[11px] uppercase tracking-[0.14em] text-chalk active:bg-edge"
            onClick={() => naviga('/')}
          >
            Torna alla settimana
          </button>
        </div>
      </div>
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

export function formattaRec(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`
}

function sottotitoloMetcon(m: WorkoutBlock): string {
  switch (m.format) {
    case 'amrap': return `${m.time_cap_min} min · quanti giri fai`
    case 'for_time': return `cap ${m.time_cap_min} min · il tempo è il punteggio`
    case 'rounds': return `${m.rounds} giri`
    case 'circuit': return `${m.rounds} giri`
    case 'emom': return `${m.rounds} min`
    case 'intervals': return `${m.interval_sec}″ lavoro`
    case 'tabata': return `${m.rounds}×20″/10″`
    default: return ''
  }
}

function descrizioneMetcon(m: WorkoutBlock): string {
  switch (m.format) {
    case 'amrap': return 'Ripeti il giro finché non finisce il tempo: quanti giri completi è il tuo punteggio.'
    case 'for_time': return 'Fai tutto il volume prescritto il più velocemente possibile, entro il tempo massimo.'
    case 'rounds': return 'Completa tutti i giri, riposando il necessario fra uno e l\'altro: il tempo totale è il tuo punteggio.'
    case 'circuit': return 'Un esercizio dopo l\'altro con recupero fisso, ripetuto per i giri indicati.'
    case 'emom': return 'Un compito ogni minuto, sul minuto: quello che avanza del minuto è il tuo riposo.'
    case 'intervals': return 'Lavoro e riposo si alternano a intervalli fissi, a ripetere per tutti i round.'
    case 'tabata': return 'Un movimento alla volta: 8 round di 20″ lavoro e 10″ riposo, poi il prossimo.'
    default: return ''
  }
}
