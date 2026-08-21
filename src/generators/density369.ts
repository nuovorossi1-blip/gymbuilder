/**
 * Motore di generazione "Metodo 3-6-9 Density Tri-Set" (Bodybuilding).
 *
 * Specifica fornita da Rossi il 21/08: due blocchi (A, B) sequenziali, ognuno
 * un tri-set continuo di 3 stazioni con ruolo biomeccanico e range di
 * ripetizioni fissi (non legati a obiettivo/esperienza come il resto del
 * motore bodybuilding standard):
 *   Stazione 1 — Forza Neurale: 3-6 rep, RPE 8 (RIR 1-2)
 *   Stazione 2 — Ipertrofia Meccanica: 6-12 rep, RPE 9
 *   Stazione 3 — Stress Metabolico: 9-25 rep, RPE 10/cedimento
 *
 * Scelta dell'esercizio DETERMINISTICA, non casuale (corretto il 21/08 dopo
 * feedback di Rossi: "gli esercizi sono sempre gli stessi" per un dato
 * split — non una scelta automatica diversa ogni volta come nel resto del
 * motore bodybuilding). Ogni pool in POOL è ordinato: il primo elemento è
 * il default (l'esercizio della specifica originale dove esiste a
 * catalogo), sempre quello scelto a parità di attrezzatura/esclusioni. Un
 * preferito dell'utente fra i candidati compatibili vince sul default. Le
 * alternative restanti del pool sono esposte su ogni DensityStation
 * (`alternatives`) per la sostituzione manuale — stesso concetto di
 * "Sostituisci" già nel resto dell'app, non ancora la stessa interfaccia.
 *
 * Fase 1 (concordata con Rossi il 21/08): SOLO modello dati + generatore,
 * testabile senza toccare Runner/UI. Il motore di esecuzione a circuito nel
 * Runner (giri dal vivo, i tre tipi di recupero) è stato fatto in una fase
 * successiva (Fase 2, DensityRunner.tsx) — vedi AIOS_STATE.md.
 *
 * Split coperti: PPL, Upper/Lower, Bro Chest/Back/Arms/Legs, Front/Back —
 * vedi TEMPLATE più sotto per l'elenco preciso e cosa manca.
 *
 * Nota sulla riconciliazione fra i documenti di Rossi (21/08, più versioni
 * nel tempo): la tabella di sostituzione per distretto muscolare (la più
 * dettagliata, con le 3 colonne Stazione 1/2/3) è stata presa come fonte
 * autorevole per "quale esercizio appartiene a quale stazione". I template
 * letterali per split (i vari documenti di specifica) sono serviti solo per
 * "quale distretto/stazione va in quale blocco". Dove un documento indicava
 * una stazione diversa per lo stesso esercizio rispetto alla tabella — es.
 * "Rematore con Bilanciere" proposto come opzione Pull Blocco A Stazione 2
 * (6-12 rep) ma classificato Stazione 1 (3-6 rep) nella tabella — ho scelto
 * l'alternativa coerente con la tabella (qui: "Lat Machine"), invece di
 * indovinare quale fonte avesse la precedenza.
 *
 * Non ancora verificato in un browser reale (stesso limite di sempre in
 * questo ambiente): solo test automatici, vedi density369.test.ts.
 */

import type { Equipment, EquipmentItem, Exercise, GeneratedWorkout, Muscle, PrescribedExercise } from '../types'
import { isExerciseAvailable } from './equipment'

export type DensitySplit =
  | 'push' | 'pull' | 'legs' | 'upper' | 'lower'
  | 'bro_chest' | 'bro_back' | 'bro_arms' | 'bro_legs'
  | 'front_body' | 'back_body'

export interface DensityStation {
  role: 1 | 2 | 3
  exercise_id: string
  name: string
  muscle: Muscle
  reps: string
  /** Altri esercizi validi per questa stessa stazione (stesso ruolo biomeccanico, stessa
   *  attrezzatura disponibile, non ancora scelti altrove nella sessione) — per la sostituzione
   *  manuale. L'esercizio di default (`exercise_id` sopra) non compare qui. Vuoto se il pool
   *  aveva un solo candidato disponibile. */
  alternatives: { exercise_id: string; name: string }[]
  /** Peso usato dall'utente per questa stazione (kg), inserito a mano durante l'allenamento —
   *  stesso campo/stesso significato di PrescribedExercise.logged_weight_kg nel resto
   *  dell'app, mai calcolato dal motore. */
  logged_weight_kg?: number
}

