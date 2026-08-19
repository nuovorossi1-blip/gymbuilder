import type { Exercise } from '../types'

export interface RuntimePreferences {
  excludedExerciseIds: string[]
}

/**
 * Niente più policy "sempre/mai/solo finisher" su corpo libero/elastici (sez. feedback utente
 * 19/08): escludeva esercizi utili (es. dip) anche quando l'attrezzatura richiesta era
 * disponibile davvero (equipment.ts già verifica quello). L'unica esclusione esplicita resta
 * quella per singolo esercizio; il resto lo gestisce lo swap "Sostituisci" nella scheda, non un
 * filtro globale a monte.
 */
export function isExerciseAllowed(exercise: Exercise, preferences: RuntimePreferences): boolean {
  return !preferences.excludedExerciseIds.includes(exercise.id)
}

export function filterExercisesByPreferences(
  exercises: Exercise[], preferences: RuntimePreferences
): Exercise[] {
  return exercises.filter((exercise) => isExerciseAllowed(exercise, preferences))
}
