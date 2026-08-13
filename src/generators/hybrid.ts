/**
 * Motore di generazione CrossFit Hybrid (fase 7).
 *
 * Funzionalità distintiva del prodotto (sez. 18 della correzione): forza e
 * cardio alternati nella stessa sessione, non due parti separate come
 * CrossFit Standard (Forza/Skill poi Metcon). La sessione è una sequenza di
 * "coppie" — un'alzata, poi una scarica cardio — ripetuta 3-5 volte secondo
 * il tempo, sempre a rotazione su tutto il corpo (niente split da scegliere,
 * come CrossFit Standard: `split` resta `null`).
 *
 * Tecnicamente è tutto un unico blocco `kind: 'main'`, con `PrescribedExercise`
 * di ruolo alternato `compound`/`metcon` in sequenza: il Runner esistente
 * (ciclo serie→recupero) funziona già così com'è, senza bisogno di un blocco
 * o di una UI dedicata. Nessuna programmazione settimanale sui muscoli
 * carenti qui (weakPoints.ts): la rotazione tocca già tutto il corpo ad ogni
 * sessione, a differenza degli split di Bodybuilding/Forza. `priority_muscles`
 * resta usato solo per decidere l'ordine delle coppie.
 */

import type {
  Equipment, EquipmentItem, Exercise, Experience, GeneratedWorkout, Intensity, Muscle,
  PrescribedExercise, WorkoutBlock,
  MetconFormat,
} from '../types'
import { isExerciseAvailable } from './equipment'
import { RANK_EXP } from './crossfit'
import { PESO_DEFAULT_KG, stimaCalorieEsercizio } from './calories'
import {
  categoriaMetcon, minutiBlocco, minutiEsercizio, poolMetcon, repsMetcon,
  portaCompoundInApertura, rimuoviDuplicati, rng, scegliCandidato, scegliRiscaldamento,
} from './shared'

export interface HybridConfig {
  experience: Experience
  equipment: Equipment
  available_equipment?: EquipmentItem[] | null
  duration_min: number
  priority_muscles: Muscle[]
  excluded_exercises: string[]
  preferred_exercises?: string[]
  intensity?: Intensity
  weight_kg?: number | null
  seed?: number
  format?: Extract<MetconFormat, 'amrap' | 'emom' | 'for_time' | 'intervals'>
  method?: 'upper_conditioning' | 'lower_conditioning' | 'full_body_functional' | 'specialization'
}

/** Rotazione di default su tutto il corpo: gambe, spinta, tirata, gambe posteriori, core. */
const ROTAZIONE_BASE: Muscle[] = ['quads', 'chest', 'back', 'hamstrings', 'core']

function muscleHybridAnchor(muscle: Muscle): Muscle {
  if (muscle === 'front_delts' || muscle === 'lateral_delts' || muscle === 'triceps') return 'chest'
  if (muscle === 'rear_delts' || muscle === 'biceps') return 'back'
  if (muscle === 'glutes') return 'hamstrings'
  return muscle
}

function ordineRotazione(priorita: Muscle[]): Muscle[] {
  const prioritaInRotazione = [...new Set(priorita.map(muscleHybridAnchor))].filter((m) => ROTAZIONE_BASE.includes(m))
  const resto = ROTAZIONE_BASE.filter((m) => !prioritaInRotazione.includes(m))
  return [...prioritaInRotazione, ...resto]
}

function prescrizioneForza(exp: Experience, intensity: Intensity) {
  const intensitaEffettiva = exp === 'beginner' && intensity === 'high' ? 'medium' : intensity
  const rest = { low: 60, medium: 75, high: 90 }[intensitaEffettiva]
  const sets = { beginner: 2, intermediate: 3, advanced: 3 }[exp]
  return { sets, reps: '8-12', rest }
}

function alleggerisciForzaHybrid(base: ReturnType<typeof prescrizioneForza>): ReturnType<typeof prescrizioneForza> {
  return {
    sets: Math.max(2, base.sets - 1),
    reps: '10-15',
    rest: Math.max(45, base.rest - 15),
  }
}

function exerciseTargetsPriority(exercise: Exercise, priorities: Muscle[]): boolean {
  return exercise.primary_muscles.some((muscle) => priorities.includes(muscle))
}

