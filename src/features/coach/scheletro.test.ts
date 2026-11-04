import { describe, expect, it } from 'vitest'
import { allineaAlloScheletro, confrontaConScheletro, costruisciScheletro, riempiScheletro } from './scheletro'
import { violazioniInterleave } from '../../engine/programming'
import { sedutaComeWorkout } from './plan'
import type { Exercise, Muscle } from '../../types'
import catalogo from '../../generators/__tests__/fixtures/exercises.json'

const cat = catalogo as unknown as Exercise[]
const carenzeSpalleBraccia: Muscle[] = ['lateral_delts', 'rear_delts', 'front_delts', 'biceps', 'triceps']
const sch = costruisciScheletro({ giorni: 5, carenze: carenzeSpalleBraccia, forti: ['chest', 'glutes', 'quads', 'hamstrings'], step: -500 })
const seduta = (nome: string) => sch.sedute.find((s) => s.nome === nome)!

describe('scheletro della scheda (regole di Rossi, 26/09)', () => {
  it('5 giorni = Pull A, Push A, Legs, Pull B, Push B', () => {
    expect(sch.sedute.map((s) => s.nome)).toEqual(['Pull A', 'Push A', 'Legs', 'Pull B', 'Push B'])
  })
  it('gambe forti: 1 multi quadricipiti, 1 multi femorali, 1 iso quadricipiti, 1 iso femorali, polpacci; niente hip thrust', () => {
    const legs = seduta('Legs').slot.filter((s) => s.tipo !== 'carenza')
    const firma = legs.map((s) => `${s.muscolo}/${s.ruolo}`).sort()
    expect(firma).toEqual(['calves/isolamento', 'hamstrings/isolamento', 'hamstrings/multiarticolare', 'quads/isolamento', 'quads/multiarticolare'].sort())
    expect(seduta('Legs').slot.some((s) => s.muscolo === 'glutes')).toBe(false)
    expect(seduta('Legs').slot[0].muscolo).toBe('lateral_delts') // richiamo della carenza in apertura
  })
  it('hip thrust solo se i glutei sono carenti', () => {
    const conGlutei = costruisciScheletro({ giorni: 5, carenze: ['glutes'], forti: [], step: 0 })
    expect(conGlutei.sedute.find((s) => s.nome === 'Legs')!.slot.some((s) => s.muscolo === 'glutes')).toBe(true)
  })
  it('spalle carenti: alzate laterali x2, shoulder press, alzate frontali, aperture posteriori', () => {
    expect(seduta('Push A').slot.filter((s) => s.muscolo === 'lateral_delts')).toHaveLength(2)
    expect(seduta('Push A').slot.some((s) => s.muscolo === 'front_delts' && s.ruolo === 'multiarticolare')).toBe(true)
    expect(seduta('Push B').slot.some((s) => s.muscolo === 'front_delts' && s.ruolo === 'isolamento')).toBe(true)
    expect(seduta('Pull A').slot.some((s) => s.muscolo === 'rear_delts')).toBe(true)
  })
  it('braccia carenti: 2 esercizi di bicipiti nei Pull e 2 di tricipiti nei Push, più il richiamo', () => {
    expect(seduta('Pull A').slot.filter((s) => s.muscolo === 'biceps' && s.tipo === 'carenza')).toHaveLength(2)
    expect(seduta('Push A').slot.filter((s) => s.muscolo === 'triceps' && s.tipo === 'carenza')).toHaveLength(2)
    expect(seduta('Push A').slot.some((s) => s.muscolo === 'biceps' && s.tipo === 'richiamo')).toBe(true)
  })
  it('carenze nei primi slot, mai un multiarticolare in fondo, interleave in deficit', () => {
    for (const sd of sch.sedute) {
      expect(sd.slot[0].tipo).toBe('carenza')
      expect(sd.slot[sd.slot.length - 1].ruolo).toBe('isolamento')
      const finti = sd.slot.map((s) => ({ muscle: s.muscolo }))
      expect(violazioniInterleave(finti, carenzeSpalleBraccia, 'deficit')).toEqual([])
    }
  })
  it('volume: carenze nel loro range (14-18 in deficit), punti forti al minimo efficace', () => {
    for (const m of ['lateral_delts', 'biceps', 'triceps'] as Muscle[]) {
      const v = sch.volume.find((x) => x.muscolo === m)!
      expect(v.serie).toBeGreaterThanOrEqual(14)
      expect(v.serie).toBeLessThanOrEqual(18)
    }
    for (const m of ['chest', 'quads', 'hamstrings'] as Muscle[]) expect(sch.volume.find((x) => x.muscolo === m)!.serie).toBeLessThanOrEqual(8)
    const carenze = sch.volume.filter((v) => v.carenza && v.muscolo !== 'front_delts')
    const forti = sch.volume.filter((v) => ['chest', 'quads', 'hamstrings'].includes(v.muscolo))
    expect(Math.min(...carenze.map((v) => v.serie))).toBeGreaterThan(Math.max(...forti.map((v) => v.serie)))
  })
  it('con il dorso carente (3 esercizi) c è il secondo bicipite e il Pull non chiude con un multiarticolare', () => {
    const s2 = costruisciScheletro({ giorni: 5, carenze: ['front_delts', 'lateral_delts', 'rear_delts', 'back'], forti: ['chest', 'glutes', 'quads'], step: -500 })
    for (const sd of s2.sedute.filter((x) => x.split === 'pull')) {
      expect(sd.slot.filter((s) => s.muscolo === 'back')).toHaveLength(3)
      expect(sd.slot[sd.slot.length - 1].ruolo).toBe('isolamento')
    }
  })
  it('un piano che non segue lo scheletro viene rifiutato con il motivo', () => {
    const plan = {
      titolo: 'x', giorni_settimana: 5, durata_min: 75, calorie: null, macro: { proteine_g: null, grassi_g: null, carboidrati_g: null }, note: '',
      sedute: sch.sedute.map((sd) => ({ nome: sd.nome, split: sd.split, esercizi: sd.slot.map((s) => ({ exercise_id: 'hip_thrust', nome: 'Hip thrust', serie: s.serie, reps: s.reps, rir: s.rir, recupero_sec: 90 })) })),
    }
    const errori = confrontaConScheletro(plan, sch, cat)
    expect(errori.length).toBeGreaterThan(0)
    expect(errori[0]).toContain('serve')
  })
})


