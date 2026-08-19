/**
 * Motore di generazione Forza.
 *
 * Riusa l'architettura "struttura-prima" corretta per Bodybuilding
 * (bodybuilding.ts, weakPoints.ts, shared.ts) ma con regole di
 * programmazione proprie della Forza, non un Bodybuilding con meno serie:
 *
 *   - poche alzate, pesanti: 3 esercizi base, fino a 5 col tempo
 *   - ripetizioni basse (3-8), recuperi lunghi (2-4 minuti)
 *   - un solo accessorio per sessione, mai più di uno
 *   - solo gli split compatibili con la programmazione a bassa frequenza di
 *     esercizio (Push/Pull/Legs, Upper/Lower, Full Body): niente Bro Split
 *     o Front/Back, che sono convenzioni da ipertrofia
 *
 * Non esiste un "obiettivo" da scegliere come in Bodybuilding: l'obiettivo
 * è sempre la forza. L'intensità (Bassa/Media/Alta) sposta l'intervallo di
 * ripetizioni e il recupero, non il tipo di sessione.
 */

import type {
  Equipment, EquipmentItem, Exercise, Experience, FocusPortion, GeneratedWorkout, Intensity, Muscle,
  PrescribedExercise, Split, WorkoutBlock,
} from '../types'
import { MUSCLE_LABELS, SPLIT_LABELS } from '../types'
import { isExerciseAvailable } from './equipment'
import { decidiRichiami } from './weakPoints'
import { PESO_DEFAULT_KG, stimaCalorieEsercizio } from './calories'
import { minutiBlocco, minutiEsercizio, PORZIONE_ROTABILE, portaCompoundInApertura, rimuoviDuplicati, riordinaPerSinergie, rng, scegliRiscaldamento, vuotoVolume } from './shared'

/** Split compatibili con la Forza (sez. 15/71): niente Bro Split o Front/Back, convenzioni da ipertrofia. */
export const SPLIT_FORZA: Split[] = ['push', 'pull', 'legs', 'upper', 'lower', 'full_body']

export interface StrengthConfig {
  split: Split
  experience: Experience
  equipment: Equipment
  available_equipment?: EquipmentItem[] | null
  duration_min: number
  priority_muscles: Muscle[]
  /** Quale capo enfatizzare per una carenza bicipiti/tricipiti in questa seduta (sez. Lagging
   *  Muscle Engine, stesso meccanismo di bodybuilding.ts). */
  priority_portions?: Partial<Record<Muscle, FocusPortion>>
  target_muscles?: Muscle[]
  excluded_exercises: string[]
  preferred_exercises?: string[]
  weekly_volume?: Record<Muscle, number>
  last_trained_at?: Partial<Record<Muscle, string>>
  intensity?: Intensity
  weight_kg?: number | null
  seed?: number
  method?: '5x5' | '3x5' | 'max_strength' | 'strength_accessories'
}

interface SlotDef {
  muscle: Muscle
  compound: boolean
}

/** Alzate pesanti fisse per split: sempre presenti, il tempo decide solo l'accessorio (sez. 3 della correzione, adattato). */
const BASE_SLOTS: Record<Split, SlotDef[]> = {
  push: [
    { muscle: 'chest', compound: true },
    { muscle: 'front_delts', compound: true },
    { muscle: 'triceps', compound: true },
  ],
  pull: [
    { muscle: 'back', compound: true },
    { muscle: 'back', compound: true },
    { muscle: 'biceps', compound: true },
  ],
  legs: [
    { muscle: 'quads', compound: true },
    { muscle: 'hamstrings', compound: true },
    { muscle: 'calves', compound: true },
  ],
  upper: [
    { muscle: 'chest', compound: true },
    { muscle: 'back', compound: true },
    { muscle: 'front_delts', compound: true },
  ],
  lower: [
    { muscle: 'quads', compound: true },
    { muscle: 'hamstrings', compound: true },
    { muscle: 'glutes', compound: true },
  ],
  full_body: [
    { muscle: 'quads', compound: true },
    { muscle: 'chest', compound: true },
    { muscle: 'back', compound: true },
  ],
  // Gli split da ipertrofia non sono usati in Forza: mai raggiunti (SPLIT_FORZA li esclude a monte).
  bro_chest: [], bro_back: [], bro_shoulders: [], bro_arms: [], bro_legs: [],
  front_body: [], back_body: [],
}

