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

import type { Intensity, Mode, PrescribedExercise, Sex } from '../types'

export const PESO_DEFAULT_KG = 75

const MET: Record<Mode, { compound: number; isolation: number; metcon?: number }> = {
  // Bodybuilding: recuperi più brevi, densità di lavoro più alta.
  bodybuilding: { compound: 5, isolation: 3.5 },
  // Forza: singole ripetizioni più intense ma recuperi lunghi abbassano la media.
  strength: { compound: 4.5, isolation: 3.5 },
  // CrossFit: la parte Strength/Skill è simile alla Forza, il Metcon è
  // sforzo cardio-metabolico continuo (MET ~8, "vigorous circuit training").
  crossfit: { compound: 4.5, isolation: 3.5, metcon: 8 },
  // Hybrid: le stesse alzate della Bodybuilding, alternate a scariche cardio
  // che alzano la densità media della sessione più delle altre modalità.
  crossfit_hybrid: { compound: 5, isolation: 3.5, metcon: 8 },
  // Condizionamento: solo Metcon, nessuna parte a bassa densità.
  conditioning: { compound: 8, isolation: 8, metcon: 8 },
  // Tabata: intervalli massimali, il MET più alto delle modalità esistenti.
  tabata: { compound: 9, isolation: 9, metcon: 9 },
}
const MET_WARMUP = 2.5

function metPer(mode: Mode, role: PrescribedExercise['role']): number {
  if (role === 'warmup') return MET_WARMUP
  if (role === 'metcon') return MET[mode].metcon ?? MET[mode].compound
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

export interface CalorieEstimateInput {
  mode: Mode
  durationMin: number
  weightKg: number | null
  age: number | null
  sex: Sex
  intensity: Intensity
  averageHeartRate?: number | null
}

export interface CalorieEstimate { kcal: number; method: 'heart_rate' | 'met'; estimated: true }

/** Provider sostituibile da HealthKit, Health Connect o dispositivi compatibili. */
export interface HealthDataProvider {
  isAvailable(): Promise<boolean>
  getAverageHeartRate(startedAt: Date, endedAt: Date): Promise<number | null>
}

/** Stima HR (Keytel) quando i dati minimi sono disponibili, altrimenti MET. */
export function estimateActiveCalories(input: CalorieEstimateInput): CalorieEstimate {
  const weight = input.weightKg ?? PESO_DEFAULT_KG
  const hr = input.averageHeartRate
  if (hr && input.age && input.sex !== 'other' && input.sex !== 'unspecified') {
    const perMinute = input.sex === 'male'
      ? (-55.0969 + 0.6309 * hr + 0.1988 * weight + 0.2017 * input.age) / 4.184
      : (-20.4022 + 0.4472 * hr - 0.1263 * weight + 0.074 * input.age) / 4.184
    return { kcal: Math.max(0, Math.round(perMinute * input.durationMin)), method: 'heart_rate', estimated: true }
  }
  const intensityMultiplier = { low: 0.85, medium: 1, high: 1.15 }[input.intensity]
  const baseMet = MET[input.mode].metcon ?? MET[input.mode].compound
  return {
    kcal: Math.round(baseMet * intensityMultiplier * 3.5 * weight / 200 * input.durationMin),
    method: 'met',
    estimated: true,
  }
}
