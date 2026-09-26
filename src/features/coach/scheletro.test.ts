import { describe, expect, it } from 'vitest'
import { confrontaConScheletro, costruisciScheletro } from './scheletro'
import { violazioniInterleave } from '../../engine/programming'
import type { Exercise, Muscle } from '../../types'
import catalogo from '../../generators/__tests__/fixtures/exercises.json'

const cat = catalogo as unknown as Exercise[]
const carenzeSpalleBraccia: Muscle[] = ['lateral_delts', 'rear_delts', 'front_delts', 'biceps', 'triceps']
const sch = costruisciScheletro({ giorni: 5, carenze: carenzeSpalleBraccia, forti: ['chest', 'glutes', 'quads', 'hamstrings'], step: -500 })
const seduta = (nome: string) => sch.sedute.find((s) => s.nome === nome)!

describe('scheletro della scheda (regole di Rossi, 26/09)', () => {
  it('5 giorni = Pull A, Push A, Legs, Pull B, Push B', () => {
    expect(sch.sedute.map((s) => s.nome)).toEqual(['Pull A', 'Push A', 'Legs', 'Pull B', 'Push B'])
  })
  it('gambe forti: 1 multi quadricipiti, 1 multi femorali, 1 iso quadricipiti, 1 iso femorali, polpacci; niente hip thrust', () => {
    const legs = seduta('Legs').slot.filter((s) => s.tipo !== 'carenza')
    const firma = legs.map((s) => `${s.muscolo}/${s.ruolo}`).sort()
    expect(firma).toEqual(['calves/isolamento', 'hamstrings/isolamento', 'hamstrings/multiarticolare', 'quads/isolamento', 'quads/multiarticolare'].sort())
    expect(seduta('Legs').slot.some((s) => s.muscolo === 'glutes')).toBe(false)
    expect(seduta('Legs').slot[0].muscolo).toBe('lateral_delts') // richiamo della carenza in apertura
  })
  it('hip thrust solo se i glutei sono carenti', () => {
    const conGlutei = costruisciScheletro({ giorni: 5, carenze: ['glutes'], forti: [], step: 0 })
    expect(conGlutei.sedute.find((s) => s.nome === 'Legs')!.slot.some((s) => s.muscolo === 'glutes')).toBe(true)
  })
  it('spalle carenti: alzate laterali x2, shoulder press, alzate frontali, aperture posteriori', () => {
    expect(seduta('Push A').slot.filter((s) => s.muscolo === 'lateral_delts')).toHaveLength(2)
    expect(seduta('Push A').slot.some((s) => s.muscolo === 'front_delts' && s.ruolo === 'multiarticolare')).toBe(true)
    expect(seduta('Push B').slot.some((s) => s.muscolo === 'front_delts' && s.ruolo === 'isolamento')).toBe(true)
    expect(seduta('Pull A').slot.some((s) => s.muscolo === 'rear_delts')).toBe(true)
  })
  it('braccia carenti: 2 esercizi di bicipiti nei Pull e 2 di tricipiti nei Push, più il richiamo', () => {
    expect(seduta('Pull A').slot.filter((s) => s.muscolo === 'biceps' && s.tipo === 'carenza')).toHaveLength(2)
    expect(seduta('Push A').slot.filter((s) => s.muscolo === 'triceps' && s.tipo === 'carenza')).toHaveLength(2)
    expect(seduta('Push A').slot.some((s) => s.muscolo === 'biceps' && s.tipo === 'richiamo')).toBe(true)
  })
  it('carenze nei primi slot, mai un multiarticolare in fondo, interleave in deficit', () => {
    for (const sd of sch.sedute) {
      expect(sd.slot[0].tipo).toBe('carenza')
      expect(sd.slot[sd.slot.length - 1].ruolo).toBe('isolamento')
      const finti = sd.slot.map((s) => ({ muscle: s.muscolo }))
      expect(violazioniInterleave(finti, carenzeSpalleBraccia, 'deficit')).toEqual([])
    }
  })
  it('volume: carenze nel loro range (14-18 in deficit), punti forti al minimo efficace', () => {
    for (const m of ['lateral_delts', 'biceps', 'triceps'] as Muscle[]) {
      const v = sch.volume.find((x) => x.muscolo === m)!
      expect(v.serie).toBeGreaterThanOrEqual(14)
      expect(v.serie).toBeLessThanOrEqual(18)
    }
    for (const m of ['chest', 'quads', 'hamstrings'] as Muscle[]) expect(sch.volume.find((x) => x.muscolo === m)!.serie).toBeLessThanOrEqual(8)
    const carenze = sch.volume.filter((v) => v.carenza && v.muscolo !== 'front_delts')
    const forti = sch.volume.filter((v) => ['chest', 'quads', 'hamstrings'].includes(v.muscolo))
    expect(Math.min(...carenze.map((v) => v.serie))).toBeGreaterThan(Math.max(...forti.map((v) => v.serie)))
  })
  it('con il dorso carente (3 esercizi) c è il secondo bicipite e il Pull non chiude con un multiarticolare', () => {
    const s2 = costruisciScheletro({ giorni: 5, carenze: ['front_delts', 'lateral_delts', 'rear_delts', 'back'], forti: ['chest', 'glutes', 'quads'], step: -500 })
    for (const sd of s2.sedute.filter((x) => x.split === 'pull')) {
      expect(sd.slot.filter((s) => s.muscolo === 'back')).toHaveLength(3)
      expect(sd.slot[sd.slot.length - 1].ruolo).toBe('isolamento')
    }
  })
  it('un piano che non segue lo scheletro viene rifiutato con il motivo', () => {
    const plan = {
      titolo: 'x', giorni_settimana: 5, durata_min: 75, calorie: null, macro: { proteine_g: null, grassi_g: null, carboidrati_g: null }, note: '',
      sedute: sch.sedute.map((sd) => ({ nome: sd.nome, split: sd.split, esercizi: sd.slot.map((s) => ({ exercise_id: 'hip_thrust', nome: 'Hip thrust', serie: s.serie, reps: s.reps, rir: s.rir, recupero_sec: 90 })) })),
    }
    const errori = confrontaConScheletro(plan, sch, cat)
    expect(errori.length).toBeGreaterThan(0)
    expect(errori[0]).toContain('serve')
  })
})
