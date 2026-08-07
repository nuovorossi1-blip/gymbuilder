import { describe, expect, it } from 'vitest'
import type { WorkoutBlock } from '../types'
import { metconInstruction, metconSubtitle } from './metconInstructions'

const block = (format: WorkoutBlock['format'], patch: Partial<WorkoutBlock> = {}): WorkoutBlock => ({
  kind: 'metcon', title: 'Test', format, exercises: [], rounds: 4, time_cap_min: 20, interval_sec: 40, ...patch,
})

describe('Istruzioni operative Metcon', () => {
  it('spiega giri, ordine, pause e cap nel For Time', () => {
    const forTime = block('for_time')
    expect(metconSubtitle(forTime)).toBe('4 giri · cap 20 min')
    expect(metconInstruction(forTime)).toContain('tutti gli esercizi nell’ordine')
    expect(metconInstruction(forTime)).toContain('Non c’è una pausa obbligatoria')
    expect(metconInstruction(forTime)).toContain('scade il cap')
  })

  it.each(['amrap', 'emom', 'rounds', 'chipper', 'ladder', 'intervals'] as const)('fornisce istruzioni per %s', (format) => {
    expect(metconInstruction(block(format)).length).toBeGreaterThan(60)
  })
})
