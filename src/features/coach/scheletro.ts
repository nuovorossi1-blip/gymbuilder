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
import { TARGET_VOLUME } from '../../engine/weeklyVolume'
import { MUSCLE_LABELS, type Exercise, type Muscle, type PrescribedExercise, type Split } from '../../types'
import type { CoachPlan } from './plan'

export type Ruolo = 'multiarticolare' | 'isolamento'
export type TipoSlot = 'carenza' | 'mantenimento' | 'richiamo'

export interface SlotScheletro {
  muscolo: Muscle
  ruolo: Ruolo
  tipo: TipoSlot
  serie: number
  reps: string
  rir: string
  /** Che esercizio mettere (famiglia), in parole: il coach sceglie quale dal catalogo. */
  indicazione: string
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

export function costruisciScheletro(opts: { giorni: number | null | undefined; carenze: Muscle[]; forti: Muscle[]; step: number | null | undefined }): Scheletro {
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
    return {
      nome, split: tipo,
      slot: ordinati.map((g) => ({ ...g, ...serieDi(g, step), reps: repsDi(g.muscolo, g.ruolo) })),
    }
  })

  // Volume settimanale: la carenza deve stare nel suo range. Se è sotto, si aggiungono serie agli
  // isolamenti carenti (fino a 5 per esercizio); il mantenimento sopra il massimo scende a 2.
  const range = TARGET_VOLUME[step] ?? TARGET_VOLUME[0]
  const totale = (m: Muscle) => sedute.reduce((t, sd) => t + sd.slot.filter((s) => s.muscolo === m).reduce((a, s) => a + s.serie, 0), 0)
  for (const m of carenze) {
    // Il deltoide anteriore lavora già in tutte le spinte: non si gonfia a forza di serie dirette.
    if (m === 'front_delts') continue
    const slotCarenti = sedute.flatMap((sd) => sd.slot.filter((s) => s.muscolo === m && s.tipo === 'carenza'))
    let giri = 0
    while (slotCarenti.length && totale(m) < range.carenza[0] && giri++ < 20) {
      const s = [...slotCarenti].sort((a, b) => a.serie - b.serie)[0]
      if (s.serie >= 5) break
      s.serie += 1
    }
  }
  const muscoli = new Set(sedute.flatMap((sd) => sd.slot.map((s) => s.muscolo)))
  for (const m of muscoli) {
    if (carenze.has(m)) continue
    let giri = 0
    while (totale(m) > range.mantenimento[1] && giri++ < 20) {
      const s = sedute.flatMap((sd) => sd.slot.filter((x) => x.muscolo === m && x.tipo === 'mantenimento' && x.serie > 2)).sort((a, b) => b.serie - a.serie)[0]
      if (!s) break
      s.serie -= 1
    }
  }
  const volume = [...muscoli].map((m) => ({
    muscolo: m, serie: totale(m), volte: sedute.filter((sd) => sd.slot.some((s) => s.muscolo === m)).length,
    carenza: carenze.has(m), range: (carenze.has(m) ? range.carenza : range.mantenimento) as [number, number],
  })).sort((a, b) => Number(b.carenza) - Number(a.carenza) || b.serie - a.serie)
  return { giorni, step, sedute, volume }
}

/** Il piano del coach rispetta lo scheletro? Errori bloccanti (il coach li corregge da solo). */
export function confrontaConScheletro(plan: CoachPlan, sch: Scheletro, catalog: Exercise[]): string[] {
  const byId = new Map(catalog.map((e) => [e.id, e]))
  const errori: string[] = []
  if (plan.sedute.length !== sch.sedute.length) {
    errori.push(`Le sedute devono essere ${sch.sedute.length} (${sch.sedute.map((s) => s.nome).join(', ')}), non ${plan.sedute.length}.`)
    return errori
  }
  sch.sedute.forEach((atteso, i) => {
    const sd = plan.sedute[i]
    if (sd.esercizi.length !== atteso.slot.length) {
      errori.push(`${atteso.nome}: servono ${atteso.slot.length} esercizi nell'ordine dello scheletro, non ${sd.esercizi.length}.`)
      return
    }
    atteso.slot.forEach((slot, j) => {
      const e = sd.esercizi[j]
      const ex = byId.get(e.exercise_id)
      if (!ex) return // già segnalato da controllaPiano
      const muscoloOk = ex.primary_muscles.includes(slot.muscolo)
      const ruoloOk = (slot.ruolo === 'multiarticolare') === ex.roles.includes('compound')
      if (!muscoloOk || !ruoloOk) {
        errori.push(`${atteso.nome}, slot ${j + 1}: serve ${slot.ruolo} per ${MUSCLE_LABELS[slot.muscolo]} (${slot.indicazione}), non ${ex.name}.`)
      } else if (Math.abs(e.serie - slot.serie) > 1) {
        errori.push(`${atteso.nome}, slot ${j + 1} (${ex.name}): ${slot.serie} serie previste, non ${e.serie}.`)
      }
    })
  })
  return errori
}

/** Lo scheletro in forma compatta per il contesto dell'LLM. */
export function scheletroPerLlm(sch: Scheletro) {
  return {
    giorni_settimana: sch.giorni,
    sedute: sch.sedute.map((sd) => ({
      nome: sd.nome, split: sd.split,
      slot: sd.slot.map((s, i) => ({ n: i + 1, muscolo: s.muscolo, ruolo: s.ruolo, tipo: s.tipo, serie: s.serie, reps: s.reps, rir: s.rir, indicazione: s.indicazione })),
    })),
    volume_settimanale: sch.volume.map((v) => ({ muscolo: MUSCLE_LABELS[v.muscolo], serie: v.serie, volte: v.volte, carenza: v.carenza, range: `${v.range[0]}-${v.range[1]}` })),
  }
}
