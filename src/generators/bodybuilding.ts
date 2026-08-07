/**
 * Motore di generazione Bodybuilding.
 *
 * Deterministico e guidato dai dati (specifica sez. 37): nessun LLM.
 * A parità di configurazione produce una sessione coerente; la varietà viene
 * da un seme, non dal caso puro, così "rigenera" dà una variante e non un
 * risultato imprevedibile.
 *
 * Architettura (corretta dopo i problemi riscontrati in test — vedi
 * AIOS_STATE.md sez. 8, decisione del 05/08 "motore struttura-prima"):
 *
 *   Attrezzatura/esclusioni/esperienza
 *     -> struttura della sessione (5-6 slot, decisi PRIMA di scegliere gli esercizi)
 *     -> richiami settimanali per i muscoli carenti (weakPoints.ts)
 *     -> selezione esercizi per slot (attrezzatura, fatica, esercizi preferiti)
 *     -> adattamento al tempo (si riducono serie/recuperi, non si tagliano slot)
 *     -> validatore di sicurezza finale (corregge, non si limita a segnalare)
 *     -> riscaldamento, costruito DOPO in base a cosa è stato davvero scelto
 *
 * In precedenza il motore selezionava gli esercizi e scopriva solo alla fine
 * se erano troppo pochi (< 5): il validatore era il posto dove si scopriva il
 * problema, non quello che lo preveniva. Ora la sessione ha sempre 5, 6 o 7
 * slot pieni per costruzione; il numero effettivo di esercizi scende sotto 5
 * solo se l'attrezzatura disponibile lo rende letteralmente impossibile, e in
 * quel caso il motore lo dice in italiano semplice, non con un errore tecnico.
 */

import type {
  Equipment, EquipmentItem, Exercise, Experience, GeneratedWorkout, Goal, Intensity, Muscle,
  PrescribedExercise, Split, WorkoutBlock,
} from '../types'
import { SPLIT_LABELS } from '../types'
import { isExerciseAvailable } from './equipment'
import { PESO_DEFAULT_KG, stimaCalorieEsercizio } from './calories'
import { minutiBlocco, minutiEsercizio, portaCompoundInApertura, rimuoviDuplicati, rng, scegliRiscaldamento } from './shared'

export interface GenerationConfig {
  split: Split
  goal: Goal
  experience: Experience
  equipment: Equipment
  available_equipment?: EquipmentItem[] | null
  duration_min: number
  priority_muscles: Muscle[]
  excluded_exercises: string[]
  /** Esercizi preferiti dall'utente (sez. 33/10 della correzione): priorità, non obbligo. */
  preferred_exercises?: string[]
  /** Volume settimanale già accumulato per muscolo, dagli allenamenti completati (weakPoints.ts). */
  weekly_volume?: Record<Muscle, number>
  last_trained_at?: Partial<Record<Muscle, string>>
  /** Bassa/Media/Alta: modula recupero e ripetizioni entro l'obiettivo scelto (sez. UI Base44). */
  intensity?: Intensity
  /** Per la stima delle calorie attive (sez. 60); senza valore si usa una media adulta dichiarata. */
  weight_kg?: number | null
  seed?: number
}

interface SlotDef {
  muscle: Muscle
  compound: boolean
  order?: number
  /** Pattern preferiti per l'ordine tecnico: fallback agli altri se l'attrezzatura non li offre. */
  preferredPatterns?: string[]
  /** Una carenza selezionata è obbligatoria nella sessione, non un bonus casuale. */
  weakPoint?: boolean
}

/**
 * Il muscolo da solo non descrive il ruolo biomeccanico di uno slot. Per
 * esempio un thruster ha i deltoidi anteriori fra i target, ma resta uno
 * squat full-body e non appartiene a un Push Bodybuilding. Questi pattern
 * sono quindi un vincolo strutturale, precedente a carenze e preferenze.
 */
