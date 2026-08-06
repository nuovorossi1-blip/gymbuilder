import { isExerciseAvailable } from '../generators/equipment'
import type { EquipmentInventory, Exercise, PrescribedExercise } from '../types'
import { isExerciseAllowed, type RuntimePreferences } from './preferences'

export function findExerciseReplacement(
  current: PrescribedExercise,
  catalog: Exercise[],
  equipment: EquipmentInventory,
  preferences: RuntimePreferences,
  usedIds: Set<string>
): Exercise | undefined {
  const original = catalog.find((exercise) => exercise.id === current.exercise_id)
  if (!original) return undefined
  const placement = current.note?.toLowerCase().includes('finisher') ? 'finisher' : current.role === 'compound' ? 'primary' : 'normal'
  return catalog
    .filter((exercise) =>
      exercise.id !== original.id && !usedIds.has(exercise.id) &&
      exercise.exercise_types.includes(current.role === 'compound' ? 'compound' : 'isolation') &&
      exercise.primary_muscles.some((muscle) => original.primary_muscles.includes(muscle)) &&
      isExerciseAvailable(exercise, equipment.preset, equipment.available) &&
      isExerciseAllowed(exercise, preferences, placement)
    )
    .sort((a, b) => {
      const fatigueA = Math.abs(a.systemic_fatigue - original.systemic_fatigue) + Math.abs(a.local_fatigue - original.local_fatigue)
      const fatigueB = Math.abs(b.systemic_fatigue - original.systemic_fatigue) + Math.abs(b.local_fatigue - original.local_fatigue)
      return fatigueA - fatigueB || a.technical_complexity - b.technical_complexity
    })[0]
}
