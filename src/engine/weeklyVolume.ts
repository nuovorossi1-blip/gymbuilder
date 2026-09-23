/**
 * Tabella del volume settimanale (23/09, Fase 4 punto 6 del prompt di programmazione di Rossi):
 * serie per distretto giorno per giorno, totale, frequenza e range obiettivo per la fase.
 *
 * Le serie si contano dalle sedute davvero generabili: il workout già scritto (DeepSeek) se c'è,
 * altrimenti quello del motore con seme fisso — la struttura (slot, serie) è deterministica,
 * cambia solo quale variante di esercizio esce. Le giornate metcon (CrossFit, Tabata) non hanno
 * serie per distretto confrontabili e restano fuori dal conteggio: la tabella lo dichiara.
 */
import type { GeneratedWorkout, Muscle, NutritionPhase, WeeklyProgram, WeeklySession } from '../types'

export interface VolumeRow {
  muscle: Muscle
  perDay: number[]
  total: number
  frequency: number
  carenza: boolean
  target: [number, number]
  status: 'basso' | 'ok' | 'alto'
}

export interface WeeklyVolume {
  days: WeeklySession[]
  rows: VolumeRow[]
  skippedDays: number
  phase: NutritionPhase | null
}

const TARGET: Record<NutritionPhase, { carenza: [number, number]; mantenimento: [number, number] }> = {
  deficit: { carenza: [12, 16], mantenimento: [6, 8] },
  maintenance: { carenza: [16, 20], mantenimento: [8, 10] },
  surplus: { carenza: [18, 24], mantenimento: [10, 14] },
}

const NOTE_NON_ALLENANTI = new Set(['avvicinamento'])

export function contaSerie(workout: GeneratedWorkout): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {}
  for (const block of workout.blocks) {
    if (block.kind === 'warmup') continue
    for (const e of block.exercises) {
      if (!e.muscle || e.role === 'warmup' || (e.note && NOTE_NON_ALLENANTI.has(e.note))) continue
      out[e.muscle] = (out[e.muscle] ?? 0) + e.sets
    }
  }
  return out
}

export function stimaVolumeSettimanale(
  program: WeeklyProgram,
  generate: (session: WeeklySession) => GeneratedWorkout | null,
  phase: NutritionPhase | null,
): WeeklyVolume | null {
  const counted = program.week.filter((session) => session.mode === 'bodybuilding' || session.mode === 'strength')
  if (counted.length === 0) return null
  const perSession = counted.map((session) => {
    try {
      const workout = session.generated_workout ?? generate(session)
      return workout ? contaSerie(workout) : {}
    } catch {
      return {}
    }
  })
  const muscles = new Set<Muscle>()
  perSession.forEach((row) => (Object.keys(row) as Muscle[]).forEach((m) => muscles.add(m)))
  const carenze = new Set(program.config.weak_points)
  const targets = TARGET[phase ?? 'maintenance']
  const rows: VolumeRow[] = [...muscles].map((muscle) => {
    const perDay = perSession.map((row) => row[muscle] ?? 0)
    const total = perDay.reduce((a, b) => a + b, 0)
    const carenza = carenze.has(muscle)
    const target = carenza ? targets.carenza : targets.mantenimento
    return {
      muscle, perDay, total, carenza, target,
      frequency: perDay.filter((n) => n > 0).length,
      status: total < target[0] ? 'basso' : total > target[1] ? 'alto' : 'ok',
    }
  })
  rows.sort((a, b) => Number(b.carenza) - Number(a.carenza) || b.total - a.total)
  return { days: counted, rows, skippedDays: program.week.length - counted.length, phase }
}
