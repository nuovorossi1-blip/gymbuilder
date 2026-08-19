/**
 * Utilità condivise fra i motori di generazione (Bodybuilding, Forza, e i
 * futuri). Qui vive solo ciò che è identico fra motori diversi: timing,
 * generatore pseudocasuale, riscaldamento contestuale, deduplicazione.
 * Le regole di programmazione (slot, split, fatica) restano in ciascun motore.
 */

import { isLaggingNote, type Exercise, type Experience, type Intensity, type Muscle, type PrescribedExercise } from '../types'

/** Muscoli con una vera sotto-struttura a capi, per cui ha senso far ruotare il focus_portion
 *  (sez. Lagging Muscle Engine): condiviso fra bodybuilding.ts e strength.ts. */
export const PORZIONE_ROTABILE = new Set<Muscle>(['biceps', 'triceps'])

/** Tier di priorità per il riordino sotto: più basso viene prima. Limita gli scambi a slot
 *  con lo stesso "peso" nella sessione, senza toccare la struttura macro (compound in
 *  apertura, identità dello split) già garantita a monte. */
function tierEsercizio(p: PrescribedExercise): number {
  if (p.role === 'compound') return 0
  if (isLaggingNote(p.note)) return 1
  return 2
}

const FATICA_LOCALE_ALTA = 2

/**
 * Rifinisce (non ricostruisce) l'ordine già deciso dal motore: evita di mettere in sequenza
 * due esercizi che affaticano pesantemente lo stesso muscolo — anche solo come secondario
 * dell'uno o dell'altro — e anticipa un isolamento su un muscolo carente subito prima del
 * primo esercizio successivo che lo coinvolge come muscolo secondario (priming), così lo si
 * allena fresco invece che dopo che è già stato tirato in causa indirettamente (sez. "Alzate
 * Laterali prima delle Dip" discussa con l'utente). Scambia solo esercizi con lo stesso tier
 * di priorità: non altera mai la macro-struttura (compound in apertura, identità dello split)
 * che i test dei generatori già verificano.
 */
export function riordinaPerSinergie(scelti: PrescribedExercise[], catalogById: Map<string, Exercise>): void {
  const exFor = (p: PrescribedExercise) => catalogById.get(p.exercise_id)

  // Mai sui compound (tier 0): il loro ordine è già deciso apposta (faticaSort, identità
  // dello split) da chi ha costruito la sessione — questo passaggio rifinisce solo gli
  // accessori/richiami, dove oggi non esiste nessuna logica di sinergia muscolare. Il
  // bersaglio (l'esercizio che coinvolge il muscolo carente come secondario) può trovarsi
  // sia prima sia dopo la carenza nell'ordine di partenza: ordinaSlot (bodybuilding.ts) non
  // ha un rango dedicato per ogni accessorio, quindi non è garantito che la carenza sia già
  // davanti.
  const carenze = scelti.filter((p) => isLaggingNote(p.note) && p.muscle && tierEsercizio(p) !== 0)
  for (const carenza of carenze) {
    const i = scelti.indexOf(carenza)
    let bersaglio = -1
    for (let j = 0; j < scelti.length; j++) {
      if (j === i) continue
      const ex = exFor(scelti[j])
      if (ex?.secondary_muscles.includes(carenza.muscle!) && tierEsercizio(scelti[j]) !== 0) { bersaglio = j; break }
    }
    if (bersaglio < 0 || bersaglio === i + 1) continue
    scelti.splice(i, 1)
    scelti.splice(bersaglio > i ? bersaglio - 1 : bersaglio, 0, carenza)
  }

  // Scatta solo quando il secondo esercizio coinvolge come SECONDARIO ciò che il primo ha
  // appena lavorato come PRIMARIO (es. Dip dopo due esercizi petto: il petto è già stanco
  // anche se l'esercizio "conta" come tricipiti). Due esercizi che condividono lo stesso
  // muscolo primario (es. tre isolamenti petto in un Bro Split) sono accumulo di volume
  // intenzionale, non il problema che questo passaggio deve risolvere.
  for (let i = 0; i < scelti.length - 1; i++) {
    if (tierEsercizio(scelti[i]) === 0 || tierEsercizio(scelti[i + 1]) === 0) continue
    const a = exFor(scelti[i]); const b = exFor(scelti[i + 1])
    if (!a || !b) continue
    if (!(b.secondary_muscles.includes(a.primary_muscles[0]) && Math.max(a.local_fatigue, b.local_fatigue) >= FATICA_LOCALE_ALTA)) continue
    for (let k = i + 2; k < scelti.length; k++) {
      if (tierEsercizio(scelti[k]) !== tierEsercizio(scelti[i + 1])) continue
      const ex = exFor(scelti[k])
      if (!ex) continue
      const muscoli = [...ex.primary_muscles, ...ex.secondary_muscles]
      if (muscoli.includes(a.primary_muscles[0])) continue
      ;[scelti[i + 1], scelti[k]] = [scelti[k], scelti[i + 1]]
      break
    }
  }
}

