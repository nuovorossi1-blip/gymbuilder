import { describe, expect, it } from 'vitest'
import catalogoReale from '../../generators/__tests__/fixtures/exercises.json'
import type { ExerciseRecord } from '../../types'
import { normalizeExercise } from './normalize'

const catalogo = catalogoReale as unknown as ExerciseRecord[]

describe('normalizeExercise', () => {
  it('completa tutti i metadati obbligatori del catalogo storico', () => {
    for (const record of catalogo) {
      const exercise = normalizeExercise(record)
      expect(exercise.english_name).not.toBe('')
      expect(exercise.category).toBeTruthy()
      expect(exercise.exercise_types.length).toBeGreaterThan(0)
      expect(exercise.workout_roles.length).toBeGreaterThan(0)
      expect(exercise.description).not.toBe('')
      expect(Array.isArray(exercise.substitutions)).toBe(true)
      expect(Array.isArray(exercise.required_equipment)).toBe(true)
      expect(typeof exercise.metcon_safe).toBe('boolean')
      expect(typeof exercise.warmup_relevant).toBe('boolean')
      expect(['supported', 'guided', 'free']).toContain(exercise.stability_profile)
      expect(exercise.axial_load).toBeGreaterThanOrEqual(0)
      expect(typeof exercise.unilateral).toBe('boolean')
    }
  })

  it('non considera metcon-safe un movimento tecnico sotto fatica', () => {
    const stacco = catalogo.find((exercise) => exercise.id === 'stacco')!
    expect(normalizeExercise(stacco).metcon_safe).toBe(false)
  })

  it('preserva i metadati espliciti provenienti dal database', () => {
    const record: ExerciseRecord = {
      ...catalogo[0],
      english_name: 'Hip Abduction Machine',
      substitutions: ['glute_bridge'],
      metcon_safe: true,
      stability_profile: 'supported',
      axial_load: 0,
      unilateral: true,
    }
    const exercise = normalizeExercise(record)
    expect(exercise.english_name).toBe('Hip Abduction Machine')
    expect(exercise.substitutions).toEqual(['glute_bridge'])
    expect(exercise.metcon_safe).toBe(true)
    expect(exercise.stability_profile).toBe('supported')
    expect(exercise.unilateral).toBe(true)
  })
})
