/**
 * Scheletro della scheda (26/09, Rossi: "il coach inventa, deve fare la scheda come nella chat
 * che ti ho mostrato"). Un LLM lasciato libero improvvisa la struttura: qui la STRUTTURA la
 * decide il codice con le regole di Rossi, e il coach sceglie solo l'esercizio di ogni casella
 * (e ne spiega il perché). Il controllo `confrontaConScheletro` blocca i piani che non lo seguono.
 *
 * Regole (chat di esempio di Rossi + messaggio del 26/09):
 *  - sedute a rotazione: 3 giorni Pull/Push/Legs; 4 Pull A/Push A/Legs/Push B; 5 Pull A/Push A/
 *    Legs/Pull B/Push B; 6 Pull A/Push A/Legs A/Pull B/Push B/Legs B;
 *  - il volume parte dalle carenze: una carenza piccola ha 2 esercizi nella sua seduta "di casa",
 *    i punti forti 1-2 al minimo efficace; spalle carenti = alzate laterali + aperture posteriori +
 *    alzate frontali + shoulder press; braccia carenti = più esercizi di bicipiti e tricipiti;
 *  - gambe forti = 1 multiarticolare quadricipiti, 1 multiarticolare femorali (hinge),
 *    1 isolamento quadricipiti, 1 isolamento femorali, 1 polpacci; hip thrust solo se i glutei
 *    sono carenti; il richiamo della carenza superiore apre il giorno gambe;
 *  - richiamo antagonista: bicipiti nei Push, tricipiti nei Pull;
 *  - ordine: carenze piccole per prime, grandi in fascia accettabile, mai un multiarticolare in
 *    fondo, interleave per fase (ordinaSessione di programming.ts, la stessa del motore);
 *  - serie, RIR e volume per gradino calorico (TABELLA_GRADINI, TARGET_VOLUME).
 */
import { NOTA_ANTAGONISTA, ordinaSessione, TABELLA_GRADINI } from '../../engine/programming'
import { stepToPhase, stepDaOffset, type CalorieStep } from '../../engine/nutrition'
import { rangeVolume } from '../../engine/weeklyVolume'
import { MUSCLE_LABELS, type Exercise, type Muscle, type PrescribedExercise, type Split } from '../../types'
import type { CoachPlan } from './plan'

export type Ruolo = 'multiarticolare' | 'isolamento'
export type TipoSlot = 'carenza' | 'mantenimento' | 'richiamo' | 'prestazione'

export interface SlotScheletro {
  muscolo: Muscle
  ruolo: Ruolo
  tipo: TipoSlot
  serie: number
  reps: string
  rir: string
  /** Che esercizio mettere (famiglia), in parole: il coach sceglie quale dal catalogo. */
  indicazione: string
  /** Esercizio obbligato (esercizio da migliorare): il coach non lo può cambiare. */
  exercise_id?: string
}

/** Esercizio da migliorare passato allo scheletro (dalla cartella, abbinato al catalogo). */
export interface Prestazione { exercise_id: string; nome: string; muscolo: Muscle; multiarticolare: boolean; unita: 'ripetizioni' | 'kg' }

const SEDUTA_DEL_MUSCOLO: Partial<Record<Muscle, Tipo>> = {
  back: 'pull', rear_delts: 'pull', biceps: 'pull', forearms: 'pull',
  chest: 'push', front_delts: 'push', lateral_delts: 'push', triceps: 'push',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', adductors: 'legs', core: 'legs',
}

/**
 * Schema dell'esercizio da migliorare per gradino calorico e seduta (26/09, regola concordata):
 * in deficit poche serie brevi e pulite, mai a cedimento; in normocalorica e surplus più serie e,
 * quando è il momento, più carico. Seduta A = forza, seduta B = volume e controllo.
 */
