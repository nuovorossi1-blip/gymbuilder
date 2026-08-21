// Modello dati di GymBuilder.

export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type Goal = 'hypertrophy' | 'strength' | 'conditioning' | 'mixed'
export type Intensity = 'low' | 'medium' | 'high'
export type Mode = 'bodybuilding' | 'strength' | 'crossfit' | 'crossfit_hybrid' | 'conditioning' | 'tabata'
export type PublicMode = Exclude<Mode, 'conditioning'>
export type Sex = 'female' | 'male' | 'other' | 'unspecified'
export type SplitSystem = 'ppl' | 'upper_lower' | 'bro_split' | 'front_back'
/** Protocollo di esecuzione Bodybuilding: 'standard' è il motore a slot di sempre.
 *  'fst7' e 'cbum_top_backoff' sono varianti di prescrizione sullo stesso motore. */
export type BodybuildingProtocol = 'standard' | 'fst7' | 'cbum_top_backoff' | 'density_369'
export type ExerciseFeedbackReason = 'dislike' | 'unavailable' | 'too_hard' | 'too_easy' | 'discomfort' | 'prefer_other'
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

/**
 * Formato del Metcon. CrossFit Standard usa solo 'amrap' (struttura fissa di
 * classe). Condizionamento (fase 8) lascia scegliere fra i primi sei.
 * 'tabata' è il protocollo fisso 20"/10"×8 del motore Tabata (fase 9), non
 * selezionabile: ha un motore proprio perché la prescrizione è rigida, non
 * una vera scelta di formato come gli altri.
 */
export type MetconFormat = 'amrap' | 'emom' | 'for_time' | 'rounds' | 'circuit' | 'chipper' | 'ladder' | 'intervals' | 'tabata'
export type CrossFitBenchmark = 'custom' | 'cindy' | 'fran' | 'grace' | 'helen'

/** Le due famiglie di comportamento del Runner per i formati Metcon (sez. Runner). */
export const FORMATO_A_INTERVALLI: MetconFormat[] = ['emom', 'intervals', 'tabata']
export const FORMATO_A_GIRI: MetconFormat[] = ['for_time', 'rounds', 'circuit', 'chipper', 'ladder']

export type Equipment =
  | 'full_gym' | 'barbell' | 'dumbbells' | 'machines'
  | 'barbell_dumbbells' | 'barbell_machines' | 'dumbbells_machines'
  | 'home_gym' | 'bodyweight'

export type Muscle =
  | 'chest' | 'back' | 'front_delts' | 'lateral_delts' | 'rear_delts'
  | 'biceps' | 'triceps' | 'forearms' | 'quads' | 'hamstrings' | 'glutes' | 'adductors' | 'calves' | 'core'

/**
 * Porzione/capo di un muscolo che ha una vera sotto-struttura biomeccanica
 * (oggi solo bicipiti e tricipiti: per le spalle la granularità esiste già
 * come Muscle distinti — front/lateral/rear_delts). Usato per lo swap
 * "stesso angolo di lavoro" e per la rotazione settimanale delle carenze.
 */
export type FocusPortion = 'long_head' | 'short_head' | 'brachialis' | 'lateral_head' | 'medial_head'

export type Split =
  | 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body'
  | 'bro_chest' | 'bro_back' | 'bro_shoulders' | 'bro_arms' | 'bro_legs'
  | 'front_body' | 'back_body'

/** Attrezzo di un singolo esercizio, come sta nel database. */
export type Gear = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'cardio'

export type EquipmentItem =
  | 'barbell' | 'dumbbells' | 'machines' | 'cable' | 'kettlebells'
  | 'row_erg' | 'ski_erg' | 'assault_bike' | 'treadmill' | 'jump_rope'
  | 'pullup_bar' | 'parallel_bars' | 'bench' | 'box' | 'resistance_bands'

export type ExerciseCategory =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'kettlebell'
  | 'bodyweight' | 'conditioning' | 'cardio' | 'mobility' | 'olympic' | 'gymnastics'

