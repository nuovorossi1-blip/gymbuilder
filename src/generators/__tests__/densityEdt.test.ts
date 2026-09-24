import { describe, expect, it } from 'vitest'
import { densityEdtComeGeneratedWorkout, generaDensityEdt, leggiStoricoEdt, prossimaFase, DENSITY_SPLIT_SUPPORTATI } from '../densityEdt'
import type { CompletedWorkout, Exercise } from '../../types'
import catalogo from './fixtures/exercises.json'

const cat = catalogo as unknown as Exercise[]
const base = { equipment: 'full_gym' as const, excluded_exercises: [] as string[] }

describe('Density 3-6-9 EDT (25/09)', () => {
  it('rotazione 9 -> 6 -> 3 -> scarico -> 9', () => {
    expect([null, 9, 6, 3, 'scarico'].map((f) => prossimaFase(f as never))).toEqual([9, 6, 3, 'scarico', 9])
  })
  it('3 zone da 15 min con coppie di esercizi diversi per ogni split supportato (60+ min)', () => {
    for (const split of DENSITY_SPLIT_SUPPORTATI) {
      const w = generaDensityEdt(cat, { ...base, split, duration_min: 60 })!
      expect(w.zones.length).toBe(3)
      expect(w.zones.every((z) => z.minutes === 15)).toBe(true)
      const ids = w.zones.flatMap((z) => z.pair.map((e) => e.exercise_id))
      expect(new Set(ids).size).toBe(ids.length)
      expect(w.estimated_duration_min).toBe(8 + 45 + 10)
    }
  })
  it('sotto i 60 minuti 2 zone; scarico = 2 zone da 10 min, 6 ripetizioni, RIR 3', () => {
    expect(generaDensityEdt(cat, { ...base, split: 'push', duration_min: 45 })!.zones.length).toBe(2)
    const s = generaDensityEdt(cat, { ...base, split: 'push', fase: 'scarico' })!
    expect(s).toMatchObject({ rep_target: 6, rir: '3' })
    expect(s.zones.every((z) => z.minutes === 10)).toBe(true)
  })
  it('stessa configurazione = stessi esercizi (serve per confrontare il record)', () => {
    const a = generaDensityEdt(cat, { ...base, split: 'upper' })!
    const b = generaDensityEdt(cat, { ...base, split: 'upper' })!
    expect(a.zones.map((z) => z.key)).toEqual(b.zones.map((z) => z.key))
  })
  it('lo storico dà la fase successiva, il record e il suggerimento +5% quando si supera il record del 20%', () => {
    const w = generaDensityEdt(cat, { ...base, split: 'push', fase: 9 })!
    const salva = (tot: number, giorno: number): CompletedWorkout => {
      const g = densityEdtComeGeneratedWorkout({ ...w, zones: w.zones.map((z) => ({ ...z, pair: [{ ...z.pair[0], reps_done: tot / 2 }, { ...z.pair[1], reps_done: tot / 2 }] })) })
      return { id: String(giorno), name: g.name, mode: 'bodybuilding', duration_sec: 3600, rating: null, completed_at: new Date(Date.UTC(2026, 8, giorno)).toISOString(), blocks: g.blocks }
    }
    const storico = leggiStoricoEdt([salva(100, 1), salva(126, 5)])
    expect(storico.ultimaFase).toBe(9)
    const dopo = generaDensityEdt(cat, { ...base, split: 'push', fase: 9, storico })!
    expect(dopo.zones[0].record).toBe(126)
    expect(dopo.zones[0].suggerisci_carico).toBe(true)
    expect(generaDensityEdt(cat, { ...base, split: 'push', storico })!.fase).toBe(6)
  })
  it('il formato comune conserva zona, fase e ripetizioni fatte per lo storico', () => {
    const w = generaDensityEdt(cat, { ...base, split: 'legs' })!
    const g = densityEdtComeGeneratedWorkout(w)
    expect(g.blocks).toHaveLength(w.zones.length)
    expect(g.blocks[0].exercises[0].edt).toMatchObject({ zone_key: w.zones[0].key, fase: 9, rep_target: 9 })
  })
})