/** Generatore pseudocasuale con seme: stessa configurazione + stesso seme = stesso allenamento. */
export function rng(seed: number) {
  let s = seed || 1
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** Minuti stimati per un esercizio: serie x (tempo sotto sforzo + recupero) + transizione. */
export function minutiEsercizio(p: { sets: number; rest_sec: number }): number {
  const lavoro = 40 // secondi medi per serie
  return (p.sets * (lavoro + p.rest_sec) + 60) / 60
}

export function minutiBlocco(esercizi: { sets: number; rest_sec: number }[]): number {
  return esercizi.reduce((t, e) => t + minutiEsercizio(e), 0)
}

/** Rimuove eventuali duplicati (sez. 22): non dovrebbero capitare, ma è una rete di sicurezza.
 *  Top Set/Back-Off (protocollo CBum) sono lo stesso esercizio ripetuto di proposito in due
 *  serie consecutive: contano come chiavi diverse, altrimenti questa rete di sicurezza
 *  cancellerebbe il Top Set tenendo solo il Back-Off. */
export function rimuoviDuplicati(scelti: PrescribedExercise[]): void {
  const chiave = (p: PrescribedExercise) => (p.note === 'top_set' || p.note === 'back_off') ? `${p.exercise_id}:${p.note}` : p.exercise_id
  const visti = new Set<string>()
  for (let i = scelti.length - 1; i >= 0; i--) {
    const k = chiave(scelti[i])
    if (visti.has(k)) scelti.splice(i, 1)
    else visti.add(k)
  }
}

/** Porta il primo multiarticolare davanti a richiami e isolamenti. */
export function portaCompoundInApertura(scelti: PrescribedExercise[]): boolean {
  if (scelti.length === 0) return false
  if (scelti[0].role === 'compound') return true
  const index = scelti.findIndex((exercise) => exercise.role === 'compound')
  if (index < 0) return false
  const [compound] = scelti.splice(index, 1)
  scelti.unshift(compound)
  return true
}

export function vuotoVolume(): Record<Muscle, number> {
  return {
    chest: 0, back: 0, front_delts: 0, lateral_delts: 0, rear_delts: 0,
    biceps: 0, triceps: 0, forearms: 0, quads: 0, hamstrings: 0, glutes: 0, adductors: 0, calves: 0, core: 0,
  }
}

/**
 * Riscaldamento contestuale (sez. 5 della correzione): costruito DOPO aver
 * scelto gli esercizi principali, in base ai pattern di movimento e ai
 * muscoli che la sessione userà davvero, non da una tabella fissa per split.
 */
export function scegliRiscaldamento(
  pool: Exercise[],
  catalogoAllenamento: Exercise[],
  scelti: PrescribedExercise[],
  random: () => number
): PrescribedExercise[] {
  const perId = new Map(catalogoAllenamento.map((e) => [e.id, e]))
  const principali = scelti.map((s) => perId.get(s.exercise_id)).filter((e): e is Exercise => !!e)
  const patterns = new Set(principali.map((e) => e.movement_pattern))
  const muscoli = new Set(principali.flatMap((e) => e.primary_muscles))

  const cardio = pool.filter((e) => e.roles.includes('cardio'))
  const resto = pool.filter((e) => !e.roles.includes('cardio'))

  // Mobilità/attivazione il cui pattern o muscolo compare davvero nella sessione di oggi.
  const mirati = resto.filter(
    (e) => patterns.has(e.movement_pattern) || e.primary_muscles.some((m) => muscoli.has(m))
  )

  const sceltiWu: Exercise[] = []
  const coreWarmups = resto.filter((e) => e.primary_muscles.includes('core'))
  for (const e of coreWarmups.slice(0, 2)) sceltiWu.push(e)
  if (cardio.length > 0) sceltiWu.push(cardio[Math.floor(random() * cardio.length)])
  for (const e of mirati) {
    if (sceltiWu.length >= 4) break
    if (!sceltiWu.some((x) => x.id === e.id)) sceltiWu.push(e)
  }
  // Fallback: se la sessione usa pattern per cui non esiste riscaldamento mirato,
  // meglio una mobilità generica che nessun riscaldamento.
  if (sceltiWu.length < 2) {
    for (const e of resto) {
      if (sceltiWu.length >= 3) break
      if (!sceltiWu.some((x) => x.id === e.id)) sceltiWu.push(e)
    }
  }
  const finale = resto.find((x) => x.id === 'wu_serie_leggera')
  if (finale && !sceltiWu.some((x) => x.id === finale.id)) sceltiWu.push(finale)

  return sceltiWu.map((e) => ({
    exercise_id: e.id,
    name: e.name,
    role: 'warmup' as const,
    muscle: e.primary_muscles[0] ?? null,
    sets: 1,
    reps: e.default_reps,
    rest_sec: 0,
    instructions: e.instructions || undefined,
  }))
}

/**
 * Movimenti "da Metcon", condivisi da CrossFit Standard, CrossFit Hybrid,
 * Condizionamento e Tabata: solo bodyweight/kettlebell/manubri/cardio (mai
 * bilanciere, macchine o cavi, che restano della parte Forza/pesi), tag
 * 'conditioning' o 'cardio', complessità tecnica bassa (va eseguito anche
 * sotto fatica).
 */
export type CategoriaMetcon = 'lower' | 'upper' | 'full' | 'core' | 'mono'

export const CATEGORIA_PATTERN: Record<string, CategoriaMetcon> = {
  squat: 'lower', lunge: 'lower', hinge: 'lower', jump: 'lower',
  horizontal_push: 'upper', vertical_push: 'upper', horizontal_pull: 'upper', vertical_pull: 'upper',
  core: 'core',
  burpee: 'full',
  bike: 'mono', run: 'mono', row: 'mono', carry: 'mono',
}

const ROPE_CARDIO_IDS = new Set(['jump_rope', 'double_under', 'triple_under'])

export function categoriaMetcon(exercise: Exercise): CategoriaMetcon | undefined {
  if (ROPE_CARDIO_IDS.has(exercise.id)) return 'mono'
  return CATEGORIA_PATTERN[exercise.movement_pattern]
}

function isMetconCandidate(e: Exercise, usati: Set<string>, experience?: Experience): boolean {
  return (
    !usati.has(e.id) &&
    e.equipment !== 'barbell' &&
    e.equipment !== 'machine' &&
    e.equipment !== 'cable' &&
    (e.technical_complexity <= 2 || ROPE_CARDIO_IDS.has(e.id)) &&
    (e.roles.includes('conditioning') || e.roles.includes('cardio') || e.metcon_safe) &&
    categoriaMetcon(e) !== undefined &&
    (experience === 'advanced' ? e.id !== 'jump_rope' : e.id !== 'double_under' && e.id !== 'triple_under')
  )
}

export function poolMetcon(
  allenamento: Exercise[],
  usati: Set<string>,
  experience?: Experience,
  warmupPool: Exercise[] = []
): Exercise[] {
  const basePool = allenamento.filter((e) => isMetconCandidate(e, usati, experience))
  const warmupMono = warmupPool.filter((e) =>
    !usati.has(e.id) &&
    e.roles.includes('cardio') &&
    categoriaMetcon(e) === 'mono' &&
    (experience === 'advanced' ? e.id !== 'wu_salto_corda' : true)
  )
  return [...basePool, ...warmupMono.filter((candidate) => !basePool.some((exercise) => exercise.id === candidate.id))]
}

/** Ripetizioni per un movimento da Metcon: numeriche per la maggior parte delle categorie, a tempo per il monostrutturale. */
export function repsMetcon(categoria: CategoriaMetcon, exp: Experience, intensity: Intensity): string {
  if (categoria === 'mono') return '1 min'
  const base: Record<Exclude<CategoriaMetcon, 'mono'>, number> = { lower: 15, upper: 10, full: 10, core: 15 }
  const expMult = { beginner: 0.7, intermediate: 1, advanced: 1.3 }[exp]
  const intMult = { low: 0.85, medium: 1, high: 1.15 }[intensity]
  const valore = Math.round((base[categoria] * expMult * intMult) / 5) * 5
  return String(Math.max(5, valore))
}

/** Sceglie un candidato dando priorità a muscoli richiesti, poi a preferiti, poi casuale fra i restanti. */
export function scegliCandidato(
  pool: Exercise[],
  usati: Set<string>,
  priorita: Muscle[],
  preferiti: Set<string>,
  random: () => number
): Exercise | undefined {
  const candidati = pool.filter((e) => !usati.has(e.id))
  if (candidati.length === 0) return undefined
  const conPriorita = candidati.filter((e) => e.primary_muscles.some((m) => priorita.includes(m)))
  const base = conPriorita.length > 0 ? conPriorita : candidati
  const conPreferiti = base.filter((e) => preferiti.has(e.id))
  const scelta = conPreferiti.length > 0 ? conPreferiti : base
  return scelta[Math.floor(random() * scelta.length)]
}

export interface MovimentoScelto {
  exercise: Exercise
  categoria: CategoriaMetcon
}

/**
 * Un circuito di movimenti da Metcon, una categoria alla volta (monostrutturale,
 * gambe, spinta/tirata, core, full-body) per varietà, poi completato da
 * qualunque movimento resti se una categoria era vuota per l'attrezzatura.
 * Condiviso da CrossFit Standard, Condizionamento e Tabata: la differenza fra
 * quei motori è solo come prescrivono serie/tempo sul circuito scelto, non
 * come lo scelgono.
 */
export function costruisciCircuito(
  pool: Exercise[],
  numMovimenti: number,
  priorita: Muscle[],
  preferiti: Set<string>,
  random: () => number
): MovimentoScelto[] {
  const monoFirst = random() >= 0.5
  const ordineCategorie: CategoriaMetcon[] = monoFirst
    ? ['mono', 'lower', 'upper', 'core', 'full']
    : ['lower', 'upper', 'mono', 'core', 'full']
  const usati = new Set<string>()
  const risultato: MovimentoScelto[] = []

  for (const categoria of ordineCategorie) {
    if (risultato.length >= numMovimenti) break
    const bucket = pool.filter((e) => categoriaMetcon(e) === categoria)
    const scelto = scegliCandidato(bucket, usati, priorita, preferiti, random)
    if (scelto) {
      usati.add(scelto.id)
      risultato.push({ exercise: scelto, categoria })
    }
  }
  while (risultato.length < numMovimenti) {
    const restanti = pool.filter((e) => !usati.has(e.id))
    const scelto = scegliCandidato(restanti, usati, priorita, preferiti, random)
    if (!scelto) break
    usati.add(scelto.id)
    const categoria = categoriaMetcon(scelto) ?? 'upper'
    risultato.push({ exercise: scelto, categoria })
  }
  return risultato
}
