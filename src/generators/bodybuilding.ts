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
 *     -> struttura della sessione (5-7 slot, decisi PRIMA di scegliere gli esercizi)
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
import { MUSCLE_LABELS, SPLIT_LABELS } from '../types'
import { isExerciseAvailable } from './equipment'
import { decidiRichiami } from './weakPoints'
import { PESO_DEFAULT_KG, stimaCalorieEsercizio } from './calories'
import { minutiBlocco, minutiEsercizio, rimuoviDuplicati, rng, scegliRiscaldamento, vuotoVolume } from './shared'

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
    { muscle: 'quads', compound: true },
    { muscle: 'hamstrings', compound: true },
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
    { muscle: 'quads', compound: true },
    { muscle: 'hamstrings', compound: true },
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
    { muscle: 'chest', compound: true },
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
    { muscle: 'biceps', compound: false },
    { muscle: 'triceps', compound: false },
    { muscle: 'biceps', compound: false },
    { muscle: 'triceps', compound: false },
    { muscle: 'biceps', compound: false },
  ],
  bro_legs: [
    { muscle: 'quads', compound: true },
    { muscle: 'hamstrings', compound: true },
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
 * Slot per il 6° e 7° esercizio, usati SOLO quando non c'è un richiamo di un
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
 * Muscoli per cui è anatomicamente sensato un "richiamo incrociato" oltre
 * al pool naturale dello split (sez. 8 della correzione: tricipiti in Pull,
 * bicipiti in Push — la classica accoppiata "braccia" di palestra). Per
 * tutti gli altri split il richiamo resta dentro il pool naturale: le gambe
 * non richiamano mai braccia o spalle (sez. 11), qualunque sia la carenza
 * dichiarata.
 */
const RICHIAMO_POOL: Record<Split, Muscle[]> = {
  push: ['chest', 'front_delts', 'lateral_delts', 'triceps', 'biceps'],
  pull: ['back', 'rear_delts', 'biceps', 'triceps'],
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

/** Quanti esercizi principali punta ad avere la sessione, secondo il tempo (sez. 3: sempre 5-7). */
function targetEsercizi(duration_min: number): number {
  if (duration_min < 45) return 5
  if (duration_min < 70) return 6
  return 7
}

/**
 * Soglia di "compound pesante": oltre 2 nella stessa sessione la tecnica e
 * il recupero ne risentono (sez. 24). La scala di systemic_fatigue nel
 * catalogo va da 1 a 3 (non 1-10): "pesante" è il valore massimo, 3.
 */
const SOGLIA_PESANTE = 3
const MAX_COMPOUND_PESANTI = 2

export function generaBodybuilding(
  catalogo: Exercise[],
  cfg: GenerationConfig
): GeneratedWorkout {
  const warnings: string[] = []
  const random = rng(cfg.seed ?? 1)
  const preferiti = new Set(cfg.preferred_exercises ?? [])
  const volumeSettimanale = cfg.weekly_volume

  // 1-3. Attrezzatura, esclusioni, esperienza
  const disponibili = catalogo.filter(
    (e) =>
      isExerciseAvailable(e, cfg.equipment, cfg.available_equipment) &&
      !cfg.excluded_exercises.includes(e.id) &&
      RANK_EXP[e.min_experience] <= RANK_EXP[cfg.experience]
  )
  const allenamento = disponibili.filter((e) => !e.roles.includes('warmup'))
  const riscaldamentoPool = disponibili.filter((e) => e.roles.includes('warmup'))

  // 4. Struttura: 5 slot fissi + fino a 2 aggiuntivi secondo il tempo (sez. 3, 11)
  const pool = SPLIT_MUSCLE_POOL[cfg.split]
  let baseSlot = [...BASE_SLOTS[cfg.split]]

  // 5a. Muscoli carenti "naturali" per lo split: ridistribuiscono gli slot base, non li aggiungono (sez. 6-7)
  const prioritaInSplit = cfg.priority_muscles.filter((m) => pool.includes(m))
  const prioritaFuoriSplit = cfg.priority_muscles.filter((m) => !pool.includes(m))
  if (prioritaInSplit.length > 0) {
    baseSlot = ridistribuisci(baseSlot, prioritaInSplit)
  }

  const target = targetEsercizi(cfg.duration_min)

  // 5b. Richiami settimanali (sez. 6-10): solo per i muscoli davvero indietro
  // sul volume delle ultime settimane, non per ogni carenza dichiarata, e
  // solo fra i muscoli anatomicamente sensati per questo split (sez. 11: le
  // gambe non richiamano mai braccia o spalle).
  const volumeStimato = volumeSettimanale ?? vuotoVolume()
  // Prima i richiami incrociati non già rappresentati dallo split (es. tricipiti
  // in Pull), poi l'eventuale volume extra sui muscoli già presenti.
  const priortaRichiamabili = cfg.priority_muscles
    .filter((m) => RICHIAMO_POOL[cfg.split].includes(m))
    .sort((a, b) => Number(pool.includes(a)) - Number(pool.includes(b)))
  const richiami = decidiRichiami(
    priortaRichiamabili,
    volumeStimato,
    baseSlot.map((s) => s.muscle),
    2,
    { last_trained_at: cfg.last_trained_at }
  )
  if (prioritaFuoriSplit.length > 0 && richiami.length === 0) {
    warnings.push(
      `${prioritaFuoriSplit.map((m) => MUSCLE_LABELS[m]).join(', ')}: già a posto sul volume ` +
        `settimanale, ${prioritaFuoriSplit.length > 1 ? 'verranno' : 'verrà'} richiamat${prioritaFuoriSplit.length > 1 ? 'i' : 'o'} quando serve.`
    )
  }

  // 6. Slot 6°-7°: prima i richiami, poi gli extra generici dello split
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

  // 7. Selezione esercizi per slot
  const scelti: PrescribedExercise[] = []
  const usati = new Set<string>()
  let faticaSistemica = 0
  let faticaPresa = 0
  let compoundPesanti = 0

  for (let i = 0; i < slot.length; i++) {
    const s = slot[i]
    const isRichiamo = i >= baseSlot.length && richiamoSet.has(s.muscle)
    const musclesDaProvare = [s.muscle, ...pool.filter((m) => m !== s.muscle)]

    let scelto: Exercise | undefined
    let muscoloUsato: Muscle = s.muscle

    for (const m of musclesDaProvare) {
      const candidati = allenamento
        .filter((e) => !usati.has(e.id))
        .filter((e) => e.primary_muscles.includes(m))
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
      const preferitiCandidati = candidati.filter((e) => preferiti.has(e.id))
      const pool_ = preferitiCandidati.length > 0 ? preferitiCandidati : candidati
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

  // 8. Adattamento al tempo: si riducono prima i recuperi, poi le serie
  // (mai sotto il minimo), solo come ultimissima risorsa si toglie uno slot,
  // partendo da un richiamo/extra e mai sotto i 5 esercizi (sez. 3, 23).
  const minutiRiscaldamento = cfg.duration_min >= 45 ? 9 : 6
  const budget = cfg.duration_min - minutiRiscaldamento
  adattaAlTempo(scelti, budget)

  // 9. Validatore di sicurezza finale (sez. 22, 40): corregge, non si limita a segnalare.
  rimuoviDuplicati(scelti)
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
    let iRimuovi = scelti.map((e) => e.note === 'richiamo').lastIndexOf(true)
    if (iRimuovi < 0) iRimuovi = scelti.map((e) => e.role === 'isolation').lastIndexOf(true)
    if (iRimuovi < 0) iRimuovi = scelti.length - 1
    scelti.splice(iRimuovi, 1)
  }
}

/**
 * Ridistribuisce gli slot base verso i muscoli prioritari CHE NON HANNO
 * ANCORA UNO SLOT PROPRIO in questo split, senza aggiungerne di nuovi:
 * toglie uno slot al muscolo più rappresentato e lo assegna alla priorità
 * (sez. 6: è una redistribuzione, non un'aggiunta).
 *
 * Un muscolo prioritario che lo split copre già naturalmente (es. bicipiti
 * in un Pull, che ha già il suo slot dedicato) non viene toccato qui: se ha
 * davvero bisogno di più volume ci pensa il richiamo settimanale
 * (weakPoints.ts), non una seconda redistribuzione nella stessa sessione.
 * Prima di questa correzione, due muscoli prioritari già presenti potevano
 * "spolpare" lo stesso donatore in sequenza fino a farlo sparire quasi
 * del tutto — misurato nei test sullo scenario Pull con carenze braccia.
 */
function ridistribuisci(slot: SlotDef[], priorita: Muscle[]): SlotDef[] {
  const out = [...slot]
  for (const p of priorita) {
    const conteggio = new Map<Muscle, number>()
    out.forEach((s) => conteggio.set(s.muscle, (conteggio.get(s.muscle) ?? 0) + 1))
    if ((conteggio.get(p) ?? 0) > 0) continue // già rappresentato: niente da redistribuire

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
