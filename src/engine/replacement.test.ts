import { describe, expect, it } from 'vitest'
import fixture from '../generators/__tests__/fixtures/exercises.json'
import { normalizeExercise } from '../data/exercises/normalize'
import type { ExerciseFeedbackReason, ExerciseRecord, PrescribedExercise } from '../types'
import { findExerciseReplacement, findExerciseReplacements } from './replacement'

const catalog = (fixture as ExerciseRecord[]).map(normalizeExercise)
const equipment = { preset: 'full_gym' as const, available: ['barbell', 'dumbbells', 'machines', 'cable', 'pullup_bar', 'bench'] as const }
const preferences = { excludedExerciseIds: [] }
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

  it('un richiamo carenza in Legs viene sostituito con lo stesso pattern e non con un esercizio gambe', () => {
    const current = { ...prescribed('curl_manubri', 'isolation'), note: 'carenza' }
    const replacement = findExerciseReplacement(current, catalog, { ...equipment, available: [...equipment.available] }, preferences, new Set(['curl_manubri']), { reason: 'dislike', experience: 'advanced', split: 'legs' })!
    expect(replacement.movement_pattern).toBe('elbow_flexion')
    expect(replacement.primary_muscles).toContain('biceps')
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

  it('non propone un esercizio già presente e conserva lo slot compound', () => {
    const original = catalog.find((item) => item.id === 'rematore_bil')!
    const supported = normalizeExercise({
      ...original,
      id: 'rematore_chest_supported_man',
      name: 'Rematore con manubri chest-supported',
      equipment: 'dumbbell',
      required_equipment: ['dumbbells', 'bench'],
      stability_profile: 'supported',
      axial_load: 0,
    })
    const duplicate = { ...supported, id: 'gia_usato' }
    const replacement = findExerciseReplacement(
      prescribed(original.id),
      [...catalog, supported, duplicate],
      { ...equipment, available: [...equipment.available] },
      preferences,
      new Set([original.id, duplicate.id]),
      { reason: 'dislike', experience: 'advanced', split: 'pull' },
    )!
    expect(replacement.id).not.toBe(duplicate.id)
    expect(replacement.id).not.toBe(original.id)
    expect(replacement.exercise_types).toContain('compound')
    expect(replacement.movement_pattern).toBe('horizontal_pull')
  })

  it('restituisce una lista ordinata di alternative senza duplicati', () => {
    const alternatives = findExerciseReplacements(
      prescribed('squat'), catalog,
      { ...equipment, available: [...equipment.available] }, preferences,
      new Set(['squat', 'front_squat']),
      { reason: 'dislike', experience: 'advanced', split: 'legs' },
    )
    expect(alternatives.length).toBeGreaterThan(1)
    expect(alternatives.every(({ exercise }) => exercise.id !== 'front_squat')).toBe(true)
    expect(alternatives.every(({ exercise }) => exercise.exercise_types.includes('compound'))).toBe(true)
    expect(alternatives.map(({ score }) => score)).toEqual([...alternatives.map(({ score }) => score)].sort((a, b) => a - b))
  })

  it('nel Metcon Hybrid sostituisce un isolamento con bodybuilding leggero dello stesso muscolo', () => {
    const current = { ...prescribed('alzate_laterali', 'metcon'), note: 'isolamento', reps: '12-15', rest_sec: 30 }
    const replacement = findExerciseReplacement(
      current, catalog,
      { ...equipment, available: [...equipment.available] }, preferences,
      new Set(['alzate_laterali']),
      { reason: 'dislike', experience: 'advanced' },
    )!
    expect(replacement.primary_muscles).toContain('lateral_delts')
    expect(replacement.exercise_types).toContain('isolation')
    expect(replacement.systemic_fatigue).toBeLessThanOrEqual(1)
  })

  it('con focus_portion nota, preferisce un\'alternativa con lo stesso capo', () => {
    // curl_panca_scott = short_head; fra le alternative bicipiti c'è anche
    // curl_martello (brachialis) e curl_inclinata_man (long_head): deve
    // scegliere preacher_curl_macchina o curl_cavo, entrambi short_head.
    const current = prescribed('curl_panca_scott', 'isolation')
    const replacement = findExerciseReplacement(
      current, catalog,
      { ...equipment, available: [...equipment.available] }, preferences,
      new Set(['curl_panca_scott']),
      { reason: 'dislike', experience: 'advanced' },
    )!
    expect(replacement.focus_portion).toBe('short_head')
  })

  it('senza alternative con lo stesso focus_portion, torna al solo muscolo condiviso', () => {
    // Nessun altro esercizio del catalogo di test condivide focus_portion 'medial_head'
    // per i tricipiti oltre a dip_panca/dip_parallele/piegamenti_diamante stessi:
    // rifiutandoli tutti, deve comunque trovare un'alternativa tricipiti (fallback Pass 4).
    const current = prescribed('dip_panca', 'isolation')
    const replacement = findExerciseReplacement(
      current, catalog,
      { ...equipment, available: [...equipment.available] }, preferences,
      new Set(['dip_panca']),
      { reason: 'dislike', experience: 'advanced', rejectedIds: new Set(['dip_parallele', 'piegamenti_diamante']) },
    )!
    expect(replacement).toBeDefined()
    expect(replacement.primary_muscles).toContain('triceps')
  })

  it('il finisher FST-7 si sostituisce solo con cavi/macchine/isolamenti, mai un bilanciere pesante', () => {
    const current = { ...prescribed('panca_piana', 'isolation'), note: 'fst7_finisher', sets: 7, reps: '10-12' }
    const alternative = findExerciseReplacements(
      current, catalog,
      { ...equipment, available: [...equipment.available] }, preferences,
      new Set(['panca_piana']),
      { reason: 'dislike', experience: 'advanced' },
    )
    expect(alternative.length).toBeGreaterThan(0)
    for (const { exercise } of alternative) {
      expect(exercise.equipment === 'cable' || exercise.equipment === 'machine' || exercise.roles.includes('isolation')).toBe(true)
      expect(exercise.equipment).not.toBe('barbell')
    }
  })

  it('gestisce sostituzioni multiple sequenziali sullo stesso slot senza bloccarsi', () => {
    const original = prescribed('panca_piana')
    const rep1 = findExerciseReplacement(original, catalog, { ...equipment, available: [...equipment.available] }, preferences, new Set([original.exercise_id]), { reason: 'dislike', rejectedIds: new Set([original.exercise_id]), split: 'push' })
    expect(rep1).toBeDefined()

    const prescribed1 = prescribed(rep1!.id)
    const rejected1 = new Set([original.exercise_id, rep1!.id])
    const rep2 = findExerciseReplacement(prescribed1, catalog, { ...equipment, available: [...equipment.available] }, preferences, new Set([rep1!.id]), { reason: 'dislike', rejectedIds: rejected1, split: 'push' })
    expect(rep2).toBeDefined()
    expect(rep2!.id).not.toBe(original.exercise_id)
    expect(rep2!.id).not.toBe(rep1!.id)
  })
})

