import { describe, expect, it } from 'vitest'
import { generaTabata } from '../tabata'
import type { Exercise } from '../../types'
import catalogoReale from './fixtures/exercises.json'

const catalogo = catalogoReale as unknown as Exercise[]

function metconBlock(w: ReturnType<typeof generaTabata>) {
  return w.blocks.find((b) => b.kind === 'metcon')!
}

describe('generaTabata — pure interval timer', () => {
  it('mode e split sono impostati correttamente', () => {
    const w = generaTabata(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 30,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    expect(w.mode).toBe('tabata')
    expect(w.split).toBeNull()
    expect(w.blocks.map((b) => b.kind)).toEqual(['metcon'])
  })

  it('imposta i round e i tempi dal config', () => {
    const w = generaTabata(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 30,
      priority_muscles: [], excluded_exercises: [], rounds: 15, work_sec: 45, rest_sec: 15, seed: 1,
    })
    const m = metconBlock(w)
    expect(m.format).toBe('tabata')
    expect(m.rounds).toBe(15)
    expect(m.interval_sec).toBe(45)
    expect(m.exercises[0].rest_sec).toBe(15)
  })

  it('stima sempre le calorie attive', () => {
    const w = generaTabata(catalogo, {
      experience: 'intermediate', equipment: 'full_gym', duration_min: 30,
      priority_muscles: [], excluded_exercises: [], seed: 1,
    })
    expect(w.est_kcal).toBeGreaterThan(0)
  })
})
