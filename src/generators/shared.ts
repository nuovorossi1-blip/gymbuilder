/**
 * Utilità condivise fra i motori di generazione (Bodybuilding, Forza, e i
 * futuri). Qui vive solo ciò che è identico fra motori diversi: timing,
 * generatore pseudocasuale, riscaldamento contestuale, deduplicazione.
 * Le regole di programmazione (slot, split, fatica) restano in ciascun motore.
 */

import type { Exercise, Experience, Intensity, Muscle, PrescribedExercise } from '../types'

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

/** Rimuove eventuali duplicati (sez. 22): non dovrebbero capitare, ma è una rete di sicurezza. */
export function rimuoviDuplicati(scelti: PrescribedExercise[]): void {
  const visti = new Set<string>()
  for (let i = scelti.length - 1; i >= 0; i--) {
    if (visti.has(scelti[i].exercise_id)) scelti.splice(i, 1)
    else visti.add(scelti[i].exercise_id)
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
    biceps: 0, triceps: 0, quads: 0, hamstrings: 0, glutes: 0, calves: 0, core: 0,
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
  const hasMono = basePool.some((e) => categoriaMetcon(e) === 'mono')
  const fallbackMono = !hasMono
    ? warmupPool.filter((e) =>
        !usati.has(e.id) &&
        e.roles.includes('cardio') &&
        categoriaMetcon(e) === 'mono' &&
        (experience === 'advanced' ? e.id !== 'wu_salto_corda' : true)
      )
    : []
  return [...basePool, ...fallbackMono.filter((candidate) => !basePool.some((exercise) => exercise.id === candidate.id))]
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
  const ordineCategorie: CategoriaMetcon[] = ['mono', 'lower', 'upper', 'core', 'full']
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
