import { describe, expect, it } from 'vitest'
import { adaptPrescriptionForProfile, computeBiomechanicalAdjustments, resolveEffectiveWeakPoints } from './biomechanics'
import type { PrescribedExercise } from '../types'

describe('Biomechanical Profile Engine', () => {
  it('assegna carenze fisiologiche femminili di default se l’utente non ne seleziona nessuna', () => {
    const weakPoints = resolveEffectiveWeakPoints([], { sex: 'female' })
    expect(weakPoints).toContain('glutes')
    expect(weakPoints).toContain('hamstrings')
    expect(weakPoints).toContain('lateral_delts')
  })

  it('dà SEMPRE priorità alle carenze esplicite scelte dall’utente', () => {
    const weakPoints = resolveEffectiveWeakPoints(['biceps', 'chest'], { sex: 'female' })
    expect(weakPoints).toEqual(['biceps', 'chest'])
  })

  it('adatta recupero e rep range per profili femminili sugli isolamenti', () => {
    const original: PrescribedExercise = {
      exercise_id: 'alzate_laterali',
      name: 'Alzate laterali',
      role: 'isolation',
      muscle: 'lateral_delts',
      sets: 3,
      reps: '8-12',
      rest_sec: 60,
    }
    const adapted = adaptPrescriptionForProfile(original, { sex: 'female' })
    expect(adapted.reps).toBe('10-15')
    expect(adapted.rest_sec).toBe(54) // 60 * 0.9
  })

  it('incrementa recupero sui multiarticolari pesanti per utenti senior (50+)', () => {
    const original: PrescribedExercise = {
      exercise_id: 'panca_piana',
      name: 'Panca piana bilanciere',
      role: 'compound',
      muscle: 'chest',
      sets: 4,
      reps: '6-8',
      rest_sec: 90,
    }
    const adapted = adaptPrescriptionForProfile(original, { age: 55, sex: 'male' })
    expect(adapted.rest_sec).toBe(106) // 90 * 1.18 = 106.2 -> 106
  })

  it('calcola correttamente le regolazioni per atleti alti o senior', () => {
    const adj = computeBiomechanicalAdjustments({ height_cm: 192, age: 52 })
    expect(adj.preferSupported).toBe(true)
    expect(adj.capAxialLoad).toBe(true)
    expect(adj.warmupExtraMin).toBe(3)
  })
})