export type ExerciseType = 'compound' | 'isolation' | 'conditioning' | 'mobility'
export type WorkoutRole = 'warmup' | 'strength' | 'skill' | 'metcon' | 'recovery' | 'hypertrophy'
export type StabilityProfile = 'supported' | 'guided' | 'free'

export interface Exercise {
  id: string
  /** Nome mostrato nell'interfaccia. */
  name: string
  english_name: string
  category: ExerciseCategory
  exercise_types: ExerciseType[]
  workout_roles: WorkoutRole[]
  primary_muscles: Muscle[]
  secondary_muscles: Muscle[]
  /** Solo su un sottoinsieme del catalogo (bicipiti/tricipiti): quale capo lavora di più. */
  focus_portion?: FocusPortion | null
  equipment: Gear
  movement_pattern: string
  min_experience: Experience
  technical_complexity: number
  systemic_fatigue: number
  local_fatigue: number
  grip_fatigue: number
  cardio_demand: number
  /** Metadati interni del motore: non vengono mostrati nella scheda. */
  stability_profile: StabilityProfile
  axial_load: number
  unilateral: boolean
  default_sets: number
  default_reps: string
  default_rest: number
  metcon_safe: boolean
  warmup_relevant: boolean
  description: string
  substitutions: string[]
  required_equipment: EquipmentItem[]
  /** Campo storico usato dai motori attuali; verrà rimosso solo dopo la migrazione completa ai ruoli tipizzati. */
  roles: string[]
  /** Come eseguire il movimento, una riga. */
  instructions: string
}

/** Forma accettata durante la transizione dai record Supabase della prima versione. */
export type ExerciseRecord = Omit<
  Exercise,
  'english_name' | 'category' | 'exercise_types' | 'workout_roles' |
  'metcon_safe' | 'warmup_relevant' | 'description' | 'substitutions' | 'required_equipment' |
  'stability_profile' | 'axial_load' | 'unilateral'
> & Partial<Pick<
  Exercise,
  'english_name' | 'category' | 'exercise_types' | 'workout_roles' |
  'metcon_safe' | 'warmup_relevant' | 'description' | 'substitutions' | 'required_equipment' |
  'stability_profile' | 'axial_load' | 'unilateral'
>>

/** Un esercizio gia' prescritto: serie, ripetizioni e recupero decisi dal motore. */
export interface PrescribedExercise {
  exercise_id: string
  name: string
  role: 'compound' | 'isolation' | 'warmup' | 'metcon'
  muscle: Muscle | null
  sets: number
  reps: string
  rest_sec: number
  note?: string
  instructions?: string
  /** Calorie attive stimate per l'intero esercizio (sez. 60): mai "esatte". */
  est_kcal?: number
}

export interface WorkoutBlock {
  kind: 'warmup' | 'main' | 'metcon'
  title: string
  duration_min?: number
  exercises: PrescribedExercise[]
  /** Solo per kind 'metcon': come si esegue il blocco. */
  format?: MetconFormat
  /** Solo per kind 'metcon' a tempo (amrap/for_time/rounds): tetto di minuti a disposizione. */
  time_cap_min?: number
  /** Solo per kind 'metcon' a giri (emom/rounds/circuit/intervals/tabata): quanti giri/intervalli. */
  rounds?: number
  /** Solo per emom/intervals/tabata: durata in secondi di ciascun intervallo di lavoro. */
  interval_sec?: number
}

export interface GeneratedWorkout {
  name: string
  /** Presente quando il workout appartiene a una seduta di un WeeklyProgram: lega WorkoutPreview
   *  alla seduta da aggiornare (riordino/sostituzione esercizi) quando si salva. Assente per un
   *  workout salvato in Libreria in modo indipendente. */
  session_id?: string
  mode: Mode
  /** Null per CrossFit Standard: non ha uno split per gruppo muscolare, ha Strength/Skill + Metcon. */
  split: Split | null
  goal: Goal
  experience: Experience
  duration_min: number
  /** Limite prudenziale oltre il quale la sessione non dovrebbe andare. */
  max_duration_min?: number
  blocks: WorkoutBlock[]
  warnings: string[]
  /** Calorie attive stimate per l'intera sessione (sez. 60-61): sempre una stima, mai un valore esatto. */
  est_kcal?: number
}

