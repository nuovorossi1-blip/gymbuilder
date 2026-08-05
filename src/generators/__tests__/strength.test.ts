import { describe, expect, it } from 'vitest'
import { generaForza, SPLIT_FORZA } from '../strength'
import type { Exercise } from '../../types'
import catalogoReale from './fixtures/exercises.json'

const catalogo = catalogoReale as unknown as Exercise[]

function mainBlock(w: ReturnType<typeof generaForza>) {
  return w.blocks.find((b) => b.kind === 'main')!
}

describe('generaForza — struttura di base (poche alzate pesanti, non un Bodybuilding ridotto)', () => {
  for (const split of SPLIT_FORZA) {
    it(`${split}: produce fra 3 e 5 alzate con palestra completa, 60 minuti`, () => {
      const w = generaForza(catalogo, {
        split, experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
        priority_muscles: [], excluded_exercises: [], seed: 10,
      })
      const n = mainBlock(w).exercises.length
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(5)
    })
  }

  it('90 minuti punta a 5 alzate, non di più: la Forza non insegue Bodybuilding', () => {
    const w = generaForza(catalogo, {
      split: 'push', experience: 'advanced', equipment: 'full_gym', duration_min: 90,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    expect(mainBlock(w).exercises.length).toBe(5)
  })

  it('recupero non scende mai sotto i 90 secondi, nemmeno con poco tempo', () => {
    const w = generaForza(catalogo, {
      split: 'legs', experience: 'beginner', equipment: 'full_gym', duration_min: 30,
      priority_muscles: [], excluded_exercises: [], seed: 3, intensity: 'high',
    })
    for (const e of mainBlock(w).exercises) {
      expect(e.rest_sec).toBeGreaterThanOrEqual(90)
    }
  })

  it('mode e goal sono impostati correttamente sul risultato', () => {
    const w = generaForza(catalogo, {
      split: 'upper', experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 2,
    })
    expect(w.mode).toBe('strength')
    expect(w.goal).toBe('strength')
  })
})

describe('generaForza — intensità (sez. UI Base44)', () => {
  it('intensità Alta abbassa le ripetizioni e allunga il recupero rispetto a Bassa, a parità di tempo sufficiente', () => {
    // Durata e serie scelte apposta abbondanti: qui verifichiamo l'effetto
    // dell'intensità, non l'adattamento al tempo (che ha un test a parte
    // e può legittimamente uniformare i recuperi quando il tempo è poco).
    const bassa = generaForza(catalogo, {
      split: 'push', experience: 'intermediate', equipment: 'full_gym', duration_min: 75,
      priority_muscles: [], excluded_exercises: [], seed: 5, intensity: 'low',
    })
    const alta = generaForza(catalogo, {
      split: 'push', experience: 'intermediate', equipment: 'full_gym', duration_min: 75,
      priority_muscles: [], excluded_exercises: [], seed: 5, intensity: 'high',
    })
    const compoundBassa = mainBlock(bassa).exercises.find((e) => e.role === 'compound')!
    const compoundAlta = mainBlock(alta).exercises.find((e) => e.role === 'compound')!
    expect(compoundAlta.rest_sec).toBeGreaterThan(compoundBassa.rest_sec)
  })

  it('un principiante non arriva alle ripetizioni bassissime anche chiedendo intensità Alta', () => {
    const w = generaForza(catalogo, {
      split: 'push', experience: 'beginner', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 5, intensity: 'high',
    })
    const compound = mainBlock(w).exercises.find((e) => e.role === 'compound')!
    expect(compound.reps).not.toBe('3-5')
  })
})

describe('generaForza — attrezzatura e duplicati', () => {
  it('con solo corpo libero non seleziona mai esercizi che richiedono altro attrezzo', () => {
    for (const split of SPLIT_FORZA) {
      const w = generaForza(catalogo, {
        split, experience: 'advanced', equipment: 'bodyweight', duration_min: 60,
        priority_muscles: [], excluded_exercises: [], seed: 8,
      })
      const perId = new Map(catalogo.map((e) => [e.id, e]))
      for (const es of mainBlock(w).exercises) {
        expect(perId.get(es.exercise_id)?.equipment).toBe('bodyweight')
      }
    }
  })

  it('non genera mai esercizi duplicati nel blocco principale', () => {
    for (const split of SPLIT_FORZA) {
      const w = generaForza(catalogo, {
        split, experience: 'advanced', equipment: 'full_gym', duration_min: 90,
        priority_muscles: [], excluded_exercises: [], seed: 13,
      })
      const ids = mainBlock(w).exercises.map((e) => e.exercise_id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
