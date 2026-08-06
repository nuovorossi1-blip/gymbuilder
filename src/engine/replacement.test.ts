import { describe, expect, it } from 'vitest'
import fixture from '../generators/__tests__/fixtures/exercises.json'
import { normalizeExercise } from '../data/exercises/normalize'
import type { ExerciseFeedbackReason, ExerciseRecord, PrescribedExercise } from '../types'
import { findExerciseReplacement } from './replacement'

const catalog = (fixture as ExerciseRecord[]).map(normalizeExercise)
const equipment = { preset: 'full_gym' as const, available: ['barbell', 'dumbbells', 'machines', 'cable', 'pullup_bar', 'bench'] as const }
const preferences = { excludedExerciseIds: [], bodyweightPolicy: 'always' as const, elasticPolicy: 'never' as const }
const prescribed = (id: string, role: PrescribedExercise['role'] = 'compound'): PrescribedExercise => {
  const exercise = catalog.find((item) => item.id === id)!
  return { exercise_id: id, name: exercise.name, role, muscle: exercise.primary_muscles[0], sets: 4, reps: '6-8', rest_sec: 120 }
}
const replace = (id: string, reason: ExerciseFeedbackReason) => findExerciseReplacement(prescribed(id), catalog, { ...equipment, available: [...equipment.available] }, preferences, new Set([id]), { reason, experience: 'advanced' })!

describe('Exercise Feedback & Replacement Engine', () => {
  it('Non mi piace mantiene pattern, muscolo e classificazione', () => {
    const replacement = replace('panca_piana', 'dislike')
    expect(replacement.id).not.toBe('panca_piana')
    expect(replacement.movement_pattern).toBe('horizontal_push')
    expect(replacement.primary_muscles).toContain('chest')
    expect(replacement.exercise_types).toContain('compound')
  })

  it('in Push non può proporre un pattern gambe', () => {
    const current = prescribed('panca_piana')
    const replacement = findExerciseReplacement(current, catalog, { ...equipment, available: [...equipment.available] }, preferences, new Set(['panca_piana']), { reason: 'dislike', experience: 'advanced', split: 'push' })!
    expect(replacement.movement_pattern).not.toBe('squat')
  })

  it('Troppo difficile seleziona una regressione dello stesso pattern', () => {
    const replacement = replace('trazioni', 'too_hard')
    expect(replacement.movement_pattern).toBe('vertical_pull')
    expect(replacement.technical_complexity).toBeLessThan(2)
  })

  it('Troppo facile seleziona una progressione dello stesso pattern', () => {
    const replacement = replace('lat_machine', 'too_easy')
    expect(replacement.movement_pattern).toBe('vertical_pull')
    expect(replacement.technical_complexity).toBeGreaterThan(1)
  })

  it('Dolore o disagio evita lo stesso movement pattern', () => {
    const replacement = replace('panca_piana', 'discomfort')
    expect(replacement.primary_muscles).toContain('chest')
    expect(replacement.movement_pattern).not.toBe('horizontal_push')
  })

  it('Preferisco altro movimento favorisce attrezzatura differente', () => {
    expect(replace('panca_piana', 'prefer_other').equipment).not.toBe('barbell')
  })

  it('Attrezzatura non disponibile rispetta il nuovo inventario', () => {
    const current = prescribed('chest_press')
    const replacement = findExerciseReplacement(current, catalog, { preset: 'full_gym', available: ['barbell', 'dumbbells', 'bench'] }, preferences, new Set(['chest_press']), { reason: 'unavailable', experience: 'advanced' })!
    expect(replacement.required_equipment).not.toContain('machines')
  })
})
