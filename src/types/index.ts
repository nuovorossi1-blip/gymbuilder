// Modello dati di GymBuilder. Qui c'e' solo cio' che serve alla Fase 1:
// Exercise, Workout, WorkoutBlock, Metcon e TimerConfig arrivano con le fasi successive.

export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type Goal = 'hypertrophy' | 'strength' | 'conditioning' | 'mixed'

export type Equipment =
  | 'full_gym' | 'barbell' | 'dumbbells' | 'machines'
  | 'barbell_dumbbells' | 'barbell_machines' | 'dumbbells_machines'
  | 'home_gym' | 'bodyweight'

export type Muscle =
  | 'chest' | 'back' | 'front_delts' | 'lateral_delts' | 'rear_delts'
  | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core'

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

// Le etichette stanno qui e non dentro i componenti (specifica sez. 87).
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

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  full_gym: 'Palestra completa',
  barbell: 'Bilanciere',
  dumbbells: 'Manubri',
  machines: 'Macchine',
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