export interface ActiveWorkoutSession {
  id: string
  started_at: number
  updated_at: number
  workout: GeneratedWorkout
  generation_config: WorkoutGenerationConfig | null
}

/** Dati stabili dell'utente. Non contiene preferenze della singola generazione. */
export interface UserProfile {
  id: string
  display_name: string | null
  email: string | null
  weight_kg: number | null
  height_cm: number | null
  age: number | null
  sex: Sex
}

export interface ExercisePreference {
  excluded_exercise_ids: string[]
  preferred_exercise_ids: string[]
}

export interface AdaptiveExercisePreference {
  dislike_score: number
  difficulty_too_high: number
  difficulty_too_low: number
  discomfort: number
  unavailable: number
  permanently_excluded: boolean
  movement_pattern: string
  updated_at: string
}

export interface EquipmentInventory {
  preset: Equipment
  available: EquipmentItem[]
}

/** Configurazione effimera: nasce in Genera e viaggia insieme al workout. */
export interface WorkoutGenerationConfig {
  program_kind?: 'program' | 'single_session'
  duration_weeks?: number
  generator_source?: 'engine' | 'llm'
  llm_provider?: 'deepseek'
  llm_prompt?: string
  mode: PublicMode
  goal: Goal
  split_system?: SplitSystem
  training_days: number
  current_day: Split | null
  experience: Experience
  duration_min: number
  equipment: EquipmentInventory
  weak_points: Muscle[]
  target_muscles?: Muscle[]
  preferences: ExercisePreference
  intensity: Intensity
  workout_format?: MetconFormat
  crossfit_benchmark?: CrossFitBenchmark
  tabata?: { work_sec: number; rest_sec: number; rounds: number; prescription: 'time' | 'reps' }
  /** Solo bodybuilding: FST-7 e Top Set & Back-Off hanno un numero di esercizi
   *  atteso diverso dallo standard — il validatore deve saperlo per non rigettarli. */
  protocol?: BodybuildingProtocol
}

/** Preferenze globali condivise da tutte le sessioni della settimana. */
export interface WeeklyProgramConfig {
  program_kind: 'program' | 'single_session'
  /** Solo i programmi hanno una durata; una sessione singola usa sempre 1. */
  duration_weeks: number
  training_days: number
  selected_modes: PublicMode[]
  goal: Goal
  split_system: SplitSystem
  /** Scelta diretta usata solo dalla sessione singola BB/Forza. */
  single_session_split?: Split
  /** Gruppi muscolari target scelti dall'utente per la sessione singola di oggi. */
  single_session_target_muscles?: Muscle[]
  /** Rapporto fra giornate BB e HY nei programmi che usano entrambe. */
  hybrid_balance?: 'bb_dominant' | 'balanced' | 'hy_dominant'
  strength_method?: '5x5' | '3x5' | 'max_strength' | 'strength_accessories'
  /** Protocollo Bodybuilding, applicato a tutte le sedute BB del programma/sessione. */
  protocol?: BodybuildingProtocol
  /** Solo per protocol 'fst7': sposta il blocco da 7 serie come primo esercizio della sessione. */
  fst7_preloading?: boolean
  hybrid_method?: 'upper_conditioning' | 'lower_conditioning' | 'full_body_functional' | 'specialization'
  hybrid_format?: Extract<MetconFormat, 'amrap' | 'emom' | 'for_time' | 'intervals'>
  experience: Experience
  duration_min: number
  equipment: EquipmentInventory
  weak_points: Muscle[]
  preferences: ExercisePreference
  intensity: Intensity
  crossfit_format: Exclude<MetconFormat, 'circuit' | 'tabata'>
  crossfit_benchmark?: CrossFitBenchmark
  tabata: { work_sec: number; rest_sec: number; rounds: number; prescription: 'time' | 'reps' }
}

