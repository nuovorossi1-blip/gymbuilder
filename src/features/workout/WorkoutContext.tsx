import { createContext, useContext, useState, type ReactNode } from 'react'
import type { GeneratedWorkout } from '../../types'

const CHIAVE = 'gymbuilder:allenamento'

interface Valore {
  workout: GeneratedWorkout | null
  setWorkout: (w: GeneratedWorkout | null) => void
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

  function setWorkout(w: GeneratedWorkout | null) {
    set(w)
    try {
      if (w) sessionStorage.setItem(CHIAVE, JSON.stringify(w))
      else sessionStorage.removeItem(CHIAVE)
    } catch {
      /* spazio esaurito o modalità privata: si continua senza persistenza */
    }
  }

  return <Ctx.Provider value={{ workout, setWorkout }}>{children}</Ctx.Provider>
}

export function useWorkout() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useWorkout va usato dentro WorkoutProvider')
  return c
}