/** 4°-5° esercizio: un solo accessorio, mai due alzate pesanti in più (sez. 24, applicato alla Forza). */
const EXTRA_SLOTS: Record<Split, SlotDef[]> = {
  push: [{ muscle: 'lateral_delts', compound: false }, { muscle: 'chest', compound: false }],
  pull: [{ muscle: 'rear_delts', compound: false }, { muscle: 'forearms', compound: false }],
  legs: [{ muscle: 'glutes', compound: false }, { muscle: 'quads', compound: false }],
  upper: [{ muscle: 'triceps', compound: false }, { muscle: 'biceps', compound: false }],
  lower: [{ muscle: 'calves', compound: false }, { muscle: 'quads', compound: false }],
  full_body: [{ muscle: 'hamstrings', compound: false }, { muscle: 'forearms', compound: false }],
  bro_chest: [], bro_back: [], bro_shoulders: [], bro_arms: [], bro_legs: [],
  front_body: [], back_body: [],
}

const SPLIT_MUSCLE_POOL: Record<Split, Muscle[]> = {
  push: ['chest', 'front_delts', 'lateral_delts', 'triceps'],
  pull: ['back', 'rear_delts', 'biceps', 'forearms'],
  legs: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'],
  upper: ['chest', 'back', 'front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps', 'forearms'],
  lower: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'],
  full_body: ['chest', 'back', 'quads', 'hamstrings', 'forearms'],
  bro_chest: [], bro_back: [], bro_shoulders: [], bro_arms: [], bro_legs: [],
  front_body: [], back_body: [],
}

const RICHIAMO_POOL: Record<Split, Muscle[]> = {
  push: ['chest', 'front_delts', 'lateral_delts', 'triceps', 'biceps'],
  pull: ['back', 'rear_delts', 'biceps', 'triceps', 'forearms'],
  legs: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'],
  upper: ['chest', 'back', 'front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps', 'forearms'],
  lower: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'],
  full_body: ['chest', 'back', 'quads', 'hamstrings', 'forearms'],
  bro_chest: [], bro_back: [], bro_shoulders: [], bro_arms: [], bro_legs: [],
  front_body: [], back_body: [],
}

const RANK_EXP: Record<Experience, number> = { beginner: 1, intermediate: 2, advanced: 3 }

/** Ripetizioni e recupero da intensità (sez. UI Base44): l'obiettivo è sempre la forza, cambia solo dove nell'intervallo. */
function prescrizioneForza(compound: boolean, exp: Experience, intensity: Intensity, method: NonNullable<StrengthConfig['method']>) {
  // I principianti restano su un intervallo moderato anche con intensità "Alta":
  // tecnica prima del carico massimale (sez. 16 del master prompt).
  const intensitaEffettiva = exp === 'beginner' && intensity === 'high' ? 'medium' : intensity

  if (!compound) return method === 'strength_accessories'
    ? { sets: 3, reps: '8-12', rest: 90 }
    : { sets: 2, reps: '8-12', rest: 90 }

  if (method === '5x5') return { sets: 5, reps: '5', rest: exp === 'beginner' ? 150 : 180 }
  if (method === '3x5') return { sets: 3, reps: '5', rest: exp === 'beginner' ? 150 : 180 }
  if (method === 'max_strength') return { sets: exp === 'advanced' ? 5 : 4, reps: exp === 'advanced' ? '2-4' : '4-5', rest: exp === 'advanced' ? 240 : 195 }

  const perIntensita = {
    low:    { reps: '6-8', rest: 150 },
    medium: { reps: '4-6', rest: 195 },
    high:   { reps: '3-5', rest: 240 },
  }[intensitaEffettiva]

  return { sets: 5, reps: perIntensita.reps, rest: perIntensita.rest }
}

