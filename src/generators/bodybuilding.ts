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
 *     -> struttura della sessione (almeno 6 slot, decisi PRIMA di scegliere gli esercizi)
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
  BodybuildingProtocol, Equipment, EquipmentItem, Exercise, Experience, FocusPortion, GeneratedWorkout, Goal, Intensity, Muscle,
  PrescribedExercise, Split, WorkoutBlock,
} from '../types'
import { isLaggingNote, SPLIT_LABELS } from '../types'
import { isExerciseAvailable } from './equipment'
import { isFst7FinisherEligible } from '../engine/replacement'
import { PESO_DEFAULT_KG, stimaCalorieEsercizio } from './calories'
import { minutiBlocco, minutiEsercizio, PORZIONE_ROTABILE, portaCompoundInApertura, rimuoviDuplicati, riordinaPerSinergie, rng, scegliRiscaldamento } from './shared'

export interface GenerationConfig {
  split: Split
  goal: Goal
  experience: Experience
  equipment: Equipment
  available_equipment?: EquipmentItem[] | null
  duration_min: number
  priority_muscles: Muscle[]
  /** Quale capo enfatizzare per una carenza bicipiti/tricipiti in questa seduta (weeklyPlan.ts
   *  la ruota fra le sedute della settimana). Assente in sessione singola: si usa 'long_head'. */
  priority_portions?: Partial<Record<Muscle, FocusPortion>>
  target_muscles?: Muscle[]
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
  /** Protocollo di esecuzione: 'standard' (default) usa la prescrizione legata all'obiettivo. */
  protocol?: BodybuildingProtocol
  /** Solo per protocol 'fst7': il blocco da 7 serie apre la sessione invece di chiuderla. */
  fst7_preloading?: boolean
}

