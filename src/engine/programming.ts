/**
 * Programmazione della sessione (23/09, prompt di programmazione di Rossi).
 *
 * "La programmazione non è scegliere gli esercizi: è DOVE metti ogni esercizio, COSA metti prima
 * e dopo, QUANTO dai a chi ne ha bisogno e QUANTO POCO a chi non ne ha bisogno."
 *
 * Questo modulo lavora DOPO la scelta degli esercizi (bodybuilding.ts) e fa due cose:
 *
 * 1. `applicaFase` — calibra serie, RIR e tecniche secondo la fase nutrizionale (Principio 5):
 *    lo stesso programma vale in deficit, normo e surplus, cambiano solo volume, RIR e tecniche.
 *    Marca anche il richiamo antagonista (bicipiti in Push, tricipiti in Pull, Principio 4).
 *
 * 2. `ordinaSessione` — decide l'ordine con vincoli espliciti, regole confermate da Rossi il 23/09:
 *    - senza carenze i muscoli grandi vanno prima; se ci sono carenze su muscoli PICCOLI apre la
 *      carenza piccola, e i grandi stanno in una fascia di fatica accettabile (slot 2-4 su 6,
 *      2-5 su 7-8), mai all'ultimo posto;
 *    - interleave: due esercizi dello stesso muscolo in fila sono ammessi in base all'energia
 *      disponibile — deficit mai, normocalorica al massimo 2, surplus fino a 3;
 *    - sul muscolo CARENTE l'interleave vale sempre, anche in surplus.
 *    Se i vincoli sono impossibili (es. Bro Petto: cinque esercizi petto) si allentano in ordine,
 *    prima quello sui muscoli non carenti, poi quello sulle carenze: la sessione esce comunque.
 *
 * L'ordine si trova per ricerca esaustiva con potatura (al massimo 8 esercizi: poche decine di
 * migliaia di combinazioni nel caso peggiore, tipicamente molte meno): è l'unico modo per
 * rispettare più vincoli insieme senza che una correzione ne rompa un'altra.
 */
import type { Exercise, Muscle, NutritionPhase, PrescribedExercise, Split } from '../types'

export const MUSCOLI_GRANDI = new Set<Muscle>(['chest', 'back', 'quads', 'hamstrings', 'glutes'])

/** Nota del richiamo antagonista. Volutamente SENZA la parola "richiamo": isLaggingNote la
 *  tratterebbe come una carenza (badge sbagliato, tagliata per prima a corto di tempo). */
export const NOTA_ANTAGONISTA = 'antagonista'

/** Quanti esercizi dello stesso muscolo (non carente) possono stare in fila. */
export function limiteConsecutivi(phase: NutritionPhase | null | undefined): number {
  if (phase === 'deficit') return 1
  if (phase === 'maintenance') return 2
  if (phase === 'surplus') return 3
  return Number.POSITIVE_INFINITY
}

const NOTE_ESCLUSE = new Set(['fst7_finisher', 'avvicinamento', 'top_set', 'back_off'])

type Step = -500 | -250 | 0 | 250 | 500 | 750 | 1000
const S = <T,>(v: [T, T, T, T, T, T, T]): Record<Step, T> =>
  ({ [-500]: v[0], [-250]: v[1], 0: v[2], 250: v[3], 500: v[4], 750: v[5], 1000: v[6] } as Record<Step, T>)

/**
 * Tabella master per gradino calorico (23/09, tabella di Rossi): colonne -500, -250, 0, +250,
 * +500, +750, +1000 kcal rispetto alla normocalorica. Il volume extra va PRIMA alle carenze:
 * i muscoli in mantenimento salgono solo dai gradini alti. Valori indicativi, come il prompt.
 */