const PATTERN_PER_MUSCOLO: Partial<Record<Muscle, string[]>> = {
  chest: ['horizontal_push'],
  back: ['horizontal_pull', 'vertical_pull'],
  front_delts: ['vertical_push'],
  lateral_delts: ['lateral_raise'],
  rear_delts: ['rear_delt'],
  biceps: ['elbow_flexion'],
  triceps: ['elbow_extension'],
  // Il catalogo storico classifica Leg Extension e Leg Curl entrambi come
  // knee_flexion: lo accettiamo qui finché la migration catalogo li separa.
  quads: ['squat', 'lunge', 'knee_extension', 'knee_flexion'],
  hamstrings: ['hinge', 'knee_flexion'],
  glutes: ['hinge', 'lunge'],
  calves: ['calf_raise', 'jump'],
  core: ['core'],
}

function patternCoerente(exercise: Exercise, muscle: Muscle): boolean {
  const ammessi = PATTERN_PER_MUSCOLO[muscle]
  return !ammessi || ammessi.includes(exercise.movement_pattern)
}

/**
 * Struttura base di ogni split (sez. 3, 11 della correzione): sempre 5 slot,
 * sempre presenti, indipendentemente dal tempo a disposizione. Il tempo
 * decide quante serie e quanto recupero, non se questi 5 esistono.
 */
const BASE_SLOTS: Record<Split, SlotDef[]> = {
  push: [
    { muscle: 'chest', compound: true },
    { muscle: 'chest', compound: true },
    { muscle: 'front_delts', compound: true },
    { muscle: 'lateral_delts', compound: false },
    { muscle: 'triceps', compound: false },
  ],
  pull: [
    { muscle: 'back', compound: true },
    { muscle: 'back', compound: true },
    { muscle: 'back', compound: false },
    { muscle: 'rear_delts', compound: false },
    { muscle: 'biceps', compound: false },
  ],
  legs: [
    { muscle: 'quads', compound: true, preferredPatterns: ['squat'] },
    { muscle: 'hamstrings', compound: true, preferredPatterns: ['hinge'] },
    { muscle: 'quads', compound: false },
    { muscle: 'hamstrings', compound: false },
    { muscle: 'calves', compound: false },
  ],
  upper: [
    { muscle: 'chest', compound: true },
    { muscle: 'back', compound: true },
    { muscle: 'front_delts', compound: true },
    { muscle: 'biceps', compound: false },
    { muscle: 'triceps', compound: false },
  ],
  lower: [
    { muscle: 'quads', compound: true, preferredPatterns: ['squat'] },
    { muscle: 'hamstrings', compound: true, preferredPatterns: ['hinge'] },
    { muscle: 'quads', compound: false },
    { muscle: 'glutes', compound: false },
    { muscle: 'calves', compound: false },
  ],
  full_body: [
    { muscle: 'quads', compound: true },
    { muscle: 'chest', compound: true },
    { muscle: 'back', compound: true },
    { muscle: 'lateral_delts', compound: false },
    { muscle: 'core', compound: false },
  ],
  bro_chest: [
    { muscle: 'chest', compound: true },
    { muscle: 'chest', compound: true },
    { muscle: 'chest', compound: false },
    { muscle: 'chest', compound: false },
    { muscle: 'chest', compound: false },
  ],
  bro_back: [
    { muscle: 'back', compound: true },
    { muscle: 'back', compound: true },
    { muscle: 'back', compound: true },
    { muscle: 'back', compound: false },
    { muscle: 'rear_delts', compound: false },
  ],
  bro_shoulders: [
    { muscle: 'front_delts', compound: true },
    { muscle: 'lateral_delts', compound: false },
    { muscle: 'lateral_delts', compound: false },
    { muscle: 'rear_delts', compound: false },
    { muscle: 'rear_delts', compound: false },
  ],
  bro_arms: [
    { muscle: 'triceps', compound: true, preferredPatterns: ['horizontal_push', 'vertical_push'] },
    { muscle: 'biceps', compound: false },
    { muscle: 'triceps', compound: false },
    { muscle: 'biceps', compound: false },
    { muscle: 'biceps', compound: false },
  ],
  bro_legs: [
    { muscle: 'quads', compound: true, preferredPatterns: ['squat'] },
    { muscle: 'hamstrings', compound: true, preferredPatterns: ['hinge'] },
    { muscle: 'quads', compound: false },
    { muscle: 'hamstrings', compound: false },
    { muscle: 'glutes', compound: false },
  ],
  front_body: [
    { muscle: 'chest', compound: true },
    { muscle: 'quads', compound: true },
    { muscle: 'lateral_delts', compound: false },
    { muscle: 'quads', compound: false },
    { muscle: 'core', compound: false },
  ],
  back_body: [
    { muscle: 'back', compound: true },
    { muscle: 'hamstrings', compound: true },
    { muscle: 'back', compound: false },
    { muscle: 'rear_delts', compound: false },
    { muscle: 'biceps', compound: false },
  ],
}