export interface DensityBlock {
  label: 'A' | 'B'
  rounds: number
  /** Recupero a fine giro (dopo la stazione 3), prima del giro successivo — o, per l'ultimo
   *  giro del Blocco A, prima della transizione al Blocco B (block_transition_rest_sec del
   *  workout, non di questo blocco). */
  round_rest_sec: number
  stations: DensityStation[]
}

export interface Density369Workout {
  name: string
  split: DensitySplit
  /** Recupero fra la fine dell'ultimo giro del Blocco A e l'inizio del Blocco B: 180-240s per
   *  spec, qui il punto medio dichiarato. */
  block_transition_rest_sec: number
  blocks: DensityBlock[]
  estimated_duration_min: number
}

export interface Density369Config {
  split: DensitySplit
  equipment: Equipment
  available_equipment?: EquipmentItem[] | null
  excluded_exercises: string[]
  preferred_exercises?: string[]
  /** Default 3, massimo 4 per spec (Blocco A). */
  rounds_a?: number
  /** Default 3 (Blocco B). */
  rounds_b?: number
}

const REPS_PER_STAZIONE: Record<1 | 2 | 3, string> = { 1: '3-6', 2: '6-12', 3: '9-25' }
const ROUND_REST_A_SEC = 180
const ROUND_REST_B_SEC = 120
const BLOCK_TRANSITION_REST_SEC = 210 // 180-240s per spec, punto medio dichiarato
const TEMPO_LAVORO_STAZIONE_SEC = 40 // stessa stima media usata da minutiEsercizio in shared.ts

/** Distretto muscolare della tabella di sostituzione di Rossi — non coincide 1:1 con Muscle
 *  del catalogo: es. "Spalle" copre sia front_delts (military press) sia lateral_delts
 *  (alzate laterali) a seconda della stazione, come nella tabella originale. */
type Distretto =
  | 'petto' | 'spalle' | 'tricipiti' | 'dorso_larghezza' | 'dorso_spessore'
  | 'bicipiti' | 'quadricipiti' | 'catena_posteriore' | 'polpacci_core'

/**
 * Pool per distretto+stazione — verificati uno per uno contro il catalogo reale di Supabase
 * (21/08, non la fixture di test). Alcuni esercizi citati da Rossi nella tabella non esistono
 * ancora a catalogo (es. Arnold Press, Push Press, Seal Row, Sissy Squat, Spider Curl — lista
 * completa in TODO.md "arricchimento catalogo Density 3-6-9"): qui compaiono solo quelli
 * verificati esistenti, non un sottoinsieme scelto a caso.
 *
 * Le due eccezioni esplicite alla Regola 1 di Rossi ("mai una macchina alla Stazione 1") sono
 * incluse di proposito — è la spec stessa a nominarle come alternativa quando mancano i pesi
 * liberi: "Chest Press convergente" (petto) e "Leg Press" (quadricipiti).
 */
