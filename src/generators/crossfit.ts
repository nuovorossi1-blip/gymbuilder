/**
 * Motore di generazione CrossFit Standard (fase 6).
 *
 * Struttura fissa di una classe standard, non uno split per gruppo
 * muscolare: Riscaldamento → Forza/Skill (1-2 alzate) → Metcon (AMRAP).
 * Per questo `GeneratedWorkout.split` resta `null` per questa modalità.
 *
 * Solo formato AMRAP per ora: è il più classico di una classe standard e il
 * più semplice da eseguire con un solo timer. EMOM/For Time/Rounds/Circuit/
 * Intervals restano la differenza esplicita del futuro motore
 * Condizionamento (fase 8): non anticipati qui per non sovrapporsi a quella
 * modalità quando arriverà.
 *
 * Il Forza/Skill riusa l'esistente tag `roles: 'strength'` del catalogo
 * (le stesse alzate che userebbe la Forza pura). Se l'attrezzatura non
 * consente bilanciere, si scende a un compound non-conditioning equivalente
 * (es. goblet squat, piegamenti): mai un buco silenzioso.
 *
 * Il Metcon pesca solo movimenti bodyweight/kettlebell/manubri/cardio
 * (roles 'conditioning' o 'cardio', complessità tecnica bassa): niente
 * bilanciere o macchine, che restano della parte Forza/Skill. Nessuna
 * programmazione settimanale sui muscoli carenti qui (weakPoints.ts):
 * con solo 1-2 alzate non è un contesto in cui il volume settimanale ha
 * senso, a differenza di Bodybuilding/Forza.
 */

import type {
  CrossFitBenchmark, Equipment, EquipmentItem, Exercise, Experience, GeneratedWorkout, Intensity, MetconFormat, Muscle,
  PrescribedExercise, WorkoutBlock,
} from '../types'
import { isExerciseAvailable } from './equipment'
import { PESO_DEFAULT_KG, stimaCalorieEsercizio } from './calories'
import {
  type CategoriaMetcon, categoriaMetcon, costruisciCircuito, minutiBlocco, minutiEsercizio, poolMetcon, repsMetcon,
  rimuoviDuplicati, rng, scegliCandidato, scegliRiscaldamento,
} from './shared'

export interface CrossFitConfig {
  format?: CrossFitFormat
  experience: Experience
  equipment: Equipment
  available_equipment?: EquipmentItem[] | null
  duration_min: number
  priority_muscles: Muscle[]
  target_muscles?: Muscle[]
  excluded_exercises: string[]
  preferred_exercises?: string[]
  intensity?: Intensity
  weight_kg?: number | null
  seed?: number
  benchmark?: CrossFitBenchmark
}

export type CrossFitFormat = Exclude<MetconFormat, 'circuit' | 'tabata'>
export const FORMATI_CROSSFIT: CrossFitFormat[] = [
  'amrap', 'for_time', 'emom', 'rounds', 'chipper', 'ladder', 'intervals',
]

const BENCHMARK_MOVEMENT_COUNT: Record<Exclude<CrossFitBenchmark, 'custom'>, number> = {
  cindy: 3, fran: 2, grace: 1, helen: 3,
}

function findFirstById(catalog: Exercise[], ids: string[]): Exercise | undefined {
  return ids.map((id) => catalog.find((exercise) => exercise.id === id)).find(Boolean)
}

function resolveBenchmark(benchmark: Exclude<CrossFitBenchmark, 'custom'>, catalog: Exercise[]): Exercise[] | null {
  const recipes: Record<Exclude<CrossFitBenchmark, 'custom'>, string[][]> = {
    cindy: [['trazioni'], ['piegamenti'], ['squat_libero']],
    fran: [['thruster_bil', 'db_thruster', 'kb_thruster'], ['trazioni']],
    grace: [['clean_jerk', 'clean_and_jerk', 'power_clean_push_jerk']],
    helen: [['run_400m', 'corsa', 'wu_camminata'], ['kb_swing'], ['trazioni']],
  }
  const exercises = recipes[benchmark].map((ids) => findFirstById(catalog, ids))
  return exercises.every(Boolean) ? exercises as Exercise[] : null
}

// La UI espone due fasce: Intermedio comprende anche le progressioni
// principianti; Avanzato comprende tutto il catalogo avanzato/esperto.
export const RANK_EXP: Record<Experience, number> = { beginner: 2, intermediate: 2, advanced: 3 }

