import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Exercise, GeneratedWorkout, WeeklyProgram, WorkoutGenerationConfig } from '../../types'

const CHIAVE = 'gymbuilder:allenamento'

interface Valore {
  workout: GeneratedWorkout | null
  setWorkout: (w: GeneratedWorkout | null) => void
  generationConfig: WorkoutGenerationConfig | null
  setGenerationConfig: (config: WorkoutGenerationConfig | null) => void
  catalog: Exercise[]
  setCatalog: (catalog: Exercise[]) => void
  weeklyProgram: WeeklyProgram | null
  setWeeklyProgram: (program: WeeklyProgram | null) => void
  rejectedExerciseIds: string[]
  rejectExercise: (id: string) => void
  clearRejectedExercises: () => void
}

const Ctx = createContext<Valore | null>(null)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  // Si conserva nella sessione del browser: ricaricando la pagina durante
  // l'allenamento non si perde tutto.
  const [workout, set] = useState<GeneratedWorkout | null>(() => {
    try {
      const raw = sessionStorage.getItem(CHIAVE)
      return raw ? (JSON.parse(raw) as GeneratedWorkout) : null
    } catch {
      return null
    }
  })
  const [generationConfig, setGenerationConfig] = useState<WorkoutGenerationConfig | null>(() => {
    try {
      const raw = sessionStorage.getItem(`${CHIAVE}:config`)
      return raw ? JSON.parse(raw) as WorkoutGenerationConfig : null
    } catch { return null }
  })
  const [catalog, setCatalog] = useState<Exercise[]>([])
  const [weeklyProgram, setWeeklyProgramState] = useState<WeeklyProgram | null>(() => {
    try {
      const raw = sessionStorage.getItem(`${CHIAVE}:weekly:v1`)
      return raw ? JSON.parse(raw) as WeeklyProgram : null
    } catch { return null }
  })
  const [rejectedExerciseIds, setRejectedExerciseIds] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(`${CHIAVE}:rejected`) ?? '[]') as string[] } catch { return [] }
  })

  function setWorkout(w: GeneratedWorkout | null) {
    set(w)
    try {
      if (w) sessionStorage.setItem(CHIAVE, JSON.stringify(w))
      else sessionStorage.removeItem(CHIAVE)
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

  return <Ctx.Provider value={{ workout, setWorkout, generationConfig, setGenerationConfig: updateGenerationConfig, catalog, setCatalog, weeklyProgram, setWeeklyProgram, rejectedExerciseIds, rejectExercise, clearRejectedExercises }}>{children}</Ctx.Provider>
}

export function useWorkout() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useWorkout va usato dentro WorkoutProvider')
  return c
}