const POOL: Record<Distretto, Record<1 | 2 | 3, string[]>> = {
  petto: {
    1: ['panca_piana', 'panca_piana_man', 'chest_press_convergente'],
    // dip_parallele NON va qui: è l'unico candidato verificato per tricipiti[1] in questo
    // split (Panca Presa Stretta/JM Press non esistono ancora a catalogo — vedi TODO.md). Se
    // Petto lo prendesse per la Stazione 2, Tricipiti Stazione 1 resterebbe senza candidati
    // nello stesso Push (bug trovato dai test il 21/08, prima del push).
    2: ['panca_inclinata_man'],
    3: ['croci_cavi', 'pec_deck', 'piegamenti'],
  },
  spalle: {
    1: ['military_press'],
    2: ['shoulder_press_man'],
    3: ['alzate_laterali', 'alzate_laterali_cavo', 'alzate_laterali_macchina', 'alzate_laterali_elastico'],
  },
  tricipiti: {
    1: ['dip_parallele'],
    2: ['french_press', 'dip_panca'],
    3: ['pushdown', 'estensione_tricipiti_cavo_alto', 'estensioni_sopra_testa'],
  },
  dorso_larghezza: {
    1: ['trazioni', 'trazioni_supine', 'chest_to_bar'],
    2: ['lat_machine', 'lat_machine_neutra', 'pullup_assisted'],
    3: ['pullover_cavo', 'pulldown_unilaterale'],
  },
  dorso_spessore: {
    1: ['stacco', 'rematore_bil', 't_bar_row'],
    2: ['rematore_man', 'pulley'],
    3: ['face_pull', 'alzate_90', 'reverse_pec_deck'],
  },
  bicipiti: {
    1: ['trazioni_supine', 'curl_bilanciere'],
    2: ['curl_martello', 'curl_inclinata_man', 'curl_panca_scott', 'preacher_curl_macchina'],
    3: ['curl_cavo', 'bayesian_curl'],
  },
  quadricipiti: {
    1: ['squat', 'front_squat', 'leg_press'],
    2: ['hack_squat', 'affondi_man', 'affondi_libero', 'bulgarian_split'],
    3: ['leg_extension', 'leg_extension_unilaterale'],
  },
  catena_posteriore: {
    1: ['stacco_rumeno', 'single_leg_rdl', 'stacco_rumeno_man'],
    2: ['good_morning_bil', 'leg_curl', 'leg_curl_seduto'],
    3: ['leg_curl', 'leg_curl_seduto', 'glute_bridge'],
  },
  // Usato solo da Legs Blocco B Stazione 3 in questa fase (vedi TEMPLATE): le stazioni 1/2
  // restano definite per completezza futura ma non sono ancora raggiungibili da nessun split.
  polpacci_core: {
    1: ['calf_in_piedi'],
    2: ['calf_seduto'],
    3: ['calf_libero', 'calf_manubri', 'calf_leg_press', 'crunch_cavo', 'plank'],
  },
}

/**
 * Quale distretto va in quale stazione di quale blocco, per split — sez. 4A/B/C/D della
 * specifica, riconciliata con la tabella di sostituzione (vedi nota in testa al file). Coperti
 * oggi (21/08, seconda estensione): PPL, Upper/Lower, i 4 Bro Split che il catalogo può
 * supportare bene, Front/Back. **Non coperto**: `bro_shoulders` (Spalle da sola) — nessun
 * esercizio a catalogo fa da "composto pesante" per i deltoidi posteriori, la Stazione 1
 * risulterebbe sempre una macchina/cavo (viola la Regola 1 di Rossi), quindi niente template
 * finché non si arricchisce il catalogo — vedi TODO.md. `full_body` non è mai stato richiesto
 * per questo protocollo, resta fuori.
 *
 * Alcune scelte non sono "quello che dice la lettera della spec", ma il pool corretto per la
 * stazione secondo la tabella di sostituzione — stesso motivo già spiegato per Pull Blocco A
 * Stazione 2 (Rematore con Bilanciere è Stazione 1 nella tabella, non Stazione 2: dove capita
 * di nuovo — Upper Blocco A St2, Front/Back — si usa il pool giusto per quella stazione dello
 * stesso distretto, non l'esercizio letterale). La spec descrive due superset (Upper Blocco B
 * St3 "Pushdown + Curl") che questo motore non modella (una stazione = un esercizio): ridotti a
 * un solo esercizio, non un errore silenzioso — segnalato qui e in TODO.md.
 */
