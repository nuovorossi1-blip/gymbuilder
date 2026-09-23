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

export interface FaseOpts {
  phase: NutritionPhase
  carenze: Muscle[]
  split: Split
}

/**
 * Serie, RIR e tecniche per fase (Principio 5). Modifica `scelti` sul posto e ritorna la nota di
 * programmazione da mostrare in anteprima.
 */
export function applicaFase(scelti: PrescribedExercise[], opts: FaseOpts): string {
  const { phase, carenze, split } = opts
  let antagonistaFatto = false
  for (const e of scelti) {
    if (e.role === 'warmup' || (e.note && NOTE_ESCLUSE.has(e.note)) || !e.muscle) continue
    const carenza = carenze.includes(e.muscle)
    const antagonista = !antagonistaFatto && e.role === 'isolation' && !carenza &&
      ((split === 'push' && e.muscle === 'biceps') || (split === 'pull' && e.muscle === 'triceps'))
    if (antagonista) {
      // Principio 4: max 2 serie in deficit, 3 in normo/surplus, RIR 1 fisso, mai tecniche.
      antagonistaFatto = true
      e.note = NOTA_ANTAGONISTA
      e.sets = phase === 'deficit' ? 2 : 3
      e.rir = '1'
      e.technique = undefined
      continue
    }
    if (e.role === 'compound') {
      e.rir = phase === 'deficit' ? '2' : phase === 'maintenance' ? '1' : '0-1'
    } else {
      e.rir = phase === 'deficit' ? '1' : phase === 'maintenance' ? '0-1' : '0'
    }
    // Mantenimento al minimo efficace in deficit; più volume sulle carenze in surplus.
    if (phase === 'deficit' && !carenza && e.role === 'isolation') e.sets = Math.max(2, e.sets - 1)
    if (phase === 'surplus' && carenza) e.sets = Math.min(5, e.sets + 1)
    // Tecniche solo sulle carenze e solo su isolamenti (mai sui multiarticolari).
    e.technique = undefined
    if (carenza && e.role === 'isolation') {
      if (phase === 'maintenance') e.technique = "Drop set sull'ultima serie"
      if (phase === 'surplus') e.technique = "Drop set o rest-pause sull'ultima serie"
    }
  }
  if (phase === 'deficit') {
    return 'Fase deficit: RIR 2 sui multiarticolari per proteggere il recupero, nessuna tecnica di intensità, ' +
      'muscoli non carenti al volume minimo efficace. Mai due esercizi dello stesso muscolo in fila.'
  }
  if (phase === 'maintenance') {
    return 'Fase normocalorica: RIR 1 sui multiarticolari, drop set solo sull\'ultima serie delle carenze. ' +
      'Al massimo due esercizi dello stesso muscolo in fila, mai sul muscolo carente.'
  }
  return 'Fase surplus: RIR 0-1, una serie in più sulle carenze con drop set o rest-pause sull\'ultima serie. ' +
    'Fino a tre esercizi dello stesso muscolo grande in fila; il muscolo carente resta sempre alternato.'
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
        if (!bigLastAllowed && pos === n - 1 && n >= 5 && item.big) continue
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
  // confermata da Rossi e cede per ultima; prima cede "mai un grande all'ultimo posto" (es. Pull
  // con dorso carente: tre dorsi alternati finiscono per forza all'ultimo slot), poi il limite
  // di fase sui muscoli non carenti.
  const INF = Number.POSITIVE_INFINITY
  const result = solve(phaseLimit, 1) ?? solve(phaseLimit, 1, true) ?? solve(INF, 1) ?? solve(INF, 1, true) ??
    solve(INF, INF) ?? solve(INF, INF, true)
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