describe('scheletro: correzioni del 26/09', () => {
  const piano = riempiScheletro(sch, { catalogo: cat, preferiti: ['face_pull'], daEvitare: [], obbligatori: [{ exercise_id: 'curl_inclinata_man', seduta: 'Pull A' }] })
  it('l’app costruisce da sola un programma che rispetta lo scheletro', () => {
    expect(confrontaConScheletro(piano, sch, cat)).toEqual([])
    expect(piano.sedute.every((sd) => sd.esercizi.every((e) => e.exercise_id))).toBe(true)
    expect(piano.sedute.find((s) => s.nome === 'Pull A')!.esercizi.some((e) => e.exercise_id === 'curl_inclinata_man')).toBe(true)
    expect(piano.sedute.find((s) => s.nome === 'Legs')!.esercizi.some((e) => e.exercise_id === 'hip_thrust')).toBe(false)
  })
  it('l’ordine delle sedute lo sceglie il cliente: invertire Pull e Push non è un errore', () => {
    const invertito = { ...piano, sedute: [piano.sedute[1], piano.sedute[0], piano.sedute[2], piano.sedute[4], piano.sedute[3]] }
    expect(confrontaConScheletro(invertito, sch, cat)).toEqual([])
  })
  it('serie, reps e RIR diversi vengono allineati allo scheletro, non bloccano', () => {
    const cinque = { ...piano, sedute: piano.sedute.map((sd) => ({ ...sd, esercizi: sd.esercizi.map((e) => ({ ...e, serie: 5, reps: '5', rir: '0' })) })) }
    const allineato = allineaAlloScheletro(cinque, sch)
    expect(allineato.sedute[0].esercizi[0].serie).toBe(sch.sedute[0].slot[0].serie)
    expect(confrontaConScheletro(allineato, sch, cat)).toEqual([])
  })
  it('le serie chieste dal cliente (serie_cliente) restano le sue, reps e RIR seguono lo scheletro (04/11)', () => {
    const atteso = sch.sedute[0].slot[0]
    const voluto = atteso.serie + 1
    const chiesto = { ...piano, sedute: piano.sedute.map((sd, i) => (i === 0 ? { ...sd, esercizi: sd.esercizi.map((e, j) => (j === 0 ? { ...e, serie: voluto, reps: '5', serie_cliente: 'dorso a 3 serie, normocalorica' } : e)) } : sd)) }
    const allineato = allineaAlloScheletro(chiesto, sch)
    expect(allineato.sedute[0].esercizi[0].serie).toBe(voluto)
    expect(allineato.sedute[0].esercizi[0].reps).toBe(atteso.reps)
    expect(allineato.sedute[0].esercizi[1].serie).toBe(sch.sedute[0].slot[1].serie)
    expect(confrontaConScheletro(allineato, sch, cat)).toEqual([])
  })
})

