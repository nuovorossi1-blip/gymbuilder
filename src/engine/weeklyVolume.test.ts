import { describe, expect, it } from 'vitest'
import { contaSerie, stimaVolumeSettimanale } from './weeklyVolume'
import type { GeneratedWorkout, WeeklyProgram } from '../types'

const workout = (exs: Array<[string, number, string?]>): GeneratedWorkout => ({
  name: 't', mode: 'bodybuilding', split: 'push', goal: 'hypertrophy', experience: 'advanced', duration_min: 60, warnings: [],
  blocks: [
    { kind: 'warmup', title: 'r', exercises: [{ exercise_id: 'w', name: 'w', role: 'warmup', muscle: 'chest', sets: 2, reps: '10', rest_sec: 0 }] },
    { kind: 'main', title: 'a', exercises: exs.map(([muscle, sets, note], i) => ({ exercise_id: `e${i}`, name: 'e', role: 'isolation', muscle: muscle as never, sets, reps: '10', rest_sec: 60, note })) },
  ],
})

describe('volume settimanale', () => {
  it('conta le serie per distretto escludendo riscaldamento e avvicinamento', () => {
    expect(contaSerie(workout([['chest', 4], ['chest', 3], ['biceps', 2], ['chest', 1, 'avvicinamento']]))).toEqual({ chest: 7, biceps: 2 })
  })
  it('confronta il totale con il range della fase e segnala carenze basse', () => {
    const program = {
      config: { weak_points: ['lateral_delts'] },
      week: [
        { id: 'a', mode: 'bodybuilding' }, { id: 'b', mode: 'bodybuilding' }, { id: 'c', mode: 'tabata' },
      ],
    } as unknown as WeeklyProgram
    const vol = stimaVolumeSettimanale(program, () => workout([['lateral_delts', 3], ['chest', 4]]), 'deficit')!
    const lat = vol.rows.find((row) => row.muscle === 'lateral_delts')!
    expect(lat).toMatchObject({ total: 6, frequency: 2, carenza: true, target: [12, 16], status: 'basso' })
    expect(vol.rows.find((row) => row.muscle === 'chest')).toMatchObject({ total: 8, status: 'ok' })
    expect(vol.skippedDays).toBe(1)
  })
})
