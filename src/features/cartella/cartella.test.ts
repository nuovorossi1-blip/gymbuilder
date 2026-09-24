import { describe, expect, it } from 'vitest'
import { abbinaEsercizio, cartellaInMarkdown, leggiMarkdown, muscoloDa, normalizzaCartella, preferitiDallaCartella, vietatiDallaCartella } from './cartella'
import { CARTELLA_VUOTA } from './types'
import type { Exercise, Profile } from '../../types'
import catalogo from '../../generators/__tests__/fixtures/exercises.json'

const cat = catalogo as unknown as Exercise[]
const profile: Profile = { id: 'u', display_name: 'Rossi', weight_kg: 82, height_cm: 179, age: 35, sex: 'male', daily_kcal: 2000, job_activity: 'sedentary', weight_trend: 'losing' }

const esempio = normalizzaCartella({
  obiettivo: { primario: 'V-shape' },
  vincoli: [{ zona: 'Girovita', problema: 'Obliqui larghi', vietati: 'Dip alle parallele, Side bend', strategia: 'core anti-estensione' }],
  carenze: [{ muscolo: 'deltoidi laterali', note: 'trapezio compensa' }, { muscolo: 'biceps', note: '' }, { muscolo: 'inventato' }],
  esercizi_ok: [{ nome: 'Face pull' }, { nome: 'Esercizio che non esiste' }],
  obbligatori: [{ nome: 'Pushdown ai cavi', seduta: 'Pull A', slot: '7' }],
  controlli: [{ data: '2026-10-20', peso: '81,5', carichi: [{ esercizio: 'Trazioni', carico: 'BW', reps: '8' }] }],
}, cat)

describe('cartella del cliente (Fase 2)', () => {
  it('normalizza dati parziali o scritti da un LLM', () => {
    expect(esempio.carenze.map((x) => x.muscolo)).toEqual(['lateral_delts', 'biceps'])
    expect(esempio.vincoli[0].vietati).toEqual(['Dip alle parallele', 'Side bend'])
    expect(esempio.obbligatori[0]).toMatchObject({ seduta: 'Pull A', slot: 7 })
    expect(esempio.controlli[0].peso).toBe(81.5)
    expect(esempio.riscaldamento.minuti).toBe(8)
    expect(normalizzaCartella(null)).toEqual(CARTELLA_VUOTA)
  })
  it('riconosce muscoli ed esercizi per nome', () => {
    expect(muscoloDa('Deltoidi posteriori')).toBe('rear_delts')
    expect(abbinaEsercizio('face pull', cat)).toBe('face_pull')
    expect(abbinaEsercizio('Esercizio che non esiste', cat)).toBeUndefined()
  })
  it('i vietati riconosciuti escono dal generatore, i preferiti entrano', () => {
    expect(vietatiDallaCartella(esempio, cat)).toEqual(['dip_parallele'])
    expect(preferitiDallaCartella(esempio)).toEqual(expect.arrayContaining(['face_pull', 'pushdown']))
  })
  it('il file .md contiene le sei parti e si reimporta identico se non modificato', () => {
    const md = cartellaInMarkdown({ cartella: esempio, profile, calorieLog: [], bodyLog: [], program: null })
    for (const parte of ['PARTE 1', 'PARTE 2', 'PARTE 3', 'PARTE 4', 'PARTE 5', 'PARTE 6']) expect(md).toContain(parte)
    expect(md).toContain('Deltoidi laterali')
    expect(md).toContain('INTERLEAVE')
    const letto = leggiMarkdown(md, cat)
    expect(letto.testoModificato).toBe(false)
    expect(letto.cartella).toEqual(esempio)
  })
  it('se il testo è stato modificato (da te o da un altro LLM) lo segnala', () => {
    const md = cartellaInMarkdown({ cartella: esempio, profile, calorieLog: [], bodyLog: [], program: null })
    const modificato = md.replace('V-shape', 'V-shape e braccia')
    expect(leggiMarkdown(modificato, cat).testoModificato).toBe(true)
    expect(leggiMarkdown('# una cartella scritta a mano', cat)).toEqual({ cartella: null, piano: null, testoModificato: true })
  })
})

describe('file .md con il programma del Coach (25/09)', () => {
  it('contiene il programma e lo ricarica insieme alla cartella', () => {
    const piano = { titolo: 'PPL', giorni_settimana: 5, sedute: [{ nome: 'Push A', esercizi: [{ nome: 'Alzate laterali', serie: 3, reps: '12-15', rir: '1' }] }] }
    const md = cartellaInMarkdown({ cartella: esempio, profile, calorieLog: [], bodyLog: [], program: null, coachPlan: piano })
    expect(md).toContain('### Push A')
    const letto = leggiMarkdown(md, cat)
    expect(letto.testoModificato).toBe(false)
    expect(letto.piano).toEqual(piano)
    expect(letto.cartella).toEqual(esempio)
  })
})