const PATTERN_LOWER = ['squat', 'hinge', 'lunge']
const PATTERN_UPPER = ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull']

/** Minuti dei tre blocchi. Il Metcon ha un tetto realistico (una classe non si allunga solo perché c'è più tempo). */
function tempi(duration_min: number): { warmup: number; strength: number; metcon: number } {
  const warmup = duration_min >= 45 ? 9 : 6
  const remaining = duration_min - warmup
  const metcon = Math.max(8, Math.min(20, Math.round(remaining * 0.5)))
  const strength = Math.max(6, Math.min(18, remaining - metcon))
  return { warmup, strength, metcon }
}

function prescrizioneCF(exp: Experience, intensity: Intensity) {
  // Come in Forza: i principianti non arrivano ai carichi più alti nemmeno chiedendo "Alta".
  const intensitaEffettiva = exp === 'beginner' && intensity === 'high' ? 'medium' : intensity
  const perIntensita = {
    low: { reps: '6-8', rest: 120 },
    medium: { reps: '5-6', rest: 150 },
    high: { reps: '3-5', rest: 180 },
  }[intensitaEffettiva]
  const sets = { beginner: 3, intermediate: 4, advanced: 5 }[exp]
  return { sets, reps: perIntensita.reps, rest: perIntensita.rest }
}

function alleggerisciPrescrizione(base: ReturnType<typeof prescrizioneCF>): ReturnType<typeof prescrizioneCF> {
  const reps = base.reps === '3-5'
    ? '5-6'
    : base.reps === '5-6'
      ? '6-8'
      : '8-10'
  return {
    sets: Math.max(2, base.sets - 1),
    reps,
    rest: Math.max(75, base.rest - 30),
  }
}

function exerciseTargetsPriority(exercise: Exercise, priorities: Muscle[]): boolean {
  return exercise.primary_muscles.some((muscle) => priorities.includes(muscle))
}

function scegliForzaSkillConFocus(
  pool: Exercise[],
  usati: Set<string>,
  priorita: Muscle[],
  preferiti: Set<string>,
  random: () => number
): Exercise | undefined {
  const candidati = pool.filter((exercise) => !usati.has(exercise.id))
  if (candidati.length === 0) return undefined
  const focalizzati = candidati
    .filter((exercise) => exerciseTargetsPriority(exercise, priorita))
    .sort((a, b) => a.systemic_fatigue - b.systemic_fatigue || a.technical_complexity - b.technical_complexity)
  const base = focalizzati.length > 0 ? focalizzati : candidati
  return scegliCandidato(base, usati, priorita, preferiti, random)
}

function scegliPoolApertura(
  strengthPool: Exercise[],
  lowerPool: Exercise[],
  upperPool: Exercise[],
  priorita: Muscle[],
  random: () => number
): Exercise[] {
  if (priorita.length > 0) {
    const focus = strengthPool.filter((exercise) => exerciseTargetsPriority(exercise, priorita))
    if (focus.length > 0) return focus
  }
  const families = [lowerPool, upperPool, strengthPool].filter((pool) => pool.length > 0)
  if (families.length === 0) return strengthPool
  return families[Math.floor(random() * families.length)] ?? strengthPool
}

function prescriviForzaSkill(e: Exercise, exp: Experience, intensity: Intensity, deload = false): PrescribedExercise {
  const p = deload ? alleggerisciPrescrizione(prescrizioneCF(exp, intensity)) : prescrizioneCF(exp, intensity)
  return {
    exercise_id: e.id,
    name: e.name,
    role: 'compound',
    muscle: e.primary_muscles[0] ?? null,
    sets: p.sets,
    reps: p.reps,
    rest_sec: p.rest,
    note: deload ? 'focus carenza: carico ridotto' : undefined,
    instructions: e.instructions || undefined,
  }
}

function adattaForzaSkillAlTempo(scelti: PrescribedExercise[], budgetMin: number): void {
  const RECUPERO_MINIMO = 90
  const sforo = () => minutiBlocco(scelti) - budgetMin

  let iter = 0
  while (sforo() > 0 && iter++ < 50) {
    const candidato = scelti.filter((e) => e.rest_sec > RECUPERO_MINIMO).sort((a, b) => b.rest_sec - a.rest_sec)[0]
    if (!candidato) break
    candidato.rest_sec = Math.max(RECUPERO_MINIMO, candidato.rest_sec - 15)
  }

  iter = 0
  while (sforo() > 0 && iter++ < 50) {
    const candidato = [...scelti].sort((a, b) => b.sets - a.sets).find((e) => e.sets > 3)
    if (!candidato) break
    candidato.sets -= 1
  }

  // Se ancora troppo lunga, si toglie l'ultima alzata aggiunta (la 2a): la 1a resta sempre.
  while (sforo() > 0 && scelti.length > 1) scelti.pop()
}

