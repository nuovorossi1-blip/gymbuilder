import { describe, expect, it, vi } from 'vitest'
vi.mock('./supabase', () => ({ supabase: {} }))
import { nomeLibero } from './api'

describe('nomi delle schede (26/09)', () => {
  it('un nome già usato diventa "Nome (2)", poi "(3)"; le maiuscole non contano', () => {
    expect(nomeLibero('Push A', [])).toBe('Push A')
    expect(nomeLibero('Push A', ['push a'])).toBe('Push A (2)')
    expect(nomeLibero('Push A', ['Push A', 'Push A (2)'])).toBe('Push A (3)')
    expect(nomeLibero('  ', [])).toBe('Scheda')
  })
})