export interface WeeklySession {
  id: string
  day: Weekday
  mode: PublicMode
  split: Split | null
  label: string
  estimated_fatigue: 1 | 2 | 3
  muscle_load: Muscle[]
  recovery_profile: RecoveryProfile
  /** Carenze assegnate a questa seduta dal programma, non tutte quelle globali. */
  priority_muscles: Muscle[]
  /** Quale porzione (capo) enfatizzare per una carenza in questa seduta, quando il
   *  muscolo ha una vera sotto-struttura (bicipiti/tricipiti): ruota fra le sedute
   *  della settimana così ogni richiamo lavora un angolo diverso. */
  priority_portions?: Partial<Record<Muscle, FocusPortion>>
  /** Target espliciti scelti dall'utente per una seduta singola guidata per gruppi muscolari. */
  custom_target_muscles?: Muscle[]
  /** Muscoli da non ricaricare con esercizi medio-pesanti il giorno successivo. */
  fatigue_avoid_muscles?: Muscle[]
  /** Formato operativo assegnato dal motore alla singola giornata metabolica. */
  metcon_format?: Exclude<MetconFormat, 'circuit' | 'tabata'>
  /** Alternanza minima per distribuire le priorità nelle ripetizioni dello stesso split. */
  variant: 'A' | 'B'
  /** Workout già compilato da un LLM: se presente la UI lo apre senza rigenerarlo. */
  generated_workout?: GeneratedWorkout
}

export interface RecoveryProfile {
  fatigue_score: number
  muscle_stress: Partial<Record<Muscle, number>>
  cardio_demand: number
  grip_demand: number
  systemic_fatigue: number
  recovery_demand_hours: number
  duration_min: number
  source: 'forecast' | 'generated_workout'
}

export interface WeeklyProgramWarning {
  code: 'consecutive_high_fatigue' | 'muscle_overlap' | 'mode_density' | 'limited_recovery'
  message: string
  day_ids: string[]
}

export interface WeeklyProgram {
  id: string
  persisted: boolean
  config: WeeklyProgramConfig
  week: WeeklySession[]
  warnings: WeeklyProgramWarning[]
}

export interface WorkoutSession {
  id: string
  workout: GeneratedWorkout
  started_at: string
  completed_at: string | null
  elapsed_sec: number
  average_heart_rate: number | null
  estimated_calories: number | null
}

export interface Profile {
  id: string
  display_name: string | null
  weight_kg?: number | null
  height_cm?: number | null
  age?: number | null
  sex?: Sex
}

export interface UserSettings {
  user_id: string
  experience: Experience
  primary_goal: Goal
  training_frequency: number
  default_duration: number
  equipment: Equipment
  /** Null/undefined usa il preset; un array rappresenta l'inventario granulare personalizzato. */
  available_equipment: EquipmentItem[] | null
  priority_muscles: Muscle[]
  excluded_exercises: string[]
  favorite_exercises: string[]
  default_intensity: Intensity
  /** Usato solo per stimare le calorie attive (sez. 60): mai richiesto, mai obbligatorio. */
  weight_kg: number | null
}

export interface SavedWorkout {
  id: string
  name: string
  mode: string
  split: string | null
  goal: string
  experience: string
  duration_min: number
  blocks: WorkoutBlock[]
  favorite: boolean
  created_at: string
  generation_config?: WorkoutGenerationConfig | null
}

export interface CompletedWorkout {
  id: string
  name: string
  mode: Mode
  duration_sec: number
  rating: string | null
  completed_at: string
  blocks: WorkoutBlock[]
}

// --- Etichette in italiano, tenute fuori dai componenti (sez. 87) ---

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  beginner: 'Intermedio',
  intermediate: 'Intermedio',
  advanced: 'Avanzato',
}

export const GOAL_LABELS: Record<Goal, string> = {
  hypertrophy: 'Massa',
  strength: 'Forza',
  conditioning: 'Condizionamento',
  mixed: 'Misto',
}

export const INTENSITY_LABELS: Record<Intensity, string> = {
  low: 'Bassa',
  medium: 'Media',
  high: 'Alta',
}

