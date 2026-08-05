/**
 * Motore di generazione Bodybuilding.
 *
 * Deterministico e guidato dai dati (specifica sez. 37): nessun LLM.
 * A parità di configurazione produce una sessione coerente; la varietà viene
 * da un seme, non dal caso puro, così "rigenera" dà una variante e non un
 * risultato imprevedibile.
 *
 * Ordine di applicazione delle regole (sez. 35):
 *   1. attrezzatura disponibile
 *   2. esclusioni dell'utente
 *   3. esperienza
 *   4. split
 *   5. muscoli prioritari
 *   6. budget di tempo
 *   7. gestione della fatica
 */

import type {
  Equipment, Exercise, Experience, GeneratedWorkout, Goal, Muscle,
  PrescribedExercise, Split, WorkoutBlock,
} from '../types'
import { EQUIPMENT_MAP, MUSCLE_LABELS, SPLIT_LABELS } from '../types'

export interface GenerationConfig {
  split: Split
  goal: Goal
  experience: Experience
  equipment: Equipment
  duration_min: number
  priority_muscles: Muscle[]
  excluded_exercises: string[]
  seed?: number
}

/** Distribuzione base per split (sez. 13-16). Ogni split ha regole proprie. */
const DISTRIBUZIONE: Record<Split, { muscle: Muscle; compound: boolean }[]> = {
  push: [
    { muscle: 'chest', compound: true },
    { muscle: 'chest', compound: false },
    { muscle: 'front_delts', compound: true },
    { muscle: 'lateral_delts', compound: false },
    { muscle: 'triceps', compound: false },
    { muscle: 'triceps', compound: false },
  ],
  pull: [
    { muscle: 'back', compound: true },
    { muscle: 'back', compound: true },
    { muscle: 'back', compound: false },
    { muscle: 'rear_delts', compound: false },
    { muscle: 'biceps', compound: false },
    { muscle: 'biceps', compound: false },
  ],
  legs: [
    { muscle: 'quads', compound: true },
    { muscle: 'quads', compound: true },
    { muscle: 'hamstrings', compound: true },
    { muscle: 'glutes', compound: false },
    { muscle: 'hamstrings', compound: false },
    { muscle: 'calves', compound: false },
  ],
  upper: [
    { muscle: 'chest', compound: true },
    { muscle: 'back', compound: true },
    { muscle: 'front_delts', compound: true },
    { muscle: 'lateral_delts', compound: false },
    { muscle: 'biceps', compound: false },
    { muscle: 'triceps', compound: false },
  ],
  lower: [
    { muscle: 'quads', compound: true },
    { muscle: 'hamstrings', compound: true },
    { muscle: 'quads', compound: false },
    { muscle: 'glutes', compound: false },
    { muscle: 'hamstrings', compound: false },
    { muscle: 'calves', compound: false },
  ],
  full_body: [
    { muscle: 'quads', compound: true },
    { muscle: 'chest', compound: true },
    { muscle: 'back', compound: true },
    { muscle: 'hamstrings', compound: true },
    { muscle: 'lateral_delts', compound: false },
    { muscle: 'core', compound: false },
  ],
}

/** Serie, ripetizioni e recupero secondo l'obiettivo (sez. 10). */
function prescrizione(goal: Goal, compound: boolean, exp: Experience) {
  const base = {
    strength:     compound ? { sets: 4, reps: '4-6',   rest: 180 } : { sets: 3, reps: '6-8',   rest: 120 },
    hypertrophy:  compound ? { sets: 4, reps: '6-10',  rest: 120 } : { sets: 3, reps: '10-15', rest: 75 },
    conditioning: compound ? { sets: 3, reps: '12-15', rest: 60 }  : { sets: 3, reps: '15-20', rest: 45 },
    mixed:        compound ? { sets: 4, reps: '8-10',  rest: 105 } : { sets: 3, reps: '12-15', rest: 60 },
  }[goal]

  // I principianti fanno una serie in meno sui fondamentali: meno volume, tecnica migliore.
  if (exp === 'beginner' && compound) return { ...base, sets: Math.max(3, base.sets - 1) }
  return base
}

const RANK_EXP: Record<Experience, number> = { beginner: 1, intermediate: 2, advanced: 3 }