function prescriviMetcon(e: Exercise, categoria: CategoriaMetcon, exp: Experience, intensity: Intensity): PrescribedExercise {
  return {
    exercise_id: e.id,
    name: e.name,
    role: 'metcon',
    muscle: e.primary_muscles[0] ?? null,
    sets: 1,
    reps: repsMetcon(categoria, exp, intensity),
    rest_sec: 0,
    instructions: e.instructions || undefined,
  }
}

export function generaCrossFit(catalogo: Exercise[], cfg: CrossFitConfig): GeneratedWorkout {
  const warnings: string[] = []
  const random = rng(cfg.seed ?? 1)
  const preferiti = new Set(cfg.preferred_exercises ?? [])
  const intensity = cfg.intensity ?? 'medium'
  const format = cfg.format ?? 'amrap'
  const benchmark = cfg.benchmark ?? 'custom'
  const targets = [...new Set(cfg.target_muscles ?? [])]

  const disponibili = catalogo.filter(
    (e) =>
      isExerciseAvailable(e, cfg.equipment, cfg.available_equipment) &&
      !cfg.excluded_exercises.includes(e.id) &&
      RANK_EXP[e.min_experience] <= RANK_EXP[cfg.experience]
  )
  const allenamento = disponibili.filter((e) => !e.roles.includes('warmup'))
  const riscaldamentoPool = disponibili.filter((e) => e.roles.includes('warmup'))

  const t = tempi(cfg.duration_min)
  const usati = new Set<string>()

  // --- Forza/Skill: 1-2 alzate. Preferisce il catalogo tag 'strength' (bilanciere); scende a un compound equivalente se l'attrezzatura non lo consente. ---
  const matchesTarget = (exercise: Exercise) => targets.length === 0 || exercise.primary_muscles.some((muscle) => targets.includes(muscle))
  const strengthPoolPrincipale = allenamento.filter((e) => e.roles.includes('strength') && matchesTarget(e))
  const strengthPool =
    strengthPoolPrincipale.length > 0
      ? strengthPoolPrincipale
      : allenamento.filter((e) => e.roles.includes('compound') && !e.roles.includes('conditioning') && matchesTarget(e))

  const lowerPool = strengthPool.filter((e) => PATTERN_LOWER.includes(e.movement_pattern))
  const upperPool = strengthPool.filter((e) => PATTERN_UPPER.includes(e.movement_pattern))

  const strengthEsercizi: PrescribedExercise[] = []
  const lift1Pool = scegliPoolApertura(strengthPool, lowerPool, upperPool, cfg.priority_muscles, random)
  const lift1 = scegliForzaSkillConFocus(lift1Pool, usati, cfg.priority_muscles, preferiti, random)
  if (lift1) {
    usati.add(lift1.id)
    strengthEsercizi.push(
      prescriviForzaSkill(lift1, cfg.experience, intensity, exerciseTargetsPriority(lift1, cfg.priority_muscles))
    )
  }

  if (t.strength >= 12) {
    const preferredSecondaryPools = lift1 && PATTERN_LOWER.includes(lift1.movement_pattern)
      ? [upperPool, strengthPool]
      : lift1 && PATTERN_UPPER.includes(lift1.movement_pattern)
        ? [lowerPool, strengthPool]
        : [upperPool, lowerPool, strengthPool]
    const lift2Pool = preferredSecondaryPools.find((pool) => pool.some((exercise) => exercise.id !== lift1?.id))
      ?? strengthPool
    const lift2 = scegliForzaSkillConFocus(lift2Pool, usati, cfg.priority_muscles, preferiti, random)
    if (lift2) {
      usati.add(lift2.id)
      strengthEsercizi.push(
        prescriviForzaSkill(lift2, cfg.experience, intensity, exerciseTargetsPriority(lift2, cfg.priority_muscles))
      )
    }
  }

  adattaForzaSkillAlTempo(strengthEsercizi, t.strength)
  rimuoviDuplicati(strengthEsercizi)

  const expectedBenchmarkMovements = benchmark === 'custom' ? 0 : BENCHMARK_MOVEMENT_COUNT[benchmark]
  const minimumPreparationExercises = benchmark === 'custom' ? 2 : 6 - expectedBenchmarkMovements
  while (strengthEsercizi.length < minimumPreparationExercises) {
    const supportPool = allenamento.filter((exercise) =>
      !usati.has(exercise.id) && matchesTarget(exercise) && exercise.technical_complexity <= 2
    )
    const support = scegliCandidato(supportPool, usati, targets, preferiti, random)
    if (!support) break
    usati.add(support.id)
    const targetedMuscle = support.primary_muscles.find((muscle) => targets.includes(muscle)) ?? support.primary_muscles[0] ?? null
    strengthEsercizi.push({
      exercise_id: support.id,
      name: support.name,
      role: support.roles.includes('compound') ? 'compound' : 'isolation',
      muscle: targetedMuscle,
      sets: 3,
      reps: '8-12',
      rest_sec: 75,
      note: targets.length > 0 ? 'target muscolare di oggi' : 'preparazione benchmark',
      instructions: support.instructions || undefined,
    })
  }

  if (strengthEsercizi.length === 0) {
    warnings.push('Nessun esercizio disponibile per la parte Forza/Skill con questa attrezzatura.')
  }

  // --- Metcon: formato scelto, con 4-5 movimenti sicuri sotto fatica, uno per categoria. ---
  const benchmarkExercises = benchmark === 'custom' ? null : resolveBenchmark(benchmark, [...allenamento, ...riscaldamentoPool])
  const benchmarkAdapted = !!benchmarkExercises && (
    (benchmark === 'fran' && benchmarkExercises[0]?.id !== 'thruster_bil') ||
    (benchmark === 'helen' && benchmarkExercises[0]?.id !== 'run_400m' && benchmarkExercises[0]?.id !== 'corsa')
  )
  if (benchmark !== 'custom' && !benchmarkExercises) {
    warnings.push(`Benchmark ${benchmark.toUpperCase()} non disponibile con catalogo, attrezzatura o esclusioni correnti: generato un WOD personalizzato.`)
  }
  if (benchmarkAdapted) warnings.push(`${benchmark.toUpperCase()} usa una variante compatibile con il catalogo e viene indicato come benchmark adattato.`)
  const standardMetconPool = poolMetcon(allenamento, usati, cfg.experience, riscaldamentoPool)
  const targetedMetconPool = targets.length > 0
    ? allenamento.filter((exercise) =>
        !usati.has(exercise.id) && matchesTarget(exercise) && exercise.technical_complexity <= 2
      )
    : []
  const metconPool = benchmark === 'custom' && targetedMetconPool.length > 0
    ? targetedMetconPool
    : standardMetconPool
  // Il totale allenante (Forza/Skill + Metcon) non scende mai sotto 6.
  const numMovimenti = Math.max(t.metcon >= 18 ? 5 : 4, 6 - strengthEsercizi.length)
  const circuito = benchmarkExercises
    ? benchmarkExercises.map((exercise) => ({ exercise, categoria: categoriaMetcon(exercise) ?? 'upper' as CategoriaMetcon }))
    : costruisciCircuito(metconPool, numMovimenti, targets.length > 0 ? targets : cfg.priority_muscles, preferiti, random)
  const metconEsercizi = circuito.map((m) => prescriviMetcon(m.exercise, m.categoria, cfg.experience, intensity))

  if (benchmarkExercises) {
    const repsByBenchmark: Record<Exclude<CrossFitBenchmark, 'custom'>, string[]> = {
      cindy: ['5', '10', '15'],
      fran: ['21-15-9', '21-15-9'],
      grace: ['30'],
      helen: ['400 m', '21', '12'],
    }
    metconEsercizi.forEach((exercise, index) => { exercise.reps = repsByBenchmark[benchmark as Exclude<CrossFitBenchmark, 'custom'>][index] })
  }

  rimuoviDuplicati(metconEsercizi)

  if (metconEsercizi.length === 0) {
    warnings.push('Nessun movimento disponibile per il Metcon con queste impostazioni.')
  } else if (metconEsercizi.length < 4) {
    warnings.push(
      `Con questa attrezzatura il Metcon ha solo ${metconEsercizi.length} movimenti. Aggiungendo attrezzi nel profilo diventa più vario.`
    )
  }

  const minutiEffettivi = t.warmup + minutiBlocco(strengthEsercizi) + t.metcon
  if (cfg.duration_min - minutiEffettivi > 10) {
    warnings.push(
      `Una sessione CrossFit Standard resta intorno ai ${Math.round(minutiEffettivi)} minuti (Forza/Skill + Metcon), ` +
        'anche scegliendo più tempo: è la durata tipica di una classe, non un limite tecnico.'
    )
  }

  const peso = cfg.weight_kg || PESO_DEFAULT_KG
  for (const e of strengthEsercizi) {
    e.est_kcal = stimaCalorieEsercizio('crossfit', e.role, minutiEsercizio(e), peso)
  }
  const minutiPerMovimentoMetcon = metconEsercizi.length > 0 ? t.metcon / metconEsercizi.length : 0
  for (const e of metconEsercizi) {
    e.est_kcal = stimaCalorieEsercizio('crossfit', e.role, minutiPerMovimentoMetcon, peso)
  }
  const kcalTotali = [...strengthEsercizi, ...metconEsercizi].reduce((tot, e) => tot + (e.est_kcal ?? 0), 0)

  const prescrizioneMetcon: Pick<WorkoutBlock, 'title' | 'format' | 'time_cap_min' | 'rounds' | 'interval_sec'> = (() => {
    switch (format) {
      case 'amrap': return { title: `AMRAP ${t.metcon}′`, format, time_cap_min: t.metcon }
      case 'for_time': return { title: 'For Time', format, time_cap_min: t.metcon, rounds: 4 }
      case 'rounds': return { title: 'Rounds For Time', format, time_cap_min: t.metcon, rounds: 5 }
      case 'emom': return { title: `EMOM ${t.metcon}′`, format, rounds: t.metcon, interval_sec: 60 }
      case 'intervals': return { title: 'Intervals 40″ / 20″', format, rounds: Math.max(8, t.metcon), interval_sec: 40 }
      case 'chipper': return { title: 'Chipper For Time', format, time_cap_min: t.metcon, rounds: 1 }
      case 'ladder': return { title: 'Ladder 2-4-6-8-10', format, time_cap_min: t.metcon, rounds: 5 }
    }
  })()

  const effectiveBenchmark = benchmarkExercises ? benchmark : 'custom'
  const adaptedLabel = benchmarkAdapted ? ' adattata' : ''
  const benchmarkTitle = effectiveBenchmark === 'cindy' ? 'Cindy · AMRAP 20′'
    : effectiveBenchmark === 'fran' ? `Fran${adaptedLabel} · 21-15-9 For Time`
    : effectiveBenchmark === 'grace' ? 'Grace · 30 Clean & Jerk For Time'
    : effectiveBenchmark === 'helen' ? `Helen${adaptedLabel} · 3 Rounds For Time`
    : null
  if (benchmarkTitle) {
    prescrizioneMetcon.title = benchmarkTitle
    prescrizioneMetcon.format = effectiveBenchmark === 'cindy' ? 'amrap' : 'for_time'
    prescrizioneMetcon.time_cap_min = effectiveBenchmark === 'cindy' ? 20 : effectiveBenchmark === 'grace' ? 7 : effectiveBenchmark === 'helen' ? 15 : 10
    prescrizioneMetcon.rounds = effectiveBenchmark === 'helen' ? 3 : effectiveBenchmark === 'cindy' ? undefined : prescrizioneMetcon.rounds
  }

  if (format === 'chipper') {
    for (const esercizio of metconEsercizi) esercizio.reps = esercizio.reps === '1 min' ? '2 min' : `2 × ${esercizio.reps}`
  }
  if (format === 'ladder') {
    for (const esercizio of metconEsercizi) esercizio.reps = '2-4-6-8-10'
  }

  const blocchi: WorkoutBlock[] = [
    {
      kind: 'warmup',
      title: 'Riscaldamento',
      duration_min: t.warmup,
      exercises: scegliRiscaldamento(riscaldamentoPool, allenamento, [...strengthEsercizi, ...metconEsercizi], random),
    },
    { kind: 'main', title: 'Forza/Skill', exercises: strengthEsercizi },
    {
      kind: 'metcon',
      ...prescrizioneMetcon,
      exercises: metconEsercizi,
    },
  ]

  return {
    name: effectiveBenchmark === 'custom' ? 'CrossFit Target WOD' : `CrossFit ${benchmarkTitle?.split(' · ')[0]}`,
    mode: 'crossfit',
    split: null,
    goal: 'conditioning',
    experience: cfg.experience,
    duration_min: Math.round(minutiEffettivi),
    blocks: blocchi,
    warnings,
    est_kcal: kcalTotali,
  }
}
