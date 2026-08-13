/**
 * Motore di generazione Condizionamento (fase 8).
 *
 * Solo Metcon, nessuna parte Forza/Skill: a differenza di CrossFit Standard
 * (che ha sempre Forza/Skill + Metcon AMRAP), qui l'utente sceglie il
 * formato — è la vera "scelta di formato" della specifica (AMRAP, EMOM,
 * For Time, Rounds, Circuit, Intervals). `split` resta `null` come gli
 * altri motori Metcon: non è programmazione per gruppo muscolare.
 *
 * Riusa il pool di movimenti di CrossFit Standard (`poolMetcon`/
 * `costruisciCircuito` in shared.ts): la differenza fra i due motori è cosa
 * fanno col circuito scelto (una sola AMRAP fissa vs sei formati diversi),
 * non come scelgono i movimenti.
 */

import type {
  Equipment, EquipmentItem, Experience, Exercise, GeneratedWorkout, Intensity, Muscle,
  PrescribedExercise, WorkoutBlock,
} from '../types'
import { METCON_FORMAT_LABELS } from '../types'
import { isExerciseAvailable } from './equipment'
import { RANK_EXP } from './crossfit'
import { PESO_DEFAULT_KG, stimaCalorieEsercizio } from './calories'
import {
  type CategoriaMetcon, costruisciCircuito, poolMetcon, repsMetcon, rimuoviDuplicati, rng, scegliRiscaldamento,
} from './shared'

/** Formati scelti dall'utente per Condizionamento. 'tabata' ha un motore proprio (fase 9): non è fra le scelte qui. */
export type ConditioningFormat = 'amrap' | 'emom' | 'for_time' | 'rounds' | 'circuit' | 'intervals'
export const FORMATI_CONDIZIONAMENTO: ConditioningFormat[] = ['amrap', 'emom', 'for_time', 'rounds', 'circuit', 'intervals']

export interface ConditioningConfig {
  format: ConditioningFormat
  experience: Experience
  equipment: Equipment
  available_equipment?: EquipmentItem[] | null
  duration_min: number
  priority_muscles: Muscle[]
  excluded_exercises: string[]
  preferred_exercises?: string[]
  intensity?: Intensity
  weight_kg?: number | null
  seed?: number
}

/** Solo per reps puramente numeriche (es. "15"): quelle a tempo ("1 min") restano intatte. */
function reduxReps(reps: string, fattore: number): string {
  if (!/^\d+$/.test(reps)) return reps
  const n = parseInt(reps, 10)
  return String(Math.max(5, Math.round((n * fattore) / 5) * 5))
}

/** Minuti stimati per un giro di circuito: ~45s di lavoro a movimento più il recupero fra un movimento e l'altro. */
function minutiPerGiro(numMovimenti: number, restSecFraEsercizi: number): number {
  return (numMovimenti * (45 + restSecFraEsercizi)) / 60
}

export function generaCondizionamento(catalogo: Exercise[], cfg: ConditioningConfig): GeneratedWorkout {
  const warnings: string[] = []
  const random = rng(cfg.seed ?? 1)
  const preferiti = new Set(cfg.preferred_exercises ?? [])
  const intensity = cfg.intensity ?? 'medium'

  const disponibili = catalogo.filter(
    (e) =>
      isExerciseAvailable(e, cfg.equipment, cfg.available_equipment) &&
      !cfg.excluded_exercises.includes(e.id) &&
      RANK_EXP[e.min_experience] <= RANK_EXP[cfg.experience]
  )
  const allenamento = disponibili.filter((e) => !e.roles.includes('warmup'))
  const riscaldamentoPool = disponibili.filter((e) => e.roles.includes('warmup'))

  const minutiRiscaldamento = cfg.duration_min >= 45 ? 9 : 6
  const budget = Math.max(8, cfg.duration_min - minutiRiscaldamento)
  const metconPool = poolMetcon(allenamento, new Set(), cfg.experience, riscaldamentoPool)

  const numMovimenti = { amrap: budget >= 15 ? 4 : 3, emom: budget >= 16 ? 2 : 1, for_time: 3, rounds: 4, circuit: 4, intervals: 3 }[cfg.format]
  const circuito = costruisciCircuito(metconPool, numMovimenti, cfg.priority_muscles, preferiti, random)

  if (circuito.length === 0) {
    warnings.push('Nessun movimento disponibile per il Metcon con queste impostazioni.')
  } else if (circuito.length < numMovimenti) {
    warnings.push(
      `Con questa attrezzatura il circuito ha solo ${circuito.length} movimenti. Aggiungendo attrezzi nel profilo diventa più vario.`
    )
  }

  const { blocco, minutiTotali: minutiTotaliMetcon } = costruisciBlocco(cfg.format, circuito, cfg.experience, intensity, budget)

  const peso = cfg.weight_kg || PESO_DEFAULT_KG
  const minutiPerMovimento = blocco.exercises.length > 0 ? minutiTotaliMetcon / blocco.exercises.length : 0
  for (const e of blocco.exercises) {
    e.est_kcal = stimaCalorieEsercizio('conditioning', 'metcon', minutiPerMovimento, peso)
  }
  const kcalTotali = blocco.exercises.reduce((t, e) => t + (e.est_kcal ?? 0), 0)

  const blocchi: WorkoutBlock[] = [
    {
      kind: 'warmup',
      title: 'Riscaldamento',
      duration_min: minutiRiscaldamento,
      exercises: scegliRiscaldamento(riscaldamentoPool, allenamento, blocco.exercises, random),
    },
    blocco,
  ]

  const minutiEffettivi = minutiRiscaldamento + minutiTotaliMetcon
  if (cfg.duration_min - minutiEffettivi > 10) {
    warnings.push(
      `Il Metcon resta intorno ai ${Math.round(minutiTotaliMetcon)} minuti anche scegliendo più tempo: ` +
        `oltre una certa durata il formato ${METCON_FORMAT_LABELS[cfg.format]} perde di senso, non è un limite tecnico.`
    )
  }

  return {
    name: `Condizionamento — ${METCON_FORMAT_LABELS[cfg.format]}`,
    mode: 'conditioning',
    split: null,
    goal: 'conditioning',
    experience: cfg.experience,
    duration_min: Math.round(minutiEffettivi),
    blocks: blocchi,
    warnings,
    est_kcal: kcalTotali,
  }
}

