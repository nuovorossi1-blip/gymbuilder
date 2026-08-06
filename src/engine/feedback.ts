import type { AdaptiveExercisePreference, Exercise, ExerciseFeedbackReason } from '../types'

export type AdaptivePreferenceMap = Record<string, AdaptiveExercisePreference>

const keyFor = (userId: string) => `gymbuilder:feedback:${userId}:v1`

export function loadExerciseFeedback(userId: string): AdaptivePreferenceMap {
  try { return JSON.parse(localStorage.getItem(keyFor(userId)) ?? '{}') as AdaptivePreferenceMap }
  catch { return {} }
}

export function recordExerciseFeedback(userId: string, exercise: Exercise, reason: ExerciseFeedbackReason, permanent = false): AdaptivePreferenceMap {
  const all = loadExerciseFeedback(userId)
  const current = all[exercise.id] ?? { dislike_score: 0, difficulty_too_high: 0, difficulty_too_low: 0, discomfort: 0, unavailable: 0, permanently_excluded: false, movement_pattern: exercise.movement_pattern, updated_at: new Date().toISOString() }
  if (reason === 'dislike' || reason === 'prefer_other') current.dislike_score += 1
  if (reason === 'too_hard') current.difficulty_too_high += 1
  if (reason === 'too_easy') current.difficulty_too_low += 1
  if (reason === 'discomfort') current.discomfort += 1
  if (reason === 'unavailable') current.unavailable += 1
  current.permanently_excluded ||= permanent || reason === 'discomfort'
  current.updated_at = new Date().toISOString()
  all[exercise.id] = current
  try { localStorage.setItem(keyFor(userId), JSON.stringify(all)) } catch { /* memoria adattiva non disponibile */ }
  return all
}

export function adaptiveExcludedIds(userId: string, catalog: Exercise[]): string[] {
  const feedback = loadExerciseFeedback(userId)
  const painfulPatterns = new Set(Object.values(feedback).filter((item) => item.discomfort > 0).map((item) => item.movement_pattern))
  return catalog.filter((exercise) => feedback[exercise.id]?.permanently_excluded || feedback[exercise.id]?.unavailable > 0 || painfulPatterns.has(exercise.movement_pattern)).map((exercise) => exercise.id)
}
