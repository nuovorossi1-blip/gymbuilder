import type { Equipment, EquipmentItem, Exercise, ExerciseRecord, Gear } from '../types'

export const PRESET_EQUIPMENT: Record<Equipment, EquipmentItem[]> = {
  full_gym: [
    'barbell', 'dumbbells', 'machines', 'cable', 'kettlebells', 'row_erg',
    'ski_erg', 'assault_bike', 'treadmill', 'jump_rope', 'pullup_bar',
    'parallel_bars', 'bench', 'box', 'resistance_bands',
  ],
  barbell: ['barbell', 'bench', 'pullup_bar'],
  dumbbells: ['dumbbells', 'bench'],
  machines: ['machines', 'cable', 'assault_bike', 'treadmill'],
  barbell_dumbbells: ['barbell', 'dumbbells', 'bench', 'pullup_bar'],
  barbell_machines: ['barbell', 'machines', 'cable', 'bench', 'assault_bike', 'treadmill'],
  dumbbells_machines: ['dumbbells', 'machines', 'cable', 'bench', 'assault_bike', 'treadmill'],
  home_gym: ['dumbbells', 'kettlebells', 'bench', 'jump_rope', 'resistance_bands'],
  bodyweight: [],
}

const REQUISITO_BASE: Record<Exclude<Gear, 'bodyweight' | 'cardio'>, EquipmentItem> = {
  barbell: 'barbell',
  dumbbell: 'dumbbells',
  machine: 'machines',
  cable: 'cable',
  kettlebell: 'kettlebells',
}

/** Ricava il requisito granulare dei record legacy; il DB può sovrascriverlo esplicitamente. */
export function inferRequiredEquipment(record: ExerciseRecord): EquipmentItem[] {
  if (record.required_equipment) return record.required_equipment
  if (record.id === 'row_erg' || record.movement_pattern === 'row') return ['row_erg']
  if (record.movement_pattern === 'bike') return ['assault_bike']
  if (record.movement_pattern === 'run') return ['treadmill']
  if (record.id === 'wu_salto_corda') return ['jump_rope']
  if (record.id.includes('trazioni') || record.id === 'wu_scapole') return ['pullup_bar']
  if (record.id === 'dip_parallele') return ['parallel_bars']
  if (record.id === 'box_step_up') return ['box']
  if (record.id.includes('elastico') || record.id === 'wu_band_pull') return ['resistance_bands']
  if (record.equipment === 'bodyweight' || record.equipment === 'cardio') return []
  return [REQUISITO_BASE[record.equipment]]
}

export function isExerciseAvailable(
  exercise: Exercise,
  preset: Equipment,
  custom?: EquipmentItem[] | null
): boolean {
  const available = new Set(custom ?? PRESET_EQUIPMENT[preset])
  const required = exercise.required_equipment ?? inferRequiredEquipment(exercise)
  return required.every((item) => available.has(item))
}