interface SlotDef {
  muscle: Muscle
  compound: boolean
  order?: number
  /** Pattern preferiti per l'ordine tecnico: fallback agli altri se l'attrezzatura non li offre. */
  preferredPatterns?: string[]
  /** Una carenza selezionata è obbligatoria nella sessione, non un bonus casuale. */
  weakPoint?: boolean
  /** Standard PPL a 6 slot (sez. spec utente 19/08): angolo/capo di default per bicipiti e
   *  tricipiti quando lo slot è fisso di template, non una carenza settimanale (che ha la sua
   *  rotazione via cfg.priority_portions — quella vince sempre se lo slot diventa weakPoint). */
  preferredPortion?: FocusPortion
  /** Tetto opzionale alle serie prescritte per questo slot (es. dip in Push: recupero attivo,
   *  non serve spingerlo come un composto pesante standard). */
  maxSets?: number
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
  // 'horizontal_push' ammette i dip (dip_parallele, catalogo): tricipiti primario, petto e
  // deltoide anteriore secondari — l'unico esercizio "a più muscoli" del catalogo Push. Senza
  // questo pattern il filtro lo escludeva sempre, per qualunque slot (sez. feedback utente
  // 19/08: "le dip prendono frontali, petto e tricipiti", volute come esercizio intermedio).
  triceps: ['elbow_extension', 'horizontal_push'],
  forearms: ['wrist_flexion', 'wrist_extension', 'carry'],
  // Il catalogo storico classifica Leg Extension e Leg Curl entrambi come
  // knee_flexion: lo accettiamo qui finché la migration catalogo li separa.
  quads: ['squat', 'lunge', 'knee_extension', 'knee_flexion'],
  hamstrings: ['hinge', 'knee_flexion'],
  glutes: ['hinge', 'lunge'],
  adductors: ['hip_adduction'],
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
  // PPL Standard Biomeccanico a 6 Slot (sez. spec utente 19/08), sempre esattamente 6 esercizi
  // per Push/Pull/Legs, mai di più: ogni slot ha un ruolo anatomico e un'angolazione fissi,
  // l'esercizio scelto viene dal pool compatibile con quel ruolo (attrezzatura/varietà), non è
  // bloccato all'esempio letterale della spec. Slot 1-2 composti primari, poi angoli
  // complementari pensati per far "rifiatare" un distretto mentre se ne allena un altro
  // (cuscinetto di recupero attivo intra-sessione).
  //
  // Push: niente shoulder press pesante fisso (dopo 2 panche i deltoidi anteriori sono già
  // affaticati come secondari, un altro composto pesante lì è ridondante/controproducente — sez.
  // feedback utente 19/08 mattina). Slot 3 alzate laterali, slot 4 il dip (tricipiti composto,
  // allena anche petto/deltoide anteriore come secondari — l'unico "esercizio a più muscoli" del
  // catalogo). Slot 5-6: bicipiti (capo lungo, allungamento — cuscinetto per i tricipiti dopo il
  // dip) e tricipiti (capo lungo, allungamento) — sì, bicipiti E tricipiti anche in Push: la
  // spec inverte di proposito il "una casa sola per muscolo" deciso stamattina, per allenare
  // l'intero range del muscolo su due sedute con angoli complementari (Push lungo/Pull corto).
  // Un front_delts composto resta disponibile SOLO se dichiarato carenza esplicitamente.
  push: [
    { muscle: 'chest', compound: true },
    { muscle: 'chest', compound: true },
    { muscle: 'lateral_delts', compound: false },
    { muscle: 'triceps', compound: true, preferredPatterns: ['horizontal_push'], maxSets: 3 },
    { muscle: 'biceps', compound: false, preferredPortion: 'long_head' },
    { muscle: 'triceps', compound: false, preferredPortion: 'long_head' },
  ],
  // Pull: 3 composti dorso ad angoli diversi (verticale, orizzontale a 45°, orizzontale basso —
  // il catalogo non distingue formalmente 45° da "basso": entrambi horizontal_pull, varietà
  // garantita dall'esclusione dei duplicati già scelti), poi rear delt (face pull), tricipiti
  // (capo laterale/mediale, accorciamento — cuscinetto per i bicipiti) e bicipiti (capo breve,
  // accorciamento) a chiudere.
  pull: [
    { muscle: 'back', compound: true, preferredPatterns: ['vertical_pull'] },
    { muscle: 'back', compound: true, preferredPatterns: ['horizontal_pull'] },
    { muscle: 'back', compound: true, preferredPatterns: ['horizontal_pull'] },
    { muscle: 'rear_delts', compound: false },
    { muscle: 'triceps', compound: false, preferredPortion: 'lateral_head' },
    { muscle: 'biceps', compound: false, preferredPortion: 'short_head' },
  ],
  // Legs: i 2 composti sono ENTRAMBI quad-dominanti (squat + leg press/hack — la spec non vuole
  // più un composto femorali fisso qui), poi isolamento quad, isolamento femorali, glutei
  // (hip thrust/stacco rumeno, in chiusura della catena posteriore) e polpacci a chiudere.
  legs: [
    { muscle: 'quads', compound: true, preferredPatterns: ['squat'] },
    { muscle: 'quads', compound: true, preferredPatterns: ['squat'] },
    { muscle: 'quads', compound: false },
    { muscle: 'hamstrings', compound: false },
    { muscle: 'glutes', compound: true, preferredPatterns: ['hinge'] },
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
    { muscle: 'triceps', compound: false },
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
  // Push/Pull/Legs: lo standard PPL a 6 slot (sez. spec utente 19/08) ha già 6 slot fissi in
  // BASE_SLOTS, quindi questi non vengono mai consultati (il target è sempre 6 = baseSlot.length,
  // il ciclo si ferma al primo giro). Lasciati vuoti invece di contenuto morto fuorviante.
  push: [],
  pull: [],
  legs: [],
  upper: [{ muscle: 'lateral_delts', compound: false }, { muscle: 'chest', compound: false }],
  lower: [{ muscle: 'adductors', compound: false }, { muscle: 'calves', compound: false }],
  full_body: [{ muscle: 'hamstrings', compound: false }, { muscle: 'biceps', compound: false }],
  bro_chest: [{ muscle: 'triceps', compound: false }, { muscle: 'front_delts', compound: false }],
  bro_back: [{ muscle: 'back', compound: false }, { muscle: 'biceps', compound: false }],
  bro_shoulders: [{ muscle: 'front_delts', compound: false }, { muscle: 'core', compound: false }],
  bro_arms: [{ muscle: 'forearms', compound: false }, { muscle: 'triceps', compound: false }],
  bro_legs: [{ muscle: 'calves', compound: false }, { muscle: 'adductors', compound: false }],
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
  // biceps in push e triceps in pull (sez. spec utente 19/08, "PPL Standard Biomeccanico a 6
  // Slot"): inversione voluta del "una casa sola per muscolo" deciso stamattina — entrambi gli
  // arti si allenano sia in Push sia in Pull, con angoli complementari (preferredPortion).
  push: ['chest', 'front_delts', 'lateral_delts', 'triceps', 'biceps'],
  pull: ['back', 'rear_delts', 'biceps', 'triceps'],
  legs: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'],
  upper: ['chest', 'back', 'front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps', 'forearms'],
  lower: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'],
  full_body: ['chest', 'back', 'quads', 'hamstrings', 'lateral_delts', 'biceps', 'triceps', 'forearms'],
  bro_chest: ['chest', 'front_delts', 'triceps'],
  bro_back: ['back', 'rear_delts', 'biceps'],
  bro_shoulders: ['front_delts', 'lateral_delts', 'rear_delts'],
  bro_arms: ['biceps', 'triceps', 'forearms'],
  bro_legs: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'],
  front_body: ['chest', 'quads', 'front_delts', 'lateral_delts', 'biceps'],
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

/** Quanti esercizi principali punta ad avere la sessione: 6 di default, 3 per
 *  FST-7 (il 7° arriva a parte come finisher, non conta qui), 5 per il basso
 *  volume di Top Set & Back-Off. */
function targetEsercizi(protocol?: BodybuildingProtocol): number {
  if (protocol === 'fst7') return 3
  if (protocol === 'cbum_top_backoff') return 5
  return 6
}

/** Base FST-7 (sez. protocollo): 8-12 rep fisse, non la prescrizione standard
 *  legata all'obiettivo — il protocollo prescrive il rep range, non lo split. */
function prescrizioneFst7Base(compound: boolean, exp: Experience, intensity: Intensity = 'medium') {
  const base = compound ? { sets: 4, reps: '8-12', rest: 105 } : { sets: 3, reps: '8-12', rest: 90 }
  const fattoreRecupero = { low: 0.75, medium: 1, high: 1.25 }[intensity]
  const risultato = { ...base, rest: Math.round(base.rest * fattoreRecupero) }
  if (exp === 'beginner' && compound) return { ...risultato, sets: Math.max(3, risultato.sets - 1) }
  return risultato
}

/** Avvicinamento (2x carico crescente) + Top Set (1x6-8 @ RIR0) + Back-Off (1x10-12 @ RIR0),
 *  stile CBum: il carico non è calcolabile qui (nessun peso registrato in nessuna parte
 *  dell'app, sez. verifica con l'utente) — resta un'indicazione testuale mostrata in UI.
 *  L'avvicinamento (sez. feedback utente 19/08, "devi dire avvicinamento") sono le serie di
 *  riscaldamento specifico a carico crescente che nel vero protocollo CBum precedono sempre
 *  la serie a cedimento: senza, il Top Set partiva a freddo. */
function prescrizioneCbum(intensity: Intensity = 'medium') {
  const fattoreRecupero = { low: 0.75, medium: 1, high: 1.25 }[intensity]
  return {
    avvicinamento: [
      { sets: 1, reps: '12-15', rest: Math.round(60 * fattoreRecupero) },
      { sets: 1, reps: '8-10', rest: Math.round(90 * fattoreRecupero) },
    ],
    topSet: { sets: 1, reps: '6-8', rest: Math.round(180 * fattoreRecupero) },
    backOff: { sets: 1, reps: '10-12', rest: Math.round(150 * fattoreRecupero) },
  }
}

/**
 * Soglia di "compound pesante": oltre 2 nella stessa sessione la tecnica e
 * il recupero ne risentono (sez. 24). La scala di systemic_fatigue nel
 * catalogo va da 1 a 3 (non 1-10): "pesante" è il valore massimo, 3.
 */
const SOGLIA_PESANTE = 3
const MAX_COMPOUND_PESANTI = 2

const SHOULDER_MUSCLES: Muscle[] = ['front_delts', 'lateral_delts', 'rear_delts']
const COMPOUND_CAPABLE_MUSCLES = new Set<Muscle>(['chest', 'back', 'front_delts', 'quads', 'hamstrings', 'glutes'])
/** Il catalogo non ha NESSUN esercizio di isolamento per i deltoidi anteriori (solo military
 *  press/shoulder press/thruster, tutti composti): forzare una carenza front_delts a isolamento
 *  (come farebbe normalmente il tetto "massimo 2 composti" sotto) produce uno slot senza
 *  candidati, silenziosamente sostituito da un ripiego casuale a valle. Scoperto generando
 *  davvero l'output dopo aver rimosso lo shoulder press fisso da Push (sez. feedback utente
 *  19/08): senza questa eccezione una carenza front_delts spariva sempre. */
const MUSCOLI_SENZA_ISOLAMENTO = new Set<Muscle>(['front_delts'])

/**
 * Ordine di esecuzione, separato dalla scelta casuale della variante.
 * I multiarticolari tecnici vengono eseguiti da freschi; negli accessori si
 * alternano i distretti per non accumulare inutilmente fatica locale.
 */
function ordinaSlot(split: Split, slots: SlotDef[]): SlotDef[] {
  const lowerBody = split === 'legs' || split === 'lower' || split === 'bro_legs'
  const rank = (slot: SlotDef): number => {
    if (slot.order !== undefined) return slot.order
    if (split === 'legs') {
      // PPL Standard Biomeccanico a 6 Slot (sez. spec utente 19/08): niente più composto
      // femorali fisso qui (i 2 composti sono entrambi quad-dominanti), glutei (hip
      // thrust/stacco rumeno) chiude la catena posteriore DOPO le due isolamenti, non subito
      // dopo i composti come nel vecchio schema (ancora valido per lower/bro_legs sotto).
      if (slot.compound && slot.muscle === 'quads') return 0
      if (!slot.compound && slot.muscle === 'quads') return 1
      if (!slot.compound && slot.muscle === 'hamstrings') return 2
      if (slot.muscle === 'glutes') return 3
      if (slot.muscle === 'calves') return 4
      return 5
    }
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
      // Una carenza spalle (fronte/laterale/post.) va lavorata a freschi, sez. Lagging Muscle
      // Engine — vale anche per un front_delts composto aggiunto SOLO se dichiarato carenza
      // (il default push non lo ha più fisso, sez. feedback utente 19/08).
      if (slot.weakPoint && SHOULDER_MUSCLES.includes(slot.muscle)) return 1
      if (!slot.compound && slot.muscle === 'lateral_delts') return 2
      if (slot.compound && slot.muscle === 'triceps') return 3
      if (!slot.compound && slot.muscle === 'chest') return 4
      if (slot.muscle === 'rear_delts') return 5
      if (slot.muscle === 'biceps') return 6
      if (slot.muscle === 'triceps') return 7
      return 8
    }
    if (split === 'pull') {
      // PPL Standard Biomeccanico a 6 Slot (sez. spec utente 19/08): 3 composti dorso (angoli
      // diversi, ordine preservato dall'array — verticale, orizzontale 45°, orizzontale basso),
      // poi rear delt, poi tricipiti (capo laterale/mediale, cuscinetto) PRIMA dei bicipiti
      // (capo breve) — a differenza di bro_back/back_body sotto, che non hanno un tricipiti
      // fisso e restano quindi sul vecchio ordine.
      if (slot.compound && slot.muscle === 'back') return 0
      if (slot.weakPoint && slot.muscle === 'rear_delts') return 1
      if (slot.muscle === 'rear_delts') return 2
      if (slot.muscle === 'triceps') return 3
      if (slot.muscle === 'biceps') return 4
      return 5
    }
    if (split === 'bro_back' || split === 'back_body') {
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

/** Ogni porzione carente della spalla resta distinta: anteriore, laterale e posteriore. */
function requisitiCarenze(priority: Muscle[]): Muscle[] {
  return [...new Set(priority)]
}

/**
 * Riserva le priorità assegnate senza mai duplicare un muscolo già coperto dallo split (sez.
 * feedback utente 19/08: "se c'è già un esercizio di default che colpisce la carenza non ne
 * mette un altro simile") e senza mai ridurre il muscolo identitario dello split (petto per
 * Push, dorso per Pull, ecc.) sotto la sua dotazione standard — lo standard resta sempre la
 * base, le carenze lo integrano senza smontarlo. Una carenza assente dallo split SOSTITUISCE
 * uno slot esistente invece di allungare la sessione oltre sei esercizi: si sacrifica prima un
 * muscolo ripetuto più volte (ridondante), MAI l'identitario finché esiste un'alternativa (anche
 * a costo di lasciare fuori la carenza in eccesso — la settimana la richiama altrove), e si
 * conserva il ruolo (composto/isolamento) dello slot sostituito.
 */
function applicaPrioritaAssegnate(base: SlotDef[], priority: Muscle[]): { slots: SlotDef[]; requirements: Muscle[] } {
  // Massimo 3 carenze dedicate per sessione, sempre — anche quando l'utente ne dichiara di più
  // (sez. feedback utente 19/08): concentrarne 4-5 in un solo giorno è esattamente il problema
  // segnalato. Le carenze in eccesso restano fuori da oggi: la settimana le richiama altrove
  // (weeklyPlan.ts), invece di sovraccaricare questa sessione.
  const requirements = requisitiCarenze(priority).slice(0, 3)
  const slots = base.map((slot) => ({ ...slot }))
  const represented = new Set<Muscle>()
  for (const requirement of requirements) {
    const existing = slots.find((slot) => slot.muscle === requirement && !slot.weakPoint)
    if (existing) { existing.weakPoint = true; represented.add(requirement) }
  }
  const missing = requirements.filter((muscle) => !represented.has(muscle))
  const identitario = base[0]?.muscle
  for (const muscle of missing) {
    // Le spalle (fronte/laterale/post.) non superano mai 2 esercizi in una seduta (sez.
    // feedback utente 19/08: "non devi rimuovere bicipiti per fare spazio ai deltoidi se già ci
    // sono 2 esercizi di deltoidi") — una 3ª carenza spalle resta fuori da oggi invece di
    // sacrificare un muscolo non ridondante come i bicipiti. Il richiamo settimanale
    // (weeklyPlan.ts) può comunque darle spazio in un altro giorno compatibile.
    if (SHOULDER_MUSCLES.includes(muscle) && slots.filter((slot) => SHOULDER_MUSCLES.includes(slot.muscle)).length >= 2) continue
    if (slots.length < 6) {
      const compoundCount = slots.filter((slot) => slot.compound).length
      const compound = (MUSCOLI_SENZA_ISOLAMENTO.has(muscle) || compoundCount < 2) && COMPOUND_CAPABLE_MUSCLES.has(muscle)
      slots.push({ muscle, compound, weakPoint: true })
      continue
    }
    const conteggio = new Map<Muscle, number>()
    for (const slot of slots) conteggio.set(slot.muscle, (conteggio.get(slot.muscle) ?? 0) + 1)
    const sacrificabili = slots
      .map((slot, index) => ({ slot, index, copie: conteggio.get(slot.muscle) ?? 1 }))
      .filter(({ slot }) => !slot.weakPoint)
    // L'identitario si tocca solo come ultima risorsa, quando è l'unico muscolo rimasto non
    // ancora carenza (split mono-muscolo come Bro Petto): altrimenti resta sempre alla sua
    // dotazione standard, per quanto affollata sia la sessione di carenze.
    const nonIdentitario = sacrificabili.filter(({ slot }) => slot.muscle !== identitario)
    const soloIdentitarioResta = nonIdentitario.length === 0
    const candidati = (soloIdentitarioResta ? sacrificabili : nonIdentitario).sort((a, b) => {
      if (a.copie !== b.copie) return b.copie - a.copie
      // Il tie-break composto/isolamento conta solo quando non resta altro che l'identitario
      // (Bro Petto): la sessione apre sempre con un compound anche lì (sez. 3, 21), senza questa
      // preferenza l'ordine naturale degli slot (compound prima nella struttura base) faceva
      // sacrificare proprio i compound per primi. Nel caso normale (più muscoli distinti in
      // gioco) non c'è invece motivo di preferire un isolamento a un compound qualsiasi: conta
      // solo la ridondanza già valutata sopra.
      return soloIdentitarioResta ? (a.slot.compound ? 1 : 0) - (b.slot.compound ? 1 : 0) : 0
    })
    const bersaglio = candidati[0]
    // Nessuno slot sacrificabile: questa carenza in eccesso resta fuori da oggi, non smonta lo
    // split. Il richiamo settimanale (weeklyPlan.ts) può comunque darle spazio in un altro
    // giorno compatibile.
    if (!bersaglio) continue
    // Conserva il ruolo dello slot sostituito (composto per composto, isolamento per isolamento,
    // come chiesto) solo se il muscolo carente lo supporta davvero: bicipiti/tricipiti/deltoidi
    // non hanno varianti "composte" nel catalogo, quindi uno slot composto per loro resterebbe
    // vuoto (nessun candidato) invece di ripiegare su un isolamento.
    const compound = (MUSCOLI_SENZA_ISOLAMENTO.has(muscle) || bersaglio.slot.compound) && COMPOUND_CAPABLE_MUSCLES.has(muscle)
    slots[bersaglio.index] = { muscle, compound, weakPoint: true }
  }
  return { slots, requirements }
}

function buildCustomTargetSlots(targets: Muscle[], priority: Muscle[]): SlotDef[] {
  const desiredSlots = 6
  const orderedTargets = [...new Set(targets)]
  if (orderedTargets.length === 0) return []
  const priorityTargets = orderedTargets.filter((muscle) => priority.includes(muscle))
  const nonPriorityTargets = orderedTargets.filter((muscle) => !priority.includes(muscle))
  const selectedTargets = [...nonPriorityTargets, ...priorityTargets]
    .slice(0, desiredSlots)
  let compounds = 0
  const slots = selectedTargets.map((muscle, index): SlotDef => {
    const compound = compounds < 2 && COMPOUND_CAPABLE_MUSCLES.has(muscle)
    if (compound) compounds++
    return { muscle, compound, weakPoint: priority.includes(muscle), order: compound ? index : 10 + index }
  })
  let refill = 0
  while (slots.length < desiredSlots) {
    const muscle = priorityTargets[refill % Math.max(1, priorityTargets.length)] ?? orderedTargets[refill % orderedTargets.length]
    slots.push({ muscle, compound: false, weakPoint: priority.includes(muscle), order: 20 + refill })
    refill++
  }
  return slots
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
  const priorities = cfg.priority_muscles ?? []
  const customTargets = cfg.target_muscles?.length ? [...new Set(cfg.target_muscles)] : []
  const pool = customTargets.length > 0 ? customTargets : SPLIT_MUSCLE_POOL[cfg.split]
  const base = BASE_SLOTS[cfg.split]
  const structured = customTargets.length > 0
    ? { slots: buildCustomTargetSlots(customTargets, priorities), requirements: customTargets }
    : applicaPrioritaAssegnate(base, priorities)
  const baseSlot = structured.slots
  // FST-7 vuole ESATTAMENTE 3 esercizi base (il 7° arriva a parte): a differenza degli altri
  // protocolli, qui il target non può salire per via dei 5 slot fissi dello split (baseSlot
  // ne ha sempre almeno 5), altrimenti il ciclo di completamento più sotto ne aggiunge fino a 5.
  // Top Set & Back-Off vuole al massimo 5 esercizi base: da quando Push/Pull/Legs hanno sempre
  // 6 slot fissi (standard PPL a 6 slot, sez. spec utente 19/08 pomeriggio), senza questo tetto
  // l'espansione CBum (x4 voci) partirebbe da 6 invece che da 5, sforando sempre il budget di
  // tempo (24 voci tracciate, mai adattabili a una durata ragionevole).
  const target = cfg.protocol === 'fst7'
    ? 3
    : cfg.protocol === 'cbum_top_backoff'
      ? Math.min(targetEsercizi(cfg.protocol), baseSlot.length)
      : Math.max(targetEsercizi(cfg.protocol), baseSlot.length)

  // 6. Sesto slot: prima le priorità assegnate dalla settimana, poi l'extra dello split.
  const extraSlot: SlotDef[] = []
  if (customTargets.length === 0) {
    for (const s of EXTRA_SLOTS[cfg.split]) {
      if (baseSlot.length + extraSlot.length >= target) break
      extraSlot.push(s)
    }
  }
  // FST-7 vuole solo 3 esercizi base (il 7° arriva a parte, sez. protocollo sotto), CBum al
  // massimo 5: tronca dopo l'ordinamento, così restano gli N a priorità più alta (compound e
  // carenze in testa), non i primi N dichiarati nello split.
  const slotOrdinato = ordinaSlot(cfg.split, [...baseSlot, ...extraSlot])
  const slot = cfg.protocol === 'fst7'
    ? slotOrdinato.slice(0, 3)
    : cfg.protocol === 'cbum_top_backoff'
      ? slotOrdinato.slice(0, targetEsercizi(cfg.protocol))
      : slotOrdinato

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
    const strictCustomTarget = customTargets.length > 0
    const musclesDaProvare = strictCustomTarget
      ? [s.muscle]
      : cfg.split === 'bro_chest'
      ? ['chest' as Muscle]
      : [s.muscle, ...(!isRichiamo ? pool.filter((m) => m !== s.muscle) : [])]

    let scelto: Exercise | undefined
    let muscoloUsato: Muscle = s.muscle

    for (const m of musclesDaProvare) {
      let candidati = allenamento
        .filter((e) => !usati.has(e.id))
        .filter((e) => e.primary_muscles.includes(m))
        .filter((e) => patternCoerente(e, m))
        .filter((e) => e.roles.includes(s.compound ? 'compound' : 'isolation'))
        // Fatica di presa (sez. 32): si escludono solo gli esercizi MOLTO esigenti
        // quando la presa è già carica, non l'intero pool dopo due tirate.
        .filter((e) => !(e.grip_fatigue >= 3 && faticaPresa >= 6))
        // Niente movimenti tecnici quando la stanchezza rende la tecnica inaffidabile (sez. 33)
        .filter((e) => !(faticaSistemica >= 8 && e.technical_complexity >= 3))

      // Rotazione per porzione (sez. Lagging Muscle Engine): un richiamo bicipiti/tricipiti
      // preferisce il capo assegnato a questa seduta (weeklyPlan.ts la ruota fra le sedute
      // della settimana; senza programma settimanale, sez. sessione singola, si usa 'long_head'
      // come primo colpo, il più efficace in singola esposizione). Se nessun esercizio del pool
      // ha ancora quel tag, si torna al pool intero: mai far fallire lo slot per questo.
      if (isRichiamo && PORZIONE_ROTABILE.has(m)) {
        const porzione: FocusPortion = cfg.priority_portions?.[m] ?? 'long_head'
        const conPorzione = candidati.filter((e) => e.focus_portion === porzione)
        if (conPorzione.length > 0) candidati = conPorzione
      } else if (s.preferredPortion && PORZIONE_ROTABILE.has(m)) {
        // Standard PPL a 6 slot (sez. spec utente 19/08): gli slot fissi bicipiti/tricipiti di
        // Push e Pull hanno un angolo di default (es. capo lungo in allungamento su Push, capo
        // breve in accorciamento su Pull) per allenare l'intero range del muscolo nelle due
        // sedute settimanali — non è una carenza, quindi non passa dal ramo sopra.
        const conPorzione = candidati.filter((e) => e.focus_portion === s.preferredPortion)
        if (conPorzione.length > 0) candidati = conPorzione
      }

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

    const pBase = cfg.protocol === 'fst7'
      ? prescrizioneFst7Base(s.compound, cfg.experience, cfg.intensity)
      : prescrizione(cfg.goal, s.compound, cfg.experience, cfg.intensity)
    const p = s.maxSets && cfg.protocol !== 'fst7' ? { ...pBase, sets: Math.min(pBase.sets, s.maxSets) } : pBase
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

  // Se uno slot molto specifico non è disponibile, completa comunque il
  // minimo con un isolamento sicuro e coerente con i muscoli dello split.
  while (scelti.length < Math.min(target, 6)) {
    const fallback = allenamento.find((exercise) =>
      !usati.has(exercise.id) && exercise.roles.includes('isolation') &&
      exercise.technical_complexity <= 2 &&
      exercise.primary_muscles.some((muscle) => pool.includes(muscle))
    )
    if (!fallback) break
    const muscle = fallback.primary_muscles.find((item) => pool.includes(item)) ?? fallback.primary_muscles[0]
    const p = prescrizione(cfg.goal, false, cfg.experience, cfg.intensity)
    usati.add(fallback.id)
    scelti.push({
      exercise_id: fallback.id, name: fallback.name, role: 'isolation', muscle: muscle ?? null,
      sets: p.sets, reps: p.reps, rest_sec: p.rest, note: 'completamento sessione',
      instructions: fallback.instructions || undefined,
    })
  }

  // 7b. Sequenziamento per fatica/sinergie (sez. Lagging Muscle Engine, Step 5): rifinisce
  // l'ordine appena costruito, non lo ricostruisce — vedi shared.ts.
  riordinaPerSinergie(scelti, new Map(allenamento.map((exercise) => [exercise.id, exercise])))

  // 7c. Protocollo FST-7 (Hany Rambod): un 4° esercizio, esattamente 7 serie x 10-12 rep,
  // recupero fisso 30s, solo cavi/macchine/isolamenti puri (mai un bilanciere pesante — sez.
  // isFst7FinisherEligible). In coda di default; in testa se fst7_preloading (mind-muscle
  // connection su muscolo carente, prima che la sessione affatichi altro).
  if (cfg.protocol === 'fst7') {
    const muscoloIdentitario = base[0]?.muscle ?? pool[0]
    const candidatiFinisher = allenamento
      .filter((e) => !usati.has(e.id) && isFst7FinisherEligible(e))
      .filter((e) => e.primary_muscles.includes(muscoloIdentitario))
    const poolFinisher = candidatiFinisher.length > 0
      ? candidatiFinisher
      : allenamento.filter((e) => !usati.has(e.id) && isFst7FinisherEligible(e) && e.primary_muscles.some((m) => pool.includes(m)))
    const finisher = poolFinisher[Math.floor(random() * poolFinisher.length)]
    if (finisher) {
      usati.add(finisher.id)
      const voceFinisher: PrescribedExercise = {
        exercise_id: finisher.id, name: finisher.name, role: 'isolation',
        muscle: finisher.primary_muscles.find((m) => pool.includes(m)) ?? finisher.primary_muscles[0] ?? null,
        sets: 7, reps: '10-12', rest_sec: 30, note: 'fst7_finisher',
        instructions: finisher.instructions || undefined,
      }
      if (cfg.fst7_preloading) scelti.unshift(voceFinisher)
      else scelti.push(voceFinisher)
    } else {
      warnings.push('Nessun esercizio a cavi/macchine/isolamento disponibile per il blocco FST-7 da 7 serie con questa attrezzatura.')
    }
  }

  // 7d. Protocollo Top Set & Back-Off (stile CBum): ogni esercizio scelto sopra diventa quattro
  // serie tracciate separate — 2x Avvicinamento a carico crescente, poi Top Set a cedimento
  // (1x6-8 @ RIR0) e Back-Off (1x10-12 @ RIR0) subito dopo. Il carico non è calcolabile (nessun
  // peso registrato da nessuna parte dell'app): resta un'indicazione testuale mostrata in UI
  // (WorkoutPreview/Runner).
  const cbumBaseCount = scelti.length
  if (cfg.protocol === 'cbum_top_backoff') {
    const cbum = prescrizioneCbum(cfg.intensity)
    const espansi = scelti.flatMap((voce): PrescribedExercise[] => [
      { ...voce, sets: cbum.avvicinamento[0].sets, reps: cbum.avvicinamento[0].reps, rest_sec: cbum.avvicinamento[0].rest, note: 'avvicinamento' },
      { ...voce, sets: cbum.avvicinamento[1].sets, reps: cbum.avvicinamento[1].reps, rest_sec: cbum.avvicinamento[1].rest, note: 'avvicinamento' },
      { ...voce, sets: cbum.topSet.sets, reps: cbum.topSet.reps, rest_sec: cbum.topSet.rest, note: 'top_set' },
      { ...voce, sets: cbum.backOff.sets, reps: cbum.backOff.reps, rest_sec: cbum.backOff.rest, note: 'back_off' },
    ])
    scelti.length = 0
    scelti.push(...espansi)
  }

  // 8. Adattamento al tempo: si riducono prima i recuperi, poi le serie
  // (mai sotto il minimo) senza eliminare slot (sez. 3, 23).
  const minutiRiscaldamento = cfg.duration_min >= 45 ? 9 : 6
  const budget = cfg.duration_min - minutiRiscaldamento
  adattaAlTempo(scelti, budget)

  // 9. Validatore di sicurezza finale (sez. 22, 40): corregge, non si limita a segnalare.
  rimuoviDuplicati(scelti)
  // Il preloading FST-7 vuole di proposito il blocco da 7 serie in apertura (mind-muscle
  // connection a freddo): non va scavalcato dal compound come farebbe di norma.
  const preserveWeakPointLead = (customTargets.length > 0 && scelti[0]?.note === 'carenza') ||
    (cfg.protocol === 'fst7' && cfg.fst7_preloading)
  if (!preserveWeakPointLead && !portaCompoundInApertura(scelti)) warnings.push('Nessun esercizio multiarticolare disponibile con questa attrezzatura.')
  // FST-7 (3 base + 1 finisher) e Top Set & Back-Off (4-5 esercizi, moltiplicati x4: 2
  // avvicinamento + top set + back-off) non seguono il minimo di 6 esercizi dello split
  // standard: il conteggio atteso è diverso per costruzione, non un segnale di attrezzatura
  // insufficiente. cbumBaseCount è il numero di esercizi scelti PRIMA dell'espansione.
  const minimoAtteso = cfg.protocol === 'fst7' ? 4 : cfg.protocol === 'cbum_top_backoff' ? cbumBaseCount * 4 : 6
  if (scelti.length < minimoAtteso) {
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
 * compound). Il numero di esercizi non viene ridotto: il minimo è sei.
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
  // isLaggingNote riconosce 'carenza'/'richiamo carenza' (note di bodybuilding.ts) oltre a
  // 'richiamo' (note di strength.ts): prima di questo il confronto letterale con 'richiamo'
  // non scattava mai qui, quindi i richiami carenza di bodybuilding erano trattati come un
  // isolamento qualsiasi invece che come i primi da tagliare a corto di tempo.
  iter = 0
  while (sforo() > 0 && iter++ < 50) {
    const riducibile = [...scelti]
      .sort((a, b) => {
        const pa = isLaggingNote(a.note) ? 0 : a.role === 'isolation' ? 1 : 2
        const pb = isLaggingNote(b.note) ? 0 : b.role === 'isolation' ? 1 : 2
        return pa - pb
      })
      // Il blocco FST-7 è esattamente 7 serie per contratto di protocollo: non va
      // eroso dal budget di tempo come un normale isolamento in eccesso.
      .filter((e) => e.note !== 'fst7_finisher')
      .find((e) => e.sets > serieMinime(e.role === 'compound'))
    if (!riducibile) break
    riducibile.sets -= 1
  }

}
