import type { GeneratedWorkout } from '../types'

export const ACTIVE_WORKOUT_SESSION_KEY = 'gymbuilder:runner-session:v1'

export type RunnerPhase =
  | { tipo: 'serie'; iEs: number; serie: number }
  | { tipo: 'recupero'; iEs: number; serie: number; sec: number }

export interface ActiveWorkoutSession {
  version: 1
  workoutKey: string
  startedAt: number
  savedAt: number
  iniziato: boolean
  fase: RunnerPhase
  rimanente: number
  inPausa: boolean
  sezione: 'principale' | 'metcon'
  metconFase: 'anteprima' | 'via' | 'fatto'
  metconRimanente: number
  metconGiri: number
  metconInPausa: boolean
  metconTrascorsi: number
  intervalIndice: number
  intervalSottofase: 'lavoro' | 'riposo'
  intervalRimanente: number
  finito: boolean
  valutazione: string | null
  note: string
  restDeadline: number
  metconDeadline: number
  intervalDeadline: number
  metconStartedAt: number
}

export function workoutSessionKey(workout: GeneratedWorkout): string {
  return JSON.stringify([
    workout.name,
    workout.mode,
    workout.blocks.map((block) => [block.kind, block.exercises.map((exercise) => exercise.exercise_id)]),
  ])
}

export function readActiveWorkoutSession(workout?: GeneratedWorkout | null): ActiveWorkoutSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ACTIVE_WORKOUT_SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as ActiveWorkoutSession
    if (session.version !== 1 || !session.iniziato) return null
    if (workout && session.workoutKey !== workoutSessionKey(workout)) return null
    return session
  } catch {
    return null
  }
}

export function hasActiveWorkoutSession(): boolean {
  return readActiveWorkoutSession() !== null
}

export function saveActiveWorkoutSession(session: ActiveWorkoutSession): void {
  try {
    localStorage.setItem(ACTIVE_WORKOUT_SESSION_KEY, JSON.stringify(session))
  } catch {
    /* Il Runner continua anche se lo storage non e' disponibile. */
  }
}

export function clearActiveWorkoutSession(): void {
  try {
    localStorage.removeItem(ACTIVE_WORKOUT_SESSION_KEY)
  } catch {
    /* Nessuna azione necessaria. */
  }
}