function serieMinime(compound: boolean): number {
  return compound ? 3 : 2
}

/** Struttura richiesta: 3 fondamentali + 2 complementari. */
function targetEsercizi(): number {
  return 5
}

const SOGLIA_PESANTE = 3
const MAX_COMPOUND_PESANTI = 2

export function generaForza(catalogo: Exercise[], cfg: StrengthConfig): GeneratedWorkout {
  const warnings: string[] = []
  const random = rng(cfg.seed ?? 1)
  const preferiti = new Set(cfg.preferred_exercises ?? [])
  const intensity = cfg.intensity ?? 'medium'
  const method = cfg.method ?? '5x5'
  const strictTargets = [...new Set(cfg.target_muscles ?? [])]

  const disponibili = catalogo.filter(
    (e) =>
      isExerciseAvailable(e, cfg.equipment, cfg.available_equipment) &&
      !cfg.excluded_exercises.includes(e.id) &&
      RANK_EXP[e.min_experience] <= RANK_EXP[cfg.experience]
  )
  const allenamentoBase = disponibili.filter((e) => !e.roles.includes('warmup'))
  const allenamento = strictTargets.length > 0
    ? allenamentoBase.filter((exercise) => exercise.primary_muscles.some((muscle) => strictTargets.includes(muscle)))
    : allenamentoBase
  const riscaldamentoPool = disponibili.filter((e) => e.roles.includes('warmup'))

  const pool = SPLIT_MUSCLE_POOL[cfg.split]
  let baseSlot = [...BASE_SLOTS[cfg.split]]

  const prioritaInSplit = cfg.priority_muscles.filter((m) => pool.includes(m))
  const prioritaFuoriSplit = cfg.priority_muscles.filter((m) => !pool.includes(m))
  if (prioritaInSplit.length > 0) {
    baseSlot = ridistribuisci(baseSlot, prioritaInSplit)
  }

  const target = targetEsercizi()

  const volumeStimato = cfg.weekly_volume ?? vuotoVolume()
  const priortaRichiamabili = cfg.priority_muscles.filter((m) => RICHIAMO_POOL[cfg.split].includes(m))
  // Un solo richiamo (non due come in Bodybuilding): la Forza resta sulle alzate base.
  const richiami = decidiRichiami(
    priortaRichiamabili,
    volumeStimato,
    baseSlot.map((s) => s.muscle),
    1,
    { last_trained_at: cfg.last_trained_at }
  )
  if (prioritaFuoriSplit.length > 0 && richiami.length === 0) {
    warnings.push(
      `${prioritaFuoriSplit.map((m) => MUSCLE_LABELS[m]).join(', ')}: già a posto sul volume ` +
        `settimanale, ${prioritaFuoriSplit.length > 1 ? 'verranno' : 'verrà'} richiamat${prioritaFuoriSplit.length > 1 ? 'i' : 'o'} quando serve.`
    )
  }

  const extraSlot: SlotDef[] = []
  for (const m of richiami) {
    if (baseSlot.length + extraSlot.length >= target) break
    extraSlot.push({ muscle: m, compound: false })
  }
  for (const s of EXTRA_SLOTS[cfg.split]) {
    if (baseSlot.length + extraSlot.length >= target) break
    extraSlot.push(s)
  }
  const richiamoSet = new Set(richiami)
  const slot = [...baseSlot, ...extraSlot]

  const scelti: PrescribedExercise[] = []
  const usati = new Set<string>()
  let faticaSistemica = 0
  let faticaPresa = 0
  let compoundPesanti = 0

  for (let i = 0; i < slot.length; i++) {
    const s = slot[i]
    const isRichiamo = i >= baseSlot.length && richiamoSet.has(s.muscle)
    const musclesDaProvare = strictTargets.length > 0
      ? strictTargets
      : [s.muscle, ...pool.filter((m) => m !== s.muscle)]

    let scelto: Exercise | undefined
    let muscoloUsato: Muscle = s.muscle

    for (const m of musclesDaProvare) {
      let candidati = allenamento
        .filter((e) => !usati.has(e.id))
        .filter((e) => e.primary_muscles.includes(m))
        .filter((e) => e.roles.includes(s.compound ? 'compound' : 'isolation'))
        .filter((e) => !(e.grip_fatigue >= 3 && faticaPresa >= 6))
        .filter((e) => !(faticaSistemica >= 8 && e.technical_complexity >= 3))

      // Rotazione per porzione (sez. Lagging Muscle Engine): stesso meccanismo di bodybuilding.ts.
      if (isRichiamo && PORZIONE_ROTABILE.has(m)) {
        const porzione: FocusPortion = cfg.priority_portions?.[m] ?? 'long_head'
        const conPorzione = candidati.filter((e) => e.focus_portion === porzione)
        if (conPorzione.length > 0) candidati = conPorzione
      }

      if (candidati.length === 0) {
        if (isRichiamo) break
        continue
      }

      const pesanteRaggiunto = compoundPesanti >= MAX_COMPOUND_PESANTI
      const faticaSort = (a: Exercise, b: Exercise) =>
        pesanteRaggiunto
          ? a.systemic_fatigue - b.systemic_fatigue
          : b.systemic_fatigue - a.systemic_fatigue // in Forza si parte sempre freschi sul compound più pesante disponibile

      const preferitiCandidati = candidati.filter((e) => preferiti.has(e.id))
      const pool_ = preferitiCandidati.length > 0 ? preferitiCandidati : candidati
      pool_.sort(faticaSort)
      const testa = pool_.slice(0, Math.min(3, pool_.length))
      scelto = testa[Math.floor(random() * testa.length)]
      muscoloUsato = m
      break
    }

    if (!scelto) continue

    const p = prescrizioneForza(s.compound, cfg.experience, intensity, method)
    const voce: PrescribedExercise = {
      exercise_id: scelto.id,
      name: scelto.name,
      role: s.compound ? 'compound' : 'isolation',
      muscle: muscoloUsato,
      sets: p.sets,
      reps: p.reps,
      rest_sec: p.rest,
      note: isRichiamo ? 'richiamo' : undefined,
      instructions: scelto.instructions || undefined,
    }

    usati.add(scelto.id)
    faticaSistemica += scelto.systemic_fatigue
    faticaPresa += scelto.grip_fatigue
    if (scelto.systemic_fatigue >= SOGLIA_PESANTE && s.compound) compoundPesanti++
    scelti.push(voce)
  }

  while (scelti.length < 5) {
    const fallback = allenamento.find((exercise) => !usati.has(exercise.id) && exercise.technical_complexity <= 2)
    if (!fallback) break
    const compound = fallback.roles.includes('compound')
    const p = prescrizioneForza(compound, cfg.experience, intensity, method)
    const muscle = fallback.primary_muscles.find((item) => strictTargets.includes(item)) ?? fallback.primary_muscles[0] ?? null
    usati.add(fallback.id)
    scelti.push({
      exercise_id: fallback.id, name: fallback.name,
      role: compound ? 'compound' : 'isolation', muscle,
      sets: p.sets, reps: p.reps, rest_sec: p.rest,
      note: 'target muscolare di oggi', instructions: fallback.instructions || undefined,
    })
  }

  // Sequenziamento per fatica/sinergie (sez. Lagging Muscle Engine, Step 5): stesso
  // meccanismo di bodybuilding.ts, vedi shared.ts.
  riordinaPerSinergie(scelti, new Map(allenamento.map((exercise) => [exercise.id, exercise])))

  const minutiRiscaldamento = cfg.duration_min >= 45 ? 9 : 6
  const budget = cfg.duration_min - minutiRiscaldamento
  adattaAlTempo(scelti, budget)

  rimuoviDuplicati(scelti)
  if (!portaCompoundInApertura(scelti)) warnings.push('Nessun esercizio multiarticolare disponibile con questa attrezzatura.')
  if (scelti.length < 5) {
    warnings.push(
      `Con questa attrezzatura escono solo ${scelti.length} alzate. ` +
        `Aggiungendo attrezzi nel profilo la sessione diventa più completa.`
    )
  }
  if (scelti.length === 0) {
    warnings.push('Nessun esercizio disponibile con queste impostazioni.')
  }

  const peso = cfg.weight_kg || PESO_DEFAULT_KG
  for (const e of scelti) {
    e.est_kcal = stimaCalorieEsercizio('strength', e.role, minutiEsercizio(e), peso)
  }
  const kcalTotali = scelti.reduce((t, e) => t + (e.est_kcal ?? 0), 0)

  const blocchi: WorkoutBlock[] = [
    {
      kind: 'warmup',
      title: 'Riscaldamento',
      duration_min: minutiRiscaldamento,
      exercises: scegliRiscaldamento(riscaldamentoPool, allenamento, scelti, random),
    },
    { kind: 'main', title: 'Allenamento', exercises: scelti },
  ]

  return {
    name: `Forza ${method === '5x5' ? '5×5' : method === '3x5' ? '3×5' : method === 'max_strength' ? 'massimale' : '+ complementari'} — ${SPLIT_LABELS[cfg.split]}`,
    mode: 'strength',
    split: cfg.split,
    goal: 'strength',
    experience: cfg.experience,
    duration_min: Math.round(minutiRiscaldamento + minutiBlocco(scelti)),
    blocks: blocchi,
    warnings,
    est_kcal: kcalTotali,
  }
}

