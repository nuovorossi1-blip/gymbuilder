import { describe, expect, it } from 'vitest'
import catalogoReale from './fixtures/exercises.json'
import type { CompletedWorkout, Exercise, Muscle, WorkoutBlock } from '../../types'
import { analizzaSettimana, decidiRichiami } from '../weakPoints'
import { vuotoVolume } from '../shared'

const catalogo = catalogoReale as unknown as Exercise[]
const now = new Date('2026-08-06T12:00:00.000Z')

function completato(exerciseId: string, sets: number, completedAt: string, kind: WorkoutBlock['kind'] = 'main'): CompletedWorkout {
  return {
    id: `${exerciseId}-${completedAt}`,
    name: 'Test',
    mode: 'bodybuilding',
    duration_sec: 1800,
    rating: null,
    completed_at: completedAt,
    blocks: [{
      kind,
      title: 'Blocco',
      exercises: [{
        exercise_id: exerciseId,
        name: exerciseId,
        role: kind === 'metcon' ? 'metcon' : 'compound',
        muscle: null,
        sets,
        reps: '8',
        rest_sec: 60,
      }],
    }],
  }
}

describe('Weak Point Weekly Programming', () => {
  it('somma volume diretto e metà del volume indiretto', () => {
    const stato = analizzaSettimana(
      [completato('panca_piana', 4, '2026-08-05T12:00:00.000Z')],
      catalogo,
      7,
      now
    )
    expect(stato.volume.chest).toBe(4)
    expect(stato.volume.triceps).toBe(2)
    expect(stato.volume.front_delts).toBe(2)
  })

  it('considera anche i blocchi Metcon e ignora sessioni fuori finestra', () => {
    const stato = analizzaSettimana([
      completato('burpee', 2, '2026-08-05T12:00:00.000Z', 'metcon'),
      completato('panca_piana', 4, '2026-07-01T12:00:00.000Z'),
    ], catalogo, 7, now)
    expect(stato.volume.chest).toBe(2)
    expect(stato.last_trained_at.chest).toBe('2026-08-05T12:00:00.000Z')
  })

  it('non programma un richiamo prima del recupero minimo', () => {
    const volume = vuotoVolume()
    const richiami = decidiRichiami(
      ['biceps', 'triceps'],
      volume,
      ['back'],
      2,
      {
        now: now.getTime(),
        minimum_hours: 48,
        last_trained_at: {
          biceps: '2026-08-05T12:00:00.000Z',
          triceps: '2026-08-03T00:00:00.000Z',
        },
      }
    )
    expect(richiami).toEqual(['triceps'] satisfies Muscle[])
  })
})
