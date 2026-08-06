/**
 * Motore di generazione Tabata (fase 9).
 *
 * Protocollo fisso, non un formato fra tanti: 20″ di lavoro massimale, 10″
 * di riposo, 8 round, sempre. Un solo movimento per volta (mai round-robin
 * fra più movimenti sullo stesso round, a differenza di EMOM/Intervals in
 * Condizionamento): un Tabata con più movimenti è più "Tabata" in sequenza
 * — tutti gli 8 round del primo, poi tutti gli 8 round del secondo — non
 * un round che alterna esercizi. Per questo il Runner tratta 'tabata'
 * diversamente da 'emom'/'intervals' pur condividendo la stessa UI a
 * intervalli (sez. Runner).
 *
 * Le ripetizioni non sono un numero fisso ("max", sez. reale del protocollo:
 * più ripetizioni possibili nei 20″), quindi qui non serve `intensity` per
 * calcolarle come nel Metcon di CrossFit Standard/Condizionamento.
 */

import type { Equipment, Experience, Exercise, GeneratedWorkout, Muscle, PrescribedExercise, WorkoutBlock } from '../types'
import { EQUIPMENT_MAP } from '../types'
import { RANK_EXP } from './crossfit'
import { PESO_DEFAULT_KG, stimaCalorieEsercizio } from './calories'
import { costruisciCircuito, poolMetcon, rimuoviDuplicati, rng, scegliRiscaldamento } from './shared'

export interface TabataConfig {
  experience: Experience
  equipment: Equipment
  duration_min: number
  priority_muscles: Muscle[]
  excluded_exercises: string[]
  preferred_exercises?: string[]
  weight_kg?: number | null
  seed?: number
}

const ROUNDS = 8
const LAVORO_SEC = 20
const RIPOSO_SEC = 10

function numeroMovimenti(budget: number): number {
  if (budget < 10) return 1
  if (budget < 18) return 2
  if (budget < 26) return 3
  return 4
}

export function generaTabata(catalogo: Exercise[], cfg: TabataConfig): GeneratedWorkout {
  const warnings: string[] = []
  const random = rng(cfg.seed ?? 1)
  const attrezziOk = EQUIPMENT_MAP[cfg.equipment]
  const preferiti = new Set(cfg.preferred_exercises ?? [])

  const disponibili = catalogo.filter(
    (e) =>
      attrezziOk.includes(e.equipment) &&
      !cfg.excluded_exercises.includes(e.id) &&
      RANK_EXP[e.min_experience] <= RANK_EXP[cfg.experience]
  )
  const allenamento = disponibili.filter((e) => !e.roles.includes('warmup'))
  const riscaldamentoPool = disponibili.filter((e) => e.roles.includes('warmup'))

  const minutiRiscaldamento = cfg.duration_min >= 45 ? 9 : 6
  const budget = Math.max(4, cfg.duration_min - minutiRiscaldamento)

  const metconPool = poolMetcon(allenamento, new Set())
  const target = numeroMovimenti(budget)
  const circuito = costruisciCircuito(metconPool, target, cfg.priority_muscles, preferiti, random)

  if (circuito.length === 0) {
    warnings.push('Nessun movimento disponibile per il Tabata con queste impostazioni.')
  } else if (circuito.length < target) {
    warnings.push(
      `Con questa attrezzatura il Tabata ha solo ${circuito.length} movimenti. Aggiungendo attrezzi nel profilo diventa più vario.`
    )
  }

  const exercises: PrescribedExercise[] = circuito.map((m) => ({
    exercise_id: m.exercise.id,
    name: m.exercise.name,
    role: 'metcon',
    muscle: m.exercise.primary_muscles[0] ?? null,
    sets: ROUNDS,
    reps: 'max',
    rest_sec: RIPOSO_SEC,
    instructions: m.exercise.instructions || undefined,
  }))
  rimuoviDuplicati(exercises)

  const minutiTabata = (exercises.length * ROUNDS * (LAVORO_SEC + RIPOSO_SEC)) / 60
  if (cfg.duration_min - (minutiRiscaldamento + minutiTabata) > 10) {
    warnings.push(
      `Il Tabata resta intorno ai ${Math.round(minutiTabata)} minuti anche scegliendo più tempo: ` +
        'il protocollo è fisso (20″/10″×8 per movimento), non un limite tecnico.'
    )
  }

  const peso = cfg.weight_kg || PESO_DEFAULT_KG
  const minutiPerMovimento = exercises.length > 0 ? minutiTabata / exercises.length : 0
  for (const e of exercises) {
    e.est_kcal = stimaCalorieEsercizio('tabata', 'metcon', minutiPerMovimento, peso)
  }
  const kcalTotali = exercises.reduce((t, e) => t + (e.est_kcal ?? 0), 0)

  const blocchi: WorkoutBlock[] = [
    {
      kind: 'warmup',
      title: 'Riscaldamento',
      duration_min: minutiRiscaldamento,
      exercises: scegliRiscaldamento(riscaldamentoPool, allenamento, exercises, random),
    },
    {
      kind: 'metcon',
      title: `Tabata × ${exercises.length}`,
      format: 'tabata',
      rounds: ROUNDS,
      interval_sec: LAVORO_SEC,
      exercises,
    },
  ]

  return {
    name: 'Tabata',
    mode: 'tabata',
    split: null,
    goal: 'conditioning',
    experience: cfg.experience,
    duration_min: Math.round(minutiRiscaldamento + minutiTabata),
    blocks: blocchi,
    warnings,
    est_kcal: kcalTotali,
  }
}
