import { describe, expect, it } from 'vitest'
import { controllaPiano, differenzePiani, normalizzaPiano, sedutaComeWorkout } from './plan'
import { leggiRispostaCoach, messaggioContesto, promptSistema, promptSistemaColloquio, unisciCartella } from './prompt'
import { normalizzaCartella } from '../cartella/cartella'
import { CARTELLA_VUOTA } from '../cartella/types'
import type { Exercise } from '../../types'
import catalogo from '../../generators/__tests__/fixtures/exercises.json'

const cat = catalogo as unknown as Exercise[]
const cartella = normalizzaCartella({
  carenze: [{ muscolo: 'lateral_delts' }, { muscolo: 'biceps' }],
  vincoli: [{ zona: 'Girovita', problema: 'obliqui', vietati: ['Dip alle parallele'] }],
  riscaldamento: { descrizione: 'Addome + rotazioni spalle', minuti: 8 },
}, cat)

const rawPiano = {
  titolo: 'PPL + Pull B + Push B', giorni_settimana: 5, durata_min: 75, calorie: 2000,
  macro: { proteine_g: 160, grassi_g: 60, carboidrati_g: 200 },
  sedute: [
    { nome: 'Push A', split: 'push', esercizi: [
      { exercise_id: 'alzate_laterali', serie: 3, reps: '12-15', rir: '0-1', recupero_sec: 60 },
      { exercise_id: 'panca_inclinata_man', serie: 3, reps: '8-12', rir: '1-2', recupero_sec: 120 },
      { nome: 'Alzate laterali ai cavi', serie: 3, reps: '12-20', rir: '0-1', recupero_sec: 60 },
      { exercise_id: 'chest_press', serie: 3, reps: '10-15', rir: '1', recupero_sec: 90 },
      { exercise_id: 'curl_manubri', serie: 2, reps: '12-15', rir: '1', recupero_sec: 60, nota: 'richiamo antagonista' },
      { exercise_id: 'pushdown', serie: 3, reps: '10-12', rir: '0-1', recupero_sec: 60 },
    ] },
    { nome: 'Pull A', split: 'pull', esercizi: [
      { exercise_id: 'curl_inclinata_man', serie: 3, reps: '10-12', rir: '1', recupero_sec: 60 },
      { exercise_id: 'lat_machine', serie: 3, reps: '8-12', rir: '1-2', recupero_sec: 120 },
      { exercise_id: 'esercizio_inventato', nome: 'Remata magica', serie: 3, reps: '10', recupero_sec: 60 },
      { exercise_id: 'dip_parallele', serie: 3, reps: '8-12', recupero_sec: 90 },
    ] },
  ],
}

describe('Coach: piano (Fase 3)', () => {
  const plan = normalizzaPiano(rawPiano, cat)!
  it('normalizza il piano e abbina per nome gli esercizi senza id', () => {
    expect(plan.sedute).toHaveLength(2)
    expect(plan.sedute[0].esercizi[2].exercise_id).toBe('alzate_laterali_cavo')
    expect(plan.sedute[1].esercizi[2].exercise_id).toBe('')
    expect(plan.calorie).toBe(2000)
  })
  it('il codice trova esercizi fuori catalogo e vietati; il volume lo calcola lui', () => {
    const esito = controllaPiano(plan, { catalog: cat, cartella, fastidi: [], phase: 'deficit' })
    expect(esito.errori.join(' ')).toContain('Remata magica')
    expect(esito.errori.join(' ')).toContain('vietati')
    const lat = esito.volume.find((r) => r.muscolo === 'lateral_delts')!
    expect(lat.carenza).toBe(true)
    expect(lat.serie).toBe(Math.round(6 * 5 / 2))
  })
  it('segnala i fastidi articolari (spalle: niente dip)', () => {
    const solo = normalizzaPiano({ ...rawPiano, sedute: [rawPiano.sedute[1]] }, cat)!
    const esito = controllaPiano(solo, { catalog: cat, cartella: normalizzaCartella({}, cat), fastidi: ['shoulders'], phase: null })
    expect(esito.errori.join(' ')).toContain('fastidi')
  })
  it('una seduta del piano diventa un allenamento con il riscaldamento fisso della cartella', () => {
    const w = sedutaComeWorkout(plan.sedute[0], cat, cartella, ['lateral_delts', 'biceps'])
    expect(w.blocks[0].exercises[0].name).toBe('Addome + rotazioni spalle')
    const main = w.blocks[1].exercises
    expect(main[0]).toMatchObject({ exercise_id: 'alzate_laterali', note: 'carenza', rir: '0-1' })
    expect(main[4].note).toBe('antagonista')
  })
})