describe('esercizi da migliorare nello scheletro (26/09)', () => {
  const trazioni = { exercise_id: 'trazioni', nome: 'Trazioni alla sbarra', muscolo: 'back' as Muscle, multiarticolare: true, unita: 'ripetizioni' as const }
  const conTrazioni = (step: number) => costruisciScheletro({ giorni: 5, carenze: carenzeSpalleBraccia, forti: ['chest', 'glutes', 'quads'], step, prestazioni: [trazioni] })
  it('le trazioni aprono Pull A e Pull B (2 volte a settimana), non gli altri giorni', () => {
    const s = conTrazioni(-500)
    for (const sd of s.sedute) expect(sd.slot[0].exercise_id === 'trazioni').toBe(sd.split === 'pull')
  })
  it('schema per fase: in deficit serie brevi senza cedimento, in surplus più ripetizioni e zavorra', () => {
    const a = conTrazioni(-500).sedute.find((s) => s.nome === 'Pull A')!.slot[0]
    expect(a).toMatchObject({ tipo: 'prestazione', serie: 5, reps: '3-4', rir: '2' })
    expect(conTrazioni(-500).sedute.find((s) => s.nome === 'Pull B')!.slot[0].indicazione).toContain('negative')
    expect(conTrazioni(500).sedute.find((s) => s.nome === 'Pull A')!.slot[0].indicazione).toContain('zavorra')
  })
  it('prende il posto di un esercizio di dorso: il volume del dorso non cresce, niente dorso subito dopo', () => {
    const senza = costruisciScheletro({ giorni: 5, carenze: carenzeSpalleBraccia, forti: ['chest', 'glutes', 'quads'], step: -500 })
    const conT = conTrazioni(-500)
    const nDorso = (x: typeof senza) => x.sedute.find((s) => s.nome === 'Pull A')!.slot.filter((s) => s.muscolo === 'back').length
    expect(nDorso(conT)).toBe(nDorso(senza))
    for (const sd of conT.sedute.filter((s) => s.split === 'pull')) expect(sd.slot[1].muscolo).not.toBe('back')
  })
  it('il coach deve usare proprio quell’esercizio; l’app lo mette da sola', () => {
    const s = conTrazioni(-500)
    const piano = riempiScheletro(s, { catalogo: cat, preferiti: [], daEvitare: [], obbligatori: [] })
    expect(piano.sedute.find((x) => x.nome === 'Pull A')!.esercizi[0].exercise_id).toBe('trazioni')
    const sbagliato = { ...piano, sedute: piano.sedute.map((sd) => sd.nome === 'Pull A' ? { ...sd, esercizi: [{ ...sd.esercizi[0], exercise_id: 'lat_machine' }, ...sd.esercizi.slice(1)] } : sd) }
    expect(confrontaConScheletro(sbagliato, s, cat).join(' ')).toContain('esercizio da migliorare')
  })
})

