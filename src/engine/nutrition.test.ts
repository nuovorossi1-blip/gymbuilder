import { describe, expect, it } from 'vitest'
import { determinaFase, escludiPerFastidi, stimaNormocalorica } from './nutrition'
import type { Exercise, Profile } from '../types'
import catalogo from '../generators/__tests__/fixtures/exercises.json'

const base: Profile = { id: 'u', display_name: null, weight_kg: 80, height_cm: 178, age: 35, sex: 'male', job_activity: 'sedentary' }

describe('fase nutrizionale (prompt di Rossi, Principio 5)', () => {
  it('stima la normocalorica con Mifflin-St Jeor per il fattore di attività', () => {
    // 10*80 + 6.25*178 - 5*35 + 5 = 1742.5 -> x1.4 = 2439.5 -> 2440
    expect(stimaNormocalorica(base)).toBe(2440)
    expect(stimaNormocalorica({ ...base, job_activity: null })).toBeNull()
  })

  it("l'esempio di Rossi: 2500 kcal, peso stabile, ufficio -> normocalorica", () => {
    const info = determinaFase({ ...base, daily_kcal: 2500, weight_trend: 'stable' })
    expect(info?.phase).toBe('maintenance')
    expect(info?.source).toBe('trend')
  })

  it("senza andamento del peso decide il rapporto calorie/normocalorica", () => {
    expect(determinaFase({ ...base, daily_kcal: 2000 })?.phase).toBe('deficit')
    expect(determinaFase({ ...base, daily_kcal: 2450 })?.phase).toBe('maintenance')
    expect(determinaFase({ ...base, daily_kcal: 3500 })?.phase).toBe('surplus')
  })

  it("l'andamento del peso misurato vince sulla formula", () => {
    expect(determinaFase({ ...base, daily_kcal: 3500, weight_trend: 'losing' })?.phase).toBe('deficit')
  })

  it('senza dati sufficienti la fase resta sconosciuta (il motore si comporta come prima)', () => {
    expect(determinaFase({ ...base, daily_kcal: null })).toBeNull()
    expect(determinaFase(null)).toBeNull()
  })

  it('sonno sotto 6 ore o stress alto abbassano di un livello la fase usata per il volume', () => {
    const info = determinaFase({ ...base, weight_trend: 'gaining', sleep_hours: 5 })
    expect(info?.phase).toBe('surplus')
    expect(info?.training_phase).toBe('maintenance')
    expect(determinaFase({ ...base, weight_trend: 'stable', stress_level: 'high' })?.training_phase).toBe('deficit')
  })
})

describe('fastidi articolari', () => {
  const cat = catalogo as unknown as Exercise[]
  it('toglie dip e lento avanti con fastidio alle spalle, lasciando la shoulder press alla macchina', () => {
    const ids = escludiPerFastidi(cat, ['shoulders']).map((exercise) => exercise.id)
    expect(ids).not.toContain('dip_parallele')
    expect(ids).not.toContain('military_press')
    expect(ids).toContain('shoulder_press_mac')
  })
  it('con le ginocchia toglie i salti ma non i polpacci', () => {
    const ids = escludiPerFastidi(cat, ['knees']).map((exercise) => exercise.id)
    expect(ids).not.toContain('box_jump_over')
    expect(ids).toContain('calf_in_piedi')
  })
  it('con la schiena bassa toglie i carichi assiali alti', () => {
    const fake = [{ id: 'squat', axial_load: 3, movement_pattern: 'squat', primary_muscles: ['quads'] }, { id: 'leg_press', axial_load: 0, movement_pattern: 'squat', primary_muscles: ['quads'] }]
    expect(escludiPerFastidi(fake, ['lower_back']).map((exercise) => exercise.id)).toEqual(['leg_press'])
  })
})
