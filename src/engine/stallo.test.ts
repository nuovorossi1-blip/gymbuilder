import { describe, expect, it } from 'vitest'
import { analizzaStallo, gradinoDiOggi, pianoScala, type BodyEntry } from './stallo'

const d0 = Date.UTC(2026, 8, 1)
const at = (day: number) => new Date(d0 + day * 86_400_000)
const voce = (day: number, weight_kg: number, extra: Partial<BodyEntry> = {}): BodyEntry =>
  ({ weight_kg, waist_cm: null, feels_flat: false, created_at: at(day).toISOString(), ...extra })

describe('ciclo delle calorie (regola di Rossi del 26/09)', () => {
  it('deficit a 2000 fermo da 4 settimane -> 2500 per 2 settimane, poi 2250, poi 2000', () => {
    const log = [voce(0, 82, { waist_cm: 94 }), voce(7, 82.1), voce(14, 81.9), voce(21, 82), voce(28, 82, { waist_cm: 94 })]
    const s = analizzaStallo(log, -500, 2000, at(0).toISOString(), at(28))!
    expect(s.tipo).toBe('mini_surplus')
    expect(s.piano.gradini).toEqual([{ kcal: 2500, giorni: 14 }, { kcal: 2250, giorni: 7 }, { kcal: 2000, giorni: 7 }])
  })
  it('dopo solo 2 settimane ferme non si fa ancora nulla (serve 4 settimane)', () => {
    const log = [voce(0, 82), voce(7, 82.1), voce(14, 82)]
    expect(analizzaStallo(log, -500, 2000, at(0).toISOString(), at(14))).toBeNull()
  })
  it('peso fermo ma girovita che cala: stai migliorando, nessuna pausa', () => {
    const log = [voce(0, 82, { waist_cm: 95 }), voce(10, 82), voce(20, 82), voce(28, 82, { waist_cm: 93 })]
    expect(analizzaStallo(log, -500, 2000, at(0).toISOString(), at(28))).toBeNull()
  })
  it('deficit che scende regolarmente: nessuna pausa', () => {
    const log = [voce(0, 82), voce(7, 81.6), voce(14, 81.2), voce(21, 80.8), voce(28, 80.4)]
    expect(analizzaStallo(log, -500, 2000, at(0).toISOString(), at(28))).toBeNull()
  })
  it('"mi sento piatto" dopo almeno 2 settimane basta per proporre la pausa', () => {
    const log = [voce(0, 82), voce(16, 82, { feels_flat: true })]
    expect(analizzaStallo(log, -250, 2250, at(0).toISOString(), at(17))?.tipo).toBe('mini_surplus')
    expect(analizzaStallo([voce(3, 82, { feels_flat: true })], -250, 2250, at(0).toISOString(), at(5))).toBeNull()
  })
  it('surplus troppo veloce -> 2500 per 2 settimane, poi 2750, poi 3000', () => {
    const log = [voce(0, 80), voce(7, 80.8), voce(14, 81.5)]
    const s = analizzaStallo(log, 500, 3000, at(0).toISOString(), at(14))!
    expect(s.tipo).toBe('mini_cut')
    expect(s.piano.gradini).toEqual([{ kcal: 2500, giorni: 14 }, { kcal: 2750, giorni: 7 }, { kcal: 3000, giorni: 7 }])
  })
  it('surplus con girovita +2 cm -> pausa', () => {
    const log = [voce(0, 80, { waist_cm: 84 }), voce(10, 80.3, { waist_cm: 86 })]
    expect(analizzaStallo(log, 500, 3000, at(0).toISOString(), at(10))?.tipo).toBe('mini_cut')
  })
  it('in normocalorica non si propone nulla', () => {
    expect(analizzaStallo([voce(0, 80, { feels_flat: true })], 0, 2500, null, at(1))).toBeNull()
  })
  it('il piano accettato dice le calorie di oggi, gradino per gradino', () => {
    const plan = { ...pianoScala('mini_surplus', 2000, 2500), started_at: at(0).toISOString() }
    expect(gradinoDiOggi(plan, at(1))).toMatchObject({ kcal: 2500, indice: 1, totale: 3 })
    expect(gradinoDiOggi(plan, at(13))).toMatchObject({ kcal: 2500, indice: 1 })
    expect(gradinoDiOggi(plan, at(15))).toMatchObject({ kcal: 2250, indice: 2 })
    expect(gradinoDiOggi(plan, at(22))).toMatchObject({ kcal: 2000, indice: 3 })
    expect(gradinoDiOggi(plan, at(29))).toBeNull()
  })
})