function schemaPrestazione(p: Prestazione, v: 'A' | 'B', step: CalorieStep): { serie: number; reps: string; rir: string; indicazione: string } {
  const deficit = step < 0
  const surplus = step >= 500
  const reps = p.unita === 'ripetizioni'
  if (v === 'A') {
    if (deficit) return { serie: 5, reps: reps ? '3-4' : '4-6', rir: '2', indicazione: `${p.nome} — FORZA: serie brevi e pulite, recupero 2-3 min, mai a cedimento` }
    if (surplus) return { serie: 5, reps: reps ? '4-6' : '4-6', rir: '1', indicazione: `${p.nome} — FORZA: ${reps ? 'quando fai 3 serie da 6 pulite aggiungi 2,5 kg di zavorra' : 'quando fai tutte le serie al massimo delle ripetizioni aumenta il carico'}` }
    return { serie: 5, reps: reps ? '3-5' : '4-6', rir: '1-2', indicazione: `${p.nome} — FORZA: serie brevi e pulite, recupero 2-3 min` }
  }
  if (deficit) return { serie: 3, reps: reps ? 'massimo meno 2' : '8-10', rir: '2', indicazione: `${p.nome} — VOLUME E CONTROLLO${reps ? ': poi 2 negative lente (discesa 3-5 secondi)' : ': discesa lenta di 3 secondi'}` }
  if (surplus) return { serie: 4, reps: reps ? '6-8' : '8-10', rir: '1-2', indicazione: `${p.nome} — VOLUME E CONTROLLO${reps ? ' (con zavorra leggera quando il massimo supera 10)' : ''}` }
  return { serie: 4, reps: reps ? '5-6' : '8-10', rir: '2', indicazione: `${p.nome} — VOLUME E CONTROLLO${reps ? ': poi 2 negative lente' : ''}` }
}

export interface SedutaScheletro { nome: string; split: Split; slot: SlotScheletro[] }

export interface Scheletro {
  giorni: number
  step: CalorieStep
  sedute: SedutaScheletro[]
  volume: { muscolo: Muscle; serie: number; volte: number; carenza: boolean; range: [number, number] }[]
}

type Tipo = 'pull' | 'push' | 'legs'
const SEDUTE_PER_GIORNI: Record<number, [string, Tipo, 'A' | 'B'][]> = {
  3: [['Pull', 'pull', 'A'], ['Push', 'push', 'A'], ['Legs', 'legs', 'A']],
  4: [['Pull A', 'pull', 'A'], ['Push A', 'push', 'A'], ['Legs', 'legs', 'A'], ['Push B', 'push', 'B']],
  5: [['Pull A', 'pull', 'A'], ['Push A', 'push', 'A'], ['Legs', 'legs', 'A'], ['Pull B', 'pull', 'B'], ['Push B', 'push', 'B']],
  6: [['Pull A', 'pull', 'A'], ['Push A', 'push', 'A'], ['Legs A', 'legs', 'A'], ['Pull B', 'pull', 'B'], ['Push B', 'push', 'B'], ['Legs B', 'legs', 'B']],
}

const REPS: Partial<Record<Muscle, { multi: string; iso: string }>> = {
  lateral_delts: { multi: '8-12', iso: '12-20' },
  rear_delts: { multi: '8-12', iso: '12-15' },
  calves: { multi: '10-15', iso: '12-15' },
}
const repsDi = (m: Muscle, r: Ruolo) => REPS[m]?.[r === 'multiarticolare' ? 'multi' : 'iso'] ?? (r === 'multiarticolare' ? '6-10' : '10-12')

interface Grezzo { muscolo: Muscle; ruolo: Ruolo; tipo: TipoSlot; indicazione: string }

