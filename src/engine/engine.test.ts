import { describe, expect, it } from 'vitest'
import fixture from '../generators/__tests__/fixtures/exercises.json'
import { normalizeExercise } from '../data/exercises/normalize'
import { generaBodybuilding } from '../generators/bodybuilding'
import { isExerciseAvailable } from '../generators/equipment'
import { estimateActiveCalories } from '../generators/calories'
import { proposeWeeklyPlan } from './weeklyPlan'
import { isExerciseAllowed, preferencePlacementForMode } from './preferences'
import { nextTimerSecond, type IntervalTimerState } from './timer'
import type { ExerciseRecord } from '../types'

const catalog = (fixture as ExerciseRecord[]).map(normalizeExercise)

describe('Workout Engine master specification', () => {
  it('propone PPL su cinque giorni e lascia selezionare una singola sessione', () => {
    expect(proposeWeeklyPlan('ppl', 5)).toEqual(['push', 'pull', 'legs', 'upper', 'lower'])
  })

  it('Bodybuilding Pull mantiene 3 dorso, rear delts, bicipiti e richiamo tricipiti', () => {
    const workout = generaBodybuilding(catalog, {
      split: 'pull', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      available_equipment: undefined, duration_min: 60,
      priority_muscles: ['rear_delts', 'biceps', 'triceps'], excluded_exercises: [],
      weekly_volume: { chest: 0, back: 0, front_delts: 0, lateral_delts: 0, rear_delts: 0, biceps: 0, triceps: 0, forearms: 0, quads: 0, hamstrings: 0, glutes: 0, adductors: 0, calves: 0, core: 0 },
      seed: 12,
    })
    const muscles = workout.blocks.find((block) => block.kind === 'main')!.exercises.map((exercise) => exercise.muscle)
    expect(muscles.filter((muscle) => muscle === 'back')).toHaveLength(3)
    expect(muscles).toContain('rear_delts')
    expect(muscles).toContain('biceps')
    expect(muscles).toContain('triceps')
  })

  it('hard-block: Row Erg non è disponibile se row_erg è spento', () => {
    const row = catalog.find((exercise) => exercise.id === 'row_erg')!
    expect(isExerciseAvailable(row, 'full_gym', ['barbell', 'dumbbells'])).toBe(false)
  })

  it('corpo libero solo finisher blocca Push-up normale ma lo consente come finisher', () => {
    const pushup = catalog.find((exercise) => exercise.equipment === 'bodyweight' && exercise.movement_pattern === 'horizontal_push')!
    const preferences = { excludedExerciseIds: [], bodyweightPolicy: 'finisher_only' as const, elasticPolicy: 'always' as const }
    expect(isExerciseAllowed(pushup, preferences, 'primary')).toBe(false)
    expect(isExerciseAllowed(pushup, preferences, 'normal')).toBe(false)
    expect(isExerciseAllowed(pushup, preferences, 'finisher')).toBe(true)
  })

  it('CrossFit e Hybrid trattano il Metcon come contesto finisher per le policy bodyweight', () => {
    expect(preferencePlacementForMode('crossfit')).toBe('finisher')
    expect(preferencePlacementForMode('crossfit_hybrid')).toBe('finisher')
    expect(preferencePlacementForMode('tabata')).toBe('finisher')
    expect(preferencePlacementForMode('bodybuilding')).toBe('normal')
  })

  it('required_equipment mancante non rompe il filtro preferenze legacy', () => {
    const pushup = { ...catalog.find((exercise) => exercise.equipment === 'bodyweight' && exercise.movement_pattern === 'horizontal_push')!, required_equipment: undefined as unknown as [] }
    const preferences = { excludedExerciseIds: [], bodyweightPolicy: 'finisher_only' as const, elasticPolicy: 'never' as const }
    expect(() => isExerciseAllowed(pushup, preferences, 'finisher')).not.toThrow()
    expect(isExerciseAllowed(pushup, preferences, 'finisher')).toBe(true)
  })

  it('timer Tabata alterna lavoro, riposo, round e fine', () => {
    const config = { workSec: 1, restSec: 1, rounds: 2 }
    let state: IntervalTimerState = { round: 1, phase: 'work', remainingSec: 1 }
    state = nextTimerSecond(state, config)
    expect(state).toEqual({ round: 1, phase: 'rest', remainingSec: 1 })
    state = nextTimerSecond(state, config)
    expect(state).toEqual({ round: 2, phase: 'work', remainingSec: 1 })
    state = nextTimerSecond(state, config)
    state = nextTimerSecond(state, config)
    expect(state.phase).toBe('complete')
  })

  it('calorie usa HR se disponibile e fallback MET altrimenti', () => {
    const base = { mode: 'bodybuilding' as const, durationMin: 60, weightKg: 80, age: 35, sex: 'male' as const, intensity: 'medium' as const }
    expect(estimateActiveCalories({ ...base, averageHeartRate: 140 }).method).toBe('heart_rate')
    expect(estimateActiveCalories({ ...base, averageHeartRate: null }).method).toBe('met')
  })
})
