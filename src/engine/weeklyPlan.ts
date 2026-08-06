import { MODE_LABELS, SPLIT_LABELS, type Goal, type Muscle, type PublicMode, type Split, type SplitSystem, type Weekday, type WeeklyProgram, type WeeklyProgramConfig, type WeeklyProgramWarning, type WeeklySession } from '../types'

const ACTIVE_DAYS: Record<number, Weekday[]> = {
  3: ['monday', 'wednesday', 'friday'],
  4: ['monday', 'tuesday', 'thursday', 'saturday'],
  5: ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'],
  6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  7: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
}
const DAY_INDEX: Record<Weekday, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 }

const PIANI: Record<SplitSystem, Record<number, Split[]>> = {
  ppl: {
    1: ['full_body'], 2: ['upper', 'lower'], 3: ['push', 'pull', 'legs'],
    4: ['push', 'pull', 'legs', 'upper'], 5: ['push', 'pull', 'legs', 'upper', 'lower'],
    6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'], 7: ['push', 'pull', 'legs', 'upper', 'lower', 'push', 'pull'],
  },
  upper_lower: {
    1: ['full_body'], 2: ['upper', 'lower'], 3: ['upper', 'lower', 'full_body'],
    4: ['upper', 'lower', 'upper', 'lower'], 5: ['upper', 'lower', 'push', 'pull', 'legs'],
    6: ['upper', 'lower', 'upper', 'lower', 'push', 'legs'], 7: ['upper', 'lower', 'push', 'pull', 'legs', 'upper', 'lower'],
  },
  bro_split: {
    1: ['full_body'], 2: ['upper', 'lower'], 3: ['bro_chest', 'bro_back', 'bro_legs'],
    4: ['bro_chest', 'bro_back', 'bro_shoulders', 'bro_legs'], 5: ['bro_chest', 'bro_back', 'bro_shoulders', 'bro_arms', 'bro_legs'],
    6: ['bro_chest', 'bro_back', 'bro_shoulders', 'bro_arms', 'bro_legs', 'full_body'], 7: ['bro_chest', 'bro_back', 'bro_shoulders', 'bro_arms', 'bro_legs', 'upper', 'lower'],
  },
  front_back: {
    1: ['full_body'], 2: ['front_body', 'back_body'], 3: ['front_body', 'back_body', 'full_body'],
    4: ['front_body', 'back_body', 'front_body', 'back_body'], 5: ['front_body', 'back_body', 'push', 'pull', 'legs'],
    6: ['front_body', 'back_body', 'front_body', 'back_body', 'upper', 'lower'], 7: ['front_body', 'back_body', 'push', 'pull', 'legs', 'front_body', 'back_body'],
  },
}