describe('Coach: prompt e risposte', () => {
  it('il prompt contiene regole, le 6 categorie e il formato JSON', () => {
    const p = promptSistemaColloquio()
    expect(p).toContain('PRINCIPIO 2')
    expect(p).toContain('6. Come ti alleni ora')
    expect(p).toContain('consiglio nutrizionale')
    expect(p).toContain('"aggiorna_cartella"')
  })
  it('il contesto passa profilo, cartella e catalogo compatto', () => {
    const ctx = JSON.parse(messaggioContesto({ profile: null, fase: null, cartella, catalogo: cat }))
    expect(ctx.cartella.carenze).toHaveLength(2)
    expect(ctx.catalogo[0]).toHaveProperty('id')
  })
  it('legge risposte imperfette senza rompersi', () => {
    const r = leggiRispostaCoach({ messaggio: '', opzioni: ['Sì', 3, ''], categoria: '2', aggiorna_cartella: [] })
    expect(r.messaggio).toBeTruthy()
    expect(r.opzioni).toEqual(['Sì'])
    expect(r.categoria).toBe(2)
    expect(r.aggiorna_cartella).toBeNull()
  })
  it('unisce gli aggiornamenti della cartella: le liste inviate sostituiscono, gli oggetti si fondono', () => {
    const u = unisciCartella(cartella, { carenze: [{ muscolo: 'rear_delts', note: 'fragile' }], obiettivo: { primario: 'V-shape' }, controlli: [{ data: 'x' }] }, cat)
    expect(u.carenze.map((c) => c.muscolo)).toEqual(['rear_delts'])
    expect(u.obiettivo.primario).toBe('V-shape')
    expect(u.controlli).toEqual([])
    expect(unisciCartella(CARTELLA_VUOTA, null, cat)).toEqual(CARTELLA_VUOTA)
  })
})

describe('Coach: Fase 4', () => {
  const plan = normalizzaPiano(rawPiano, cat)!
  it('il controllo usa le 10 domande, la chat può modificare il piano', () => {
    const c = promptSistema('controllo')
    for (const q of ['CORPO', 'SPECCHIO', 'PALESTRA', 'ALIMENTAZIONE', '10) sonno']) expect(c).toContain(q)
    expect(promptSistema('chat')).toContain('rimanda il piano INTERO')
  })
  it('le differenze tra versioni sono leggibili', () => {
    const dopo = JSON.parse(JSON.stringify(plan))
    dopo.calorie = 2250
    dopo.sedute[0].esercizi[0].serie = 4
    dopo.sedute[0].esercizi.splice(3, 1)
    const d = differenzePiani(plan, dopo).join(' ')
    expect(d).toContain('Calorie: 2000 → 2250')
    expect(d).toContain('serie 3→4')
    expect(d).toContain('tolto Chest press')
    expect(differenzePiani(plan, plan)).toEqual(['Nessuna modifica alle sedute.'])
  })
  it('i range carenza/punto forte producono avvisi solo per scostamenti netti', () => {
    const esito = controllaPiano(plan, { catalog: cat, cartella, fastidi: [], phase: 'deficit', step: -500 })
    expect(esito.volume.find((r) => r.muscolo === 'lateral_delts')!.target).toEqual([14, 18])
    expect(esito.volume.find((r) => r.muscolo === 'chest')!.target).toEqual([5, 12])
  })
  it('legge calorie e controllo dalla risposta', () => {
    const r = leggiRispostaCoach({ messaggio: 'ok', calorie: 2250, controllo: { data: '2026-10-20' } })
    expect(r.calorie).toBe(2250)
    expect(r.controllo).toEqual({ data: '2026-10-20' })
  })
})