const TEMPLATE: Record<DensitySplit, { a: Distretto[]; b: Distretto[] }> = {
  push: { a: ['petto', 'petto', 'spalle'], b: ['tricipiti', 'spalle', 'tricipiti'] },
  pull: { a: ['dorso_larghezza', 'dorso_larghezza', 'dorso_spessore'], b: ['bicipiti', 'dorso_spessore', 'bicipiti'] },
  legs: { a: ['quadricipiti', 'quadricipiti', 'quadricipiti'], b: ['catena_posteriore', 'catena_posteriore', 'polpacci_core'] },
  // Lower e la giornata Gambe del Bro Split condividono lo stesso identico obiettivo di un Legs
  // PPL: stessa struttura, non serve un template diverso.
  lower: { a: ['quadricipiti', 'quadricipiti', 'quadricipiti'], b: ['catena_posteriore', 'catena_posteriore', 'polpacci_core'] },
  bro_legs: { a: ['quadricipiti', 'quadricipiti', 'quadricipiti'], b: ['catena_posteriore', 'catena_posteriore', 'polpacci_core'] },
  upper: { a: ['petto', 'dorso_spessore', 'spalle'], b: ['spalle', 'dorso_larghezza', 'tricipiti'] },
  // Giornata di un solo distretto (non in coppia con un altro come nel Push/Pull PPL): entrambi
  // i blocchi restano sullo stesso muscolo, sfruttando le due metà del pool (composto+accessorio
  // nel Blocco A, isolamento dedicato nel Blocco B) invece di dividerlo fra due muscoli diversi.
  bro_chest: { a: ['petto', 'petto', 'spalle'], b: ['tricipiti', 'tricipiti', 'tricipiti'] },
  bro_back: { a: ['dorso_larghezza', 'dorso_larghezza', 'dorso_larghezza'], b: ['dorso_spessore', 'dorso_spessore', 'dorso_spessore'] },
  bro_arms: { a: ['tricipiti', 'tricipiti', 'tricipiti'], b: ['bicipiti', 'bicipiti', 'bicipiti'] },
  front_body: { a: ['quadricipiti', 'petto', 'quadricipiti'], b: ['spalle', 'spalle', 'polpacci_core'] },
  back_body: { a: ['dorso_spessore', 'dorso_spessore', 'dorso_spessore'], b: ['catena_posteriore', 'dorso_spessore', 'bicipiti'] },
}

/** Split per cui questo protocollo ha davvero un template — usarlo per decidere se proporlo
 *  all'utente per lo split scelto, invece di scoprirlo solo al momento della generazione. */
export const DENSITY_SPLIT_SUPPORTATI = Object.keys(TEMPLATE) as DensitySplit[]

const NOME_SPLIT: Record<DensitySplit, string> = {
  push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', lower: 'Lower',
  bro_chest: 'Petto', bro_back: 'Dorso', bro_arms: 'Braccia', bro_legs: 'Gambe',
  front_body: 'Front', back_body: 'Back',
}

interface SceltaEsercizio {
  scelto: Exercise
  alternative: Exercise[]
}

function sceglieEsercizio(
  candidatiId: string[],
  catalogo: Exercise[],
  cfg: Density369Config,
  giaScelti: Set<string>
): SceltaEsercizio | null {
  const preferiti = new Set(cfg.preferred_exercises ?? [])
  // L'ordine di candidatiId (definito in POOL) è quello di preferenza: il primo è il default
  // della specifica dove esiste a catalogo. Filtra senza riordinare — mai un sort qui, è
  // proprio l'assenza di un sort/scelta casuale il punto (vedi nota in testa al file).
  const pool = candidatiId
    .map((id) => catalogo.find((e) => e.id === id))
    .filter((e): e is Exercise => !!e)
    .filter((e) => !cfg.excluded_exercises.includes(e.id))
    .filter((e) => !giaScelti.has(e.id))
    .filter((e) => isExerciseAvailable(e, cfg.equipment, cfg.available_equipment))

  if (pool.length === 0) return null

  // Un preferito dell'utente fra i candidati compatibili vince sul default della specifica —
  // stesso principio già usato nel resto del motore bodybuilding (sez. 10 della correzione).
  const preferito = pool.find((e) => preferiti.has(e.id))
  const scelto = preferito ?? pool[0]
  return { scelto, alternative: pool.filter((e) => e.id !== scelto.id) }
}

function costruisciBlocco(
  label: 'A' | 'B',
  distretti: Distretto[],
  catalogo: Exercise[],
  cfg: Density369Config,
  giaScelti: Set<string>,
  rounds: number,
  roundRestSec: number
): DensityBlock | null {
  const stations: DensityStation[] = []
  for (let i = 0; i < 3; i++) {
    const role = (i + 1) as 1 | 2 | 3
    const candidatiId = POOL[distretti[i]][role]
    const risultato = sceglieEsercizio(candidatiId, catalogo, cfg, giaScelti)
    if (!risultato) return null // attrezzatura/esclusioni non lasciano nessun candidato per questa stazione
    const { scelto, alternative } = risultato
    giaScelti.add(scelto.id)
    stations.push({
      role,
      exercise_id: scelto.id,
      name: scelto.name,
      muscle: scelto.primary_muscles[0],
      reps: REPS_PER_STAZIONE[role],
      alternatives: alternative.map((e) => ({ exercise_id: e.id, name: e.name })),
    })
  }
  return { label, rounds, round_rest_sec: roundRestSec, stations }
}

