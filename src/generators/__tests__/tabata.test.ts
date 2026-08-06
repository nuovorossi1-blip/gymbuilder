import { describe, expect, it } from 'vitest'
import { generaTabata } from '../tabata'
import type { Equipment, Exercise } from '../../types'
import catalogoReale from './fixtures/exercises.json'

const catalogo = catalogoReale as unknown as Exercise[]
const perId = new Map(catalogo.map((e) => [e.id, e]))

function metconBlock(w: ReturnType<typeof generaTabata>) {
  return w.blocks.find((b) => b.kind === 'metcon')!
}

const EQUIPAGGIAMENTI: Equipment[] = [
  'full_gym', 'barbell', 'dumbbells', 'machines', 'barbell_dumbbells',
  'barbell_machines', 'dumbbells_machines', 'home_gym', 'bodyweight',
]

describe('generaTabata — protocollo fisso (20″ lavoro / 10″ riposo × 8, sempre)', () => {
  it('mode, split e goal sono impostati correttamente: niente split, è un protocollo fisso', () => {
    const w = generaTabata(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 30,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    expect(w.mode).toBe('tabata')
    expect(w.split).toBeNull()
    expect(w.blocks.map((b) => b.kind)).toEqual(['warmup', 'metcon'])
  })

  it('il protocollo è sempre 8 round di 20 secondi, per ogni durata scelta', () => {
    for (const durata of [20, 30, 45, 60, 90]) {
      const w = generaTabata(catalogo, {
        experience: 'intermediate', equipment: 'full_gym', duration_min: durata,
        priority_muscles: [], excluded_exercises: [], seed: 1,
      })
      const m = metconBlock(w)
      expect(m.format).toBe('tabata')
      expect(m.rounds).toBe(8)
      expect(m.interval_sec).toBe(20)
    }
  })

  it('le ripetizioni sono sempre "max": non è un numero di reps fisso come AMRAP/Condizionamento', () => {
    const w = generaTabata(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 45,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    for (const e of metconBlock(w).exercises) {
      expect(e.reps).toBe('max')
      expect(e.rest_sec).toBe(10)
    }
  })

  it('il numero di movimenti cresce con la durata ma resta comunque limitato (mai più di 4)', () => {
    const corta = generaTabata(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 20,
      priority_muscles: [], excluded_exercises: [], seed: 9,
    })
    const lunga = generaTabata(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 90,
      priority_muscles: [], excluded_exercises: [], seed: 9,
    })
    expect(metconBlock(corta).exercises.length).toBeLessThanOrEqual(metconBlock(lunga).exercises.length)
    expect(metconBlock(lunga).exercises.length).toBeLessThanOrEqual(4)
  })

  it('più tempo del necessario per 4 movimenti non allunga il Tabata: arriva un avviso esplicito', () => {
    const w = generaTabata(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 90,
      priority_muscles: [], excluded_exercises: [], seed: 9,
    })
    expect(w.warnings.some((x) => x.includes('protocollo è fisso'))).toBe(true)
  })
})

describe('generaTabata — scelta movimenti', () => {
  it('non sceglie mai bilanciere, macchine o cavi', () => {
    const w = generaTabata(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 45,
      priority_muscles: [], excluded_exercises: [], seed: 4,
    })
    for (const es of metconBlock(w).exercises) {
      const ex = perId.get(es.exercise_id)!
      expect(['barbell', 'machine', 'cable']).not.toContain(ex.equipment)
    }
  })

  it('produce sempre esercizi validi (presenti nel catalogo) per ogni combinazione di attrezzatura', () => {
    for (const equipment of EQUIPAGGIAMENTI) {
      const w = generaTabata(catalogo, {
        experience: 'advanced', equipment, duration_min: 45,
        priority_muscles: [], excluded_exercises: [], seed: 11,
      })
      for (const es of metconBlock(w).exercises) {
        expect(perId.get(es.exercise_id)).toBeDefined()
      }
    }
  })

  it('con solo corpo libero non seleziona mai esercizi che richiedono altro attrezzo', () => {
    const w = generaTabata(catalogo, {
      experience: 'advanced', equipment: 'bodyweight', duration_min: 45,
      priority_muscles: [], excluded_exercises: [], seed: 8,
    })
    for (const es of metconBlock(w).exercises) {
      expect(perId.get(es.exercise_id)?.equipment).toBe('bodyweight')
    }
  })

  it('non genera mai lo stesso movimento due volte nella sessione', () => {
    for (const equipment of EQUIPAGGIAMENTI) {
      const w = generaTabata(catalogo, {
        experience: 'advanced', equipment, duration_min: 90,
        priority_muscles: [], excluded_exercises: [], seed: 13,
      })
      const ids = metconBlock(w).exercises.map((e) => e.exercise_id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('rispetta gli esercizi esclusi', () => {
    const w = generaTabata(catalogo, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 45,
      priority_muscles: [], excluded_exercises: ['burpee', 'mountain_climber'], seed: 2,
    })
    const ids = metconBlock(w).exercises.map((e) => e.exercise_id)
    expect(ids).not.toContain('burpee')
    expect(ids).not.toContain('mountain_climber')
  })
})

describe('generaTabata — calorie', () => {
  it('stima sempre le calorie attive per ogni movimento e per il totale', () => {
    const w = generaTabata(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 30,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    for (const es of metconBlock(w).exercises) {
      expect(es.est_kcal).toBeGreaterThan(0)
    }
    expect(w.est_kcal).toBeGreaterThan(0)
  })
})
