import { describe, expect, it } from 'vitest'
import { adaptPrescriptionForProfile, computeBiomechanicalAdjustments, resolveEffectiveWeakPoints } from './biomechanics'
import type { PrescribedExercise } from '../types'

describe('Biomechanical Profile Engine', () => {
  it('non inventa carenze dal profilo se l’utente non ne seleziona nessuna', () => {
    const weakPoints = resolveEffectiveWeakPoints([], { sex: 'female' })
    expect(weakPoints).toEqual([])
  })

  it('dà SEMPRE priorità alle carenze esplicite scelte dall’utente', () => {
    const weakPoints = resolveEffectiveWeakPoints(['biceps', 'chest'], { sex: 'female' })
    expect(weakPoints).toEqual(['biceps', 'chest'])
  })

  it('adatta tempi di recupero e rep range per profili femminili (recupero metabolico più rapido)', () => {
    const compound: PrescribedExercise = {
      exercise_id: 'panca_piana', name: 'Panca piana bilanciere', role: 'compound', muscle: 'chest', sets: 4, reps: '6-8', rest_sec: 120,
    }
    const isolation: PrescribedExercise = {
      exercise_id: 'alzate_laterali', name: 'Alzate laterali', role: 'isolation', muscle: 'lateral_delts', sets: 3, reps: '8-12', rest_sec: 60,
    }

    const adaptedCompound = adaptPrescriptionForProfile(compound, { sex: 'female' })
    const adaptedIsolation = adaptPrescriptionForProfile(isolation, { sex: 'female' })

    expect(adaptedCompound.rest_sec).toBe(102) // 120 * 0.85
    expect(adaptedIsolation.rest_sec).toBe(48) // 60 * 0.80
    expect(adaptedIsolation.reps).toBe('10-15')
  })

  it('mantiene il recupero completo neuro-muscolare ATP/PCr per gli uomini', () => {
    const compound: PrescribedExercise = {
      exercise_id: 'panca_piana', name: 'Panca piana bilanciere', role: 'compound', muscle: 'chest', sets: 4, reps: '6-8', rest_sec: 120,
    }
    const adaptedMale = adaptPrescriptionForProfile(compound, { sex: 'male' })
    expect(adaptedMale.rest_sec).toBe(120) // 120 * 1.0
  })

  it('incrementa recupero sui multiarticolari pesanti per utenti senior (50+)', () => {
    const original: PrescribedExercise = {
      exercise_id: 'panca_piana', name: 'Panca piana bilanciere', role: 'compound', muscle: 'chest', sets: 4, reps: '6-8', rest_sec: 90,
    }
    const adapted = adaptPrescriptionForProfile(original, { age: 55, sex: 'male' })
    expect(adapted.rest_sec).toBe(108) // 90 * 1.20 = 108
  })

  it('calcola correttamente le regolazioni per atleti alti o senior', () => {
    const adj = computeBiomechanicalAdjustments({ height_cm: 192, age: 52 })
    expect(adj.preferSupported).toBe(true)
    expect(adj.capAxialLoad).toBe(true)
    expect(adj.warmupExtraMin).toBe(3)
  })
})
