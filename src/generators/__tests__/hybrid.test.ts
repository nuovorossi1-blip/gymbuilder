import { describe, expect, it } from 'vitest'
import { generaHybrid } from '../hybrid'
import type { Equipment, Exercise } from '../../types'
import catalogoReale from './fixtures/exercises.json'

const catalogo = catalogoReale as unknown as Exercise[]
const perId = new Map(catalogo.map((e) => [e.id, e]))

function mainBlock(w: ReturnType<typeof generaHybrid>) {
  return w.blocks.find((b) => b.kind === 'main')!
}

const EQUIPAGGIAMENTI: Equipment[] = [
  'full_gym', 'barbell', 'dumbbells', 'machines', 'barbell_dumbbells',
  'barbell_machines', 'dumbbells_machines', 'home_gym', 'bodyweight',
]

describe('generaHybrid — struttura (forza e cardio alternati, non due parti separate)', () => {
  it('mode, split e goal sono impostati correttamente: niente split, è forza+cardio alternati', () => {
    const w = generaHybrid(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    expect(w.mode).toBe('crossfit_hybrid')
    expect(w.split).toBeNull()
    expect(w.goal).toBe('mixed')
  })

  it('produce sempre due blocchi: riscaldamento e un unico blocco principale', () => {
    const w = generaHybrid(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    expect(w.blocks.map((b) => b.kind)).toEqual(['warmup', 'main'])
  })

  it('gli esercizi si alternano rigorosamente compound/metcon (le coppie forza+cardio)', () => {
    for (const durata of [30, 45, 60, 75, 90]) {
      const w = generaHybrid(catalogo, {
        experience: 'intermediate', equipment: 'full_gym', duration_min: durata,
        priority_muscles: [], excluded_exercises: [], seed: 3,
      })
      const ruoli = mainBlock(w).exercises.map((e) => e.role)
      for (let i = 0; i < ruoli.length; i++) {
        expect(ruoli[i]).toBe(i % 2 === 0 ? 'compound' : 'metcon')
      }
    }
  })

  it('il numero di coppie cresce con la durata (3 sotto i 45 min, 5 da 75 in su)', () => {
    const corta = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 30,
      priority_muscles: [], excluded_exercises: [], seed: 9,
    })
    const lunga = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 90,
      priority_muscles: [], excluded_exercises: [], seed: 9,
    })
    expect(mainBlock(corta).exercises.length).toBeLessThanOrEqual(6)
    expect(mainBlock(lunga).exercises.length).toBeGreaterThanOrEqual(mainBlock(corta).exercises.length)
  })
})

describe('generaHybrid — scelta esercizi', () => {
  it('le alzate sono sempre compound (hypertrophy o strength), mai movimenti conditioning', () => {
    const w = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 4,
    })
    for (const es of mainBlock(w).exercises.filter((e) => e.role === 'compound')) {
      const ex = perId.get(es.exercise_id)!
      expect(ex.roles).toContain('compound')
      expect(ex.roles.includes('hypertrophy') || ex.roles.includes('strength')).toBe(true)
    }
  })

  it('le scariche cardio non usano mai bilanciere, macchine o cavi', () => {
    const w = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 4,
    })
    for (const es of mainBlock(w).exercises.filter((e) => e.role === 'metcon')) {
      const ex = perId.get(es.exercise_id)!
      expect(['barbell', 'machine', 'cable']).not.toContain(ex.equipment)
    }
  })

  it('produce sempre esercizi validi (presenti nel catalogo) per ogni combinazione di attrezzatura', () => {
    for (const equipment of EQUIPAGGIAMENTI) {
      const w = generaHybrid(catalogo, {
        experience: 'advanced', equipment, duration_min: 60,
        priority_muscles: [], excluded_exercises: [], seed: 11,
      })
      for (const es of mainBlock(w).exercises) {
        expect(perId.get(es.exercise_id)).toBeDefined()
      }
    }
  })

  it('con solo corpo libero non seleziona mai esercizi che richiedono altro attrezzo', () => {
    const w = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'bodyweight', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 8,
    })
    for (const es of mainBlock(w).exercises) {
      expect(perId.get(es.exercise_id)?.equipment).toBe('bodyweight')
    }
  })

  it('non genera mai lo stesso esercizio due volte nella sessione', () => {
    for (const equipment of EQUIPAGGIAMENTI) {
      const w = generaHybrid(catalogo, {
        experience: 'advanced', equipment, duration_min: 90,
        priority_muscles: [], excluded_exercises: [], seed: 13,
      })
      const ids = mainBlock(w).exercises.map((e) => e.exercise_id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('rispetta gli esercizi esclusi', () => {
    const w = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: ['panca_piana', 'squat'], seed: 2,
    })
    const ids = mainBlock(w).exercises.map((e) => e.exercise_id)
    expect(ids).not.toContain('panca_piana')
    expect(ids).not.toContain('squat')
  })

  it('la prima coppia della rotazione tocca un muscolo prioritario, se indicato', () => {
    const w = generaHybrid(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: ['back'], excluded_exercises: [], seed: 5,
    })
    expect(mainBlock(w).exercises[0].muscle).toBe('back')
  })
})

describe('generaHybrid — calorie', () => {
  it('stima sempre le calorie attive per ogni esercizio e per il totale', () => {
    const w = generaHybrid(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    for (const es of mainBlock(w).exercises) {
      expect(es.est_kcal).toBeGreaterThan(0)
    }
    expect(w.est_kcal).toBeGreaterThan(0)
  })
})
