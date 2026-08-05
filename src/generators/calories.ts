/**
 * ActiveCaloriesEngine (sez. 60-61): stima, mai valore esatto.
 *
 * Formula standard su MET (Metabolic Equivalent of Task):
 *   kcal/min = MET * 3.5 * peso_kg / 200
 *
 * I valori MET sono approssimazioni dichiarate, non misure individuali:
 * dipendono da carico, tecnica e recupero reale, che qui non conosciamo.
 * Senza il peso dell'utente si usa una media adulta (75 kg), sempre
 * etichettata come stima nell'interfaccia — mai "calorie esatte" (sez. 82
 * del master prompt, regola 15).
 */

import type { Mode, PrescribedExercise } from '../types'

export const PESO_DEFAULT_KG = 75

const MET: Record<Mode, { compound: number; isolation: number }> = {
  // Bodybuilding: recuperi più brevi, densità di lavoro più alta.
  bodybuilding: { compound: 5, isolation: 3.5 },
  // Forza: singole ripetizioni più intense ma recuperi lunghi abbassano la media.
  strength: { compound: 4.5, isolation: 3.5 },
}
const MET_WARMUP = 2.5

function metPer(mode: Mode, role: PrescribedExercise['role']): number {
  if (role === 'warmup') return MET_WARMUP
  return MET[mode][role]
}

/** Calorie stimate per un singolo esercizio, dati i minuti che occupa (serie + recuperi). */
export function stimaCalorieEsercizio(
  mode: Mode,
  role: PrescribedExercise['role'],
  minuti: number,
  pesoKg: number
): number {
  const met = metPer(mode, role)
  return Math.round(met * 3.5 * pesoKg / 200 * minuti)
}