const SPLIT_LOAD: Record<Split, Muscle[]> = {
  push: ['chest', 'front_delts', 'lateral_delts', 'triceps'], pull: ['back', 'rear_delts', 'biceps'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'], upper: ['chest', 'back', 'front_delts', 'rear_delts', 'biceps', 'triceps'],
  lower: ['quads', 'hamstrings', 'glutes', 'calves'], full_body: ['chest', 'back', 'quads', 'hamstrings', 'core'],
  bro_chest: ['chest', 'front_delts', 'triceps'], bro_back: ['back', 'rear_delts', 'biceps'],
  bro_shoulders: ['front_delts', 'lateral_delts', 'rear_delts'], bro_arms: ['biceps', 'triceps'],
  bro_legs: ['quads', 'hamstrings', 'glutes', 'calves'], front_body: ['chest', 'front_delts', 'quads', 'core'],
  back_body: ['back', 'rear_delts', 'hamstrings', 'glutes', 'biceps'],
}

const MODE_WEIGHT: Record<Goal, Record<PublicMode, number>> = {
  hypertrophy: { bodybuilding: 4, strength: 2, crossfit_hybrid: 2.7, crossfit: 1.8, tabata: 1 },
  strength: { bodybuilding: 2.5, strength: 4, crossfit_hybrid: 2.5, crossfit: 1.5, tabata: 0.8 },
  conditioning: { bodybuilding: 1.5, strength: 1.2, crossfit_hybrid: 3.5, crossfit: 4, tabata: 2.5 },
  mixed: { bodybuilding: 3, strength: 2.8, crossfit_hybrid: 3.2, crossfit: 2.5, tabata: 1.5 },
}

const GENERIC_LOAD: Record<Exclude<PublicMode, 'bodybuilding' | 'strength'>, Muscle[]> = {
  crossfit: ['back', 'quads', 'hamstrings', 'front_delts', 'core'],
  crossfit_hybrid: ['chest', 'back', 'quads', 'hamstrings', 'biceps', 'triceps'],
  tabata: ['quads', 'hamstrings', 'core'],
}
const STRENGTH_SPLITS = new Set<Split>(['push', 'pull', 'legs', 'upper', 'lower', 'full_body'])

export function proposeWeeklyPlan(system: SplitSystem, days: number): Split[] {
  const safeDays = Math.min(7, Math.max(1, Math.round(days)))
  return [...PIANI[system][safeDays]]
}

function distributeModes(config: WeeklyProgramConfig): Record<PublicMode, number> {
  const modes = [...new Set(config.selected_modes)]
  if (modes.length === 0) throw new Error('Seleziona almeno una modalità.')
  if (modes.length > config.training_days) throw new Error('I giorni devono essere almeno quanti le modalità selezionate.')
  const counts = Object.fromEntries(modes.map((mode) => [mode, 1])) as Partial<Record<PublicMode, number>>
  let remaining = config.training_days - modes.length
  while (remaining-- > 0) {
    const candidate = modes
      .filter((mode) => !(mode === 'tabata' && modes.length > 1 && (counts[mode] ?? 0) >= 1))
      .sort((a, b) => MODE_WEIGHT[config.goal][b] / ((counts[b] ?? 0) + 0.6) - MODE_WEIGHT[config.goal][a] / ((counts[a] ?? 0) + 0.6))[0] ?? modes[0]
    counts[candidate] = (counts[candidate] ?? 0) + 1
  }
  return counts as Record<PublicMode, number>
}

function strengthSplits(count: number): Split[] {
  if (count === 1) return ['full_body']
  if (count === 2) return ['lower', 'upper']
  return ['lower', 'upper', 'full_body', 'lower', 'upper', 'full_body'].slice(0, count) as Split[]
}

function makeCandidates(config: WeeklyProgramConfig): Omit<WeeklySession, 'id' | 'day'>[] {
  const counts = distributeModes(config)
  const sessions: Omit<WeeklySession, 'id' | 'day'>[] = []
  for (const mode of config.selected_modes) {
    const count = counts[mode] ?? 0
    const splits = mode === 'bodybuilding' ? proposeWeeklyPlan(config.split_system, count) : mode === 'strength' ? strengthSplits(count) : Array<null>(count).fill(null)
    splits.forEach((split) => sessions.push({
      mode, split, label: split ? `${MODE_LABELS[mode]} — ${SPLIT_LABELS[split]}` : MODE_LABELS[mode],
      estimated_fatigue: mode === 'tabata' ? 2 : mode === 'bodybuilding' ? 2 : 3,
      muscle_load: split ? SPLIT_LOAD[split] : GENERIC_LOAD[mode as keyof typeof GENERIC_LOAD],
    }))
  }
  return sessions
}

function overlap(a: Muscle[], b: Muscle[]): number { return a.filter((muscle) => b.includes(muscle)).length }

function orderForRecovery(candidates: Omit<WeeklySession, 'id' | 'day'>[]): Omit<WeeklySession, 'id' | 'day'>[] {
  const remaining = [...candidates]
  const ordered: Omit<WeeklySession, 'id' | 'day'>[] = []
  while (remaining.length) {
    const previous = ordered[ordered.length - 1]
    remaining.sort((a, b) => {
      if (!previous) return Number(a.mode !== 'bodybuilding') - Number(b.mode !== 'bodybuilding')
      const score = (item: typeof a) => overlap(previous.muscle_load, item.muscle_load) * 2 + (previous.estimated_fatigue === 3 && item.estimated_fatigue === 3 ? 5 : 0) + (previous.mode === item.mode ? 1 : 0)
      return score(a) - score(b)
    })
    ordered.push(remaining.shift()!)
  }
  return ordered
}

export function validateWeeklyProgram(week: WeeklySession[], config: WeeklyProgramConfig): WeeklyProgramWarning[] {
  const warnings: WeeklyProgramWarning[] = []
  const days = new Set<Weekday>()
  for (const session of week) {
    if (days.has(session.day)) warnings.push({ code: 'mode_density', message: `Hai due sessioni di ${session.day === 'monday' ? 'lunedì' : 'uno stesso giorno'}. Puoi mantenerle o spostarne una.`, day_ids: week.filter((item) => item.day === session.day).map((item) => item.id) })
    days.add(session.day)
  }
  const chronological = [...week].sort((a, b) => DAY_INDEX[a.day] - DAY_INDEX[b.day])
  for (let index = 1; index < chronological.length; index++) {
    const previous = chronological[index - 1]
    const current = chronological[index]
    if (DAY_INDEX[current.day] - DAY_INDEX[previous.day] !== 1) continue
    if (previous.estimated_fatigue === 3 && current.estimated_fatigue === 3) warnings.push({ code: 'consecutive_high_fatigue', message: `${previous.label} e ${current.label} sono due sessioni molto tassanti consecutive. Valuta di spostarne una.`, day_ids: [previous.id, current.id] })
    const shared = overlap(previous.muscle_load, current.muscle_load)
    if (shared >= 4) warnings.push({ code: 'muscle_overlap', message: `Sovrapposizione elevata tra ${previous.label} e ${current.label}. Puoi mantenerla o modificare uno dei due giorni.`, day_ids: [previous.id, current.id] })
  }
  if (config.training_days >= 6 && config.selected_modes.filter((mode) => mode !== 'tabata').length >= 3) warnings.push({ code: 'limited_recovery', message: 'Settimana ad alta densità: monitora recupero, sonno e qualità tecnica.', day_ids: week.map((item) => item.id) })
  const cardioModes = config.selected_modes.some((mode) => mode === 'crossfit' || mode === 'crossfit_hybrid' || mode === 'tabata')
  const conditioningGear: string[] = ['kettlebells', 'dumbbells', 'row_erg', 'ski_erg', 'assault_bike', 'treadmill', 'jump_rope']
  if (cardioModes && config.preferences.bodyweight_policy === 'never' && !config.equipment.available.some((item) => conditioningGear.includes(item))) warnings.push({ code: 'mode_density', message: 'Le modalità metaboliche hanno poche alternative: abilita almeno un attrezzo cardio, manubri o kettlebell.', day_ids: week.filter((item) => item.mode === 'crossfit' || item.mode === 'crossfit_hybrid' || item.mode === 'tabata').map((item) => item.id) })
  return warnings
}

export function generateWeeklyProgram(config: WeeklyProgramConfig): WeeklyProgram {
  const days = Math.min(7, Math.max(3, Math.round(config.training_days)))
  const normalized = { ...config, training_days: days, selected_modes: [...new Set(config.selected_modes)] }
  const ordered = orderForRecovery(makeCandidates(normalized))
  const activeDays = ACTIVE_DAYS[days]
  const week = ordered.map((session, index): WeeklySession => ({ ...session, id: `session-${index + 1}`, day: activeDays[index] }))
  return { id: `week-${Date.now()}`, config: normalized, week, warnings: validateWeeklyProgram(week, normalized) }
}

export function updateWeeklySession(program: WeeklyProgram, id: string, patch: Partial<Pick<WeeklySession, 'day' | 'mode' | 'split'>>): WeeklyProgram {
  const week = program.week.map((session) => {
    if (session.id !== id) return session
    const mode = patch.mode ?? session.mode
    const requestedSplit = patch.split ?? session.split ?? 'full_body'
    const split = mode === 'bodybuilding' ? requestedSplit : mode === 'strength' ? (STRENGTH_SPLITS.has(requestedSplit) ? requestedSplit : 'full_body') : null
    return { ...session, ...patch, mode, split, label: split ? `${MODE_LABELS[mode]} — ${SPLIT_LABELS[split]}` : MODE_LABELS[mode], muscle_load: split ? SPLIT_LOAD[split] : GENERIC_LOAD[mode as keyof typeof GENERIC_LOAD], estimated_fatigue: mode === 'tabata' ? 2 : mode === 'bodybuilding' ? 2 : 3 } as WeeklySession
  })
  const config = { ...program.config, selected_modes: [...new Set(week.map((session) => session.mode))] }
  return { ...program, config, week, warnings: validateWeeklyProgram(week, config) }
}
