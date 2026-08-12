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

import type { Equipment, EquipmentItem, Experience, Exercise, GeneratedWorkout, Muscle, PrescribedExercise, WorkoutBlock } from '../types'
import { PESO_DEFAULT_KG, stimaCalorieEsercizio } from './calories'

export interface TabataConfig {
  experience: Experience
  equipment: Equipment
  available_equipment?: EquipmentItem[] | null
  duration_min: number
  priority_muscles: Muscle[]
  excluded_exercises: string[]
  preferred_exercises?: string[]
  weight_kg?: number | null
  work_sec?: number
  rest_sec?: number
  rounds?: number
  prescription?: 'time' | 'reps'
  seed?: number
}

const ROUNDS = 8
const LAVORO_SEC = 20
const RIPOSO_SEC = 10


export function generaTabata(_catalogo: Exercise[], cfg: TabataConfig): GeneratedWorkout {
  const warnings: string[] = []
  const rounds = Math.max(1, cfg.rounds ?? ROUNDS)
  const workSec = Math.max(1, cfg.work_sec ?? LAVORO_SEC)
  const restSec = Math.max(1, cfg.rest_sec ?? RIPOSO_SEC)

  const exercises: PrescribedExercise[] = [
    {
      exercise_id: 'tabata_generic_timer',
      name: 'Tabata Work Phase',
      role: 'metcon',
      muscle: null,
      sets: rounds,
      reps: 'max',
      rest_sec: restSec,
      instructions: `${workSec}s di lavoro intenso e ${restSec}s di recupero per ${rounds} giri.`,
    },
  ]

  const minutiTabata = (rounds * (workSec + restSec)) / 60
  const peso = cfg.weight_kg || PESO_DEFAULT_KG
  exercises[0].est_kcal = stimaCalorieEsercizio('tabata', 'metcon', minutiTabata, peso)
  const kcalTotali = exercises[0].est_kcal ?? 0

  const blocchi: WorkoutBlock[] = [
    {
      kind: 'metcon',
      title: `Tabata Timer · ${rounds} Giri (${workSec}s / ${restSec}s)`,
      format: 'tabata',
      rounds,
      interval_sec: workSec,
      exercises,
    },
  ]

  return {
    name: 'Tabata Timer',
    mode: 'tabata',
    split: null,
    goal: 'conditioning',
    experience: cfg.experience,
    duration_min: Math.max(1, Math.ceil(minutiTabata)),
    blocks: blocchi,
    warnings,
    est_kcal: kcalTotali,
  }
}
