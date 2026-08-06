import type {
  Exercise,
  ExerciseCategory,
  ExerciseRecord,
  ExerciseType,
  WorkoutRole,
} from '../../types'

const CATEGORIA_ATTREZZO: Record<ExerciseRecord['equipment'], ExerciseCategory> = {
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  machine: 'machine',
  cable: 'cable',
  kettlebell: 'kettlebell',
  bodyweight: 'bodyweight',
  cardio: 'cardio',
}

const RUOLI_WORKOUT = new Set<WorkoutRole>([
  'warmup', 'strength', 'skill', 'metcon', 'recovery', 'hypertrophy',
])

function tipiDaRuoli(record: ExerciseRecord): ExerciseType[] {
  const tipi: ExerciseType[] = []
  if (record.roles.includes('compound')) tipi.push('compound')
  if (record.roles.includes('isolation') || record.roles.includes('core')) tipi.push('isolation')
  if (record.roles.includes('conditioning') || record.roles.includes('cardio')) tipi.push('conditioning')
  if (record.roles.includes('warmup')) tipi.push('mobility')
  return tipi.length > 0 ? [...new Set(tipi)] : ['isolation']
}

function ruoliWorkoutDaRecord(record: ExerciseRecord): WorkoutRole[] {
  const espliciti = record.roles.filter((role): role is WorkoutRole => RUOLI_WORKOUT.has(role as WorkoutRole))
  if (record.roles.includes('conditioning') || record.roles.includes('cardio')) espliciti.push('metcon')
  if (espliciti.length === 0) espliciti.push('hypertrophy')
  return [...new Set(espliciti)]
}

/**
 * Porta i record storici del catalogo alla forma canonica della Phase 2.
 * I fallback consentono di distribuire prima il frontend e poi la migrazione SQL,
 * senza rendere inutilizzabile l'app durante il rollout.
 */
export function normalizeExercise(record: ExerciseRecord): Exercise {
  const exerciseTypes = record.exercise_types?.length ? record.exercise_types : tipiDaRuoli(record)
  const workoutRoles = record.workout_roles?.length ? record.workout_roles : ruoliWorkoutDaRecord(record)
  const category = record.category ?? (
    record.roles.includes('warmup') ? 'mobility' :
    record.roles.includes('conditioning') && record.equipment === 'bodyweight' ? 'conditioning' :
    CATEGORIA_ATTREZZO[record.equipment]
  )
  const metconSafe = record.metcon_safe ?? (
    (record.roles.includes('conditioning') || record.roles.includes('cardio')) &&
    record.technical_complexity <= 2
  )

  return {
    ...record,
    english_name: record.english_name?.trim() || record.name,
    category,
    exercise_types: exerciseTypes,
    workout_roles: workoutRoles,
    metcon_safe: metconSafe,
    warmup_relevant: record.warmup_relevant ?? record.roles.includes('warmup'),
    description: record.description?.trim() || record.instructions?.trim() || record.name,
    substitutions: record.substitutions ?? [],
  }
}