export const MODE_LABELS: Record<Mode, string> = {
  bodybuilding: 'Bodybuilding',
  strength: 'Forza',
  crossfit: 'CrossFit Standard',
  crossfit_hybrid: 'CrossFit Hybrid',
  conditioning: 'Condizionamento',
  tabata: 'Tabata',
}

export const PUBLIC_MODES: PublicMode[] = ['bodybuilding', 'crossfit', 'crossfit_hybrid', 'strength', 'tabata']

export const SPLIT_SYSTEM_LABELS: Record<SplitSystem, string> = {
  ppl: 'PPL',
  upper_lower: 'Upper / Lower',
  bro_split: 'Bro Split',
  front_back: 'Front / Back',
}

export const BODYBUILDING_PROTOCOL_LABELS: Record<BodybuildingProtocol, string> = {
  standard: 'Standard',
  fst7: 'FST-7 (Hany Rambod)',
  cbum_top_backoff: 'Top Set & Back-Off (CBum)',
  density_369: 'Density Tri-Set 3-6-9',
}


export const METCON_FORMAT_LABELS: Record<MetconFormat, string> = {
  amrap: 'AMRAP',
  emom: 'EMOM',
  for_time: 'For Time',
  rounds: 'A giri',
  circuit: 'Circuit',
  chipper: 'Chipper',
  ladder: 'Ladder',
  intervals: 'Intervals',
  tabata: 'Tabata',
}

export const METCON_FORMAT_HINTS: Record<MetconFormat, string> = {
  amrap: 'Più giri possibili in un tempo fisso',
  emom: 'Un compito ogni minuto, sul minuto',
  for_time: 'Il volume prescritto il più veloce possibile',
  rounds: 'Un numero fisso di giri, riposando il necessario',
  circuit: 'Stazioni in sequenza con recupero fisso',
  chipper: 'Una lista lunga da completare una sola volta',
  ladder: 'Ripetizioni che salgono a ogni giro',
  intervals: 'Lavoro e riposo a intervalli regolari',
  tabata: 'Protocollo fisso 20″ lavoro / 10″ riposo × 8',
}

export const CROSSFIT_BENCHMARK_LABELS: Record<CrossFitBenchmark, string> = {
  custom: 'WOD personalizzato sui target',
  cindy: 'Cindy · AMRAP 20′',
  fran: 'Fran · 21-15-9 For Time',
  grace: 'Grace · 30 Clean & Jerk',
  helen: 'Helen · 3 giri For Time',
}

export const CROSSFIT_BENCHMARK_HINTS: Record<CrossFitBenchmark, string> = {
  custom: 'Costruito sui muscoli target scelti oggi',
  cindy: '5 trazioni, 10 push-up, 15 squat',
  fran: 'Thruster e trazioni, schema 21-15-9',
  grace: '30 clean & jerk nel minor tempo possibile',
  helen: '400 m corsa, 21 swing, 12 trazioni × 3',
}

/** Modalità della specifica non ancora costruite: mostrate ma disattivate (sez. 84, non si finge che esistano). */
export const MODES_IN_ARRIVO: { label: string; hint: string }[] = []

export const SPLIT_LABELS: Record<Split, string> = {
  push: 'Spinta',
  pull: 'Tirata',
  legs: 'Gambe',
  upper: 'Parte alta',
  lower: 'Parte bassa',
  full_body: 'Tutto il corpo',
  bro_chest: 'Petto',
  bro_back: 'Dorso',
  bro_shoulders: 'Spalle',
  bro_arms: 'Braccia',
  bro_legs: 'Gambe (dedicate)',
  front_body: 'Anteriore',
  back_body: 'Posteriore',
}

