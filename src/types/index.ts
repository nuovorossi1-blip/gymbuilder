// Modello dati di GymBuilder.

export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type Goal = 'hypertrophy' | 'strength' | 'conditioning' | 'mixed'

export type Equipment =
  | 'full_gym' | 'barbell' | 'dumbbells' | 'machines'
  | 'barbell_dumbbells' | 'barbell_machines' | 'dumbbells_machines'
  | 'home_gym' | 'bodyweight'

export type Muscle =
  | 'chest' | 'back' | 'front_delts' | 'lateral_delts' | 'rear_delts'
  | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core'

export type Split =
  | 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body'
  | 'bro_chest' | 'bro_back' | 'bro_shoulders' | 'bro_arms' | 'bro_legs'
  | 'front_body' | 'back_body'

/** Attrezzo di un singolo esercizio, come sta nel database. */
export type Gear = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'cardio'

export interface Exercise {
  id: string
  name: string
  primary_muscles: Muscle[]
  secondary_muscles: Muscle[]
  equipment: Gear
  movement_pattern: string
  roles: string[]
  min_experience: Experience
  technical_complexity: number
  systemic_fatigue: number
  local_fatigue: number
  grip_fatigue: number
  cardio_demand: number
  default_sets: number
  default_reps: string
  default_rest: number
}

/** Un esercizio gia' prescritto: serie, ripetizioni e recupero decisi dal motore. */
export interface PrescribedExercise {
  exercise_id: string
  name: string
  role: 'compound' | 'isolation' | 'warmup'
  muscle: Muscle | null
  sets: number
  reps: string
  rest_sec: number
  note?: string
}

export interface WorkoutBlock {
  kind: 'warmup' | 'main'
  title: string
  duration_min?: number
  exercises: PrescribedExercise[]
}

export interface GeneratedWorkout {
  name: string
  mode: 'bodybuilding'
  split: Split
  goal: Goal
  experience: Experience
  duration_min: number
  blocks: WorkoutBlock[]
  warnings: string[]
}

export interface Profile {
  id: string
  display_name: string | null
}

export interface UserSettings {
  user_id: string
  experience: Experience
  primary_goal: Goal
  training_frequency: number
  default_duration: number
  equipment: Equipment
  priority_muscles: Muscle[]
  excluded_exercises: string[]
  favorite_exercises: string[]
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
}

export interface CompletedWorkout {
  id: string
  name: string
  duration_sec: number
  rating: string | null
  completed_at: string
  blocks: WorkoutBlock[]
}

// --- Etichette in italiano, tenute fuori dai componenti (sez. 87) ---

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzato',
}

export const GOAL_LABELS: Record<Goal, string> = {
  hypertrophy: 'Massa',
  strength: 'Forza',
  conditioning: 'Condizionamento',
  mixed: 'Misto',
}

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

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Petto',
  back: 'Dorso',
  front_delts: 'Deltoidi anteriori',
  lateral_delts: 'Deltoidi laterali',
  rear_delts: 'Deltoidi posteriori',
  biceps: 'Bicipiti',
  triceps: 'Tricipiti',
  quads: 'Quadricipiti',
  hamstrings: 'Femorali',
  glutes: 'Glutei',
  calves: 'Polpacci',
  core: 'Core',
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