describe('sostituzione per fastidio (03/11)', () => {
  const pieno = riempiScheletro(sch, { catalogo: cat, preferiti: [], daEvitare: [], obbligatori: [] })
  const idx = seduta('Push A').slot.findIndex((s) => s.muscolo === 'front_delts' && s.ruolo === 'multiarticolare')
  const laterale = cat.find((e) => e.primary_muscles[0] === 'lateral_delts' && !e.roles.includes('compound'))!
  const legPress = cat.find((e) => e.primary_muscles[0] === 'quads' && e.roles.includes('compound'))!
  const conCambio = (ex: Exercise, sostituzione?: string) => ({
    ...pieno,
    sedute: pieno.sedute.map((sd) => sd.nome !== 'Push A' ? sd : { ...sd, esercizi: sd.esercizi.map((e, j) => j === idx ? { ...e, exercise_id: ex.id, nome: ex.name, sostituzione } : e) }),
  })
  it('il piano riempito dall\'app rispetta lo scheletro', () => {
    expect(confrontaConScheletro(pieno, sch, cat)).toEqual([])
  })
  it('shoulder press -> alzate laterali: rifiutata senza motivo, accettata con "sostituzione"', () => {
    expect(confrontaConScheletro(conCambio(laterale), sch, cat).length).toBeGreaterThan(0)
    expect(confrontaConScheletro(conCambio(laterale, 'dolore alla spalla nella spinta sopra la testa'), sch, cat)).toEqual([])
  })
  it('fuori dal distretto resta un errore anche con "sostituzione"', () => {
    expect(confrontaConScheletro(conCambio(legPress, 'non ho la macchina'), sch, cat).length).toBeGreaterThan(0)
  })
  it('esercizio scelto dal cliente (04/11): chest press nello slot del deltoide anteriore accettata con "esercizio_cliente"', () => {
    const chest = cat.find((e) => e.primary_muscles[0] === 'chest' && e.roles.includes('compound') && (e.secondary_muscles ?? []).includes('front_delts'))!
    expect(chest).toBeTruthy()
    expect(confrontaConScheletro(conCambio(chest), sch, cat).length).toBeGreaterThan(0)
    const scelto = conCambio(chest)
    scelto.sedute = scelto.sedute.map((sd) => sd.nome !== 'Push A' ? sd : { ...sd, esercizi: sd.esercizi.map((e, j) => j === idx ? { ...e, esercizio_cliente: 'il cliente non vuole i piegamenti a V' } : e) })
    expect(confrontaConScheletro(scelto, sch, cat)).toEqual([])
    // Le sue serie contano per il deltoide anteriore (carenza), non per il petto.
    const w = sedutaComeWorkout(allineaAlloScheletro(scelto, sch).sedute.find((sd) => sd.nome === 'Push A')!, cat, null, carenzeSpalleBraccia)
    expect(w.blocks.find((b) => b.kind === 'main')!.exercises[idx].muscle).toBe('front_delts')
  })
  it('esercizio scelto dal cliente che non allena il muscolo dello slot resta un errore', () => {
    const scelto = conCambio(legPress)
    scelto.sedute = scelto.sedute.map((sd) => sd.nome !== 'Push A' ? sd : { ...sd, esercizi: sd.esercizi.map((e, j) => j === idx ? { ...e, esercizio_cliente: 'voglio la leg press' } : e) })
    expect(confrontaConScheletro(scelto, sch, cat).length).toBeGreaterThan(0)
  })
})
