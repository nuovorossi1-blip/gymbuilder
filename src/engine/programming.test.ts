import { describe, expect, it } from 'vitest'
import { generaBodybuilding } from '../generators/bodybuilding'
import { MUSCOLI_GRANDI, NOTA_ANTAGONISTA, violazioniInterleave } from './programming'
import type { Exercise, Muscle, NutritionPhase, Split } from '../types'
import catalogo from '../generators/__tests__/fixtures/exercises.json'

const cat = catalogo as unknown as Exercise[]
const genera = (split: Split, phase: NutritionPhase | null, carenze: Muscle[] = [], seed = 5) =>
  generaBodybuilding(cat, {
    split, goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym', duration_min: 75,
    priority_muscles: carenze, excluded_exercises: [], seed, nutrition_phase: phase,
  }).blocks.find((block) => block.kind === 'main')!.exercises

describe('interleave per fase (regole di Rossi del 23/09)', () => {
  it('in deficit mai due esercizi dello stesso muscolo in fila (Pull, Push, Legs, Upper)', () => {
    for (const split of ['pull', 'push', 'legs', 'upper'] as Split[]) {
      for (const seed of [1, 5, 9, 13]) {
        expect(violazioniInterleave(genera(split, 'deficit', [], seed), [], 'deficit')).toEqual([])
      }
    }
  })
  it('in normocalorica al massimo 2 di fila', () => {
    for (const split of ['pull', 'legs'] as Split[]) expect(violazioniInterleave(genera(split, 'maintenance'), [], 'maintenance')).toEqual([])
  })
  it('in surplus ammette tre esercizi di dorso consecutivi', () => {
    const pull = genera('pull', 'surplus')
    expect(pull.slice(0, 3).map((exercise) => exercise.muscle)).toEqual(['back', 'back', 'back'])
  })
  it('sul muscolo carente l interleave resta anche in surplus', () => {
    for (const seed of [1, 5, 9]) {
      const pull = genera('pull', 'surplus', ['back'], seed)
      expect(violazioniInterleave(pull, ['back'], 'surplus')).toEqual([])
    }
  })
})

describe('gerarchia di posizione', () => {
  it('carenza piccola in slot 1, muscoli grandi mai all ultimo posto', () => {
    const push = genera('push', 'deficit', ['lateral_delts'])
    expect(push[0].muscle).toBe('lateral_delts')
    const last = push[push.length - 1]
    expect(last.role === 'compound' && MUSCOLI_GRANDI.has(last.muscle!)).toBe(false)
    expect(push.findIndex((exercise) => exercise.muscle === 'chest')).toBeLessThanOrEqual(2)
  })
})

describe('calibrazione per fase (Principio 5)', () => {
  it('deficit: RIR 1-2 sui composti (tabella di Rossi), nessuna tecnica, mantenimento ridotto', () => {
    const legs = genera('legs', 'deficit')
    expect(legs.filter((exercise) => exercise.role === 'compound').every((exercise) => exercise.rir === '1-2')).toBe(true)
    expect(legs.some((exercise) => exercise.technique)).toBe(false)
    expect(legs.filter((exercise) => exercise.role === 'isolation').every((exercise) => exercise.sets <= 2)).toBe(true)
  })
  it('normocalorica: drop set sulla carenza, mai sui composti', () => {
    const push = genera('push', 'maintenance', ['lateral_delts'])
    expect(push.find((exercise) => exercise.muscle === 'lateral_delts')?.technique).toMatch(/Drop set/)
    expect(push.filter((exercise) => exercise.role === 'compound').some((exercise) => exercise.technique)).toBe(false)
  })
  it('richiamo antagonista: bicipiti in Push e tricipiti in Pull, 2 serie in deficit, RIR 1', () => {
    const push = genera('push', 'deficit')
    const bi = push.find((exercise) => exercise.note === NOTA_ANTAGONISTA)
    expect(bi?.muscle).toBe('biceps')
    expect(bi?.sets).toBe(2)
    expect(bi?.rir).toBe('1')
    expect(push.indexOf(bi!)).toBeGreaterThanOrEqual(3)
    const pull = genera('pull', 'maintenance')
    const tri = pull.find((exercise) => exercise.note === NOTA_ANTAGONISTA)
    expect(tri?.muscle).toBe('triceps')
    expect(tri?.sets).toBe(3)
    expect(pull[pull.length - 1]).toBe(tri)
  })
  it('se il bicipite è carente in Push non viene declassato a richiamo', () => {
    const push = genera('push', 'deficit', ['biceps'])
    expect(push.some((exercise) => exercise.note === NOTA_ANTAGONISTA)).toBe(false)
  })
  it('senza fase nota non cambia nulla rispetto a prima (nessun RIR, nessuna nota)', () => {
    const push = genera('push', null)
    expect(push.some((exercise) => exercise.rir)).toBe(false)
  })
})

describe('tabella master per gradino e dip (23/09)', () => {
  const gen = (split: Split, step: number, carenze: Muscle[] = [], seed = 5) =>
    generaBodybuilding(cat, {
      split, goal: 'hypertrophy', experience: 'advanced', equipment: 'full_gym', duration_min: 90,
      priority_muscles: carenze, excluded_exercises: [], seed, nutrition_step: step,
    }).blocks.find((block) => block.kind === 'main')!.exercises

  it('nessun multiarticolare all ultimo slot, dip compreso, in tutte le fasi', () => {
    for (const step of [-500, 0, 500, 1000]) {
      for (const seed of [1, 5, 9]) {
        for (const split of ['push', 'pull', 'legs', 'upper'] as Split[]) {
          const main = gen(split, step, ['lateral_delts', 'triceps'], seed)
          expect(main[main.length - 1].role).not.toBe('compound')
        }
      }
    }
  })

  it('il volume extra va prima alle carenze: a +250 sale la carenza, non il mantenimento', () => {
    const a = gen('pull', 0, ['biceps'])
    const b = gen('pull', 250, ['biceps'])
    const serie = (m: typeof a, muscle: Muscle) => m.filter((e) => e.muscle === muscle).reduce((t, e) => t + e.sets, 0)
    expect(serie(b, 'back')).toBe(serie(a, 'back'))
    expect(gen('pull', -500, ['biceps']).find((e) => e.muscle === 'biceps')!.sets).toBe(3)
    expect(gen('pull', 1000, ['biceps']).find((e) => e.muscle === 'biceps')!.sets).toBe(5)
  })

  it('tecniche crescono coi gradini e restano sugli isolamenti carenti', () => {
    const tecniche = (step: number) => gen('push', step, ['lateral_delts', 'triceps']).filter((e) => e.technique).length
    expect(tecniche(-500)).toBe(0)
    expect(tecniche(-250)).toBe(0)
    expect(tecniche(0)).toBe(1)
    expect(tecniche(1000)).toBeGreaterThanOrEqual(2)
    expect(gen('push', 1000, ['lateral_delts']).filter((e) => e.role === 'compound').some((e) => e.technique)).toBe(false)
  })

  it('richiamo antagonista: 2 serie in deficit, 4 al gradino massimo', () => {
    expect(gen('push', -500).find((e) => e.note === NOTA_ANTAGONISTA)?.sets).toBe(2)
    expect(gen('push', 1000).find((e) => e.note === NOTA_ANTAGONISTA)?.sets).toBe(4)
  })
})