function costruisciBlocco(
  format: ConditioningFormat,
  circuito: { exercise: Exercise; categoria: CategoriaMetcon }[],
  exp: Experience,
  intensity: Intensity,
  budget: number
): { blocco: WorkoutBlock; minutiTotali: number } {
  const titolo = METCON_FORMAT_LABELS[format]
  const n = Math.max(1, circuito.length)

  if (format === 'amrap') {
    const time_cap_min = Math.max(8, Math.min(25, budget))
    const exercises = circuito.map((m) => prescrivi(m, exp, intensity, 0))
    rimuoviDuplicati(exercises)
    return { blocco: { kind: 'metcon', title: `${titolo} ${time_cap_min}′`, format, time_cap_min, exercises }, minutiTotali: time_cap_min }
  }

  if (format === 'emom') {
    const rounds = Math.max(8, Math.min(20, budget))
    const exercises = circuito.map((m, i) => {
      const p = prescrivi(m, exp, intensity, 0)
      p.reps = reduxReps(p.reps, 0.6)
      if (circuito.length === 2) p.note = i === 0 ? 'min dispari' : 'min pari'
      return p
    })
    rimuoviDuplicati(exercises)
    return { blocco: { kind: 'metcon', title: `${titolo} ${rounds}′`, format, rounds, interval_sec: 60, exercises }, minutiTotali: rounds }
  }

  if (format === 'for_time') {
    const time_cap_min = Math.max(10, Math.min(20, budget))
    const exercises = circuito.map((m) => {
      const p = prescrivi(m, exp, intensity, 0)
      if (m.categoria !== 'mono') p.reps = reduxReps(p.reps, 2)
      return p
    })
    rimuoviDuplicati(exercises)
    return { blocco: { kind: 'metcon', title: `${titolo} (cap ${time_cap_min}′)`, format, rounds: 1, time_cap_min, exercises }, minutiTotali: time_cap_min }
  }

  if (format === 'rounds') {
    const rounds = budget < 15 ? 3 : budget < 22 ? 4 : 5
    const exercises = circuito.map((m) => prescrivi(m, exp, intensity, 0, 'riposa il necessario'))
    rimuoviDuplicati(exercises)
    const minutiTotali = rounds * minutiPerGiro(n, 30)
    return { blocco: { kind: 'metcon', title: `${rounds} giri — ${titolo}`, format, rounds, exercises }, minutiTotali }
  }

  if (format === 'circuit') {
    const rounds = budget < 15 ? 2 : budget < 22 ? 3 : 4
    const exercises = circuito.map((m) => prescrivi(m, exp, intensity, 30))
    rimuoviDuplicati(exercises)
    const minutiTotali = rounds * minutiPerGiro(n, 30)
    return { blocco: { kind: 'metcon', title: `${rounds} giri — ${titolo}`, format, rounds, exercises }, minutiTotali }
  }

  // intervals
  const interval_sec = 40
  const restBetween = 20
  const rounds = Math.max(8, Math.min(16, Math.round((budget * 60) / (interval_sec + restBetween))))
  const exercises = circuito.map((m) => ({
    exercise_id: m.exercise.id,
    name: m.exercise.name,
    role: 'metcon' as const,
    muscle: m.exercise.primary_muscles[0] ?? null,
    sets: 1,
    reps: `${interval_sec} sec`,
    rest_sec: restBetween,
    instructions: m.exercise.instructions || undefined,
  }))
  rimuoviDuplicati(exercises)
  const minutiTotali = (rounds * (interval_sec + restBetween)) / 60
  return { blocco: { kind: 'metcon', title: `${titolo} ${interval_sec}″/${restBetween}″`, format, rounds, interval_sec, exercises }, minutiTotali }
}

function prescrivi(
  m: { exercise: Exercise; categoria: CategoriaMetcon },
  exp: Experience,
  intensity: Intensity,
  rest_sec: number,
  note?: string
): PrescribedExercise {
  return {
    exercise_id: m.exercise.id,
    name: m.exercise.name,
    role: 'metcon',
    muscle: m.exercise.primary_muscles[0] ?? null,
    sets: 1,
    reps: repsMetcon(m.categoria, exp, intensity),
    rest_sec,
    note,
    instructions: m.exercise.instructions || undefined,
  }
}
