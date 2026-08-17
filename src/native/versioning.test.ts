import { describe, expect, it } from 'vitest'
import { isNewerVersion } from './versioning'

describe('Android app versioning', () => {
  it('rileva versioni maggiori, minori e patch più recenti', () => {
    expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true)
    expect(isNewerVersion('1.3.0', '1.2.9')).toBe(true)
    expect(isNewerVersion('1.2.4', '1.2.3')).toBe(true)
  })

  it('non propone la stessa versione o una precedente', () => {
    expect(isNewerVersion('v1.2.3', '1.2.3')).toBe(false)
    expect(isNewerVersion('1.2.2', '1.2.3')).toBe(false)
  })
})