function seduta(tipo: Tipo, v: 'A' | 'B', carenze: Set<Muscle>, forti: Set<Muscle>): Grezzo[] {
  const c = (m: Muscle) => carenze.has(m)
  const t = (m: Muscle): TipoSlot => (c(m) ? 'carenza' : 'mantenimento')
  const s: Grezzo[] = []
  const add = (muscolo: Muscle, ruolo: Ruolo, indicazione: string, tipo?: TipoSlot) => s.push({ muscolo, ruolo, tipo: tipo ?? t(muscolo), indicazione })
  if (tipo === 'push') {
    // Petto punto forte = al minimo efficace (un esercizio per Push, ~6 serie a settimana);
    // altrimenti due (manubri da fresco + macchina che regge la fatica).
    add('chest', 'multiarticolare', v === 'A' ? 'spinta con manubri su panca inclinata' : 'chest press alla macchina o panca inclinata con manubri')
    if (!forti.has('chest') || c('chest')) add('chest', 'multiarticolare', v === 'A' ? 'chest press alla macchina' : 'dip o panca presa stretta (se la spalla lo consente)')
    if (c('chest')) add('chest', 'isolamento', 'croci ai cavi o pec deck')
    add('lateral_delts', 'isolamento', v === 'A' ? 'alzate laterali con manubri (seduto, carico leggero)' : 'alzate laterali al cavo a un braccio')
    if (c('lateral_delts')) add('lateral_delts', 'isolamento', v === 'A' ? 'alzate laterali al cavo' : 'alzate laterali alla macchina o con manubri')
    if (c('front_delts')) {
      if (v === 'A') add('front_delts', 'multiarticolare', 'shoulder press (manubri o macchina, in base al fastidio alla spalla)')
      else add('front_delts', 'isolamento', 'alzate frontali (manubri o cavo)')
    }
    add('triceps', 'isolamento', c('triceps') ? 'tricipiti in allungamento (french press o overhead al cavo)' : 'pushdown al cavo')
    if (c('triceps')) add('triceps', 'isolamento', v === 'A' ? 'pushdown alla corda' : 'overhead al cavo a un braccio')
    add('biceps', 'isolamento', 'curl leggero (richiamo, mai a cedimento)', 'richiamo')
  } else if (tipo === 'pull') {
    const nDorso = c('back') ? 3 : forti.has('back') ? (v === 'A' ? 2 : 1) : v === 'A' ? 3 : 2
    const dorso = v === 'A'
      ? ['trazioni o lat machine (verticale)', 'rematore con petto supportato (T-bar o manubrio)', 'pulley al cavo']
      : ['lat machine con presa diversa', 'pulley presa larga', 'rematore al cavo o alla macchina']
    for (let i = 0; i < nDorso; i++) add('back', 'multiarticolare', dorso[i])
    add('rear_delts', 'isolamento', v === 'A' ? 'aperture posteriori al cavo (fly cavo)' : 'face pull o reverse pec deck')
    add('biceps', 'isolamento', v === 'A' ? 'curl con manubri su panca inclinata (allungamento)' : 'curl con bilanciere EZ (metà movimento)')
    // Con 3 esercizi di dorso serve un secondo bicipite per alternare e non chiudere con un
    // multiarticolare (esempio di Rossi: Bi → Sch → Rear → Sch → Bi → Sch → Tri).
    if (c('biceps') || nDorso >= 3) add('biceps', 'isolamento', v === 'A' ? 'hammer curl' : 'bayesian curl al cavo')
    add('triceps', 'isolamento', 'pushdown o overhead leggero (richiamo, mai a cedimento)', 'richiamo')
  } else {
    // Richiamo della carenza superiore in apertura: zero impatto sulle gambe, +1 frequenza.
    const sup = (['lateral_delts', 'rear_delts', 'biceps', 'triceps', 'front_delts'] as Muscle[]).find(c)
    if (sup) add(sup, 'isolamento', `${MUSCLE_LABELS[sup].toLowerCase()}: esercizio leggero al cavo (richiamo della carenza)`, 'carenza')
    add('quads', 'multiarticolare', v === 'A' ? 'pendulum o hack squat' : 'leg press o hack squat')
    if (c('quads')) add('quads', 'multiarticolare', 'squat al multipower o bulgarian split squat')
    add('hamstrings', 'multiarticolare', 'stacco rumeno (hinge)')
    add('quads', 'isolamento', 'leg extension')
    add('hamstrings', 'isolamento', v === 'A' ? 'leg curl seduto' : 'leg curl sdraiato')
    if (c('glutes')) add('glutes', 'multiarticolare', 'hip thrust')
    add('calves', 'isolamento', 'calf raise in piedi o seduto')
  }
  return s
}

function serieDi(g: Grezzo, step: CalorieStep): { serie: number; rir: string } {
  const T = TABELLA_GRADINI
  if (g.tipo === 'richiamo') return { serie: T.serie.antagonista[step], rir: T.rir.antagonista[step] }
  const comp = g.ruolo === 'multiarticolare'
  const car = g.tipo === 'carenza'
  let serie = comp ? (car ? T.serie.carenzaComp : T.serie.mantComp)[step] : (car ? T.serie.carenzaIso : T.serie.mantIso)[step]
  // Il posteriore è piccolo e recupera in fretta: una serie in più (esempio di Rossi: 4x12-15).
  if (car && g.muscolo === 'rear_delts') serie += 1
  // Gambe punto forte: 3 serie anche sugli isolamenti (esempio di Rossi: quadricipiti 6 e
  // femorali 6 a settimana); polpacci mai sotto 3.
  if (!car && !comp && ['quads', 'hamstrings', 'calves'].includes(g.muscolo)) serie = Math.max(3, serie)
  return { serie, rir: comp ? T.rir.comp[step] : T.rir.iso[step] }
}

