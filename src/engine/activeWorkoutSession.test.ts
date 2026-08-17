import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GeneratedWorkout } from '../types'
import {
  ACTIVE_WORKOUT_SESSION_KEY,
  clearActiveWorkoutSession,
  hasActiveWorkoutSession,
  readActiveWorkoutSession,
  saveActiveWorkoutSession,
  workoutSessionKey,
  type ActiveWorkoutSession,
} from './activeWorkoutSession'

const workout = {
  name: 'Sessione test',
  mode: 'bodybuilding',
  blocks: [{ kind: 'main', exercises: [{ exercise_id: 'panca_piana' }] }],
} as GeneratedWorkout

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('window', {})
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
})

function session(overrides: Partial<ActiveWorkoutSession> = {}): ActiveWorkoutSession {
  return {
    version: 1,
    workoutKey: workoutSessionKey(workout),
    startedAt: 1_000,
    savedAt: 2_000,
    iniziato: true,
    fase: { tipo: 'recupero', iEs: 2, serie: 3, sec: 90 },
    rimanente: 48,
    inPausa: false,
    sezione: 'principale',
    metconFase: 'anteprima',
    metconRimanente: 0,
    metconGiri: 0,
    metconInPausa: false,
    metconTrascorsi: 0,
    intervalIndice: 0,
    intervalSottofase: 'lavoro',
    intervalRimanente: 0,
    finito: false,
    valutazione: null,
    note: '',
    restDeadline: 50_000,
    metconDeadline: 0,
    intervalDeadline: 0,
    metconStartedAt: 0,
    ...overrides,
  }
}

describe('persistenza sessione Runner', () => {
  it('ripristina posizione, fase e deadline della sessione corrente', () => {
    saveActiveWorkoutSession(session())

    expect(readActiveWorkoutSession(workout)).toMatchObject({
      fase: { tipo: 'recupero', iEs: 2, serie: 3 },
      rimanente: 48,
      restDeadline: 50_000,
    })
    expect(hasActiveWorkoutSession()).toBe(true)
  })

  it('non applica lo stato di un allenamento diverso', () => {
    saveActiveWorkoutSession(session())
    const altro = { ...workout, name: 'Altro allenamento' }

    expect(readActiveWorkoutSession(altro)).toBeNull()
  })

  it('elimina definitivamente la sessione conclusa o interrotta', () => {
    saveActiveWorkoutSession(session())
    clearActiveWorkoutSession()

    expect(storage.has(ACTIVE_WORKOUT_SESSION_KEY)).toBe(false)
    expect(hasActiveWorkoutSession()).toBe(false)
  })
})
