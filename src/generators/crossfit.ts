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
  Equipment, Exercise, Experience, GeneratedWorkout, Intensity, Muscle,
  PrescribedExercise, WorkoutBlock,
} from '../types'
import { EQUIPMENT_MAP } from '../types'
import { PESO_DEFAULT_KG, stimaCalorieEsercizio } from './calories'
import { minutiBlocco, minutiEsercizio, rimuoviDuplicati, rng, scegliRiscaldamento } from './shared'

export interface CrossFitConfig {
  experience: Experience
  equipment: Equipment
  duration_min: number
  priority_muscles: Muscle[]
  excluded_exercises: string[]
  preferred_exercises?: string[]
  intensity?: Intensity
  weight_kg?: number | null
  seed?: number
}

const RANK_EXP: Record<Experience, number> = { beginner: 1, intermediate: 2, advanced: 3 }

const PATTERN_LOWER = ['squat', 'hinge', 'lunge']
const PATTERN_UPPER = ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull']

type CategoriaMetcon = 'lower' | 'upper' | 'full' | 'core' | 'mono'

const CATEGORIA_PATTERN: Record<string, CategoriaMetcon> = {
  squat: 'lower', lunge: 'lower', hinge: 'lower', jump: 'lower',
  horizontal_push: 'upper', vertical_push: 'upper', horizontal_pull: 'upper', vertical_pull: 'upper',
  core: 'core',
  burpee: 'full',
  bike: 'mono', run: 'mono', row: 'mono',
}

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

function repsMetcon(categoria: CategoriaMetcon, exp: Experience, intensity: Intensity): string {
  if (categoria === 'mono') return '1 min'
  const base: Record<Exclude<CategoriaMetcon, 'mono'>, number> = { lower: 15, upper: 10, full: 10, core: 15 }
  const expMult = { beginner: 0.7, intermediate: 1, advanced: 1.3 }[exp]
  const intMult = { low: 0.85, medium: 1, high: 1.15 }[intensity]
  const valore = Math.round((base[categoria] * expMult * intMult) / 5) * 5
  return String(Math.max(5, valore))
}

/** Sceglie un candidato dando priorità a muscoli richiesti, poi a preferiti, poi casuale fra i restanti. */
function scegliCandidato(
  pool: Exercise[],
  usati: Set<string>,
  priorita: Muscle[],
  preferiti: Set<string>,
  random: () => number
): Exercise | undefined {
  const candidati = pool.filter((e) => !usati.has(e.id))
  if (candidati.length === 0) return undefined
  const conPriorita = candidati.filter((e) => e.primary_muscles.some((m) => priorita.includes(m)))
  const base = conPriorita.length > 0 ? conPriorita : candidati
  const conPreferiti = base.filter((e) => preferiti.has(e.id))
  const scelta = conPreferiti.length > 0 ? conPreferiti : base
  return scelta[Math.floor(random() * scelta.length)]
}

