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
  it('deficit: RIR 2 sui composti, nessuna tecnica, mantenimento ridotto', () => {
    const legs = genera('legs', 'deficit')
    expect(legs.filter((exercise) => exercise.role === 'compound').every((exercise) => exercise.rir === '2')).toBe(true)
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