export function generaHybrid(catalogo: Exercise[], cfg: HybridConfig): GeneratedWorkout {
  const warnings: string[] = []
  const random = rng(cfg.seed ?? 1)
  const preferiti = new Set(cfg.preferred_exercises ?? [])
  const intensity = cfg.intensity ?? 'medium'
  const format = cfg.format ?? 'amrap'
  const method = cfg.method ?? (cfg.priority_muscles.length > 0 ? 'specialization' : 'full_body_functional')

  const disponibili = catalogo.filter(
    (e) =>
      isExerciseAvailable(e, cfg.equipment, cfg.available_equipment) &&
      !cfg.excluded_exercises.includes(e.id) &&
      RANK_EXP[e.min_experience] <= RANK_EXP[cfg.experience]
  )
  const allenamento = disponibili.filter((e) => !e.roles.includes('warmup'))
  const riscaldamentoPool = disponibili.filter((e) => e.roles.includes('warmup'))

  const methodPriority: Muscle[] = method === 'upper_conditioning' ? ['chest', 'back']
    : method === 'lower_conditioning' ? ['quads', 'hamstrings', 'glutes']
    : method === 'specialization' ? cfg.priority_muscles
    : []
  const rotazione = ordineRotazione(methodPriority)
  const usati = new Set<string>()
  const forza: PrescribedExercise[] = []
  const forzaPool = allenamento.filter(
    (e) => e.roles.includes('compound') && (e.roles.includes('hypertrophy') || e.roles.includes('strength'))
  )

  // Parte Strength/Bodybuilding separata: una alzata nelle sessioni brevi,
  // due da 45 minuti in su. I movimenti più tecnici restano qui, mai nel circuito.
  const numeroAlzate = cfg.duration_min < 45 ? 1 : 2
  for (let i = 0; i < numeroAlzate; i++) {
    const muscoloTarget = rotazione[i % rotazione.length]
    const candidatiForza = forzaPool
      .filter((e) => e.primary_muscles.includes(muscoloTarget))
      .sort((a, b) => {
        // Unilaterali/affondi non aprono mai la seduta: prima squat, hinge,
        // press e tirate bilaterali, poi gli esercizi più instabili.
        const aLunge = a.movement_pattern === 'lunge' || a.unilateral ? 1 : 0
        const bLunge = b.movement_pattern === 'lunge' || b.unilateral ? 1 : 0
        return aLunge - bLunge || b.systemic_fatigue - a.systemic_fatigue || a.technical_complexity - b.technical_complexity
      })
    const focalizzati = candidatiForza.filter((e) => exerciseTargetsPriority(e, cfg.priority_muscles))
    const baseForza = focalizzati.length > 0 ? focalizzati : candidatiForza
    const bilaterali = baseForza.filter((e) => e.movement_pattern !== 'lunge' && !e.unilateral)
    const alzata = scegliCandidato(
      (bilaterali.length > 0 ? bilaterali : baseForza.length > 0 ? baseForza : forzaPool).slice(0, 3),
      usati,
      cfg.priority_muscles,
      preferiti,
      random
    )
    if (alzata) {
      usati.add(alzata.id)
      const focusCarenza = exerciseTargetsPriority(alzata, cfg.priority_muscles)
      const p = focusCarenza
        ? alleggerisciForzaHybrid(prescrizioneForza(cfg.experience, intensity))
        : prescrizioneForza(cfg.experience, intensity)
      forza.push({
        exercise_id: alzata.id,
        name: alzata.name,
        role: 'compound',
        muscle: alzata.primary_muscles[0] ?? null,
        sets: p.sets,
        reps: p.reps,
        rest_sec: p.rest,
        note: focusCarenza ? 'focus carenza: carico ridotto' : undefined,
        instructions: alzata.instructions || undefined,
      })
    }
  }

  // Hybrid Metcon: cardio e isolamenti semplici si alternano. Gli isolamenti
  // devono avere tecnica semplice e fatica sistemica/presa bassa.
  const metcon: PrescribedExercise[] = []
  const cardioPool = poolMetcon(allenamento, usati, cfg.experience)
  const isolationPool = allenamento.filter(
    (e) => e.roles.includes('isolation') && e.technical_complexity <= 1 &&
      e.systemic_fatigue <= 1 && e.grip_fatigue <= 2
  )
  const coppie = cfg.duration_min < 45 ? 1 : 2
  for (let i = 0; i < coppie; i++) {
    const cardio = scegliCandidato(cardioPool, usati, cfg.priority_muscles, preferiti, random)
    if (cardio) {
      usati.add(cardio.id)
      const categoria = categoriaMetcon(cardio) ?? 'mono'
      metcon.push({
        exercise_id: cardio.id, name: cardio.name, role: 'metcon',
        muscle: cardio.primary_muscles[0] ?? null, sets: 1,
        reps: repsMetcon(categoria, cfg.experience, intensity), rest_sec: 0,
        note: 'cardio', instructions: cardio.instructions || undefined,
      })
    }
    const isolamento = scegliCandidato(isolationPool, usati, cfg.priority_muscles, preferiti, random)
    if (isolamento) {
      usati.add(isolamento.id)
      metcon.push({
        exercise_id: isolamento.id, name: isolamento.name, role: 'metcon',
        muscle: isolamento.primary_muscles[0] ?? null, sets: 1,
        reps: intensity === 'high' ? '10-12' : '12-15', rest_sec: 30, note: 'isolamento',
        instructions: isolamento.instructions || undefined,
      })
    }
  }

  rimuoviDuplicati(forza)
  rimuoviDuplicati(metcon)
  if (!portaCompoundInApertura(forza)) warnings.push('Nessun esercizio multiarticolare disponibile per aprire la sessione.')

  if (forza.length === 0) {
    warnings.push('Nessuna alzata disponibile per la parte Forza con questa attrezzatura.')
  }
  if (metcon.length === 0) {
    warnings.push('Nessun movimento disponibile per il Metcon Hybrid con questa attrezzatura.')
  }

  const minutiRiscaldamento = cfg.duration_min >= 45 ? 9 : 6
  const minutiMetcon = Math.max(8, Math.min(18, cfg.duration_min - minutiRiscaldamento - minutiBlocco(forza)))
  const peso = cfg.weight_kg || PESO_DEFAULT_KG
  for (const e of forza) {
    e.est_kcal = stimaCalorieEsercizio('crossfit_hybrid', e.role, minutiEsercizio(e), peso)
  }
  for (const e of metcon) {
    e.est_kcal = stimaCalorieEsercizio('crossfit_hybrid', e.role, minutiMetcon / Math.max(1, metcon.length), peso)
  }
  const tutti = [...forza, ...metcon]
  const kcalTotali = tutti.reduce((t, e) => t + (e.est_kcal ?? 0), 0)

  const metconBlock: WorkoutBlock = {
    kind: 'metcon', title: `Hybrid ${format === 'for_time' ? 'For Time' : format === 'intervals' ? 'Intervals' : format.toUpperCase()}`,
    format,
    time_cap_min: minutiMetcon,
    rounds: format === 'emom' ? minutiMetcon : format === 'for_time' ? 4 : format === 'intervals' ? Math.max(6, Math.round(minutiMetcon / 2)) : undefined,
    interval_sec: format === 'emom' ? 60 : format === 'intervals' ? 40 : undefined,
    exercises: metcon,
  }
  const blocchi: WorkoutBlock[] = [
    {
      kind: 'warmup',
      title: 'Riscaldamento',
      duration_min: minutiRiscaldamento,
      exercises: scegliRiscaldamento(riscaldamentoPool, allenamento, tutti, random),
    },
    { kind: 'main', title: 'Bodybuilding', exercises: forza },
    metconBlock,
  ]

  return {
    name: `Hybrid — ${method === 'upper_conditioning' ? 'Upper / Conditioning' : method === 'lower_conditioning' ? 'Lower / Conditioning' : method === 'specialization' ? 'Specializzazione' : 'Full Body Functional'}`,
    mode: 'crossfit_hybrid',
    split: null,
    goal: 'mixed',
    experience: cfg.experience,
    duration_min: Math.round(minutiRiscaldamento + minutiBlocco(forza) + minutiMetcon),
    blocks: blocchi,
    warnings,
    est_kcal: kcalTotali,
  }
}
