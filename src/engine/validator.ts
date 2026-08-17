import { isExerciseAvailable } from '../generators/equipment'
import { minutiBlocco } from '../generators/shared'
import type { Exercise, GeneratedWorkout, Muscle, Split, WorkoutGenerationConfig } from '../types'

export interface ValidationResult { valid: boolean; errors: string[] }

const SPLIT_PRIMARY_MUSCLES: Record<Split, Muscle[]> = {
  push: ['chest', 'front_delts', 'lateral_delts', 'triceps'],
  pull: ['back', 'rear_delts', 'biceps', 'forearms'],
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
    if (ids.has(exercise.id) && item.role !== 'warmup') errors.push(`${exercise.name} è duplicato.`)
    ids.add(exercise.id)
  }
  if (workout.mode !== 'tabata') {
    const minimum = workout.mode === 'strength' ? 5 : workout.mode === 'crossfit' ? 3 : 6
    if (trainingExercises.length < minimum) {
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
