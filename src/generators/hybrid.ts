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
} from '../types'
import { isExerciseAvailable } from './equipment'
import { RANK_EXP } from './crossfit'
import { PESO_DEFAULT_KG, stimaCalorieEsercizio } from './calories'
import {
  CATEGORIA_PATTERN, minutiBlocco, minutiEsercizio, poolMetcon, repsMetcon,
  rimuoviDuplicati, rng, scegliCandidato, scegliRiscaldamento,
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
}

/** Rotazione di default su tutto il corpo: gambe, spinta, tirata, gambe posteriori, core. */
const ROTAZIONE_BASE: Muscle[] = ['quads', 'chest', 'back', 'hamstrings', 'core']

function numeroCoppie(duration_min: number): number {
  if (duration_min < 45) return 3
  if (duration_min < 75) return 4
  return 5
}

function ordineRotazione(priorita: Muscle[]): Muscle[] {
  const prioritaInRotazione = priorita.filter((m) => ROTAZIONE_BASE.includes(m))
  const resto = ROTAZIONE_BASE.filter((m) => !prioritaInRotazione.includes(m))
  return [...prioritaInRotazione, ...resto]
}

function prescrizioneForza(exp: Experience, intensity: Intensity) {
  const intensitaEffettiva = exp === 'beginner' && intensity === 'high' ? 'medium' : intensity
  const rest = { low: 60, medium: 75, high: 90 }[intensitaEffettiva]
  const sets = { beginner: 2, intermediate: 3, advanced: 3 }[exp]
  return { sets, reps: '8-12', rest }
}

function transizione(intensity: Intensity): number {
  return { low: 60, medium: 45, high: 30 }[intensity]
}

