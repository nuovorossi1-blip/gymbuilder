import { isExerciseAvailable } from '../generators/equipment'
import { minutiBlocco } from '../generators/shared'
import type { Exercise, GeneratedWorkout, WorkoutGenerationConfig } from '../types'

export interface ValidationResult { valid: boolean; errors: string[] }

export function validateWorkout(
  workout: GeneratedWorkout,
  config: WorkoutGenerationConfig,
  catalog: Exercise[]
): ValidationResult {
  const errors: string[] = []
  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]))
  const prescribed = workout.blocks.flatMap((block) => block.exercises)
  const ids = new Set<string>()

  if (workout.mode !== config.mode) errors.push('La modalità generata non coincide con la configurazione.')
  if (config.current_day && workout.split !== config.current_day) errors.push('Il giorno generato non coincide con quello selezionato.')
  for (const item of prescribed) {
    const exercise = byId.get(item.exercise_id)
    if (!exercise) { errors.push(`Esercizio sconosciuto: ${item.exercise_id}.`); continue }
    if (!isExerciseAvailable(exercise, config.equipment.preset, config.equipment.available)) {
      errors.push(`${exercise.name} richiede attrezzatura non disponibile.`)
    }
    if (config.preferences.excluded_exercise_ids.includes(exercise.id)) errors.push(`${exercise.name} è esplicitamente escluso.`)
    if (ids.has(exercise.id) && item.role !== 'warmup') errors.push(`${exercise.name} è duplicato.`)
    ids.add(exercise.id)
  }
  const estimated = workout.blocks.reduce((sum, block) => sum + (block.duration_min ?? minutiBlocco(block.exercises)), 0)
  const max = workout.max_duration_min ?? Math.ceil(config.duration_min * 1.15)
  if (estimated > max + 1) errors.push(`Durata stimata ${Math.ceil(estimated)} min oltre il massimo di ${max} min.`)
  if (prescribed.length === 0) errors.push('La sessione non contiene esercizi.')
  return { valid: errors.length === 0, errors }
}
