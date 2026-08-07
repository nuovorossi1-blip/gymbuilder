import { isExerciseAvailable } from '../generators/equipment'
import type { AdaptiveExercisePreference, EquipmentInventory, Exercise, ExerciseFeedbackReason, Experience, PrescribedExercise, Split } from '../types'
import { isExerciseAllowed, type RuntimePreferences } from './preferences'

const EXPERIENCE_RANK: Record<Experience, number> = { beginner: 1, intermediate: 2, advanced: 3 }

export interface ReplacementOptions {
  reason?: ExerciseFeedbackReason
  rejectedIds?: Set<string>
  adaptivePreferences?: Record<string, AdaptiveExercisePreference>
  experience?: Experience
  preferredIds?: Set<string>
  split?: Split | null
}

const SPLIT_PATTERNS: Partial<Record<Split, Set<string>>> = {
  push: new Set(['horizontal_push', 'vertical_push', 'lateral_raise', 'elbow_extension', 'elbow_flexion']),
  pull: new Set(['horizontal_pull', 'vertical_pull', 'rear_delt', 'elbow_flexion', 'elbow_extension']),
  legs: new Set(['squat', 'lunge', 'hinge', 'knee_flexion', 'knee_extension', 'calf_raise', 'jump', 'core']),
}

export function findExerciseReplacement(
  current: PrescribedExercise,
  catalog: Exercise[],
  equipment: EquipmentInventory,
  preferences: RuntimePreferences,
  usedIds: Set<string>,
  options: ReplacementOptions = {}
): Exercise | undefined {
  const original = catalog.find((exercise) => exercise.id === current.exercise_id)
  if (!original) return undefined
  const reason = options.reason ?? 'dislike'
  const placement = current.note?.toLowerCase().includes('finisher') ? 'finisher' : current.role === 'compound' ? 'primary' : 'normal'
  const expectedType = current.role === 'compound' ? 'compound' : current.role === 'isolation' ? 'isolation' : 'conditioning'
  const metabolic = current.role === 'metcon'

  const candidates = catalog.filter((exercise) => {
    if (exercise.id === original.id || usedIds.has(exercise.id) || options.rejectedIds?.has(exercise.id)) return false
    const splitPatterns = options.split ? SPLIT_PATTERNS[options.split] : undefined
    if (splitPatterns && current.note !== 'carenza' && !splitPatterns.has(exercise.movement_pattern)) return false
    if (!isExerciseAvailable(exercise, equipment.preset, equipment.available) || !isExerciseAllowed(exercise, preferences, placement)) return false
    if (options.experience && EXPERIENCE_RANK[exercise.min_experience] > EXPERIENCE_RANK[options.experience]) return false
    if (options.adaptivePreferences?.[exercise.id]?.permanently_excluded) return false
    if (metabolic) return exercise.exercise_types.includes('conditioning') && exercise.metcon_safe
    const sameMuscle = exercise.primary_muscles.some((muscle) => original.primary_muscles.includes(muscle))
    if (!sameMuscle) return false
    if (reason === 'discomfort') return true
    return exercise.exercise_types.includes(expectedType)
  })

  const score = (exercise: Exercise): number => {
    let value = 0
    const samePattern = exercise.movement_pattern === original.movement_pattern
    const sameEquipment = exercise.equipment === original.equipment
    const sameType = exercise.exercise_types.includes(expectedType)
    value += samePattern ? -60 : 12
    value += sameType ? -25 : 20
    value -= exercise.primary_muscles.filter((muscle) => original.primary_muscles.includes(muscle)).length * 15
    value += Math.abs(exercise.systemic_fatigue - original.systemic_fatigue) * 4
    value += Math.abs(exercise.local_fatigue - original.local_fatigue) * 3
    value += Math.abs(exercise.technical_complexity - original.technical_complexity) * 2
    value += Math.abs(exercise.axial_load - original.axial_load) * 3
    value += exercise.stability_profile === original.stability_profile ? -6 : 3
    value += exercise.unilateral === original.unilateral ? -3 : 2
    if (reason === 'too_hard') value += exercise.technical_complexity >= original.technical_complexity ? 80 : -25
    if (reason === 'too_easy') value += exercise.technical_complexity <= original.technical_complexity ? 80 : -25
    if (reason === 'discomfort') value += samePattern ? 120 : 0
    if (reason === 'prefer_other') value += sameEquipment ? 25 : -15
    if (reason === 'unavailable') value += sameEquipment ? 40 : -10
    if (options.preferredIds?.has(exercise.id)) value -= 8
    const adaptive = options.adaptivePreferences?.[exercise.id]
    if (adaptive) value += adaptive.dislike_score * 8 + adaptive.discomfort * 40 + adaptive.unavailable * 40
    return value
  }
  return candidates.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name))[0]
}
