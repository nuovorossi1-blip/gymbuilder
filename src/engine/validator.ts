import { isExerciseAvailable } from '../generators/equipment'
import { minutiBlocco } from '../generators/shared'
import type { Exercise, GeneratedWorkout, Muscle, Split, WorkoutGenerationConfig } from '../types'

export interface ValidationResult { valid: boolean; errors: string[] }

const SPLIT_PRIMARY_MUSCLES: Record<Split, Muscle[]> = {
  // biceps in push e triceps in pull (sez. spec utente 19/08, "PPL Standard Biomeccanico a 6
  // Slot"): entrambi gli arti si allenano ora in entrambe le sedute, con angoli complementari.
  push: ['chest', 'front_delts', 'lateral_delts', 'triceps', 'biceps'],
  pull: ['back', 'rear_delts', 'biceps', 'forearms', 'triceps'],
  legs: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'],
  upper: ['chest', 'back', 'front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps', 'forearms'],
  lower: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'],
  full_body: ['chest', 'back', 'front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'],
  bro_chest: ['chest', 'front_delts', 'triceps'],
  bro_back: ['back', 'rear_delts', 'biceps'],
  bro_shoulders: ['front_delts', 'lateral_delts', 'rear_delts'],
  bro_arms: ['biceps', 'triceps', 'forearms'],
  bro_legs: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'],
  front_body: ['chest', 'front_delts', 'lateral_delts', 'quads', 'core'],
  back_body: ['back', 'rear_delts', 'biceps', 'hamstrings', 'glutes'],
}

export function validateWorkout(
  workout: GeneratedWorkout,
  config: WorkoutGenerationConfig,
  catalog: Exercise[]
): ValidationResult {
  const errors: string[] = []
  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]))
  const prescribed = workout.blocks.flatMap((block) => block.exercises)
  const trainingExercises = workout.blocks
    .filter((block) => block.kind !== 'warmup')
    .flatMap((block) => block.exercises)
  const ids = new Set<string>()

  if (workout.mode !== config.mode) errors.push('La modalità generata non coincide con la configurazione.')
  if (config.current_day && workout.split !== config.current_day) errors.push('Il giorno generato non coincide con quello selezionato.')
  for (const item of prescribed) {
    if (item.exercise_id.startsWith('tabata_generic')) continue
    const exercise = byId.get(item.exercise_id)
    if (!exercise) { errors.push(`Esercizio sconosciuto: ${item.exercise_id}.`); continue }
    if (!isExerciseAvailable(exercise, config.equipment.preset, config.equipment.available)) {
      errors.push(`${exercise.name} richiede attrezzatura non disponibile.`)
    }
    if (config.preferences.excluded_exercise_ids.includes(exercise.id)) errors.push(`${exercise.name} è esplicitamente escluso.`)
    // Avvicinamento + Top Set + Back-Off (protocollo CBum) sono lo STESSO esercizio ripetuto
    // di proposito in più serie consecutive con note diverse: non è il duplicato accidentale
    // che questo controllo vuole intercettare.
    const isTopBackoffPair = item.note === 'avvicinamento' || item.note === 'top_set' || item.note === 'back_off'
    if (ids.has(exercise.id) && item.role !== 'warmup' && !isTopBackoffPair) errors.push(`${exercise.name} è duplicato.`)
    if (!isTopBackoffPair) ids.add(exercise.id)
  }
  // Un benchmark CrossFit fisso (Cindy/Fran/Grace/Helen) è per definizione un allenamento
  // completo con un numero di movimenti ufficiale (anche solo 1, es. Grace): niente Forza/Skill
  // né Accessory in quel caso (generators/crossfit.ts), quindi il minimo generico pensato per un
  // WOD costruito liberamente non si applica.
  const isFixedBenchmarkSession = workout.mode === 'crossfit' && !!config.crossfit_benchmark && config.crossfit_benchmark !== 'custom'
  if (workout.mode !== 'tabata') {
    // FST-7 fa apposta solo 3 esercizi base + 1 finisher (4 totali): il minimo generico di 6
    // pensato per una sessione bodybuilding standard rigetterebbe SEMPRE una scheda FST-7
    // valida, come confermato dall'utente ("scheda vuota/con errore" quando selezionava FST-7).
    const minimum = workout.mode === 'strength'
      ? 5
      : workout.mode === 'crossfit'
        ? 3
        : workout.mode === 'bodybuilding' && config.protocol === 'fst7'
          ? 4
          : 6
    if (!isFixedBenchmarkSession && trainingExercises.length < minimum) {
      errors.push(`La sessione ${workout.mode} deve contenere almeno ${minimum} esercizi allenanti (riscaldamento escluso).`)
    }
    const estimated = workout.blocks.reduce((sum, block) => sum + (block.duration_min ?? minutiBlocco(block.exercises)), 0)
    const max = workout.max_duration_min ?? Math.ceil(config.duration_min * 1.15)
    if (estimated > max + 1) errors.push(`Durata stimata ${Math.ceil(estimated)} min oltre il massimo di ${max} min.`)
  }
  const strictTargets = config.mode !== 'crossfit' && config.program_kind === 'single_session' && (config.target_muscles?.length ?? 0) > 0 &&
    (config.crossfit_benchmark ?? 'custom') === 'custom'
  if (strictTargets) {
    const targets = config.target_muscles ?? []
    for (const item of trainingExercises) {
      const exercise = byId.get(item.exercise_id)
      if (exercise && !exercise.primary_muscles.some((muscle) => targets.includes(muscle))) {
        errors.push(`${exercise.name} non ha come target primario uno dei muscoli scelti per oggi.`)
      }
    }
  }
  const splitBoundMode = workout.mode === 'bodybuilding' || workout.mode === 'strength'
  if (splitBoundMode && config.current_day) {
    const naturalMuscles = SPLIT_PRIMARY_MUSCLES[config.current_day]
    for (const item of trainingExercises) {
      const exercise = byId.get(item.exercise_id)
      if (!exercise) continue
      const belongsToSplit = exercise.primary_muscles.some((muscle) => naturalMuscles.includes(muscle))
      const explicitWeakPointRecall = exercise.primary_muscles.some((muscle) => config.weak_points.includes(muscle))
      if (!belongsToSplit && !explicitWeakPointRecall) {
        errors.push(`${exercise.name} non appartiene alla sessione ${config.current_day}; può essere inserito solo se il suo muscolo principale è indicato come carente.`)
      }
    }
  }
  if (prescribed.length === 0) errors.push('La sessione non contiene esercizi.')
  return { valid: errors.length === 0, errors }
}
