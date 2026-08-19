import { describe, expect, it } from 'vitest'
import type { Exercise, PrescribedExercise } from '../../types'
import catalogoReale from './fixtures/exercises.json'
import { categoriaMetcon, poolMetcon, riordinaPerSinergie } from '../shared'

const base = (catalogoReale as unknown as Exercise[]).find((exercise) => !exercise.roles.includes('warmup'))!
const rope = (id: 'jump_rope' | 'double_under', complexity: number): Exercise => ({
  ...base, id, name: id, movement_pattern: 'jump', equipment: 'bodyweight',
  required_equipment: ['jump_rope'], roles: ['cardio', 'conditioning'], technical_complexity: complexity,
})

describe('Progressione corda nei Metcon', () => {
  const single = rope('jump_rope', 1)
  const double = rope('double_under', 3)

  it('classifica entrambi come cardio monostrutturale', () => {
    expect(categoriaMetcon(single)).toBe('mono')
    expect(categoriaMetcon(double)).toBe('mono')
  })

  it('usa Single Under per principianti e Double Under per avanzati', () => {
    expect(poolMetcon([single, double], new Set(), 'beginner').map((exercise) => exercise.id)).toEqual(['jump_rope'])
    expect(poolMetcon([single, double], new Set(), 'advanced').map((exercise) => exercise.id)).toEqual(['double_under'])
  })

  it('se manca il monostrutturale principale usa un fallback cardio dal warmup pool', () => {
    const bike = {
      ...base,
      id: 'wu_bike',
      name: 'Cyclette leggera',
      movement_pattern: 'bike',
      equipment: 'cardio' as const,
      roles: ['warmup', 'cardio'],
      primary_muscles: [],
      required_equipment: ['assault_bike' as const],
    }
    expect(poolMetcon([], new Set(), 'beginner', [bike]).map((exercise) => exercise.id)).toEqual(['wu_bike'])
  })
})

describe('riordinaPerSinergie (sez. Lagging Muscle Engine, Step 5)', () => {
  const ex = (overrides: Partial<Exercise>): Exercise => ({ ...base, secondary_muscles: [], local_fatigue: 2, ...overrides })
  const pe = (exercise: Exercise, overrides: Partial<PrescribedExercise> = {}): PrescribedExercise => ({
    exercise_id: exercise.id, name: exercise.name, role: 'isolation',
    muscle: exercise.primary_muscles[0] ?? null, sets: 3, reps: '10-12', rest_sec: 60, ...overrides,
  })

  it('anticipa un isolamento carente subito prima dell\'esercizio che lo coinvolge come secondario (Alzate Laterali prima delle Dip)', () => {
    const pancaPiana = ex({ id: 'panca_test', primary_muscles: ['chest'] })
    const pancaInclinata = ex({ id: 'panca_incl_test', primary_muscles: ['chest'] })
    const dip = ex({ id: 'dip_test', primary_muscles: ['triceps'], secondary_muscles: ['chest', 'front_delts'], local_fatigue: 3 })
    const alzateLaterali = ex({ id: 'alzate_test', primary_muscles: ['front_delts'] })

    const scelti = [
      pe(pancaPiana, { role: 'compound' }),
      pe(pancaInclinata, { role: 'compound' }),
      pe(dip, { role: 'isolation' }),
      pe(alzateLaterali, { role: 'isolation', note: 'carenza' }),
    ]
    const catalogById = new Map([pancaPiana, pancaInclinata, dip, alzateLaterali].map((e) => [e.id, e]))
    riordinaPerSinergie(scelti, catalogById)

    expect(scelti.map((p) => p.exercise_id)).toEqual(['panca_test', 'panca_incl_test', 'alzate_test', 'dip_test'])
  })

  it('sposta un isolamento se il successivo lo coinvolge come secondario ad alta fatica', () => {
    const croci = ex({ id: 'croci_test', primary_muscles: ['chest'] })
    const dip = ex({ id: 'dip_test', primary_muscles: ['triceps'], secondary_muscles: ['chest'], local_fatigue: 3 })
    const curl = ex({ id: 'curl_test', primary_muscles: ['biceps'] })

    const scelti = [pe(croci), pe(dip), pe(curl)]
    const catalogById = new Map([croci, dip, curl].map((e) => [e.id, e]))
    riordinaPerSinergie(scelti, catalogById)

    expect(scelti.map((p) => p.exercise_id)).toEqual(['croci_test', 'curl_test', 'dip_test'])
  })

  it('non tocca mai i compound, anche se il secondo condivide un secondario ad alta fatica col primo', () => {
    const pancaPiana = ex({ id: 'panca_test', primary_muscles: ['chest'] })
    const dipCompound = ex({ id: 'dip_compound_test', primary_muscles: ['triceps'], secondary_muscles: ['chest'], local_fatigue: 3 })
    const curl = ex({ id: 'curl_test', primary_muscles: ['biceps'] })

    const scelti = [
      pe(pancaPiana, { role: 'compound' }),
      pe(dipCompound, { role: 'compound' }),
      pe(curl, { role: 'isolation' }),
    ]
    const catalogById = new Map([pancaPiana, dipCompound, curl].map((e) => [e.id, e]))
    riordinaPerSinergie(scelti, catalogById)

    expect(scelti.map((p) => p.exercise_id)).toEqual(['panca_test', 'dip_compound_test', 'curl_test'])
  })

  it('non scambia due isolamenti che condividono lo stesso muscolo primario (accumulo di volume intenzionale, es. Bro Split)', () => {
    const croci = ex({ id: 'croci_test', primary_muscles: ['chest'], local_fatigue: 3 })
    const pecDeck = ex({ id: 'pec_deck_test', primary_muscles: ['chest'], local_fatigue: 3 })
    const piegamenti = ex({ id: 'piegamenti_test', primary_muscles: ['chest'], local_fatigue: 3 })

    const scelti = [pe(croci), pe(pecDeck), pe(piegamenti)]
    const catalogById = new Map([croci, pecDeck, piegamenti].map((e) => [e.id, e]))
    riordinaPerSinergie(scelti, catalogById)

    expect(scelti.map((p) => p.exercise_id)).toEqual(['croci_test', 'pec_deck_test', 'piegamenti_test'])
  })
})
