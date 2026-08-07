import { describe, expect, it } from 'vitest'
import { timerTitle } from './backgroundTimer'

describe('background timer', () => {
  it('formatta il tempo residuo nel titolo senza valori negativi', () => {
    expect(timerTitle('Recupero', 65)).toBe('1:05 · Recupero')
    expect(timerTitle('AMRAP', -2)).toBe('0:00 · AMRAP')
  })
})
