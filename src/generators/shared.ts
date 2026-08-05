/**
 * Utilità condivise fra i motori di generazione (Bodybuilding, Forza, e i
 * futuri). Qui vive solo ciò che è identico fra motori diversi: timing,
 * generatore pseudocasuale, riscaldamento contestuale, deduplicazione.
 * Le regole di programmazione (slot, split, fatica) restano in ciascun motore.
 */

import type { Exercise, Muscle, PrescribedExercise } from '../types'

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