/** Generatore pseudocasuale con seme: stessa configurazione + stesso seme = stesso allenamento. */
function rng(seed: number) {
  let s = seed || 1
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** Minuti stimati per un esercizio: serie x (tempo sotto sforzo + recupero) + transizione. */
function minutiEsercizio(p: { sets: number; rest_sec: number }): number {
  const lavoro = 40 // secondi medi per serie
  return (p.sets * (lavoro + p.rest_sec) + 60) / 60
}

export function generaBodybuilding(
  catalogo: Exercise[],
  cfg: GenerationConfig
): GeneratedWorkout {
  const warnings: string[] = []
  const random = rng(cfg.seed ?? 1)
  const attrezziOk = EQUIPMENT_MAP[cfg.equipment]

  // 1-3. Attrezzatura, esclusioni, esperienza
  const disponibili = catalogo.filter(
    (e) =>
      attrezziOk.includes(e.equipment) &&
      !cfg.excluded_exercises.includes(e.id) &&
      RANK_EXP[e.min_experience] <= RANK_EXP[cfg.experience]
  )

  const allenamento = disponibili.filter((e) => !e.roles.includes('warmup'))
  const riscaldamento = disponibili.filter((e) => e.roles.includes('warmup'))

  // 4. Slot dello split
  let slot = [...DISTRIBUZIONE[cfg.split]]

  // 5. Muscoli prioritari: ridistribuiscono il volume, non allungano la sessione (sez. 6)
  const priorita = cfg.priority_muscles.filter((m) => slotContiene(cfg.split, m))
  const prioritaFuoriSplit = cfg.priority_muscles.filter((m) => !slotContiene(cfg.split, m))
  if (prioritaFuoriSplit.length > 0) {
    warnings.push(
      `${prioritaFuoriSplit.map((m) => MUSCLE_LABELS[m]).join(', ')}: non rientra` +
        `${prioritaFuoriSplit.length > 1 ? 'no' : ''} in ${SPLIT_LABELS[cfg.split].toLowerCase()}, ` +
        `${prioritaFuoriSplit.length > 1 ? 'verranno allenati' : 'verrà allenato'} in un'altra sessione.`
    )
  }
  if (priorita.length > 0) {
    slot = ridistribuisci(slot, priorita)
  }

  // 6. Budget di tempo: il riscaldamento si prende 8-10 minuti (sez. 11)
  const minutiRiscaldamento = cfg.duration_min >= 45 ? 9 : 6
  let budget = cfg.duration_min - minutiRiscaldamento

  // 7. Selezione con controllo della fatica
  const scelti: PrescribedExercise[] = []
  const usati = new Set<string>()
  let faticaSistemica = 0
  let faticaPresa = 0

  for (const s of slot) {
    const candidati = allenamento
      .filter((e) => !usati.has(e.id))
      .filter((e) => e.primary_muscles.includes(s.muscle))
      .filter((e) => e.roles.includes(s.compound ? 'compound' : 'isolation'))
      // Fatica di presa (sez. 32): si escludono solo gli esercizi MOLTO esigenti
      // quando la presa è già carica. Un filtro sul totale, come avevo scritto
      // prima, tagliava anche i curl dopo due tirate e lasciava sessioni monche.
      .filter((e) => !(e.grip_fatigue >= 3 && faticaPresa >= 6))
      // Niente movimenti tecnici quando la stanchezza rende la tecnica inaffidabile (sez. 33)
      .filter((e) => !(faticaSistemica >= 8 && e.technical_complexity >= 3))

    if (candidati.length === 0) continue

    // Fra i candidati validi si preferisce il più impegnativo quando si è freschi,
    // il più semplice quando si è stanchi (sez. 12).
    candidati.sort((a, b) =>
      faticaSistemica < 5
        ? b.systemic_fatigue - a.systemic_fatigue
        : a.systemic_fatigue - b.systemic_fatigue
    )
    const testa = candidati.slice(0, Math.min(3, candidati.length))
    const scelto = testa[Math.floor(random() * testa.length)]

    const p = prescrizione(cfg.goal, s.compound, cfg.experience)
    const voce: PrescribedExercise = {
      exercise_id: scelto.id,
      name: scelto.name,
      role: s.compound ? 'compound' : 'isolation',
      muscle: s.muscle,
      sets: p.sets,
      reps: p.reps,
      rest_sec: p.rest,
    }

    const costo = minutiEsercizio(voce)
    if (budget - costo < 0) break // il tempo comanda: meglio meno esercizi che sforare

    budget -= costo
    faticaSistemica += scelto.systemic_fatigue
    faticaPresa += scelto.grip_fatigue
    usati.add(scelto.id)
    scelti.push(voce)
  }

  // Riempimento: se restano tempo e meno di 5 esercizi, si aggiunge isolamento
  // sui muscoli dello split. Senza questo passaggio uno slot vuoto (perché non
  // esiste l'esercizio giusto) faceva finire la sessione a 4 esercizi con 15
  // minuti ancora disponibili — misurato nei test.
  const muscoliSplit = [...new Set(DISTRIBUZIONE[cfg.split].map((s) => s.muscle))]
  const ordinePriorita = [...priorita, ...muscoliSplit]
  while (scelti.length < 7 && budget > 4) {
    const m = ordinePriorita[(scelti.length + 1) % ordinePriorita.length]
    const extra = allenamento
      .filter((e) => !usati.has(e.id))
      .filter((e) => e.primary_muscles.includes(m))
      .filter((e) => e.roles.includes('isolation'))
      .filter((e) => !(e.grip_fatigue >= 3 && faticaPresa >= 6))
      .sort((a, b) => a.systemic_fatigue - b.systemic_fatigue)[0]
    if (!extra) {
      // Niente di aggiungibile su nessun muscolo: si esce.
      const restanti = ordinePriorita.filter((x) =>
        allenamento.some(
          (e) => !usati.has(e.id) && e.primary_muscles.includes(x) && e.roles.includes('isolation')
        )
      )
      if (restanti.length === 0) break
      ordinePriorita.push(...restanti)
      if (ordinePriorita.length > 40) break
      continue
    }
    const p = prescrizione(cfg.goal, false, cfg.experience)
    const voce: PrescribedExercise = {
      exercise_id: extra.id,
      name: extra.name,
      role: 'isolation',
      muscle: m,
      sets: p.sets,
      reps: p.reps,
      rest_sec: p.rest,
    }
    const costo = minutiEsercizio(voce)
    if (budget - costo < 0) break
    budget -= costo
    faticaPresa += extra.grip_fatigue
    usati.add(extra.id)
    scelti.push(voce)
  }

  // Validazione (sez. 17 e 36): minimo 5 esercizi quando il tempo lo consente
  if (scelti.length < 5 && cfg.duration_min >= 45) {
    warnings.push(
      `Con questa attrezzatura escono solo ${scelti.length} esercizi. ` +
        `Aggiungendo attrezzi nel profilo la sessione diventa più completa.`
    )
  }
  if (scelti.length === 0) {
    warnings.push('Nessun esercizio disponibile con queste impostazioni.')
  }

  const blocchi: WorkoutBlock[] = [
    {
      kind: 'warmup',
      title: 'Riscaldamento',
      duration_min: minutiRiscaldamento,
      exercises: scegliRiscaldamento(riscaldamento, cfg.split, random),
    },
    { kind: 'main', title: 'Allenamento', exercises: scelti },
  ]

  return {
    name: `${SPLIT_LABELS[cfg.split]} — ${scelti.length} esercizi`,
    mode: 'bodybuilding',
    split: cfg.split,
    goal: cfg.goal,
    experience: cfg.experience,
    duration_min: Math.round(
      minutiRiscaldamento + scelti.reduce((t, e) => t + minutiEsercizio(e), 0)
    ),
    blocks: blocchi,
    warnings,
  }
}

/** Lo split contiene quel muscolo fra i suoi slot? */
function slotContiene(split: Split, m: Muscle): boolean {
  return DISTRIBUZIONE[split].some((s) => s.muscle === m)
}

/**
 * Ridistribuisce gli slot verso i muscoli prioritari senza aggiungerne di nuovi:
 * toglie uno slot al muscolo più rappresentato e lo assegna alla priorità.
 */
function ridistribuisci(
  slot: { muscle: Muscle; compound: boolean }[],
  priorita: Muscle[]
): { muscle: Muscle; compound: boolean }[] {
  const out = [...slot]
  for (const p of priorita) {
    const conteggio = new Map<Muscle, number>()
    out.forEach((s) => conteggio.set(s.muscle, (conteggio.get(s.muscle) ?? 0) + 1))
    // Candidato a cedere: il muscolo con più slot, che non sia una priorità
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

/** Riscaldamento: cardio leggero + mobilità + attivazione mirata allo split (sez. 11). */
function scegliRiscaldamento(
  pool: Exercise[],
  split: Split,
  random: () => number
): PrescribedExercise[] {
  const cardio = pool.filter((e) => e.roles.includes('cardio'))
  const resto = pool.filter((e) => !e.roles.includes('cardio'))

  const mirati: Record<Split, string[]> = {
    push: ['wu_circonduzioni', 'wu_band_pull'],
    pull: ['wu_scapole', 'wu_band_pull'],
    legs: ['wu_rotazioni_anca', 'wu_squat_vuoto'],
    upper: ['wu_circonduzioni', 'wu_scapole'],
    lower: ['wu_rotazioni_anca', 'wu_squat_vuoto'],
    full_body: ['wu_rotazioni_anca', 'wu_circonduzioni'],
  }

  const scelti: Exercise[] = []
  if (cardio.length > 0) scelti.push(cardio[Math.floor(random() * cardio.length)])
  for (const id of mirati[split]) {
    const e = resto.find((x) => x.id === id)
    if (e) scelti.push(e)
  }
  const finale = resto.find((x) => x.id === 'wu_serie_leggera')
  if (finale) scelti.push(finale)

  return scelti.map((e) => ({
    exercise_id: e.id,
    name: e.name,
    role: 'warmup' as const,
    muscle: e.primary_muscles[0] ?? null,
    sets: 1,
    reps: e.default_reps,
    rest_sec: 0,
  }))
}
