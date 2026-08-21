import { describe, expect, it } from 'vitest'
import { ultimiPesiPerEsercizio } from './weightHistory'
import type { CompletedWorkout } from '../types'

function allenamento(id: string, esercizi: { exercise_id: string; logged_weight_kg?: number }[]): CompletedWorkout {
  return {
    id,
    name: `Allenamento ${id}`,
    mode: 'bodybuilding',
    duration_sec: 3000,
    rating: null,
    completed_at: '2026-08-21T00:00:00Z',
    blocks: [{
      kind: 'main',
      title: 'Principale',
      exercises: esercizi.map((e) => ({
        exercise_id: e.exercise_id, name: e.exercise_id, role: 'compound', muscle: null,
        sets: 3, reps: '8-12', rest_sec: 90, logged_weight_kg: e.logged_weight_kg,
      })),
    }],
  }
}

describe('ultimiPesiPerEsercizio', () => {
  it('prende il peso dal primo allenamento (il più recente) in cui compare, non l\'ultimo in ordine di array', () => {
    const storico = [
      allenamento('recente', [{ exercise_id: 'panca_piana', logged_weight_kg: 80 }]),
      allenamento('vecchio', [{ exercise_id: 'panca_piana', logged_weight_kg: 70 }]),
    ]
    expect(ultimiPesiPerEsercizio(storico)).toEqual({ panca_piana: 80 })
  })

  it('ignora gli esercizi senza peso registrato', () => {
    const storico = [allenamento('a', [{ exercise_id: 'squat' }])]
    expect(ultimiPesiPerEsercizio(storico)).toEqual({})
  })

  it('se il più recente non ha il peso ma uno più vecchio sì, usa quello più vecchio (primo trovato con un valore)', () => {
    const storico = [
      allenamento('recente', [{ exercise_id: 'squat' }]), // senza peso questa volta
      allenamento('vecchio', [{ exercise_id: 'squat', logged_weight_kg: 100 }]),
    ]
    expect(ultimiPesiPerEsercizio(storico)).toEqual({ squat: 100 })
  })

  it('raccoglie esercizi diversi da allenamenti diversi', () => {
    const storico = [
      allenamento('a', [{ exercise_id: 'panca_piana', logged_weight_kg: 80 }]),
      allenamento('b', [{ exercise_id: 'squat', logged_weight_kg: 100 }]),
    ]
    expect(ultimiPesiPerEsercizio(storico)).toEqual({ panca_piana: 80, squat: 100 })
  })

  it('storico vuoto ritorna un oggetto vuoto, non un errore', () => {
    expect(ultimiPesiPerEsercizio([])).toEqual({})
  })
})