function prescriviForzaSkill(e: Exercise, exp: Experience, intensity: Intensity): PrescribedExercise {
  const p = prescrizioneCF(exp, intensity)
  return {
    exercise_id: e.id,
    name: e.name,
    role: 'compound',
    muscle: e.primary_muscles[0] ?? null,
    sets: p.sets,
    reps: p.reps,
    rest_sec: p.rest,
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
  const attrezziOk = EQUIPMENT_MAP[cfg.equipment]
  const preferiti = new Set(cfg.preferred_exercises ?? [])
  const intensity = cfg.intensity ?? 'medium'

  const disponibili = catalogo.filter(
    (e) =>
      attrezziOk.includes(e.equipment) &&
      !cfg.excluded_exercises.includes(e.id) &&
      RANK_EXP[e.min_experience] <= RANK_EXP[cfg.experience]
  )
  const allenamento = disponibili.filter((e) => !e.roles.includes('warmup'))
  const riscaldamentoPool = disponibili.filter((e) => e.roles.includes('warmup'))

  const t = tempi(cfg.duration_min)
  const usati = new Set<string>()

  // --- Forza/Skill: 1-2 alzate. Preferisce il catalogo tag 'strength' (bilanciere); scende a un compound equivalente se l'attrezzatura non lo consente. ---
  const strengthPoolPrincipale = allenamento.filter((e) => e.roles.includes('strength'))
  const strengthPool =
    strengthPoolPrincipale.length > 0
      ? strengthPoolPrincipale
      : allenamento.filter((e) => e.roles.includes('compound') && !e.roles.includes('conditioning'))

  const lowerPool = strengthPool.filter((e) => PATTERN_LOWER.includes(e.movement_pattern))
  const upperPool = strengthPool.filter((e) => PATTERN_UPPER.includes(e.movement_pattern))

  const strengthEsercizi: PrescribedExercise[] = []
  const lift1 = scegliCandidato(lowerPool.length > 0 ? lowerPool : strengthPool, usati, cfg.priority_muscles, preferiti, random)
  if (lift1) {
    usati.add(lift1.id)
    strengthEsercizi.push(prescriviForzaSkill(lift1, cfg.experience, intensity))
  }

  if (t.strength >= 15) {
    const lift2 = scegliCandidato(upperPool.length > 0 ? upperPool : strengthPool, usati, cfg.priority_muscles, preferiti, random)
    if (lift2) {
      usati.add(lift2.id)
      strengthEsercizi.push(prescriviForzaSkill(lift2, cfg.experience, intensity))
    }
  }

  adattaForzaSkillAlTempo(strengthEsercizi, t.strength)
  rimuoviDuplicati(strengthEsercizi)

  if (strengthEsercizi.length === 0) {
    warnings.push('Nessun esercizio disponibile per la parte Forza/Skill con questa attrezzatura.')
  }

  // --- Metcon: AMRAP con 3-4 movimenti bodyweight/kettlebell/manubri/cardio, uno per categoria. ---
  const metconPool = allenamento.filter(
    (e) =>
      !usati.has(e.id) &&
      e.equipment !== 'barbell' &&
      e.equipment !== 'machine' &&
      e.equipment !== 'cable' &&
      e.technical_complexity <= 2 &&
      (e.roles.includes('conditioning') || e.roles.includes('cardio')) &&
      CATEGORIA_PATTERN[e.movement_pattern] !== undefined
  )

  const numMovimenti = t.metcon >= 15 ? 4 : 3
  const ordineCategorie: CategoriaMetcon[] = numMovimenti === 4 ? ['mono', 'lower', 'upper', 'core'] : ['mono', 'lower', 'upper']

  const metconEsercizi: PrescribedExercise[] = []
  const usatiMetcon = new Set<string>()

  for (const categoria of ordineCategorie) {
    const bucket = metconPool.filter((e) => CATEGORIA_PATTERN[e.movement_pattern] === categoria)
    const scelto = scegliCandidato(bucket, usatiMetcon, cfg.priority_muscles, preferiti, random)
    if (scelto) {
      usatiMetcon.add(scelto.id)
      metconEsercizi.push(prescriviMetcon(scelto, categoria, cfg.experience, intensity))
    }
  }
  // Se una categoria era vuota (attrezzatura limitata), si completa da qualunque movimento resti, per non finire con un Metcon più corto del necessario.
  while (metconEsercizi.length < numMovimenti) {
    const restanti = metconPool.filter((e) => !usatiMetcon.has(e.id))
    const scelto = scegliCandidato(restanti, usatiMetcon, cfg.priority_muscles, preferiti, random)
    if (!scelto) break
    usatiMetcon.add(scelto.id)
    const categoria = CATEGORIA_PATTERN[scelto.movement_pattern] ?? 'upper'
    metconEsercizi.push(prescriviMetcon(scelto, categoria, cfg.experience, intensity))
  }

  rimuoviDuplicati(metconEsercizi)

  if (metconEsercizi.length === 0) {
    warnings.push('Nessun movimento disponibile per il Metcon con queste impostazioni.')
  } else if (metconEsercizi.length < 3) {
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
      title: `AMRAP ${t.metcon}′`,
      format: 'amrap',
      time_cap_min: t.metcon,
      exercises: metconEsercizi,
    },
  ]

  return {
    name: 'CrossFit Standard',
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
