import { describe, expect, it } from 'vitest'
import catalogoReale from './fixtures/exercises.json'
import type { ExerciseRecord } from '../../types'
import { normalizeExercise } from '../../data/exercises/normalize'
import { isExerciseAvailable } from '../equipment'
import { generaCondizionamento } from '../conditioning'

const catalogo = (catalogoReale as unknown as ExerciseRecord[]).map(normalizeExercise)

describe('Equipment Engine avanzato', () => {
  it('distingue il vogatore dagli altri attrezzi cardio', () => {
    const row = catalogo.find((exercise) => exercise.id === 'row_erg')!
    expect(isExerciseAvailable(row, 'full_gym', ['treadmill'])).toBe(false)
    expect(isExerciseAvailable(row, 'bodyweight', ['row_erg'])).toBe(true)
  })

  it('riconosce i requisiti specifici di corda, sbarra ed elastici', () => {
    expect(catalogo.find((exercise) => exercise.id === 'wu_salto_corda')?.required_equipment).toEqual(['jump_rope'])
    expect(catalogo.find((exercise) => exercise.id === 'trazioni')?.required_equipment).toEqual(['pullup_bar'])
    expect(catalogo.find((exercise) => exercise.id === 'curl_elastico')?.required_equipment).toEqual(['resistance_bands'])
  })

  it('non genera Row Erg quando l’inventario personalizzato lo esclude', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const workout = generaCondizionamento(catalogo, {
        format: 'amrap',
        experience: 'advanced',
        equipment: 'full_gym',
        available_equipment: ['dumbbells', 'kettlebells', 'jump_rope'],
        duration_min: 45,
        priority_muscles: [],
        excluded_exercises: [],
        seed,
      })
      const ids = workout.blocks.flatMap((block) => block.exercises.map((exercise) => exercise.exercise_id))
      expect(ids).not.toContain('row_erg')
    }
  })
})
