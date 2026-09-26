/**
 * Progressi sugli esercizi da migliorare (26/09): dagli allenamenti completati si ricavano, per
 * ogni seduta, la serie migliore e le ripetizioni pulite totali (o il carico usato).
 */
import type { CompletedWorkout } from '../types'

export interface PuntoProgresso { data: string; migliore: number | null; totale: number | null; kg: number | null }

export function progressiEsercizio(exerciseId: string, storico: CompletedWorkout[], max = 12): PuntoProgresso[] {
  const punti: PuntoProgresso[] = []
  for (const w of storico) {
    for (const b of w.blocks) for (const e of b.exercises) {
      if (e.exercise_id !== exerciseId) continue
      const reps = (e.logged_reps ?? []).filter((r) => Number.isFinite(r) && r > 0)
      if (!reps.length && e.logged_weight_kg === undefined) continue
      punti.push({
        data: w.completed_at.slice(0, 10),
        migliore: reps.length ? Math.max(...reps) : null,
        totale: reps.length ? reps.reduce((a, r) => a + r, 0) : null,
        kg: e.logged_weight_kg ?? null,
      })
    }
  }
  return punti.sort((a, b) => a.data.localeCompare(b.data)).slice(-max)
}

/** Riassunto leggibile: "5 → 7 (miglior serie), 3 sedute". */
export function riassuntoProgressi(punti: PuntoProgresso[]): string {
  const conReps = punti.filter((p) => p.migliore !== null)
  if (conReps.length >= 2) return `miglior serie ${conReps[0].migliore} → ${conReps[conReps.length - 1].migliore} in ${conReps.length} sedute`
  if (conReps.length === 1) return `miglior serie ${conReps[0].migliore} (1 seduta registrata)`
  const conKg = punti.filter((p) => p.kg !== null)
  if (conKg.length >= 2) return `carico ${conKg[0].kg} → ${conKg[conKg.length - 1].kg} kg in ${conKg.length} sedute`
  return 'nessuna seduta registrata ancora'
}