function adattaAlTempo(scelti: PrescribedExercise[], budgetMin: number): void {
  const RECUPERO_MINIMO = 90 // in Forza il recupero non scende sotto i 90s: serve al sistema nervoso, non solo al muscolo

  const sforo = () => minutiBlocco(scelti) - budgetMin
  if (sforo() <= 0) return

  let iter = 0
  while (sforo() > 0 && iter++ < 50) {
    const candidato = scelti
      .filter((e) => e.rest_sec > RECUPERO_MINIMO)
      .sort((a, b) => b.rest_sec - a.rest_sec)[0]
    if (!candidato) break
    candidato.rest_sec = Math.max(RECUPERO_MINIMO, candidato.rest_sec - 15)
  }

  iter = 0
  while (sforo() > 0 && iter++ < 50) {
    const riducibile = [...scelti]
      .sort((a, b) => {
        const pa = a.note === 'richiamo' ? 0 : a.role === 'isolation' ? 1 : 2
        const pb = b.note === 'richiamo' ? 0 : b.role === 'isolation' ? 1 : 2
        return pa - pb
      })
      .find((e) => e.sets > serieMinime(e.role === 'compound'))
    if (!riducibile) break
    riducibile.sets -= 1
  }

}

function ridistribuisci(slot: SlotDef[], priorita: Muscle[]): SlotDef[] {
  const out = [...slot]
  for (const p of priorita) {
    const conteggio = new Map<Muscle, number>()
    out.forEach((s) => conteggio.set(s.muscle, (conteggio.get(s.muscle) ?? 0) + 1))
    if ((conteggio.get(p) ?? 0) > 0) continue

    let donatore: Muscle | null = null
    let max = 1
    for (const [m, n] of conteggio) {
      if (!priorita.includes(m) && n > max) {
        max = n
        donatore = m
      }
    }
    if (!donatore) continue
    const i = out.map((s) => s.muscle).lastIndexOf(donatore)
    if (i >= 0) out[i] = { muscle: p, compound: false }
  }
  return out
}