export function costruisciScheletro(opts: { giorni: number | null | undefined; carenze: Muscle[]; forti: Muscle[]; step: number | null | undefined; prestazioni?: Prestazione[] }): Scheletro {
  const giorni = Math.max(3, Math.min(6, Math.round(opts.giorni ?? 5)))
  const step = stepDaOffset(opts.step ?? 0)
  const carenze = new Set(opts.carenze)
  const forti = new Set(opts.forti.filter((m) => !carenze.has(m)))
  const fase = stepToPhase(step)

  const sedute: SedutaScheletro[] = SEDUTE_PER_GIORNI[giorni].map(([nome, tipo, v]) => {
    const grezzi = seduta(tipo, v, carenze, forti)
    // Ordine con le stesse regole del motore: pseudo-esercizi, poi si riportano gli slot.
    const pseudo: PrescribedExercise[] = grezzi.map((g, i) => ({
      exercise_id: `slot-${i}`, name: g.indicazione, role: g.ruolo === 'multiarticolare' ? 'compound' : 'isolation',
      muscle: g.muscolo, sets: 3, reps: '', rest_sec: 90,
      note: g.tipo === 'richiamo' ? NOTA_ANTAGONISTA : g.tipo === 'carenza' ? 'carenza' : undefined,
    }))
    ordinaSessione(pseudo, { carenze: [...carenze], phase: fase, split: tipo })
    const ordinati = pseudo.map((p) => grezzi[Number(p.exercise_id.slice(5))])
    const slot: SlotScheletro[] = ordinati.map((g) => ({ ...g, ...serieDi(g, step), reps: repsDi(g.muscolo, g.ruolo) }))
    // Esercizi da migliorare: casella fissa in APERTURA (massima freschezza) in tutte le sedute
    // del loro tipo, quindi 2 volte a settimana con 5 giorni. Prende il posto del primo esercizio
    // dello stesso muscolo e ruolo, così il volume di quel muscolo non cresce.
    for (const p of (opts.prestazioni ?? []).filter((x) => SEDUTA_DEL_MUSCOLO[x.muscolo] === tipo)) {
      const ruolo: Ruolo = p.multiarticolare ? 'multiarticolare' : 'isolamento'
      const i = slot.findIndex((x) => x.muscolo === p.muscolo && x.ruolo === ruolo && x.tipo !== 'richiamo' && x.tipo !== 'prestazione')
      if (i >= 0) slot.splice(i, 1)
      slot.unshift({ muscolo: p.muscolo, ruolo, tipo: 'prestazione', exercise_id: p.exercise_id, ...schemaPrestazione(p, v, step) })
      // Mai due esercizi dello stesso muscolo di fila subito dopo.
      if (slot[1]?.muscolo === p.muscolo) {
        const j = slot.findIndex((x, k) => k > 1 && x.muscolo !== p.muscolo)
        if (j > 1) [slot[1], slot[j]] = [slot[j], slot[1]]
      }
    }
    return { nome, split: tipo, slot }
  })

  // Volume settimanale: la carenza deve stare nel suo range. Se è sotto, si aggiungono serie agli
  // isolamenti carenti (fino a 5 per esercizio); il mantenimento sopra il massimo scende a 2.
  const totale = (m: Muscle) => sedute.reduce((t, sd) => t + sd.slot.filter((s) => s.muscolo === m).reduce((a, s) => a + s.serie, 0), 0)
  for (const m of carenze) {
    const slotCarenti = sedute.flatMap((sd) => sd.slot.filter((s) => s.muscolo === m && s.tipo === 'carenza'))
    let giri = 0
    while (slotCarenti.length && totale(m) < rangeVolume(m, true, step)[0] && giri++ < 20) {
      const s = [...slotCarenti].sort((a, b) => a.serie - b.serie)[0]
      if (s.serie >= 5) break
      s.serie += 1
    }
  }
  const muscoli = new Set(sedute.flatMap((sd) => sd.slot.map((s) => s.muscolo)))
  for (const m of muscoli) {
    if (carenze.has(m)) continue
    let giri = 0
    while (totale(m) > rangeVolume(m, false, step)[1] && giri++ < 20) {
      const s = sedute.flatMap((sd) => sd.slot.filter((x) => x.muscolo === m && x.tipo === 'mantenimento' && x.serie > 2)).sort((a, b) => b.serie - a.serie)[0]
      if (!s) break
      s.serie -= 1
    }
  }
  const volume = [...muscoli].map((m) => ({
    muscolo: m, serie: totale(m), volte: sedute.filter((sd) => sd.slot.some((s) => s.muscolo === m)).length,
    carenza: carenze.has(m), range: rangeVolume(m, carenze.has(m), step),
  })).sort((a, b) => Number(b.carenza) - Number(a.carenza) || b.serie - a.serie)
  return { giorni, step, sedute, volume }
}

