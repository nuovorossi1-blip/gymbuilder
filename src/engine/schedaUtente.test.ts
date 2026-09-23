import { describe, expect, it } from 'vitest'
import { componiSchedaSalvabile, righeMancanti } from './schedaUtente'
import type { Exercise } from '../types'
import catalogo from '../generators/__tests__/fixtures/exercises.json'

const cat = catalogo as unknown as Exercise[]
const byId = new Map(cat.map((e) => [e.id, e]))

describe('scheda analizzata -> scheda salvabile (blocco 5)', () => {
  it('conserva esattamente l ordine confermato e le serie scelte', () => {
    const w = componiSchedaSalvabile([
      { exercise_id: 'alzate_laterali', sets: 3, reps: '12-15', rir: '0-1' },
      { exercise_id: 'panca_inclinata_man', sets: 3, reps: '8-12', rir: '1-2' },
      { exercise_id: 'pushdown', sets: 3, reps: '10-12' },
    ], cat, { nome: 'Push A', seduta: 'Push', carenze: ['lateral_delts'], phase: 'deficit', experience: 'advanced' })
    const main = w.blocks.find((b) => b.kind === 'main')!.exercises
    expect(main.map((e) => e.exercise_id)).toEqual(['alzate_laterali', 'panca_inclinata_man', 'pushdown'])
    expect(main[0]).toMatchObject({ sets: 3, reps: '12-15', rir: '0-1', note: 'carenza', role: 'isolation' })
    expect(main[1].role).toBe('compound')
    expect(w.split).toBe('push')
    expect(w.name).toBe('Push A')
  })
  it('non riordina ma avvisa se due muscoli uguali sono in fila in deficit o se un composto chiude', () => {
    const w = componiSchedaSalvabile([
      { exercise_id: 'curl_manubri', sets: 3, reps: '10' },
      { exercise_id: 'curl_martello', sets: 3, reps: '10' },
      { exercise_id: 'croci_cavi', sets: 3, reps: '10' },
      { exercise_id: 'alzate_laterali', sets: 3, reps: '10' },
      { exercise_id: 'dip_parallele', sets: 3, reps: '10' },
    ], cat, { nome: '', seduta: 'Altro', carenze: [], phase: 'deficit', experience: 'intermediate' })
    expect(w.blocks.find((b) => b.kind === 'main')!.exercises[0].exercise_id).toBe('curl_manubri')
    expect(w.warnings.join(' ')).toContain('Alternanza')
    expect(w.warnings.join(' ')).toContain("all'ultimo slot")
  })
  it('segnala le righe non abbinate e rifiuta il salvataggio finché mancano', () => {
    const righe = [{ exercise_id: 'pushdown', sets: 3, reps: '10' }, { exercise_id: 'inventato', sets: 3, reps: '10' }, { exercise_id: null, sets: 3, reps: '10' }]
    expect(righeMancanti(righe, byId)).toEqual([1, 2])
    expect(() => componiSchedaSalvabile(righe, cat, { nome: '', seduta: 'Push', carenze: [], phase: null, experience: 'advanced' })).toThrow()
  })
})