export const TABELLA_GRADINI = {
  serie: {
    carenzaIso: S([3, 3, 4, 4, 4, 5, 5]),
    carenzaComp: S([3, 3, 4, 4, 4, 5, 5]),
    mantIso: S([2, 2, 3, 3, 3, 3, 4]),
    mantComp: S([3, 3, 3, 3, 4, 4, 4]),
    antagonista: S([2, 2, 3, 3, 3, 4, 4]),
  },
  rir: {
    comp: S(['1-2', '1-2', '1', '1', '0-1', '0-1', '0-1']),
    iso: S(['0-1', '0-1', '0-1', '0', '0', '0', '0']),
    antagonista: S(['1', '1', '1', '1', '0-1', '0-1', '0-1']),
  },
  /** Quante tecniche per sessione, solo su isolamenti carenti (mai sui multiarticolari). */
  tecniche: {
    drop: S([0, 0, 1, 2, 9, 9, 9]),
    restPause: S([0, 0, 0, 0, 1, 1, 2]),
    myo: S([0, 0, 0, 0, 0, 1, 2]),
  },
}

export function normalizzaStep(value: number | null | undefined): Step | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return Math.max(-500, Math.min(1000, Math.round(value / 250) * 250)) as Step
}

/** Gradino di default per chi arriva con la sola fase (test, config vecchie). */
export function stepDaFase(phase: NutritionPhase): Step {
  return phase === 'deficit' ? -500 : phase === 'maintenance' ? 0 : 500
}

export interface FaseOpts {
  step: number
  carenze: Muscle[]
  split: Split
}

/**
 * Serie, RIR e tecniche per gradino calorico (Principi 5 e 11 di Rossi). Modifica `scelti` sul
 * posto e ritorna la nota di programmazione da mostrare in anteprima.
 */
export function applicaFase(scelti: PrescribedExercise[], opts: FaseOpts): string {
  const step = normalizzaStep(opts.step) ?? 0
  const { carenze, split } = opts
  let antagonistaFatto = false
  let drop = TABELLA_GRADINI.tecniche.drop[step]
  let restPause = TABELLA_GRADINI.tecniche.restPause[step]
  let myo = TABELLA_GRADINI.tecniche.myo[step]
  for (const e of scelti) {
    if (e.role === 'warmup' || (e.note && NOTE_ESCLUSE.has(e.note)) || !e.muscle) continue
    const carenza = carenze.includes(e.muscle)
    const antagonista = !antagonistaFatto && e.role === 'isolation' && !carenza &&
      ((split === 'push' && e.muscle === 'biceps') || (split === 'pull' && e.muscle === 'triceps'))
    e.technique = undefined
    if (antagonista) {
      // Principio 4: richiamo leggero, mai a cedimento; al gradino massimo diventa un esercizio vero.
      antagonistaFatto = true
      e.note = NOTA_ANTAGONISTA
      e.sets = TABELLA_GRADINI.serie.antagonista[step]
      e.rir = TABELLA_GRADINI.rir.antagonista[step]
      if (step === 1000) e.technique = "Drop set sull'ultima serie"
      continue
    }
    const comp = e.role === 'compound'
    e.sets = comp
      ? (carenza ? TABELLA_GRADINI.serie.carenzaComp : TABELLA_GRADINI.serie.mantComp)[step]
      : (carenza ? TABELLA_GRADINI.serie.carenzaIso : TABELLA_GRADINI.serie.mantIso)[step]
    e.rir = comp ? TABELLA_GRADINI.rir.comp[step] : TABELLA_GRADINI.rir.iso[step]
    if (carenza && !comp) {
      // Myo-reps preferite sulle alzate laterali al cavo/manubri, rest-pause sui curl/estensioni.
      if (myo > 0 && e.muscle === 'lateral_delts') { e.technique = "Myo-reps sull'ultima serie"; myo-- }
      else if (restPause > 0) { e.technique = "Rest-pause sull'ultima serie"; restPause-- }
      else if (drop > 0) { e.technique = "Drop set sull'ultima serie"; drop-- }
      else if (myo > 0) { e.technique = "Myo-reps sull'ultima serie"; myo-- }
    }
  }
  const phase = step <= -250 ? 'deficit' : step <= 250 ? 'maintenance' : 'surplus'
  const alternanza = phase === 'deficit'
    ? 'Mai due esercizi dello stesso muscolo in fila.'
    : phase === 'maintenance'
      ? 'Al massimo due esercizi dello stesso muscolo in fila, mai sul muscolo carente.'
      : 'Fino a tre esercizi dello stesso muscolo grande in fila; il muscolo carente resta sempre alternato.'
  const tecniche = step <= -250
    ? 'nessuna tecnica di intensità'
    : step <= 250
      ? 'drop set solo sull\'ultima serie delle carenze'
      : 'drop set, rest-pause e myo-reps sulle carenze'
  const extra = step >= 750 ? ' Con queste calorie puoi valutare il 6° giorno e le gambe 2 volte a settimana.' : ''
  return `Volume al gradino ${step > 0 ? '+' : ''}${step} kcal: RIR ${TABELLA_GRADINI.rir.comp[step]} sui multiarticolari, ${tecniche}. ${alternanza}${extra}`
}