const normNome = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '')

/** La seduta dello scheletro con lo stesso nome (l'ordine della rotazione lo sceglie il cliente). */
function sedutaCorrispondente(nome: string, sch: Scheletro): SedutaScheletro | undefined {
  const n = normNome(nome)
  return sch.sedute.find((s) => normNome(s.nome) === n)
}

/**
 * Allinea serie, ripetizioni e RIR del piano allo scheletro: sono numeri decisi dall'app (fase,
 * carenze), non vale la pena bloccare il piano se il coach li scrive diversi (26/09).
 * Restituisce un piano nuovo; le sedute senza corrispondenza restano com'erano.
 */
export function allineaAlloScheletro(plan: CoachPlan, sch: Scheletro): CoachPlan {
  return {
    ...plan,
    sedute: plan.sedute.map((sd) => {
      const atteso = sedutaCorrispondente(sd.nome, sch)
      if (!atteso || atteso.slot.length !== sd.esercizi.length) return sd
      return { ...sd, esercizi: sd.esercizi.map((e, j) => ({ ...e, serie: atteso.slot[j].serie, reps: atteso.slot[j].reps, rir: atteso.slot[j].rir })) }
    }),
  }
}

/**
 * Il piano del coach rispetta lo scheletro? Le sedute si confrontano per NOME (26/09: Rossi ha
 * chiesto di invertire Pull e Push, e il confronto per posizione segnava tutto sbagliato); dentro
 * ogni seduta contano ordine, muscolo principale e ruolo. Serie/reps/RIR li allinea
 * `allineaAlloScheletro`.
 */
export function confrontaConScheletro(plan: CoachPlan, sch: Scheletro, catalog: Exercise[]): string[] {
  const byId = new Map(catalog.map((e) => [e.id, e]))
  const errori: string[] = []
  const mancanti = sch.sedute.filter((a) => !plan.sedute.some((sd) => normNome(sd.nome) === normNome(a.nome)))
  const estranee = plan.sedute.filter((sd) => !sedutaCorrispondente(sd.nome, sch))
  if (mancanti.length || estranee.length || plan.sedute.length !== sch.sedute.length) {
    errori.push(`Le sedute devono essere ${sch.sedute.length}: ${sch.sedute.map((s) => s.nome).join(', ')} (in qualsiasi ordine)${mancanti.length ? `; mancano ${mancanti.map((s) => s.nome).join(', ')}` : ''}${estranee.length ? `; non previste ${estranee.map((s) => s.nome).join(', ')}` : ''}.`)
  }
  for (const sd of plan.sedute) {
    const atteso = sedutaCorrispondente(sd.nome, sch)
    if (!atteso) continue
    if (sd.esercizi.length !== atteso.slot.length) {
      errori.push(`${atteso.nome}: servono ${atteso.slot.length} esercizi nell'ordine dello scheletro, non ${sd.esercizi.length}.`)
      continue
    }
    atteso.slot.forEach((slot, j) => {
      const ex = byId.get(sd.esercizi[j].exercise_id)
      if (!ex) return // già segnalato da controllaPiano
      if (slot.exercise_id) {
        if (ex.id !== slot.exercise_id) errori.push(`${atteso.nome}, slot ${j + 1}: deve essere ${slot.indicazione.split(' — ')[0]} (esercizio da migliorare), non ${ex.name}.`)
        return
      }
      const muscoloOk = ex.primary_muscles.includes(slot.muscolo)
      const ruoloOk = (slot.ruolo === 'multiarticolare') === ex.roles.includes('compound')
      if (!muscoloOk || !ruoloOk) errori.push(`${atteso.nome}, slot ${j + 1}: serve ${slot.ruolo} per ${MUSCLE_LABELS[slot.muscolo]} (${slot.indicazione}), non ${ex.name}.`)
    })
  }
  return errori
}

export interface PreferenzeRiempimento {
  /** Esercizi disponibili (già filtrati per attrezzatura, fastidi e vietati). */
  catalogo: Exercise[]
  preferiti: string[]
  daEvitare: string[]
  obbligatori: { exercise_id?: string; seduta?: string; slot?: number }[]
}

const parole = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z]+/).filter((w) => w.length > 3)

