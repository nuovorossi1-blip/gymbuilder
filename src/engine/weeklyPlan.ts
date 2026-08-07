import { MODE_LABELS, SPLIT_LABELS, type Exercise, type GeneratedWorkout, type Goal, type Muscle, type PublicMode, type RecoveryProfile, type Split, type SplitSystem, type Weekday, type WeeklyProgram, type WeeklyProgramConfig, type WeeklyProgramWarning, type WeeklySession } from '../types'

export function selectProgramMode(current: PublicMode[], selected: PublicMode): PublicMode[] {
  if (current.includes(selected)) return current.filter((mode) => mode !== selected)
  if (current.length < 2) return [...current, selected]
  return [current[0], selected]
}

export function applyAutomaticProgramming(config: WeeklyProgramConfig): WeeklyProgramConfig {
  const modes = config.selected_modes
  const has = (mode: PublicMode) => modes.includes(mode)
  const mixed = modes.length === 2
  const goal: Goal = mixed
    ? has('bodybuilding') && has('strength') ? 'strength' : 'mixed'
    : has('bodybuilding') ? 'hypertrophy'
    : has('strength') ? 'strength'
    : 'conditioning'
  const intensity = config.experience === 'advanced' && config.duration_min <= 60 ? 'high' : 'medium'
  const strength_method = has('strength')
    ? has('crossfit') || has('crossfit_hybrid') ? 'strength_accessories'
    : has('bodybuilding') ? 'max_strength'
    : config.experience === 'advanced' ? '3x5' : '5x5'
    : config.strength_method
  const crossfit_format = config.experience === 'advanced'
    ? config.duration_min >= 75 ? 'rounds' : 'for_time'
    : config.duration_min <= 45 ? 'emom' : 'amrap'
  const hybrid_method = config.weak_points.length > 0 ? 'specialization'
    : config.duration_min >= 75 ? 'full_body_functional'
    : config.hybrid_balance === 'hy_dominant' ? 'upper_conditioning'
    : 'full_body_functional'
  const hybrid_format = config.experience === 'advanced'
    ? config.duration_min <= 45 ? 'intervals' : 'for_time'
    : config.duration_min <= 45 ? 'emom' : 'amrap'

  return { ...config, goal, intensity, strength_method, crossfit_format, hybrid_method, hybrid_format }
}

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

function forecastProfile(mode: PublicMode, split: Split | null, duration: number): RecoveryProfile {
  const load = split ? SPLIT_LOAD[split] : GENERIC_LOAD[mode as keyof typeof GENERIC_LOAD]
  const muscleStress = Object.fromEntries(load.map((muscle) => [muscle, split === 'legs' || split === 'lower' ? 8 : 6])) as Partial<Record<Muscle, number>>
  const values: Record<PublicMode, [number, number, number, number]> = {
    bodybuilding: [6, 2, 3, 36], strength: [8, 2, 5, 48],
    crossfit: [8, 9, 7, 48], crossfit_hybrid: [8, 8, 6, 48], tabata: [6, 9, 3, 30],
  }
  const [fatigue, cardio, systemic, recovery] = values[mode]
  return { fatigue_score: split === 'legs' || split === 'lower' ? Math.min(10, fatigue + 1) : fatigue, muscle_stress: muscleStress, cardio_demand: cardio, grip_demand: load.includes('back') ? 6 : 3, systemic_fatigue: systemic, recovery_demand_hours: recovery, duration_min: duration, source: 'forecast' }
}

export function proposeWeeklyPlan(system: SplitSystem, days: number): Split[] {
  const safeDays = Math.min(7, Math.max(1, Math.round(days)))
  return [...PIANI[system][safeDays]]
}

function bodybuildingSplits(config: WeeklyProgramConfig, count: number): Split[] {
  if (config.split_system !== 'ppl' || count !== 4) return proposeWeeklyPlan(config.split_system, count)
  const lowerPriority = config.weak_points.some((muscle) => ['quads', 'hamstrings', 'glutes', 'calves'].includes(muscle))
  const upperPriority = config.weak_points.some((muscle) => ['chest', 'back', 'front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps'].includes(muscle))
  return ['push', 'pull', 'legs', lowerPriority && !upperPriority ? 'lower' : upperPriority ? 'upper' : 'full_body']
}