export function generaHybrid(catalogo: Exercise[], cfg: HybridConfig): GeneratedWorkout {
  const warnings: string[] = []
  const random = rng(cfg.seed ?? 1)
  const preferiti = new Set(cfg.preferred_exercises ?? [])
  const intensity = cfg.intensity ?? 'medium'

  const disponibili = catalogo.filter(
    (e) =>
      isExerciseAvailable(e, cfg.equipment, cfg.available_equipment) &&
      !cfg.excluded_exercises.includes(e.id) &&
      RANK_EXP[e.min_experience] <= RANK_EXP[cfg.experience]
  )
  const allenamento = disponibili.filter((e) => !e.roles.includes('warmup'))
  const riscaldamentoPool = disponibili.filter((e) => e.roles.includes('warmup'))

  const target = numeroCoppie(cfg.duration_min)
  const rotazione = ordineRotazione(cfg.priority_muscles)

  const usati = new Set<string>()
  const scelti: PrescribedExercise[] = []
  const forzaPool = allenamento.filter(
    (e) => e.roles.includes('compound') && (e.roles.includes('hypertrophy') || e.roles.includes('strength'))
  )

  let ultimaCategoriaCardio: string | null = null

  for (let i = 0; i < target; i++) {
    const muscoloTarget = rotazione[i % rotazione.length]

    // --- Alzata ---
    const candidatiForza = forzaPool.filter((e) => e.primary_muscles.includes(muscoloTarget))
    const alzata = scegliCandidato(
      candidatiForza.length > 0 ? candidatiForza : forzaPool,
      usati,
      cfg.priority_muscles,
      preferiti,
      random
    )
    if (alzata) {
      usati.add(alzata.id)
      const p = prescrizioneForza(cfg.experience, intensity)
      scelti.push({
        exercise_id: alzata.id,
        name: alzata.name,
        role: 'compound',
        muscle: alzata.primary_muscles[0] ?? null,
        sets: p.sets,
        reps: p.reps,
        rest_sec: p.rest,
        instructions: alzata.instructions || undefined,
      })
    }

    // --- Scarica cardio: categoria diversa dall'ultima, per varietà. ---
    const poolCardio = poolMetcon(allenamento, usati)
    const cardioVario = poolCardio.filter((e) => CATEGORIA_PATTERN[e.movement_pattern] !== ultimaCategoriaCardio)
    const cardio = scegliCandidato(
      cardioVario.length > 0 ? cardioVario : poolCardio,
      usati,
      cfg.priority_muscles,
      preferiti,
      random
    )
    if (cardio) {
      usati.add(cardio.id)
      const categoria = CATEGORIA_PATTERN[cardio.movement_pattern]
      ultimaCategoriaCardio = categoria
      scelti.push({
        exercise_id: cardio.id,
        name: cardio.name,
        role: 'metcon',
        muscle: cardio.primary_muscles[0] ?? null,
        sets: 1,
        reps: repsMetcon(categoria, cfg.experience, intensity),
        rest_sec: transizione(intensity),
        note: 'cardio',
        instructions: cardio.instructions || undefined,
      })
    }
  }

  adattaAlTempo(scelti, cfg.duration_min)
  rimuoviDuplicati(scelti)

  if (scelti.filter((e) => e.role === 'compound').length === 0) {
    warnings.push('Nessuna alzata disponibile per la parte Forza con questa attrezzatura.')
  }
  if (scelti.filter((e) => e.role === 'metcon').length === 0) {
    warnings.push('Nessun movimento cardio disponibile con questa attrezzatura.')
  }

  const minutiRiscaldamento = cfg.duration_min >= 45 ? 9 : 6
  const peso = cfg.weight_kg || PESO_DEFAULT_KG
  for (const e of scelti) {
    e.est_kcal = stimaCalorieEsercizio('crossfit_hybrid', e.role, minutiEsercizio(e), peso)
  }
  const kcalTotali = scelti.reduce((t, e) => t + (e.est_kcal ?? 0), 0)

  const blocchi: WorkoutBlock[] = [
    {
      kind: 'warmup',
      title: 'Riscaldamento',
      duration_min: minutiRiscaldamento,
      exercises: scegliRiscaldamento(riscaldamentoPool, allenamento, scelti, random),
    },
    { kind: 'main', title: 'Forza + Cardio alternati', exercises: scelti },
  ]

  return {
    name: 'CrossFit Hybrid',
    mode: 'crossfit_hybrid',
    split: null,
    goal: 'mixed',
    experience: cfg.experience,
    duration_min: Math.round(minutiRiscaldamento + minutiBlocco(scelti)),
    blocks: blocchi,
    warnings,
    est_kcal: kcalTotali,
  }
}

function adattaAlTempo(scelti: PrescribedExercise[], duration_min: number): void {
  const minutiRiscaldamento = duration_min >= 45 ? 9 : 6
  const budget = duration_min - minutiRiscaldamento
  const REST_MINIMO_FORZA = 45
  const REST_MINIMO_CARDIO = 20

  const sforo = () => minutiBlocco(scelti) - budget
  if (sforo() <= 0) return

  let iter = 0
  while (sforo() > 0 && iter++ < 80) {
    const candidato = scelti
      .filter((e) => e.rest_sec > (e.role === 'compound' ? REST_MINIMO_FORZA : REST_MINIMO_CARDIO))
      .sort((a, b) => b.rest_sec - a.rest_sec)[0]
    if (!candidato) break
    const minimo = candidato.role === 'compound' ? REST_MINIMO_FORZA : REST_MINIMO_CARDIO
    candidato.rest_sec = Math.max(minimo, candidato.rest_sec - 15)
  }

  iter = 0
  while (sforo() > 0 && iter++ < 50) {
    const candidato = [...scelti].sort((a, b) => b.sets - a.sets).find((e) => e.role === 'compound' && e.sets > 2)
    if (!candidato) break
    candidato.sets -= 1
  }

  // Se ancora troppo lunga, si tolgono le ultime coppie (due voci alla volta), mai sotto 2 coppie (4 voci).
  while (sforo() > 0 && scelti.length > 4) {
    scelti.splice(scelti.length - 2, 2)
  }
}
