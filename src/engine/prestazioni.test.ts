import { describe, expect, it } from 'vitest'
import { progressiEsercizio, riassuntoProgressi } from './prestazioni'
import type { CompletedWorkout } from '../types'

const seduta = (data: string, reps: number[]): CompletedWorkout => ({
  id: data, user_id: 'u', name: 'Pull A', mode: 'bodybuilding', split: 'pull', goal: 'hypertrophy', experience: 'advanced', duration_min: 70,
  duration_sec: 4000, completed_at: `${data}T10:00:00Z`, rating: null, notes: null,
  blocks: [{ kind: 'main', title: 'x', exercises: [{ exercise_id: 'trazioni', name: 'Trazioni', role: 'compound', muscle: 'back', sets: 5, reps: '3-4', rest_sec: 150, prestazione: true, logged_reps: reps }] }],
} as unknown as CompletedWorkout)

describe('progressi sugli esercizi da migliorare', () => {
  it('serie migliore e ripetizioni totali per seduta, in ordine di data', () => {
    const p = progressiEsercizio('trazioni', [seduta('2026-10-08', [5, 4, 4, 4, 3]), seduta('2026-10-01', [4, 4, 3, 3, 3])])
    expect(p.map((x) => [x.data, x.migliore, x.totale])).toEqual([['2026-10-01', 4, 17], ['2026-10-08', 5, 20]])
    expect(riassuntoProgressi(p)).toBe('miglior serie 4 → 5 in 2 sedute')
  })
  it('senza registrazioni lo dice', () => {
    expect(riassuntoProgressi(progressiEsercizio('trazioni', []))).toBe('nessuna seduta registrata ancora')
  })
})
