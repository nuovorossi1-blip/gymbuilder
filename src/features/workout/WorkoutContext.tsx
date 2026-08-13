import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ActiveWorkoutSession, Exercise, GeneratedWorkout, WeeklyProgram, WorkoutGenerationConfig } from '../../types'

const CHIAVE = 'gymbuilder:allenamento'
const ACTIVE_SESSION_KEY = `${CHIAVE}:active-session:v1`

interface Valore {
  workout: GeneratedWorkout | null
  setWorkout: (w: GeneratedWorkout | null) => void
  generationConfig: WorkoutGenerationConfig | null
  setGenerationConfig: (config: WorkoutGenerationConfig | null) => void
  catalog: Exercise[]
  setCatalog: (catalog: Exercise[]) => void
  weeklyProgram: WeeklyProgram | null
  setWeeklyProgram: (program: WeeklyProgram | null) => void
  activeSession: ActiveWorkoutSession | null
  startWorkoutSession: (workout: GeneratedWorkout, config?: WorkoutGenerationConfig | null) => ActiveWorkoutSession
  resumeActiveSession: () => boolean
  clearActiveSession: () => void
  rejectedExerciseIds: string[]
  rejectExercise: (id: string) => void
  clearRejectedExercises: () => void
}

const Ctx = createContext<Valore | null>(null)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  // Si conserva nel localStorage: navigando tra schermate, aprendo il banner o ricaricando
  // l'allenamento non si perde mai lo stato della sessione.
  const [workout, set] = useState<GeneratedWorkout | null>(() => {
    try {
      const raw = localStorage.getItem(CHIAVE) || sessionStorage.getItem(CHIAVE)
      return raw ? (JSON.parse(raw) as GeneratedWorkout) : null
    } catch {
      return null
    }
  })
  const [generationConfig, setGenerationConfig] = useState<WorkoutGenerationConfig | null>(() => {
    try {
      const raw = localStorage.getItem(`${CHIAVE}:config`) || sessionStorage.getItem(`${CHIAVE}:config`)
      return raw ? JSON.parse(raw) as WorkoutGenerationConfig : null
    } catch { return null }
  })
  const [catalog, setCatalog] = useState<Exercise[]>([])
  const [weeklyProgram, setWeeklyProgramState] = useState<WeeklyProgram | null>(() => {
    try {
      const raw = localStorage.getItem(`${CHIAVE}:weekly:v1`) || sessionStorage.getItem(`${CHIAVE}:weekly:v1`)
      return raw ? JSON.parse(raw) as WeeklyProgram : null
    } catch { return null }
  })
  const [activeSession, setActiveSessionState] = useState<ActiveWorkoutSession | null>(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_KEY)
      return raw ? JSON.parse(raw) as ActiveWorkoutSession : null
    } catch { return null }
  })
  const [rejectedExerciseIds, setRejectedExerciseIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`${CHIAVE}:rejected`) ?? '[]') as string[] } catch { return [] }
  })

  function setWorkout(w: GeneratedWorkout | null) {
    set(w)
    try {
      if (w) {
        localStorage.setItem(CHIAVE, JSON.stringify(w))
        sessionStorage.setItem(CHIAVE, JSON.stringify(w))
      } else {
        localStorage.removeItem(CHIAVE)
        sessionStorage.removeItem(CHIAVE)
      }
    } catch {
      /* spazio esaurito o modalità privata: si continua senza persistenza */
    }
  }

  function updateGenerationConfig(config: WorkoutGenerationConfig | null) {
    setGenerationConfig(config)
    try {
      if (config) sessionStorage.setItem(`${CHIAVE}:config`, JSON.stringify(config))
      else sessionStorage.removeItem(`${CHIAVE}:config`)
    } catch { /* sessionStorage non disponibile */ }
  }

  function setWeeklyProgram(program: WeeklyProgram | null) {
    setWeeklyProgramState(program)
    try {
      if (program) sessionStorage.setItem(`${CHIAVE}:weekly:v1`, JSON.stringify(program))
      else sessionStorage.removeItem(`${CHIAVE}:weekly:v1`)
    } catch { /* si continua senza persistenza locale */ }
  }

  function persistActiveSession(session: ActiveWorkoutSession | null) {
    setActiveSessionState(session)
    try {
      if (session) localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session))
      else localStorage.removeItem(ACTIVE_SESSION_KEY)
    } catch {
      /* si continua senza persistenza locale */
    }
  }

  function startWorkoutSession(workout: GeneratedWorkout, config: WorkoutGenerationConfig | null = generationConfig) {
    const now = Date.now()
    const next: ActiveWorkoutSession = {
      id: `session-${now}-${Math.random().toString(36).slice(2, 8)}`,
      started_at: now,
      updated_at: now,
      workout,
      generation_config: config,
    }
    setWorkout(workout)
    updateGenerationConfig(config)
    persistActiveSession(next)
    return next
  }

  function resumeActiveSession() {
    if (!activeSession) return false
    setWorkout(activeSession.workout)
    updateGenerationConfig(activeSession.generation_config)
    persistActiveSession({ ...activeSession, updated_at: Date.now() })
    return true
  }

  function clearActiveSession() {
    persistActiveSession(null)
  }

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACTIVE_SESSION_KEY) {
        try {
          setActiveSessionState(event.newValue ? JSON.parse(event.newValue) as ActiveWorkoutSession : null)
        } catch {
          setActiveSessionState(null)
        }
      }
      if (event.key === CHIAVE) {
        try {
          set(event.newValue ? JSON.parse(event.newValue) as GeneratedWorkout : null)
        } catch {
          set(null)
        }
      }
      if (event.key === `${CHIAVE}:config`) {
        try {
          setGenerationConfig(event.newValue ? JSON.parse(event.newValue) as WorkoutGenerationConfig : null)
        } catch {
          setGenerationConfig(null)
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function rejectExercise(id: string) {
    setRejectedExerciseIds((current) => {
      const next = current.includes(id) ? current : [...current, id]
      try { sessionStorage.setItem(`${CHIAVE}:rejected`, JSON.stringify(next)) } catch { /* opzionale */ }
      return next
    })
  }

  function clearRejectedExercises() {
    setRejectedExerciseIds([])
    try { sessionStorage.removeItem(`${CHIAVE}:rejected`) } catch { /* opzionale */ }
  }

  return <Ctx.Provider value={{
    workout,
    setWorkout,
    generationConfig,
    setGenerationConfig: updateGenerationConfig,
    catalog,
    setCatalog,
    weeklyProgram,
    setWeeklyProgram,
    activeSession,
    startWorkoutSession,
    resumeActiveSession,
    clearActiveSession,
    rejectedExerciseIds,
    rejectExercise,
    clearRejectedExercises,
  }}>{children}</Ctx.Provider>
}

export function useWorkout() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useWorkout va usato dentro WorkoutProvider')
  return c
}
