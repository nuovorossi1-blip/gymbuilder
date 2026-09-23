/**
 * Blocco 5 (23/09): dalla scheda analizzata alla scheda salvata.
 *
 * L'utente scrive la sua scheda in "Analizza", DeepSeek abbina ogni riga a un esercizio del
 * catalogo e propone la sua versione; l'utente sceglie slot per slot e salva. Qui si costruisce il
 * GeneratedWorkout salvabile: stesso formato delle schede del motore, così Salvati, Runner, timer,
 * Sostituisci e storico funzionano senza differenze.
 *
 * Regola di Rossi: l'ordine CONFERMATO dall'utente non si tocca. Se va contro le regole
 * (interleave per fase, multiarticolare all'ultimo slot) si aggiunge solo un avviso.
 */
import { minutiBlocco, rng, scegliRiscaldamento } from '../generators/shared'
import type { Exercise, GeneratedWorkout, Muscle, NutritionPhase, PrescribedExercise, Split } from '../types'
import { violazioniInterleave } from './programming'

export interface RigaScheda {
  exercise_id: string | null
  sets: number
  reps: string
  rir?: string
}

export const SEDUTA_SPLIT: Record<string, Split | null> = {
  Push: 'push', Pull: 'pull', Legs: 'legs', Upper: 'upper', Lower: 'lower', 'Full Body': 'full_body', Altro: null,
}

export function righeMancanti(righe: RigaScheda[], catalogById: Map<string, Exercise>): number[] {
  return righe.map((riga, index) => (riga.exercise_id && catalogById.has(riga.exercise_id) ? -1 : index)).filter((index) => index >= 0)
}

export function componiSchedaSalvabile(
  righe: RigaScheda[],
  catalog: Exercise[],
  opts: { nome: string; seduta: string; carenze: Muscle[]; phase: NutritionPhase | null; experience: GeneratedWorkout['experience']; note?: string },
): GeneratedWorkout {
  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]))
  if (righeMancanti(righe, byId).length > 0) throw new Error('Alcune righe non sono abbinate a un esercizio del catalogo.')
  const main: PrescribedExercise[] = righe.map((riga) => {
    const ex = byId.get(riga.exercise_id!)!
    const muscle = ex.primary_muscles.find((m) => opts.carenze.includes(m)) ?? ex.primary_muscles[0] ?? null
    return {
      exercise_id: ex.id,
      name: ex.name,
      role: ex.roles.includes('compound') ? 'compound' : 'isolation',
      muscle,
      sets: Math.max(1, Math.min(10, Math.round(riga.sets) || 3)),
      reps: riga.reps.trim() || ex.default_reps,
      rest_sec: ex.default_rest,
      rir: riga.rir?.trim() || undefined,
      note: muscle && opts.carenze.includes(muscle) ? 'carenza' : undefined,
      instructions: ex.instructions || undefined,
    }
  })
  const warnings: string[] = []
  const viol = violazioniInterleave(main, opts.carenze, opts.phase)
  if (viol.length) warnings.push('Alternanza muscoli non rispettata: ' + viol.join(' '))
  if (main.length >= 5 && main[main.length - 1].role === 'compound') {
    warnings.push(`${main[main.length - 1].name} è un multiarticolare all'ultimo slot: da stanco rende meno e carica di più le articolazioni.`)
  }
  const pool = catalog.filter((exercise) => exercise.roles.includes('warmup'))
  const allenamento = catalog.filter((exercise) => !exercise.roles.includes('warmup'))
  const riscaldamento = scegliRiscaldamento(pool, allenamento, main, rng(1))
  const minutiRisc = 8
  return {
    name: opts.nome.trim() || `Scheda ${opts.seduta}`,
    mode: 'bodybuilding',
    split: SEDUTA_SPLIT[opts.seduta] ?? null,
    goal: 'hypertrophy',
    experience: opts.experience,
    duration_min: Math.round(minutiRisc + minutiBlocco(main)),
    blocks: [
      { kind: 'warmup', title: 'Riscaldamento', duration_min: minutiRisc, exercises: riscaldamento },
      { kind: 'main', title: 'Allenamento', exercises: main },
    ],
    warnings,
    programming_note: opts.note,
  }
}