export const SPLIT_HINTS: Record<Split, string> = {
  push: 'Petto, spalle, tricipiti',
  pull: 'Dorso, deltoidi posteriori, bicipiti',
  legs: 'Quadricipiti, femorali, glutei, polpacci',
  upper: 'Tutta la parte superiore',
  lower: 'Tutta la parte inferiore',
  full_body: 'Una sessione su tutto',
  bro_chest: 'Sessione dedicata al petto',
  bro_back: 'Sessione dedicata al dorso',
  bro_shoulders: 'Sessione dedicata alle spalle',
  bro_arms: 'Bicipiti e tricipiti',
  bro_legs: 'Sessione gambe più lunga e mirata',
  front_body: 'Petto, spalle, quadricipiti, addome',
  back_body: 'Dorso, deltoidi posteriori, femorali, glutei',
}

/** Raggruppamento degli split per la UI di selezione (sez. 15, 71 della specifica). */
export const SPLIT_GROUPS: { label: string; splits: Split[] }[] = [
  { label: 'Push / Pull / Legs', splits: ['push', 'pull', 'legs'] },
  { label: 'Upper / Lower', splits: ['upper', 'lower'] },
  { label: 'Full Body', splits: ['full_body'] },
  { label: 'Bro Split', splits: ['bro_chest', 'bro_back', 'bro_shoulders', 'bro_arms', 'bro_legs'] },
  { label: 'Front / Back', splits: ['front_body', 'back_body'] },
]

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  full_gym: 'Palestra completa',
  barbell: 'Solo bilanciere',
  dumbbells: 'Solo manubri',
  machines: 'Solo macchine',
  barbell_dumbbells: 'Bilanciere e manubri',
  barbell_machines: 'Bilanciere e macchine',
  dumbbells_machines: 'Manubri e macchine',
  home_gym: 'Palestra in casa',
  bodyweight: 'Corpo libero',
}

export const EQUIPMENT_ITEM_LABELS: Record<EquipmentItem, string> = {
  barbell: 'Bilanciere',
  dumbbells: 'Manubri',
  machines: 'Macchine',
  cable: 'Cavi',
  kettlebells: 'Kettlebell',
  row_erg: 'Row Erg',
  ski_erg: 'Ski Erg',
  assault_bike: 'Assault Bike / Cyclette',
  treadmill: 'Tapis roulant',
  jump_rope: 'Corda',
  pullup_bar: 'Sbarra trazioni',
  parallel_bars: 'Parallele',
  bench: 'Panca',
  box: 'Box / rialzo',
  resistance_bands: 'Elastici',
}

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Petto',
  back: 'Dorso',
  front_delts: 'Deltoidi anteriori',
  lateral_delts: 'Deltoidi laterali',
  rear_delts: 'Deltoidi posteriori',
  biceps: 'Bicipiti',
  triceps: 'Tricipiti',
  forearms: 'Avambracci',
  quads: 'Quadricipiti',
  hamstrings: 'Femorali',
  glutes: 'Glutei',
  adductors: 'Adduttori · interno coscia',
  calves: 'Polpacci',
  core: 'Core',
}

/** Riconosce le note che il motore assegna agli esercizi "richiamo carenza"
 *  (bodybuilding.ts usa 'carenza'/'richiamo carenza', strength.ts usa 'richiamo'):
 *  serve solo a mostrare un badge in UI, non alla logica di generazione. */
export function isLaggingNote(note?: string): boolean {
  return !!note && (note.includes('carenza') || note.includes('richiamo'))
}

export const DURATIONS = [30, 45, 60, 75, 90] as const

/** Quali attrezzi sono disponibili per ciascuna scelta dell'utente. */
export const EQUIPMENT_MAP: Record<Equipment, Gear[]> = {
  full_gym:            ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'cardio'],
  barbell:             ['barbell', 'bodyweight'],
  dumbbells:           ['dumbbell', 'bodyweight'],
  machines:            ['machine', 'cable', 'bodyweight', 'cardio'],
  barbell_dumbbells:   ['barbell', 'dumbbell', 'bodyweight'],
  barbell_machines:    ['barbell', 'machine', 'cable', 'bodyweight', 'cardio'],
  dumbbells_machines:  ['dumbbell', 'machine', 'cable', 'bodyweight', 'cardio'],
  home_gym:            ['dumbbell', 'bodyweight', 'kettlebell'],
  bodyweight:          ['bodyweight'],
}