function distributeModes(config: WeeklyProgramConfig): Record<PublicMode, number> {
  const modes = [...new Set(config.selected_modes)]
  if (modes.length === 0) throw new Error('Seleziona almeno una modalità.')
  if (modes.length > 2) throw new Error('Un programma può combinare al massimo due discipline.')
  if (modes.length > config.training_days) throw new Error('I giorni devono essere almeno quanti le modalità selezionate.')
  if (modes.length === 2 && modes.includes('bodybuilding') && modes.includes('crossfit_hybrid')) {
    const balance = config.hybrid_balance ?? 'bb_dominant'
    const bb = balance === 'hy_dominant'
      ? Math.max(1, Math.floor(config.training_days * 0.4))
      : Math.max(1, Math.ceil(config.training_days * (balance === 'bb_dominant' ? 0.6 : 0.5)))
    return { bodybuilding: bb, crossfit_hybrid: config.training_days - bb } as Record<PublicMode, number>
  }
  if (modes.length === 2 && modes.includes('bodybuilding') && modes.includes('crossfit')) {
    const bb = Math.ceil(config.training_days / 2)
    return { bodybuilding: bb, crossfit: config.training_days - bb } as Record<PublicMode, number>
  }
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

function splitAccogliePriorita(system: SplitSystem, split: Split | null, muscle: Muscle): boolean {
  if (!split) return false
  if (split === 'full_body') return true
  if (['quads', 'hamstrings', 'glutes', 'calves'].includes(muscle)) {
    return ['legs', 'lower', 'bro_legs', 'front_body', 'back_body'].includes(split)
  }
  if (muscle === 'chest') return ['push', 'upper', 'bro_chest', 'front_body'].includes(split)
  if (muscle === 'back') return ['pull', 'upper', 'bro_back', 'back_body'].includes(split)
  if (muscle === 'core') return ['legs', 'lower', 'front_body', 'back_body'].includes(split)

  if (system === 'ppl') {
    if (muscle === 'lateral_delts' || muscle === 'front_delts') return split === 'push' || split === 'upper'
    if (muscle === 'rear_delts') return split === 'pull' || split === 'upper'
    if (muscle === 'biceps' || muscle === 'triceps') return split === 'push' || split === 'pull' || split === 'upper'
  }
  if (system === 'upper_lower') return split === 'upper'
  if (system === 'front_back') {
    if (muscle === 'lateral_delts' || muscle === 'front_delts') return split === 'front_body'
    if (muscle === 'rear_delts') return split === 'back_body'
    if (muscle === 'biceps' || muscle === 'triceps') return split === 'front_body' || split === 'back_body'
  }
  if (system === 'bro_split') {
    if (muscle === 'lateral_delts' || muscle === 'front_delts') return split === 'bro_shoulders' || split === 'bro_chest'
    if (muscle === 'rear_delts') return split === 'bro_shoulders' || split === 'bro_back'
    if (muscle === 'biceps') return split === 'bro_arms' || split === 'bro_back'
    if (muscle === 'triceps') return split === 'bro_arms' || split === 'bro_chest'
  }
  return false
}

function assegnaPrioritaSettimanali(
  sessions: Omit<WeeklySession, 'id' | 'day'>[],
  config: WeeklyProgramConfig
): Omit<WeeklySession, 'id' | 'day'>[] {
  return sessions.map((session) => {
    if (session.mode === 'crossfit_hybrid') {
      const upperPriority = config.weak_points.filter((muscle) => !['quads', 'hamstrings', 'glutes', 'calves', 'core'].includes(muscle))
      return session.variant === 'A'
        ? { ...session, label: upperPriority.length > 0 ? 'Hybrid — Specializzazione carenze' : 'Hybrid — Upper / Conditioning', priority_muscles: upperPriority.slice(0, 4) }
        : { ...session, label: 'Hybrid — Functional / Full Body', priority_muscles: [] }
    }
    let compatible = config.weak_points.filter((muscle) => splitAccogliePriorita(config.split_system, session.split, muscle))
    if (session.split === 'upper') {
      const shoulders = compatible.filter((muscle) => ['front_delts', 'lateral_delts', 'rear_delts'].includes(muscle))
      if (shoulders.length > 1) {
        const chosen = shoulders[session.variant === 'A' ? 0 : 1] ?? shoulders[0]
        compatible = [chosen, ...compatible.filter((muscle) => !shoulders.includes(muscle))]
      }
    }
    // Un Full Body non può assorbire tutte le specializzazioni: le ruota fra A/B.
    const priority_muscles = session.split === 'full_body' && compatible.length > 2
      ? compatible.filter((_, index) => index % 2 === (session.variant === 'A' ? 0 : 1)).slice(0, 2)
      : compatible
    return { ...session, priority_muscles }
  })
}

function makeCandidates(config: WeeklyProgramConfig): Omit<WeeklySession, 'id' | 'day'>[] {
  const counts = distributeModes(config)
  const sessions: Omit<WeeklySession, 'id' | 'day'>[] = []
  for (const mode of config.selected_modes) {
    const count = counts[mode] ?? 0
    const splits = mode === 'bodybuilding' ? bodybuildingSplits(config, count) : mode === 'strength' ? strengthSplits(count) : Array<null>(count).fill(null)
    const occurrences = new Map<Split | null, number>()
    splits.forEach((split) => {
      const occurrence = occurrences.get(split) ?? 0
      occurrences.set(split, occurrence + 1)
      sessions.push({
      mode, split, label: split ? `${MODE_LABELS[mode]} — ${SPLIT_LABELS[split]}` : MODE_LABELS[mode],
      estimated_fatigue: mode === 'tabata' ? 2 : mode === 'bodybuilding' ? 2 : 3,
      muscle_load: split ? SPLIT_LOAD[split] : GENERIC_LOAD[mode as keyof typeof GENERIC_LOAD],
      recovery_profile: forecastProfile(mode, split, config.duration_min),
      priority_muscles: [], variant: occurrence % 2 === 0 ? 'A' : 'B',
    })})
  }
  return assegnaPrioritaSettimanali(sessions, config)
}

function overlap(a: Muscle[], b: Muscle[]): number { return a.filter((muscle) => b.includes(muscle)).length }

function candidateScore(candidate: Omit<WeeklySession, 'id' | 'day'>[], days: Weekday[], config: WeeklyProgramConfig): number {
  let score = 0
  const weeklyStress: Partial<Record<Muscle, number>> = {}
  candidate.forEach((session, index) => {
    for (const [muscle, stress] of Object.entries(session.recovery_profile.muscle_stress) as [Muscle, number][]) weeklyStress[muscle] = (weeklyStress[muscle] ?? 0) + stress
    if (index === 0) return
    const previous = candidate[index - 1]
    const gapHours = (DAY_INDEX[days[index]] - DAY_INDEX[days[index - 1]]) * 24
    const sharedStress = overlap(previous.muscle_load, session.muscle_load)
    // Nei programmi misti evita di ammucchiare le due giornate Hybrid:
    // PPL + HY + HY viene distribuito come P/HY/P/HY/L quando il recupero lo consente.
    if (previous.mode === session.mode && config.selected_modes.length > 1) score += 18
    if (gapHours < previous.recovery_profile.recovery_demand_hours) score += (previous.recovery_profile.recovery_demand_hours - gapHours) / 3
    score += sharedStress * (gapHours === 24 ? 3 : 0.8)
    score += Math.max(0, previous.recovery_profile.fatigue_score + session.recovery_profile.fatigue_score - 14) * (gapHours === 24 ? 2 : 0.5)
    score += Math.max(0, previous.recovery_profile.grip_demand + session.recovery_profile.grip_demand - 12)
    score += Math.max(0, previous.recovery_profile.cardio_demand + session.recovery_profile.cardio_demand - 16)
  })
  for (const muscle of config.weak_points) {
    const stress = weeklyStress[muscle] ?? 0
    score += stress < 6 ? 8 : stress > 24 ? (stress - 24) * 1.5 : 0
  }
  return score
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  const output: T[][] = []
  items.forEach((item, index) => {
    for (const rest of permutations([...items.slice(0, index), ...items.slice(index + 1)])) output.push([item, ...rest])
  })
  return output
}

function orderForRecovery(candidates: Omit<WeeklySession, 'id' | 'day'>[], days: Weekday[], config: WeeklyProgramConfig): Omit<WeeklySession, 'id' | 'day'>[] {
  let best = candidates
  let bestScore = Number.POSITIVE_INFINITY
  for (const candidate of permutations(candidates)) {
    const score = candidateScore(candidate, days, config)
    if (score < bestScore) { best = candidate; bestScore = score }
  }
  return best
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
  if (config.program_kind === 'single_session') {
    const mode = config.selected_modes[0]
    if (!mode) throw new Error('Seleziona una modalità.')
    const normalized = { ...config, training_days: 1, duration_weeks: 1, selected_modes: [mode] }
    const requested = config.single_session_split ?? 'full_body'
    const split = mode === 'bodybuilding' ? requested : mode === 'strength' ? (STRENGTH_SPLITS.has(requested) ? requested : 'full_body') : null
    const session: WeeklySession = {
      id: 'single-session', day: 'monday', mode, split,
      label: split ? `${MODE_LABELS[mode]} — ${SPLIT_LABELS[split]}` : MODE_LABELS[mode],
      estimated_fatigue: mode === 'bodybuilding' ? 2 : 3,
      muscle_load: split ? SPLIT_LOAD[split] : GENERIC_LOAD[mode as keyof typeof GENERIC_LOAD],
      recovery_profile: forecastProfile(mode, split, config.duration_min),
      priority_muscles: config.weak_points.slice(0, 2), variant: 'A',
    }
    return { id: `single-${Date.now()}`, persisted: false, config: normalized, week: [session], warnings: [] }
  }
  const days = Math.min(7, Math.max(3, Math.round(config.training_days)))
  const normalized = { ...config, training_days: days, duration_weeks: Math.min(52, Math.max(2, Math.round(config.duration_weeks))), selected_modes: [...new Set(config.selected_modes)] }
  const isStrengthCrossFitSix = days === 6 && normalized.selected_modes.length === 2 &&
    normalized.selected_modes.includes('strength') && normalized.selected_modes.includes('crossfit')
  const activeDays: Weekday[] = isStrengthCrossFitSix
    ? ['monday', 'tuesday', 'wednesday', 'friday', 'saturday', 'sunday']
    : ACTIVE_DAYS[days]
  const isPplBbHybridBlock = normalized.training_days === 5 && normalized.split_system === 'ppl' &&
    normalized.hybrid_balance !== 'hy_dominant' && normalized.selected_modes.length === 2 &&
    normalized.selected_modes.includes('bodybuilding') && normalized.selected_modes.includes('crossfit_hybrid')
  const isBbCrossFitFourDays = normalized.training_days === 4 && normalized.selected_modes.length === 2 &&
    normalized.selected_modes.includes('bodybuilding') && normalized.selected_modes.includes('crossfit')
  // Programmazione richiesta: Push/Pull/Legs, riposo, HY specializzazione,
  // HY funzionale, riposo. Qui il blocco metodologico prevale sul sorter generico.
  const candidates = makeCandidates(normalized)
  const ordered = isStrengthCrossFitSix
    ? (() => {
        const strength = candidates.filter((session) => session.mode === 'strength')
        const crossfit = candidates.filter((session) => session.mode === 'crossfit')
        const adapted = (index: number, label: string) => crossfit[index] ? {
          ...crossfit[index], label, fatigue_avoid_muscles: strength[index]?.muscle_load ?? [],
        } : undefined
        return [
          strength[0], adapted(0, 'CrossFit — Upper / Gymnastics'),
          strength[1], adapted(1, 'CrossFit — Mixed adattato'),
          strength[2], adapted(2, 'CrossFit — Endurance / Tecnica'),
        ].filter((session): session is Omit<WeeklySession, 'id' | 'day'> => !!session)
      })()
    : isPplBbHybridBlock
    ? [...candidates.filter((session) => session.mode === 'bodybuilding'), ...candidates.filter((session) => session.mode === 'crossfit_hybrid')]
    : isBbCrossFitFourDays
      ? [
          candidates.filter((session) => session.mode === 'bodybuilding')[0],
          candidates.filter((session) => session.mode === 'crossfit')[0],
          candidates.filter((session) => session.mode === 'bodybuilding')[1],
          candidates.filter((session) => session.mode === 'crossfit')[1],
        ].filter((session): session is Omit<WeeklySession, 'id' | 'day'> => !!session)
    : orderForRecovery(candidates, activeDays, normalized)
  const week = ordered.map((session, index): WeeklySession => ({ ...session, id: `session-${index + 1}`, day: activeDays[index] }))
  return { id: `week-${Date.now()}`, persisted: false, config: normalized, week, warnings: validateWeeklyProgram(week, normalized) }
}

export function updateWeeklySession(program: WeeklyProgram, id: string, patch: Partial<Pick<WeeklySession, 'day' | 'mode' | 'split'>>): WeeklyProgram {
  const week = program.week.map((session) => {
    if (session.id !== id) return session
    const mode = patch.mode ?? session.mode
    const requestedSplit = patch.split ?? session.split ?? 'full_body'
    const split = mode === 'bodybuilding' ? requestedSplit : mode === 'strength' ? (STRENGTH_SPLITS.has(requestedSplit) ? requestedSplit : 'full_body') : null
    return { ...session, ...patch, mode, split, label: split ? `${MODE_LABELS[mode]} — ${SPLIT_LABELS[split]}` : MODE_LABELS[mode], muscle_load: split ? SPLIT_LOAD[split] : GENERIC_LOAD[mode as keyof typeof GENERIC_LOAD], estimated_fatigue: mode === 'tabata' ? 2 : mode === 'bodybuilding' ? 2 : 3, recovery_profile: forecastProfile(mode, split, program.config.duration_min) } as WeeklySession
  })
  const config = { ...program.config, selected_modes: [...new Set(week.map((session) => session.mode))] }
  const prioritized = assegnaPrioritaSettimanali(week, config) as WeeklySession[]
  return { ...program, config, week: prioritized, warnings: validateWeeklyProgram(prioritized, config) }
}

export function analyzeWorkoutRecovery(workout: GeneratedWorkout, catalog: Exercise[]): RecoveryProfile {
  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]))
  const stress: Partial<Record<Muscle, number>> = {}
  let systemic = 0, grip = 0, cardio = 0, work = 0
  for (const prescribed of workout.blocks.filter((block) => block.kind !== 'warmup').flatMap((block) => block.exercises)) {
    const exercise = byId.get(prescribed.exercise_id)
    if (!exercise) continue
    const volume = Math.max(1, prescribed.sets)
    for (const muscle of exercise.primary_muscles) stress[muscle] = (stress[muscle] ?? 0) + volume
    for (const muscle of exercise.secondary_muscles) stress[muscle] = (stress[muscle] ?? 0) + volume * 0.5
    systemic += exercise.systemic_fatigue * volume; grip += exercise.grip_fatigue * volume; cardio += exercise.cardio_demand * volume; work += volume
  }
  const divisor = Math.max(1, work)
  const systemicScore = Math.min(10, systemic / divisor * 3)
  const cardioScore = Math.min(10, cardio / divisor * 3)
  const gripScore = Math.min(10, grip / divisor * 3)
  const maxStress = Math.max(0, ...Object.values(stress))
  const fatigue = Math.min(10, systemicScore * 0.45 + cardioScore * 0.25 + gripScore * 0.1 + Math.min(10, maxStress) * 0.2)
  return { fatigue_score: Math.round(fatigue * 10) / 10, muscle_stress: stress, cardio_demand: Math.round(cardioScore * 10) / 10, grip_demand: Math.round(gripScore * 10) / 10, systemic_fatigue: Math.round(systemicScore * 10) / 10, recovery_demand_hours: fatigue >= 8 ? 48 : fatigue >= 6 ? 36 : 24, duration_min: workout.duration_min, source: 'generated_workout' }
}

export function applyWorkoutRecovery(program: WeeklyProgram, sessionId: string, workout: GeneratedWorkout, catalog: Exercise[]): WeeklyProgram {
  const profile = analyzeWorkoutRecovery(workout, catalog)
  const week = program.week.map((session) => session.id === sessionId ? { ...session, recovery_profile: profile, muscle_load: Object.keys(profile.muscle_stress) as Muscle[], estimated_fatigue: profile.fatigue_score >= 8 ? 3 as const : profile.fatigue_score >= 5 ? 2 as const : 1 as const } : session)
  return { ...program, week, warnings: validateWeeklyProgram(week, program.config) }
}
