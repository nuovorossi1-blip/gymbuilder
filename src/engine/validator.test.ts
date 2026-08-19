import { describe, expect, it } from 'vitest'
import fixture from '../generators/__tests__/fixtures/exercises.json'
import { normalizeExercise } from '../data/exercises/normalize'
import { generaBodybuilding } from '../generators/bodybuilding'
import { generaCrossFit } from '../generators/crossfit'
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

  it('sessione singola con gruppi a scelta multi-split (deltoide anteriore+laterale+posteriore) non viene rifiutata', () => {
    // Bug reale: la sessione singola BB con gruppi a scelta usava ancora l'ultimo split
    // preimpostato (es. 'push') come current_day per la validazione, anche quando i muscoli
    // scelti attraversano piu' split (i deltoidi posteriori appartengono a Pull, non a Push).
    // weeklyPlan.ts ora lascia lo split a null per queste sessioni: current_day resta assente
    // e la validazione passa dal controllo sui target scelti, che li accetta correttamente.
    const targets: WorkoutGenerationConfig['target_muscles'] = ['front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps']
    const workout = generaBodybuilding(catalog, {
      split: 'full_body', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 60, priority_muscles: ['lateral_delts', 'biceps'], target_muscles: targets,
      excluded_exercises: [], seed: 4,
    })
    const config: WorkoutGenerationConfig = {
      program_kind: 'single_session', mode: 'bodybuilding', goal: 'hypertrophy',
      training_days: 1, current_day: null, experience: 'advanced', duration_min: 60,
      equipment: { preset: 'full_gym', available: PRESET_EQUIPMENT.full_gym },
      weak_points: ['lateral_delts', 'biceps'], target_muscles: targets,
      preferences: { excluded_exercise_ids: [], preferred_exercise_ids: [], bodyweight_policy: 'always', elastic_policy: 'always' },
      intensity: 'medium',
    }
    const result = validateWorkout(workout, config, catalog)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('Grace (un solo movimento, niente Forza/Skill ne Accessory) non viene rifiutata per numero minimo di esercizi', () => {
    // Grace e' ufficialmente "30 Clean & Jerk", un solo movimento: con Forza/Skill e Accessory
    // saltati (benchmark fisso), il minimo generico di 3 esercizi allenanti per CrossFit non
    // deve applicarsi, altrimenti Grace fallirebbe sempre la validazione.
    const workout = generaCrossFit(catalog, {
      experience: 'advanced', equipment: 'full_gym', duration_min: 60,
      priority_muscles: [], excluded_exercises: [], seed: 4, benchmark: 'grace',
    })
    const config: WorkoutGenerationConfig = {
      program_kind: 'single_session', mode: 'crossfit', goal: 'conditioning',
      training_days: 1, current_day: null, experience: 'advanced', duration_min: 60,
      equipment: { preset: 'full_gym', available: PRESET_EQUIPMENT.full_gym },
      weak_points: [], crossfit_benchmark: 'grace',
      preferences: { excluded_exercise_ids: [], preferred_exercise_ids: [], bodyweight_policy: 'always', elastic_policy: 'always' },
      intensity: 'medium',
    }
    const result = validateWorkout(workout, config, catalog)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('FST-7 (3 esercizi base + 1 finisher) non viene rifiutato per numero minimo di esercizi', () => {
    // Bug reale segnalato dall'utente ("seduta vuota/con errore" selezionando FST-7"): il
    // minimo generico di 6 esercizi per una sessione bodybuilding standard rigettava SEMPRE
    // una scheda FST-7, che ne fa apposta solo 4 (3 base + il finisher da 7 serie). Causa:
    // WorkoutGenerationConfig non portava mai il protocollo fino al validatore (Create.tsx non
    // lo passava in buildGenerationConfig). Qui si verifica sia che il generatore produca
    // davvero solo 4 esercizi, sia che il validatore — informato del protocollo — li accetti.
    const workout = generaBodybuilding(catalog, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 60, priority_muscles: [], excluded_exercises: [], seed: 4,
      protocol: 'fst7',
    })
    const main = workout.blocks.find((block) => block.kind === 'main')!
    expect(main.exercises).toHaveLength(4)
    const result = validateWorkout(workout, { ...pushConfig([]), protocol: 'fst7' }, catalog)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('Top Set & Back-Off (protocollo CBum) non viene rifiutato per esercizio duplicato', () => {
    // La stessa alzata compare due volte di proposito (Top Set + Back-Off): senza il
    // carve-out in validator.ts, il controllo duplicati bloccherebbe ogni sessione CBum.
    const workout = generaBodybuilding(catalog, {
      split: 'push', goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym',
      duration_min: 60, priority_muscles: [], excluded_exercises: [], seed: 4,
      protocol: 'cbum_top_backoff',
    })
    const result = validateWorkout(workout, pushConfig([]), catalog)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })
})