/**
 * L'app costruisce da sola il programma dallo scheletro (26/09): per ogni slot sceglie
 * dal catalogo l'esercizio del muscolo e ruolo giusti, preferendo gli obbligatori della seduta,
 * quelli che il cliente sente bene e quelli che somigliano all'indicazione, evitando le
 * ripetizioni tra le sedute A e B e gli esercizi dove perde tensione.
 */
export function riempiScheletro(sch: Scheletro, pref: PreferenzeRiempimento, titolo = 'Programma dallo scheletro'): CoachPlan {
  const usati = new Map<string, number>()
  const sedute = sch.sedute.map((sd) => {
    const inSeduta = new Set<string>()
    const esercizi = sd.slot.map((slot, j) => {
      const candidati = pref.catalogo.filter((e) =>
        e.primary_muscles[0] === slot.muscolo && (slot.ruolo === 'multiarticolare') === e.roles.includes('compound') && !inSeduta.has(e.id) && !e.roles.includes('warmup'))
      const chiave = parole(slot.indicazione)
      const punteggio = (e: Exercise) => {
        let p = 0
        if (pref.obbligatori.some((o) => o.exercise_id === e.id && (!o.seduta || normNome(o.seduta) === normNome(sd.nome)) && (!o.slot || o.slot === j + 1))) p += 200
        else if (pref.obbligatori.some((o) => o.exercise_id === e.id && (!o.seduta || normNome(o.seduta) === normNome(sd.nome)))) p += 120
        if (pref.preferiti.includes(e.id)) p += 50
        if (pref.daEvitare.includes(e.id)) p -= 60
        const nome = parole(e.name)
        p += chiave.filter((w) => nome.some((n) => n.startsWith(w.slice(0, 5)))).length * 15
        p -= (usati.get(e.id) ?? 0) * 40
        if (['cardio', 'bodyweight'].includes(String(e.equipment)) && slot.ruolo === 'isolamento') p -= 10
        return p
      }
      const fisso = slot.exercise_id ? pref.catalogo.find((e) => e.id === slot.exercise_id) : undefined
      const scelto = fisso ?? candidati.sort((a, b) => punteggio(b) - punteggio(a))[0]
      if (scelto) { inSeduta.add(scelto.id); usati.set(scelto.id, (usati.get(scelto.id) ?? 0) + 1) }
      return {
        exercise_id: scelto?.id ?? '',
        nome: scelto?.name ?? slot.indicazione,
        serie: slot.serie, reps: slot.reps, rir: slot.rir,
        recupero_sec: slot.ruolo === 'multiarticolare' ? 120 : slot.tipo === 'richiamo' ? 60 : 75,
        nota: slot.tipo === 'prestazione' ? `Esercizio da migliorare, in apertura quando sei fresco: ${slot.indicazione}.` : `${slot.tipo === 'carenza' ? 'Carenza' : slot.tipo === 'richiamo' ? 'Richiamo antagonista' : 'Mantenimento'}: ${slot.indicazione}.`,
      }
    })
    return { nome: sd.nome, split: sd.split, logica: sd.slot.map((s) => MUSCLE_LABELS[s.muscolo]).join(' → '), esercizi }
  })
  return {
    titolo, giorni_settimana: sch.giorni, durata_min: 75, sedute,
    calorie: null, macro: { proteine_g: null, grassi_g: null, carboidrati_g: null },
    note: 'Costruito dall’app dallo scheletro delle tue regole: carenze nei primi slot, volume dalle carenze, punti forti al minimo efficace. Chiedi al coach di cambiare un esercizio o spiegarti una scelta.',
  }
}

/** Lo scheletro in forma compatta per il contesto dell'LLM. */
export function scheletroPerLlm(sch: Scheletro) {
  return {
    giorni_settimana: sch.giorni,
    sedute: sch.sedute.map((sd) => ({
      nome: sd.nome, split: sd.split,
      slot: sd.slot.map((s, i) => ({ n: i + 1, muscolo: s.muscolo, ruolo: s.ruolo, tipo: s.tipo, serie: s.serie, reps: s.reps, rir: s.rir, indicazione: s.indicazione, ...(s.exercise_id ? { exercise_id_obbligatorio: s.exercise_id } : {}) })),
    })),
    volume_settimanale: sch.volume.map((v) => ({ muscolo: MUSCLE_LABELS[v.muscolo], serie: v.serie, volte: v.volte, carenza: v.carenza, range: `${v.range[0]}-${v.range[1]}` })),
  }
}