function stimaDurataMin(blockA: DensityBlock, blockB: DensityBlock): number {
  // Nessun riposo fra le stazioni dello stesso giro (corretto 21/08: si passa dritti da una
  // stazione alla successiva, come AMRAP) — solo tempo di lavoro per giro, più il vero riposo
  // a fine giro fra un giro e il successivo.
  const secondiBlocco = (blocco: DensityBlock) => {
    const secondiPerGiro = blocco.stations.length * TEMPO_LAVORO_STAZIONE_SEC
    return blocco.rounds * secondiPerGiro + (blocco.rounds - 1) * blocco.round_rest_sec
  }
  return Math.round((secondiBlocco(blockA) + secondiBlocco(blockB) + BLOCK_TRANSITION_REST_SEC) / 60)
}

/**
 * Genera una sessione Density Tri-Set 3-6-9 per Push, Pull o Legs.
 * Ritorna null se attrezzatura/esclusioni non lasciano un esercizio disponibile per almeno
 * una stazione — mai un errore tecnico, il chiamante decide come dirlo in italiano semplice.
 */
export function generaDensity369(catalogo: Exercise[], cfg: Density369Config): Density369Workout | null {
  const template = TEMPLATE[cfg.split]
  const giaScelti = new Set<string>()

  const roundsA = Math.min(4, Math.max(1, cfg.rounds_a ?? 3))
  const roundsB = Math.max(1, cfg.rounds_b ?? 3)

  const blockA = costruisciBlocco('A', template.a, catalogo, cfg, giaScelti, roundsA, ROUND_REST_A_SEC)
  if (!blockA) return null
  const blockB = costruisciBlocco('B', template.b, catalogo, cfg, giaScelti, roundsB, ROUND_REST_B_SEC)
  if (!blockB) return null

  return {
    name: `${NOME_SPLIT[cfg.split]} — Density Tri-Set 3-6-9`,
    split: cfg.split,
    block_transition_rest_sec: BLOCK_TRANSITION_REST_SEC,
    blocks: [blockA, blockB],
    estimated_duration_min: stimaDurataMin(blockA, blockB),
  }
}

/**
 * Trasforma un Density369Workout in una forma compatibile col resto dell'app
 * (`GeneratedWorkout`/`PrescribedExercise`, quello che il Runner normale, `WorkoutPreview`, lo
 * storico e il tracciamento del programma settimanale già sanno leggere): un esercizio per
 * stazione, `sets` pari ai giri del blocco (la stazione si ripete quella volta), non un log
 * giro-per-giro — perde il dettaglio del circuito ma resta leggibile senza dover cambiare lo
 * schema del database o la logica esistente altrove. Condivisa fra `DensityRunner.tsx` (al
 * salvataggio in `completed_workouts`) e `Create.tsx` (per segnare un giorno del programma
 * settimanale come generato — 21/08, integrazione col programma settimanale).
 *
 * `durataSec`: la durata reale se il workout è già stato eseguito, altrimenti una stima
 * (`estimated_duration_min * 60`) va bene per un giorno non ancora iniziato — solo per mostrare
 * un numero ragionevole in `duration_min`, mai usata per validare o bloccare nulla.
 */
export function density369ComeGeneratedWorkout(w: Density369Workout, durataSec: number): GeneratedWorkout {
  const esercizi: PrescribedExercise[] = w.blocks.flatMap((blocco) =>
    blocco.stations.map((s): PrescribedExercise => ({
      exercise_id: s.exercise_id,
      name: `${s.name} (Blocco ${blocco.label}, Stazione ${s.role})`,
      role: s.role === 3 ? 'isolation' : 'compound',
      muscle: s.muscle,
      sets: blocco.rounds,
      reps: s.reps,
      // Nessuna pausa fra le stazioni dello stesso giro (corretto 21/08): l'unico riposo reale
      // in questo protocollo è a fine giro, quindi è quello che ha senso registrare qui.
      rest_sec: blocco.round_rest_sec,
      logged_weight_kg: s.logged_weight_kg,
    }))
  )
  return {
    name: w.name,
    mode: 'bodybuilding',
    split: w.split,
    goal: 'hypertrophy',
    experience: 'advanced',
    duration_min: Math.round(durataSec / 60),
    blocks: [{ kind: 'main', title: w.name, exercises: esercizi }],
  } as GeneratedWorkout
}