/**
 * Slot per il 6° esercizio, usati SOLO quando non c'è una priorità assegnata
 * muscolo carente a reclamare quella posizione (sez. 3, 11): un richiamo ha
 * sempre la precedenza su un isolamento generico aggiuntivo.
 */
const EXTRA_SLOTS: Record<Split, SlotDef[]> = {
  push: [{ muscle: 'chest', compound: false }, { muscle: 'triceps', compound: false }],
  pull: [{ muscle: 'triceps', compound: false }, { muscle: 'biceps', compound: false }],
  legs: [{ muscle: 'glutes', compound: false }, { muscle: 'core', compound: false }],
  upper: [{ muscle: 'lateral_delts', compound: false }, { muscle: 'chest', compound: false }],
  lower: [{ muscle: 'hamstrings', compound: false }, { muscle: 'core', compound: false }],
  full_body: [{ muscle: 'hamstrings', compound: false }, { muscle: 'biceps', compound: false }],
  bro_chest: [{ muscle: 'front_delts', compound: false }, { muscle: 'triceps', compound: false }],
  bro_back: [{ muscle: 'back', compound: false }, { muscle: 'biceps', compound: false }],
  bro_shoulders: [{ muscle: 'front_delts', compound: false }, { muscle: 'core', compound: false }],
  bro_arms: [{ muscle: 'triceps', compound: false }, { muscle: 'biceps', compound: false }],
  bro_legs: [{ muscle: 'calves', compound: false }, { muscle: 'core', compound: false }],
  front_body: [{ muscle: 'chest', compound: false }, { muscle: 'lateral_delts', compound: false }],
  back_body: [{ muscle: 'hamstrings', compound: false }, { muscle: 'glutes', compound: false }],
}

/**
 * Muscoli che uno split può plausibilmente toccare, per due usi: capire se
 * un muscolo carente è "naturale" per questo split o è un richiamo incrociato
 * (sez. 7), e trovare un muscolo sostituto quando uno slot resta senza
 * candidati per mancanza di attrezzatura.
 */
