/**
 * Engine di adattamento Biomeccanico & Fisiologico basato sui dati profilo
 * (Sesso, Età, Altezza, Peso).
 *
 * Principi biomeccanici integrati:
 * 1. Sesso:
 *    - Donna: maggiore tolleranza alla fatica ad alte rep, recupero inter-set più rapido.
 *      Bias muscolare consigliato (se l'utente non seleziona carenze): Glutei, Femorali, Deltoidi laterali.
 *    - Uomo: Bias V-Taper (Petto, Dorso, Spalle).
 *    - IMPORANTE: Se l'utente seleziona delle carenze manuali, queste HANNO SEMPRE LA PRIORITÀ ASSOLUTA!
 * 2. Età:
 *    - Master (35-49) & Senior (50+): aumento del riscaldamento articolare (+1-3 min),
 *      maggiore tempo di recupero sui multiarticolari pesanti (+15-20%) e riduzione del sovraccarico assiale.
 * 3. Altezza / Leve articolari (≥ 185 cm):
 *    - Bracci di leva più lunghi su Squat/Stacco -> predilige profili guidati/supportati (es. Leg Press, Trap Bar,
 *      Bulgarian Split Squat, Rematore supportato) per proteggere il rachide lombare.
 * 4. Peso / BMI:
 *    - Adatta il calcolo delle calorie attive (formula Keytel/MET) ed il peso nei movimenti a corpo libero.
 */

import type { Muscle, PrescribedExercise } from '../types'

export interface BiomechanicalProfile {
  sex?: 'male' | 'female' | 'other' | 'unspecified' | null
  age?: number | null
  weight_kg?: number | null
  height_cm?: number | null
}

export interface BiomechanicalAdjustments {
  /** Carenze consigliate per profilo se l'utente non ne sceglie di proprie. */
  recommendedWeakPoints: Muscle[]
  /** Modificatore serie/ripetizioni per isolamenti: 'metabolic_high' (10-15 reps) per donne o 'standard' (8-12) */
  repRangeBias: 'standard' | 'metabolic_high'
  /** Moltiplicatore per i tempi di recupero (secondi) */
  restMultiplier: number
  /** Minuti extra di riscaldamento per protezione articolare */
  warmupExtraMin: number
  /** Predilige esercizi con profilo di stabilità guidato/supportato per ridurre il carico assiale */
  preferSupported: boolean
  /** Limita gli esercizi ad elevato sovraccarico assiale sul rachide */
  capAxialLoad: boolean
}

export function computeBiomechanicalAdjustments(profile?: BiomechanicalProfile | null): BiomechanicalAdjustments {
  if (!profile) {
    return {
      recommendedWeakPoints: [],
      repRangeBias: 'standard',
      restMultiplier: 1.0,
      warmupExtraMin: 0,
      preferSupported: false,
      capAxialLoad: false,
    }
  }

  const isFemale = profile.sex === 'female'
  const isSenior = typeof profile.age === 'number' && profile.age >= 50
  const isMaster = typeof profile.age === 'number' && profile.age >= 35 && profile.age < 50
  const isTall = typeof profile.height_cm === 'number' && profile.height_cm >= 185

  // Carenze di default Fisiologiche se l'utente NON ne ha specificate di sue:
  // - Donna: Glutei, Femorali, Deltoidi laterali
  // - Uomo: Petto, Dorso, Spalle
  const recommendedWeakPoints: Muscle[] = isFemale
    ? ['glutes', 'hamstrings', 'lateral_delts']
    : ['chest', 'back', 'lateral_delts']

  let restMultiplier = 1.0
  if (isFemale) restMultiplier *= 0.9
  if (isSenior) restMultiplier *= 1.18

  const warmupExtraMin = isSenior ? 3 : isMaster ? 1 : 0
  const preferSupported = isSenior || isTall
  const capAxialLoad = isSenior || isTall

  return {
    recommendedWeakPoints,
    repRangeBias: isFemale ? 'metabolic_high' : 'standard',
    restMultiplier,
    warmupExtraMin,
    preferSupported,
    capAxialLoad,
  }
}

/**
 * Risolve la lista finale di carenze da usare nel programma:
 * Le carenze scelte esplicitamente dall'utente in UI HANNO SEMPRE PRIORITÀ ASSOLUTA.
 * Se l'utente non ha scelto carenze (array vuoto), vengono applicate le raccomandazioni del profilo.
 */
export function resolveEffectiveWeakPoints(userWeakPoints: Muscle[], profile?: BiomechanicalProfile | null): Muscle[] {
  if (userWeakPoints && userWeakPoints.length > 0) {
    return userWeakPoints
  }
  const adjustments = computeBiomechanicalAdjustments(profile)
  return adjustments.recommendedWeakPoints
}

/**
 * Adatta la prescrizione di una serie di esercizi in base al profilo biomeccanico.
 */
export function adaptPrescriptionForProfile(
  prescribed: PrescribedExercise,
  profile?: BiomechanicalProfile | null
): PrescribedExercise {
  if (!profile) return prescribed
  const adj = computeBiomechanicalAdjustments(profile)

  let rest_sec = prescribed.rest_sec
  if (prescribed.role === 'compound') {
    rest_sec = Math.round(rest_sec * adj.restMultiplier)
  } else if (prescribed.role === 'isolation' && adj.repRangeBias === 'metabolic_high') {
    rest_sec = Math.max(30, Math.round(rest_sec * 0.9))
  }

  let reps = prescribed.reps
  if (prescribed.role === 'isolation' && adj.repRangeBias === 'metabolic_high' && reps === '8-12') {
    reps = '10-15'
  }

  return {
    ...prescribed,
    rest_sec,
    reps,
  }
}
