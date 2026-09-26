import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } } }))

import { chiediJsonAlLlm } from './deepseek'

const risposta = (content: string) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) })

afterEach(() => vi.unstubAllGlobals())

describe('risposta vuota in modalità JSON (26/09)', () => {
  it('se il modello risponde solo con spazi, richiede subito in testo normale senza response_format', async () => {
    const corpi: Record<string, unknown>[] = []
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      corpi.push(JSON.parse(init.body).payload)
      return corpi.length === 1 ? risposta('     \n   ') : risposta('Con 5 giorni ti propongo PPL + Pull B + Push B.')
    })
    vi.stubGlobal('fetch', fetchMock)
    const r = await chiediJsonAlLlm([{ role: 'user', content: '5 giorni a settimana' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(corpi[0].response_format).toEqual({ type: 'json_object' })
    expect(corpi[1].response_format).toBeUndefined()
    expect(r.messaggio).toBe('Con 5 giorni ti propongo PPL + Pull B + Push B.')
  })
  it('se resta vuota anche la seconda volta, lo dice chiaramente invece di "non ho capito"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => risposta('   ')))
    await expect(chiediJsonAlLlm([{ role: 'user', content: 'ciao' }])).rejects.toThrow('risposta vuota')
  })
})
