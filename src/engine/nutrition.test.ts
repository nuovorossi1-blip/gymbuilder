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
    // Peso stabile a 2500 kcal: 2500 diventa la normocalorica dichiarata (vince sulla formula).
    expect(info?.maintenance_kcal).toBe(2500)
    expect(info?.maintenance_source).toBe('dichiarata')
    expect(info?.calorie_step).toBe(0)
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

import { gradinoCalorie, rampaVolume, stepDaOffset } from './nutrition'

describe('la scala (Principio 11 di Rossi, 23/09)', () => {
  const giorno = (d: number) => new Date(Date.UTC(2026, 8, 1) + d * 86_400_000).toISOString()
  const oggi = (d: number) => new Date(Date.UTC(2026, 8, 1) + d * 86_400_000)

  it('i gradini sono relativi alla normocalorica, a passi di 250, da -500 a +1000', () => {
    expect(stepDaOffset(-600)).toBe(-500)
    expect(stepDaOffset(260)).toBe(250)
    expect(stepDaOffset(1400)).toBe(1000)
    const p = { ...base, maintenance_kcal: 2500 }
    expect([2000, 2250, 2500, 2750, 3000, 3250, 3500].map((daily_kcal) => gradinoCalorie({ ...p, daily_kcal }))).toEqual([-500, -250, 0, 250, 500, 750, 1000])
  })

  it('salto 2000 -> 3000 in un giorno: il volume sale un gradino a settimana, dopo 7 giorni', () => {
    const log = [
      { kcal: 2000, maintenance_kcal: 2500, step: -500, created_at: giorno(0) },
      { kcal: 3000, maintenance_kcal: 2500, step: 500, created_at: giorno(30) },
    ]
    expect(rampaVolume(500, log, oggi(33)).volume_step).toBe(-500) // 3 giorni: ancora fermo
    expect(rampaVolume(500, log, oggi(33)).direction).toBe('up')
    expect(rampaVolume(500, log, oggi(37)).volume_step).toBe(-250) // dopo 7 giorni: +1 gradino
    expect(rampaVolume(500, log, oggi(44)).volume_step).toBe(0)
    expect(rampaVolume(500, log, oggi(51)).volume_step).toBe(250)
    expect(rampaVolume(500, log, oggi(58)).volume_step).toBe(500)
    expect(rampaVolume(500, log, oggi(58)).direction).toBeNull()
  })

  it('anche in discesa è una scala (scelta di Rossi: sempre graduale)', () => {
    const log = [
      { kcal: 3500, maintenance_kcal: 2500, step: 1000, created_at: giorno(0) },
      { kcal: 3000, maintenance_kcal: 2500, step: 500, created_at: giorno(60) },
    ]
    const r = rampaVolume(500, log, oggi(62))
    expect(r).toMatchObject({ volume_step: 1000, direction: 'down', next_change_in_days: 5 })
    expect(rampaVolume(500, log, oggi(67)).volume_step).toBe(750)
    expect(rampaVolume(500, log, oggi(74)).volume_step).toBe(500)
  })

  it('senza storico il volume coincide subito con il gradino (primo inserimento)', () => {
    expect(rampaVolume(250, [], oggi(0))).toMatchObject({ volume_step: 250, direction: null })
  })

  it('determinaFase spiega la rampa in italiano', () => {
    const log = [
      { kcal: 2500, maintenance_kcal: 2500, step: 0, created_at: giorno(0) },
      { kcal: 2750, maintenance_kcal: 2500, step: 250, created_at: giorno(20) },
    ]
    const info = determinaFase({ ...base, maintenance_kcal: 2500, daily_kcal: 2750 }, log, oggi(23))!
    expect(info.calorie_step).toBe(250)
    expect(info.training_step).toBe(0)
    expect(info.summary).toContain('il volume è ancora al livello 2500 kcal e sale di un gradino')
  })
})