const SPLIT_MUSCLE_POOL: Record<Split, Muscle[]> = {
  push: ['chest', 'front_delts', 'lateral_delts', 'triceps'],
  pull: ['back', 'rear_delts', 'biceps'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves', 'core'],
  upper: ['chest', 'back', 'front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps'],
  lower: ['quads', 'hamstrings', 'glutes', 'calves', 'core'],
  full_body: ['chest', 'back', 'quads', 'hamstrings', 'lateral_delts', 'core', 'biceps', 'triceps'],
  bro_chest: ['chest', 'front_delts', 'triceps'],
  bro_back: ['back', 'rear_delts', 'biceps'],
  bro_shoulders: ['front_delts', 'lateral_delts', 'rear_delts'],
  bro_arms: ['biceps', 'triceps'],
  bro_legs: ['quads', 'hamstrings', 'glutes', 'calves', 'core'],
  front_body: ['chest', 'quads', 'front_delts', 'lateral_delts', 'core'],
  back_body: ['back', 'hamstrings', 'rear_delts', 'biceps', 'glutes'],
}

/**
 * Serie, ripetizioni e recupero secondo l'obiettivo (sez. 10), modulati
 * dall'intensità scelta per oggi (Bassa/Media/Alta): sposta il recupero
 * verso gli estremi dell'intervallo dell'obiettivo, non cambia obiettivo.
 */
function prescrizione(goal: Goal, compound: boolean, exp: Experience, intensity: Intensity = 'medium') {
  const base = {
    strength:     compound ? { sets: 4, reps: '4-6',   rest: 180 } : { sets: 3, reps: '6-8',   rest: 120 },
    hypertrophy:  compound ? { sets: 4, reps: '6-10',  rest: 120 } : { sets: 3, reps: '10-15', rest: 75 },
    conditioning: compound ? { sets: 3, reps: '12-15', rest: 60 }  : { sets: 3, reps: '15-20', rest: 45 },
    mixed:        compound ? { sets: 4, reps: '8-10',  rest: 105 } : { sets: 3, reps: '12-15', rest: 60 },
  }[goal]

  const fattoreRecupero = { low: 0.75, medium: 1, high: 1.25 }[intensity]
  const risultato = { ...base, rest: Math.round(base.rest * fattoreRecupero) }

  // I principianti fanno una serie in meno sui fondamentali: meno volume, tecnica migliore.
  if (exp === 'beginner' && compound) return { ...risultato, sets: Math.max(3, risultato.sets - 1) }
  return risultato
}

/** Serie minime sotto cui non si scende quando si adatta la sessione al tempo (sez. 3). */
function serieMinime(compound: boolean): number {
  return compound ? 3 : 2
}

const RANK_EXP: Record<Experience, number> = { beginner: 1, intermediate: 2, advanced: 3 }

/** Quanti esercizi principali punta ad avere la sessione: massimo sei. */
function targetEsercizi(duration_min: number): number {
  if (duration_min < 45) return 5
  return 6
}

/**
 * Soglia di "compound pesante": oltre 2 nella stessa sessione la tecnica e
 * il recupero ne risentono (sez. 24). La scala di systemic_fatigue nel
 * catalogo va da 1 a 3 (non 1-10): "pesante" è il valore massimo, 3.
 */
const SOGLIA_PESANTE = 3
const MAX_COMPOUND_PESANTI = 2

const SHOULDER_MUSCLES: Muscle[] = ['front_delts', 'lateral_delts', 'rear_delts']

/**
 * Ordine di esecuzione, separato dalla scelta casuale della variante.
 * I multiarticolari tecnici vengono eseguiti da freschi; negli accessori si
 * alternano i distretti per non accumulare inutilmente fatica locale.
 */
function ordinaSlot(split: Split, slots: SlotDef[]): SlotDef[] {
  const lowerBody = split === 'legs' || split === 'lower' || split === 'bro_legs'
  const rank = (slot: SlotDef): number => {
    if (slot.order !== undefined) return slot.order
    if (lowerBody) {
      if (slot.compound && slot.muscle === 'quads') return 0
      if (slot.compound && slot.muscle === 'hamstrings') return 1
      if (slot.muscle === 'glutes') return 2
      if (!slot.compound && slot.muscle === 'quads') return 3
      if (!slot.compound && slot.muscle === 'hamstrings') return 4
      if (slot.muscle === 'calves') return 5
      return 6
    }
    if (split === 'push') {
      if (slot.compound && slot.muscle === 'chest') return 0
      if (slot.weakPoint && slot.muscle === 'lateral_delts') return 1
      if (slot.compound && slot.muscle === 'front_delts') return 1
      if (!slot.compound && slot.muscle === 'chest') return 2
      if (slot.muscle === 'lateral_delts') return 3
      if (slot.muscle === 'biceps') return 4
      if (slot.muscle === 'triceps') return 5
      return 6
    }
    if (split === 'pull' || split === 'bro_back' || split === 'back_body') {
      if (slot.compound && (slot.muscle === 'back' || slot.muscle === 'hamstrings')) return 0
      if (slot.weakPoint && slot.muscle === 'rear_delts') return 1
      if (!slot.compound && slot.muscle === 'back') return 2
      if (slot.muscle === 'rear_delts') return 3
      if (slot.muscle === 'biceps') return 4
      if (slot.muscle === 'triceps') return 5
    }
    if (split === 'upper' || split === 'front_body' || split === 'bro_chest') {
      if (slot.compound) return 0
      if (slot.weakPoint && SHOULDER_MUSCLES.includes(slot.muscle)) return 1
      if (slot.muscle === 'chest' || slot.muscle === 'back' || slot.muscle === 'quads') return 2
      if (SHOULDER_MUSCLES.includes(slot.muscle)) return 3
      if (slot.muscle === 'biceps') return 4
      if (slot.muscle === 'triceps') return 5
    }
    return slot.compound ? 0 : 1
  }
  return slots.map((slot, index) => ({ slot, index })).sort((a, b) => rank(a.slot) - rank(b.slot) || a.index - b.index).map(({ slot }) => slot)
}

/**
 * Collassa le tre porzioni del deltoide in un solo richiamo "spalle" per
 * sessione. Se lo split ne copre già una selezionata usa quella naturale
 * (laterale in Push, posteriore in Pull); altrimenti sceglie la prima carenza
 * dichiarata. Bicipiti e tricipiti restano due requisiti distinti.
 */
function requisitiCarenze(priority: Muscle[], slots: SlotDef[]): Muscle[] {
  const requirements: Muscle[] = []
  const shoulders = priority.filter((muscle) => SHOULDER_MUSCLES.includes(muscle))
  if (shoulders.length > 0) {
    requirements.push(slots.find((slot) => shoulders.includes(slot.muscle))?.muscle ?? shoulders[0])
  }
  for (const muscle of priority.filter((item) => !SHOULDER_MUSCLES.includes(item))) {
    if (!requirements.includes(muscle)) requirements.push(muscle)
  }
  return requirements
}

/** Mantiene almeno tre slot identitari e riserva le priorità assegnate, senza superare sei esercizi. */
function applicaPrioritaAssegnate(base: SlotDef[], priority: Muscle[]): { slots: SlotDef[]; requirements: Muscle[] } {
  const requirements = requisitiCarenze(priority, base).slice(0, 3)
  const slots = base.map((slot) => ({ ...slot }))
  const represented = new Set<Muscle>()
  for (const requirement of requirements) {
    const existing = slots.find((slot) => slot.muscle === requirement && !slot.weakPoint)
    if (existing) { existing.weakPoint = true; represented.add(requirement) }
  }
  const missing = requirements.filter((muscle) => !represented.has(muscle))
  while (slots.length + missing.length > 6 && slots.length > 3) {
    const removable = slots.map((slot, index) => ({ slot, index })).reverse().find(({ slot }) => !slot.weakPoint)
    if (!removable) break
    slots.splice(removable.index, 1)
  }
  for (const muscle of missing) slots.push({ muscle, compound: false, weakPoint: true })
  return { slots, requirements }
}

export function generaBodybuilding(
  catalogo: Exercise[],
  cfg: GenerationConfig
): GeneratedWorkout {
  const warnings: string[] = []
  const random = rng(cfg.seed ?? 1)
  const preferiti = new Set(cfg.preferred_exercises ?? [])

  // 1-3. Attrezzatura, esclusioni, esperienza
  const disponibili = catalogo.filter(
    (e) =>
      isExerciseAvailable(e, cfg.equipment, cfg.available_equipment) &&
      !cfg.excluded_exercises.includes(e.id) &&
      RANK_EXP[e.min_experience] <= RANK_EXP[cfg.experience]
  )
  const allenamento = disponibili.filter((e) => !e.roles.includes('warmup'))
  const riscaldamentoPool = disponibili.filter((e) => e.roles.includes('warmup'))

  // 4. Struttura: 5 slot fissi + un sesto secondo tempo e priorità settimanali.
  const pool = SPLIT_MUSCLE_POOL[cfg.split]
  const priorities = cfg.priority_muscles ?? []
  let base = BASE_SLOTS[cfg.split]
  // Specializzazione Push del documento BB: dopo due press per il petto,
  // laterali, un compound più stabile, quindi bicipiti e tricipiti.
  if (cfg.split === 'push' && priorities.includes('lateral_delts') && priorities.includes('biceps') && priorities.includes('triceps')) {
    base = [
      { muscle: 'chest', compound: true, order: 0 },
      { muscle: 'chest', compound: true, order: 1 },
      { muscle: 'lateral_delts', compound: false, order: 2 },
      { muscle: 'chest', compound: true, order: 3 },
      { muscle: 'biceps', compound: false, order: 4 },
      { muscle: 'triceps', compound: false, order: 5 },
    ]
  }
  const structured = applicaPrioritaAssegnate(base, priorities)
  const baseSlot = structured.slots
  const target = cfg.split === 'bro_chest'
    ? 5
    : Math.min(6, Math.max(targetEsercizi(cfg.duration_min), baseSlot.length))

  // 6. Sesto slot: prima le priorità assegnate dalla settimana, poi l'extra dello split.
  const extraSlot: SlotDef[] = []
  for (const s of EXTRA_SLOTS[cfg.split]) {
    if (baseSlot.length + extraSlot.length >= target) break
    extraSlot.push(s)
  }
  const slot = ordinaSlot(cfg.split, [...baseSlot, ...extraSlot])

  // 7. Selezione esercizi per slot
  const scelti: PrescribedExercise[] = []
  const usati = new Set<string>()
  let faticaSistemica = 0
  let faticaPresa = 0
  let compoundPesanti = 0

  for (let i = 0; i < slot.length; i++) {
    const s = slot[i]
    const isRichiamo = !!s.weakPoint
    const isCrossSplitRecall = isRichiamo && !pool.includes(s.muscle)
    const musclesDaProvare = cfg.split === 'bro_chest'
      ? ['chest' as Muscle]
      : [s.muscle, ...(!isRichiamo ? pool.filter((m) => m !== s.muscle) : [])]

    let scelto: Exercise | undefined
    let muscoloUsato: Muscle = s.muscle

    for (const m of musclesDaProvare) {
      const candidati = allenamento
        .filter((e) => !usati.has(e.id))
        .filter((e) => e.primary_muscles.includes(m))
        .filter((e) => patternCoerente(e, m))
        .filter((e) => e.roles.includes(s.compound ? 'compound' : 'isolation'))
        // Fatica di presa (sez. 32): si escludono solo gli esercizi MOLTO esigenti
        // quando la presa è già carica, non l'intero pool dopo due tirate.
        .filter((e) => !(e.grip_fatigue >= 3 && faticaPresa >= 6))
        // Niente movimenti tecnici quando la stanchezza rende la tecnica inaffidabile (sez. 33)
        .filter((e) => !(faticaSistemica >= 8 && e.technical_complexity >= 3))

      if (candidati.length === 0) {
        // Solo per lo slot base si prova un muscolo sostituto dello stesso split;
        // un richiamo è specifico e non va rimpiazzato con un altro muscolo.
        if (isRichiamo) break
        continue
      }

      const pesanteRaggiunto = compoundPesanti >= MAX_COMPOUND_PESANTI
      const faticaSort = (a: Exercise, b: Exercise) =>
        pesanteRaggiunto
          ? a.systemic_fatigue - b.systemic_fatigue
          : faticaSistemica < 5
            ? b.systemic_fatigue - a.systemic_fatigue
            : a.systemic_fatigue - b.systemic_fatigue

      // Un preferito compatibile va scelto, non solo "avvantaggiato": sez. 10
      // della correzione, "evitare di ignorarli senza motivo". Se per questo
      // muscolo/slot esiste un candidato preferito, si sceglie da quelli soli
      // (con un minimo di varietà se l'utente ne ha preferiti più di uno per
      // lo stesso muscolo); altrimenti si torna al pool normale.
      const patternCandidati = s.preferredPatterns?.length
        ? candidati.filter((e) => s.preferredPatterns?.includes(e.movement_pattern))
        : []
      const poolPattern = patternCandidati.length > 0 ? patternCandidati : candidati
      const preferitiCandidati = poolPattern.filter((e) => preferiti.has(e.id))
      const pool_ = preferitiCandidati.length > 0 ? preferitiCandidati : poolPattern
      pool_.sort(faticaSort)
      const testa = pool_.slice(0, Math.min(3, pool_.length))
      scelto = testa[Math.floor(random() * testa.length)]
      muscoloUsato = m
      break
    }

    if (!scelto) continue // nessun esercizio disponibile per questo slot con questa attrezzatura

    const p = prescrizione(cfg.goal, s.compound, cfg.experience, cfg.intensity)
    const voce: PrescribedExercise = {
      exercise_id: scelto.id,
      name: scelto.name,
      role: s.compound ? 'compound' : 'isolation',
      muscle: muscoloUsato,
      sets: isCrossSplitRecall ? Math.min(2, p.sets) : p.sets,
      reps: p.reps,
      rest_sec: p.rest,
      note: isCrossSplitRecall ? 'richiamo carenza' : isRichiamo ? 'carenza' : undefined,
      instructions: scelto.instructions || undefined,
    }

    usati.add(scelto.id)
    faticaSistemica += scelto.systemic_fatigue
    faticaPresa += scelto.grip_fatigue
    if (scelto.systemic_fatigue >= SOGLIA_PESANTE && s.compound) compoundPesanti++
    scelti.push(voce)
  }

  // 8. Adattamento al tempo: si riducono prima i recuperi, poi le serie
  // (mai sotto il minimo), solo come ultimissima risorsa si toglie uno slot,
  // partendo da un richiamo/extra e mai sotto i 5 esercizi (sez. 3, 23).
  const minutiRiscaldamento = cfg.duration_min >= 45 ? 9 : 6
  const budget = cfg.duration_min - minutiRiscaldamento
  adattaAlTempo(scelti, budget)

  // 9. Validatore di sicurezza finale (sez. 22, 40): corregge, non si limita a segnalare.
  rimuoviDuplicati(scelti)
  if (!portaCompoundInApertura(scelti)) warnings.push('Nessun esercizio multiarticolare disponibile con questa attrezzatura.')
  if (scelti.length < 5) {
    warnings.push(
      `Con questa attrezzatura escono solo ${scelti.length} esercizi. ` +
        `Aggiungendo attrezzi nel profilo la sessione diventa più completa.`
    )
  }
  if (scelti.length === 0) {
    warnings.push('Nessun esercizio disponibile con queste impostazioni.')
  }

  // Stima calorie (sez. 60): calcolata dopo l'adattamento al tempo, sui
  // minuti effettivi di ogni esercizio. Senza peso noto si usa una media
  // adulta dichiarata, mai spacciata per una misura individuale.
  const peso = cfg.weight_kg || PESO_DEFAULT_KG
  for (const e of scelti) {
    e.est_kcal = stimaCalorieEsercizio('bodybuilding', e.role, minutiEsercizio(e), peso)
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
    name: `${SPLIT_LABELS[cfg.split]} — ${scelti.length} esercizi`,
    mode: 'bodybuilding',
    split: cfg.split,
    goal: cfg.goal,
    experience: cfg.experience,
    duration_min: Math.round(minutiRiscaldamento + minutiBlocco(scelti)),
    blocks: blocchi,
    warnings,
    est_kcal: kcalTotali,
  }
}

/**
 * Adatta la sessione al budget di tempo SENZA eliminare esercizi come prima
 * mossa (sez. 3, 23): prima taglia il recupero verso il minimo dell'obiettivo,
 * poi una serie sugli slot meno prioritari (richiami ed extra prima dei
 * compound), solo alla fine — se proprio non basta — droppa l'ultimo slot,
 * mai sotto i 5 esercizi.
 */
function adattaAlTempo(scelti: PrescribedExercise[], budgetMin: number): void {
  const RECUPERO_MINIMO = 45

  const sforo = () => minutiBlocco(scelti) - budgetMin
  if (sforo() <= 0) return

  // Fase 1: recuperi verso il minimo, dal più lungo.
  let iter = 0
  while (sforo() > 0 && iter++ < 50) {
    const candidato = scelti
      .filter((e) => e.rest_sec > RECUPERO_MINIMO)
      .sort((a, b) => b.rest_sec - a.rest_sec)[0]
    if (!candidato) break
    candidato.rest_sec = Math.max(RECUPERO_MINIMO, candidato.rest_sec - 15)
  }

  // Fase 2: una serie in meno sugli slot non-compound e i richiami, poi i compound.
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

  // Fase 3: ultima risorsa, droppa lo slot meno prioritario, mai sotto 5.
  while (sforo() > 0 && scelti.length > 5) {
    let iRimuovi = scelti.map((e) => e.note !== 'carenza' && e.role === 'isolation').lastIndexOf(true)
    if (iRimuovi < 0) iRimuovi = scelti.map((e) => e.note !== 'carenza').lastIndexOf(true)
    if (iRimuovi < 0) break
    scelti.splice(iRimuovi, 1)
  }
}
