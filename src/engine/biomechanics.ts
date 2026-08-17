/**
 * Engine di adattamento Biomeccanico & Fisiologico basato sui dati profilo
 * (Sesso, Età, Altezza, Peso).
 *
 * Principi biomeccanici integrati:
 * 1. Sesso e Tempi di Recupero:
 *    - Uomo: Maggiore reclutamento neuro-muscolare e massa muscolare assoluta.
 *      Recuperi più lunghi sui fondamentali (90-120s ipertrofia, 180-240s forza)
 *      per ripristino completo ATP/PCr e tensione meccanica massimale.
 *    - Donna: Maggiore tolleranza al lattato, densità capillare e recupero metabolico più rapido.
 *      Recuperi più brevi (45-60s isolamenti, 75-90s fondamentali) con rep range metabolici (10-15).
 * 2. Età:
 *    - Master (35-49) & Senior (50+): riscaldamento articolare esteso (+1-3 min),
 *      maggiori tempi di recupero per la salute cardiovascolare e CNS, riduzione carico assiale.
 * 3. Altezza / Leve articolari (≥ 185 cm):
 *    - Bracci di leva più lunghi su Squat/Stacco -> predilige profili guidati/supportati per proteggere il rachide.
 * 4. Peso / BMI:
 *    - Adatta la stima calorica attiva (formula Keytel/MET) ed il peso nei movimenti a corpo libero.
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
  /** Modificatore serie/ripetizioni per isolamenti: 'metabolic_high' (10-15 reps) per donne o 'standard' (8-12) per uomini */
  repRangeBias: 'standard' | 'metabolic_high'
  /** Moltiplicatore per i tempi di recupero sui multiarticolari pesanti */
  compoundRestMultiplier: number
  /** Moltiplicatore per i tempi di recupero sugli isolamenti */
  isolationRestMultiplier: number
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
      compoundRestMultiplier: 1.0,
      isolationRestMultiplier: 1.0,
      warmupExtraMin: 0,
      preferSupported: false,
      capAxialLoad: false,
    }
  }

  const isFemale = profile.sex === 'female'
  const isSenior = typeof profile.age === 'number' && profile.age >= 50
  const isMaster = typeof profile.age === 'number' && profile.age >= 35 && profile.age < 50
  const isTall = typeof profile.height_cm === 'number' && profile.height_cm >= 185

  // Una carenza è una scelta/valutazione esplicita dell'utente: non può essere
  // dedotta automaticamente dal sesso o dagli altri dati anagrafici.
  const recommendedWeakPoints: Muscle[] = []

  // Tempi di recupero differenziati Uomo vs Donna:
  // Uomo: 1.0x sui fondamentali (recupero completo ATP/PCr per tensione meccanica elevata)
  // Donna: 0.85x sui fondamentali e 0.80x sugli isolamenti (recupero metabolico più veloce)
  let compoundRestMultiplier = isFemale ? 0.85 : 1.0
  let isolationRestMultiplier = isFemale ? 0.80 : 1.0

  if (isSenior) {
    compoundRestMultiplier *= 1.20
    isolationRestMultiplier *= 1.15
  } else if (isMaster) {
    compoundRestMultiplier *= 1.10
  }

  const warmupExtraMin = isSenior ? 3 : isMaster ? 1 : 0
  const preferSupported = isSenior || isTall
  const capAxialLoad = isSenior || isTall

  return {
    recommendedWeakPoints,
    repRangeBias: isFemale ? 'metabolic_high' : 'standard',
    compoundRestMultiplier,
    isolationRestMultiplier,
    warmupExtraMin,
    preferSupported,
    capAxialLoad,
  }
}

/**
 * Risolve la lista finale di carenze da usare nel programma:
 * Le carenze scelte esplicitamente dall'utente in UI HANNO SEMPRE PRIORITÀ ASSOLUTA.
 * Le carenze sono sempre e soltanto quelle scelte esplicitamente dall'utente.
 */
export function resolveEffectiveWeakPoints(userWeakPoints: Muscle[], profile?: BiomechanicalProfile | null): Muscle[] {
  void profile
  return [...new Set(userWeakPoints ?? [])]
}

/**
 * Adatta la prescrizione di un esercizio in base al profilo fisiologico/biomeccanico dell'utente.
 */
export function adaptPrescriptionForProfile(
  prescribed: PrescribedExercise,
  profile?: BiomechanicalProfile | null
): PrescribedExercise {
  if (!profile) return prescribed
  const adj = computeBiomechanicalAdjustments(profile)

  let rest_sec = prescribed.rest_sec
  if (prescribed.role === 'compound') {
    rest_sec = Math.max(60, Math.round(rest_sec * adj.compoundRestMultiplier))
  } else if (prescribed.role === 'isolation') {
    rest_sec = Math.max(30, Math.round(rest_sec * adj.isolationRestMultiplier))
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
