import { describe, expect, it } from 'vitest'
import { analizzaStallo, gradinoDiOggi, pianoScala, type BodyEntry } from './stallo'

const d0 = Date.UTC(2026, 8, 1)
const at = (day: number) => new Date(d0 + day * 86_400_000)
const voce = (day: number, weight_kg: number, extra: Partial<BodyEntry> = {}): BodyEntry =>
  ({ weight_kg, waist_cm: null, feels_flat: false, created_at: at(day).toISOString(), ...extra })

describe('stallo e scala (blocco 3)', () => {
  it('cut con peso fermo da 2 settimane -> mini surplus 2250, 2500, 2250, 2000', () => {
    const log = [voce(0, 80), voce(7, 80.1), voce(14, 80), voce(15, 79.9)]
    const s = analizzaStallo(log, -500, 2000, at(0).toISOString(), at(15))!
    expect(s.tipo).toBe('mini_surplus')
    expect(s.piano.gradini.map((g) => g.kcal)).toEqual([2250, 2500, 2250, 2000])
  })
  it('cut che scende regolarmente: nessuno stallo', () => {
    const log = [voce(0, 80), voce(7, 79.5), voce(14, 79)]
    expect(analizzaStallo(log, -500, 2000, at(0).toISOString(), at(14))).toBeNull()
  })
  it('meno di 2 settimane di dati: non si giudica', () => {
    expect(analizzaStallo([voce(0, 80), voce(5, 80), voce(10, 80)], -500, 2000, at(0).toISOString(), at(10))).toBeNull()
  })
  it('"mi sento piatto" nell ultima settimana basta per proporre il mini surplus', () => {
    const s = analizzaStallo([voce(3, 80, { feels_flat: true })], -250, 2250, null, at(5))
    expect(s?.tipo).toBe('mini_surplus')
  })
  it('bulk troppo veloce -> mini cut 2750, 2500, 2750, 3000', () => {
    const log = [voce(0, 80), voce(7, 80.8), voce(14, 81.5)]
    const s = analizzaStallo(log, 500, 3000, at(0).toISOString(), at(14))!
    expect(s.tipo).toBe('mini_cut')
    expect(s.piano.gradini.map((g) => g.kcal)).toEqual([2750, 2500, 2750, 3000])
  })
  it('bulk con girovita +2 cm -> mini cut', () => {
    const log = [voce(0, 80, { waist_cm: 84 }), voce(10, 80.3, { waist_cm: 86 })]
    expect(analizzaStallo(log, 500, 3000, at(0).toISOString(), at(10))?.tipo).toBe('mini_cut')
  })
  it('in normocalorica non si propone nulla', () => {
    expect(analizzaStallo([voce(0, 80, { feels_flat: true })], 0, 2500, null, at(1))).toBeNull()
  })
  it('il piano accettato dice le calorie di oggi, gradino per gradino', () => {
    const plan = { ...pianoScala('mini_surplus', 2000), started_at: at(0).toISOString() }
    expect(gradinoDiOggi(plan, at(1))).toMatchObject({ kcal: 2250, indice: 1, totale: 4 })
    expect(gradinoDiOggi(plan, at(8))).toMatchObject({ kcal: 2500, indice: 2 })
    expect(gradinoDiOggi(plan, at(22))).toMatchObject({ kcal: 2000, indice: 4 })
    expect(gradinoDiOggi(plan, at(29))).toBeNull()
  })
})