export interface OrdinaOpts {
  carenze: Muscle[]
  phase?: NutritionPhase | null
  split?: Split | null
  catalogById?: Map<string, Exercise>
}

interface Item {
  e: PrescribedExercise
  orig: number
  muscle: Muscle | null
  big: boolean
  carenza: boolean
  smallCarenza: boolean
  bigCarenza: boolean
  /** Cavo o macchina: traiettoria guidata, tollera la fatica (esempio di Rossi: "pulley slot 6,
   *  GRANDE ma CAVO, regge la fatica"). */
  guidato: boolean
}

const FATICA_LOCALE_ALTA = 2

/**
 * Riordina `scelti` sul posto rispettando le regole di Rossi. Ritorna true se ha cambiato qualcosa.
 * Senza fase nota e senza carenze non tocca nulla: il comportamento resta quello di prima.
 */
export function ordinaSessione(scelti: PrescribedExercise[], opts: OrdinaOpts): boolean {
  const n = scelti.length
  if (n <= 2 || n > 9) return false
  if (!opts.phase && opts.carenze.length === 0) return false
  if (scelti.some((e) => e.note && NOTE_ESCLUSE.has(e.note))) return false

  const items: Item[] = scelti.map((e, orig) => {
    const muscle = e.muscle
    const carenza = !!muscle && opts.carenze.includes(muscle)
    const big = e.role === 'compound' && !!muscle && MUSCOLI_GRANDI.has(muscle)
    return {
      e, orig, muscle, big, carenza,
      smallCarenza: carenza && !!muscle && !MUSCOLI_GRANDI.has(muscle),
      bigCarenza: carenza && !!muscle && MUSCOLI_GRANDI.has(muscle),
      guidato: ['cable', 'machine'].includes(String(opts.catalogById?.get(e.exercise_id)?.equipment ?? '')),
    }
  })

  const smallLead = items.some((i) => i.smallCarenza)
  const hasCompound = items.some((i) => i.e.role === 'compound')
  const lastAllowed = n <= 6 ? 3 : 4
  const phaseLimit = limiteConsecutivi(opts.phase)
  const byId = opts.catalogById

  const sinergiaPenalty = (a: Item, b: Item): number => {
    if (!byId) return 0
    const ea = byId.get(a.e.exercise_id)
    const eb = byId.get(b.e.exercise_id)
    if (!ea || !eb) return 0
    const hit = eb.secondary_muscles.includes(ea.primary_muscles[0]) && Math.max(ea.local_fatigue, eb.local_fatigue) >= FATICA_LOCALE_ALTA
    return hit ? 3 : 0
  }

  const positionCost = (item: Item, pos: number): number => {
    let cost = Math.abs(pos - item.orig)
    if (item.big && pos > lastAllowed) cost += 6 * (pos - lastAllowed)
    if (item.e.role === 'compound' && pos === n - 1 && n >= 5) cost += 8
    // Multiarticolari "piccoli" (dip, shoulder press): fascia media, al massimo uno slot dopo i grandi.
    else if (item.e.role === 'compound' && pos > lastAllowed + 1) cost += 4 * (pos - lastAllowed - 1)
    // Prompt, "eccezione importante": piccolo carente slot 1 -> grande carente slot 2-3.
    if (smallLead && item.bigCarenza && pos > 2) cost += 3 * (pos - 2)
    if (item.e.note === NOTA_ANTAGONISTA) {
      // Principio 4: bicipiti a metà Push (slot 4-5), tricipiti a fine Pull.
      if (opts.split === 'push') cost += 3 * (pos < 3 ? 3 - pos : pos > 4 ? pos - 4 : 0)
      if (opts.split === 'pull') cost += 3 * (n - 1 - pos)
    }
    return cost
  }

  function solve(limitNonCarenza: number, limitCarenza: number, bigLastAllowed = false): Item[] | null {
    let best: Item[] | null = null
    let bestCost = Number.POSITIVE_INFINITY
    const used = new Array<boolean>(n).fill(false)
    const seq: Item[] = []

    const leadOk = (item: Item): boolean => {
      if (smallLead) return item.smallCarenza
      if (hasCompound) return item.e.role === 'compound'
      return true
    }

    function runLength(next: Item): number {
      if (!next.muscle) return 1
      let len = 1
      for (let k = seq.length - 1; k >= 0 && seq[k].muscle === next.muscle; k--) len++
      return len
    }

    function step(cost: number) {
      if (cost >= bestCost) return
      if (seq.length === n) { best = [...seq]; bestCost = cost; return }
      const pos = seq.length
      for (let i = 0; i < n; i++) {
        if (used[i]) continue
        const item = items[i]
        if (pos === 0 && !leadOk(item)) continue
        // Nessun multiarticolare in fondo (23/09): vale anche per dip e shoulder press, che il
        // catalogo registra come tricipiti/deltoidi ma sono composti che caricano le spalle.
        // Eccezione: un multiarticolare a cavo/macchina può chiudere se è l'unico modo di rispettare
        // l'interleave (es. Pull in deficit con 3 dorsi su 6 slot), e comunque costa di più.
        if (!bigLastAllowed && pos === n - 1 && n >= 5 && item.e.role === 'compound' && !item.guidato) continue
        const limit = item.carenza ? limitCarenza : limitNonCarenza
        if (runLength(item) > limit) continue
        const add = positionCost(item, pos) + (pos > 0 ? sinergiaPenalty(seq[pos - 1], item) : 0)
        used[i] = true; seq.push(item)
        step(cost + add)
        seq.pop(); used[i] = false
      }
    }
    step(0)
    return best
  }

  // Vincoli allentati in ordine di importanza: l'interleave sul muscolo carente è la regola
  // confermata da Rossi e cede per ultima.
  const INF = Number.POSITIVE_INFINITY
  // Aggiornato col blocco 4: prima di mettere un multiarticolare a PESI LIBERI in fondo si accetta
  // una coppia dello stesso muscolo non carente (limite di fase +1): la qualità dell'interleave
  // costa meno del rischio di un bilanciere/manubrio pesante da stanchi (caso dip di Rossi).
  const result = solve(phaseLimit, 1) ?? solve(phaseLimit + 1, 1) ?? solve(phaseLimit, 1, true) ??
    solve(INF, 1) ?? solve(INF, 1, true) ?? solve(INF, INF) ?? solve(INF, INF, true)
  if (!result) return false
  const changed = result.some((item, idx) => item.orig !== idx)
  if (changed) {
    const ordered = result.map((item) => item.e)
    scelti.splice(0, n, ...ordered)
  }
  return changed
}

/** Quante volte uno stesso muscolo compare in fila oltre il limite: usato dal validatore. */
export function violazioniInterleave(esercizi: Pick<PrescribedExercise, 'muscle'>[], carenze: Muscle[], phase?: NutritionPhase | null): string[] {
  const errors: string[] = []
  const phaseLimit = limiteConsecutivi(phase)
  let start = 0
  for (let i = 1; i <= esercizi.length; i++) {
    const m = esercizi[start].muscle
    if (i < esercizi.length && m && esercizi[i].muscle === m) continue
    const run = i - start
    if (m && run > 1) {
      const limit = carenze.includes(m) ? 1 : phaseLimit
      if (run > limit) errors.push(`${run} esercizi di fila sullo stesso muscolo (${m}) alle posizioni ${start + 1}-${i}.`)
    }
    start = i
  }
  return errors
}
