import { describe, expect, it } from 'vitest'
import fixture from '../generators/__tests__/fixtures/exercises.json'
import { normalizeExercise } from '../data/exercises/normalize'
import { generaBodybuilding } from '../generators/bodybuilding'
import { PRESET_EQUIPMENT } from '../generators/equipment'
import type { ExerciseRecord, WorkoutGenerationConfig } from '../types'
import { validateWorkout } from './validator'

const catalog = (fixture as ExerciseRecord[]).map(normalizeExercise)

function pushConfig(weakPoints: WorkoutGenerationConfig['weak_points']): WorkoutGenerationConfig {
  return {
    program_kind: 'single_session', mode: 'bodybuilding', goal: 'hypertrophy',
    training_days: 1, current_day: 'push', experience: 'advanced', duration_min: 60,
    equipment: { preset: 'full_gym', available: PRESET_EQUIPMENT.full_gym }, weak_points: weakPoints,
    preferences: { excluded_exercise_ids: [], preferred_exercise_ids: [], bodyweight_policy: 'always', elastic_policy: 'always' },
    intensity: 'medium',
  }
}

function pushConRematore() {
  const workout = generaBodybuilding(catalog, {
    split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
    duration_min: 60, priority_muscles: [], excluded_exercises: [], seed: 4,
  })
  const row = catalog.find((exercise) => exercise.id === 'rematore_bil')!
  const main = workout.blocks.find((block) => block.kind === 'main')!
  main.exercises[main.exercises.length - 1] = {
    exercise_id: row.id, name: row.name, role: 'compound', muscle: 'back',
    sets: 3, reps: '8-10', rest_sec: 120,
  }
  return workout
}

describe('validateWorkout — coerenza dello split', () => {
  it('rifiuta un esercizio dorso in Spinta quando il dorso non è carente', () => {
    const result = validateWorkout(pushConRematore(), pushConfig([]), catalog)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes('solo se il suo muscolo principale è indicato come carente'))).toBe(true)
  })

  it('consente un richiamo dorso in Spinta quando il dorso è esplicitamente carente', () => {
    const result = validateWorkout(pushConRematore(), pushConfig(['back']), catalog)
    expect(result.valid).toBe(true)
  })
})
