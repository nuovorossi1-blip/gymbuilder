import type { Exercise, ExercisePolicy, Mode } from '../types'

export interface RuntimePreferences {
  excludedExerciseIds: string[]
  bodyweightPolicy: ExercisePolicy
  elasticPolicy: ExercisePolicy
}

export type ExercisePlacement = 'primary' | 'normal' | 'finisher'

export function preferencePlacementForMode(mode: Mode): ExercisePlacement {
  return mode === 'bodybuilding' || mode === 'strength' ? 'normal' : 'finisher'
}

export function isExerciseAllowed(
  exercise: Exercise,
  preferences: RuntimePreferences,
  placement: ExercisePlacement
): boolean {
  if (preferences.excludedExerciseIds.includes(exercise.id)) return false
  const bodyweight = exercise.equipment === 'bodyweight'
  const requiredEquipment = exercise.required_equipment ?? []
  const elastic = requiredEquipment.includes('resistance_bands')
  const policy = bodyweight ? preferences.bodyweightPolicy : elastic ? preferences.elasticPolicy : 'always'
  if (policy === 'never') return false
  return policy !== 'finisher_only' || placement === 'finisher'
}

export function filterExercisesByPreferences(
  exercises: Exercise[], preferences: RuntimePreferences, placement: ExercisePlacement
): Exercise[] {
  return exercises.filter((exercise) => isExerciseAllowed(exercise, preferences, placement))
}
