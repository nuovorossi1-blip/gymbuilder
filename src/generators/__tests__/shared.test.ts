import { describe, expect, it } from 'vitest'
import type { Exercise } from '../../types'
import catalogoReale from './fixtures/exercises.json'
import { categoriaMetcon, poolMetcon } from '../shared'

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
