/**
 * Fase nutrizionale e recupero (23/09, prompt di programmazione di Rossi, Principio 5).
 *
 * L'utente non sceglie "deficit/normo/surplus" da una lista: dichiara quante calorie mangia,
 * che lavoro fa e (se lo sa) se il peso scende, resta fermo o sale. La fase si ricava da qui:
 *  1. se l'andamento del peso è dichiarato vince lui — è un dato misurato, la formula è una stima
 *     (esempio di Rossi: "2500 kcal, non perdo né metto peso, lavoro d'ufficio" -> normocalorica);
 *  2. altrimenti si confrontano le calorie con la normocalorica stimata (Mifflin-St Jeor x
 *     fattore attività): sotto il 90% deficit, sopra il 110% surplus, in mezzo normo;
 *  3. senza dati sufficienti la fase resta sconosciuta e il motore si comporta come prima.
 *
 * Sonno sotto le 6 ore o stress alto = recupero limitato: il volume si calibra come nella fase
 * inferiore (surplus -> normo, normo -> deficit), perché il recupero reale è quello.
 */
import type { JobActivity, JointIssue, NutritionPhase, Profile, Sex, StressLevel, WeightTrend } from '../types'

export type { JobActivity, JointIssue, NutritionPhase, StressLevel, WeightTrend }

export const PHASE_LABELS: Record<NutritionPhase, string> = {
  deficit: 'Deficit',
  maintenance: 'Normocalorica',
  surplus: 'Surplus',
}

export const JOB_ACTIVITY_LABELS: Record<JobActivity, string> = {
  sedentary: 'Sedentario (ufficio, seduto)',
  active: 'Attivo (in piedi, cammino molto)',
  very_active: 'Molto attivo (lavoro fisico)',
}

export const WEIGHT_TREND_LABELS: Record<WeightTrend, string> = {
  losing: 'Sto perdendo peso',
  stable: 'Il peso resta stabile',
  gaining: 'Sto prendendo peso',
}

export const STRESS_LABELS: Record<StressLevel, string> = { low: 'Basso', medium: 'Medio', high: 'Alto' }

export const JOINT_LABELS: Record<JointIssue, string> = {
  shoulders: 'Spalle',
  elbows: 'Gomiti',
  wrists: 'Polsi',
  lower_back: 'Schiena bassa',
  knees: 'Ginocchia',
}

/** Fattore moltiplicativo del metabolismo basale: include già 3-5 allenamenti a settimana. */
const ACTIVITY_FACTOR: Record<JobActivity, number> = { sedentary: 1.4, active: 1.6, very_active: 1.8 }

const SEX_OFFSET: Record<Sex, number> = { male: 5, female: -161, other: -78, unspecified: -78 }

export function stimaNormocalorica(profile: Pick<Profile, 'weight_kg' | 'height_cm' | 'age' | 'sex' | 'job_activity'>): number | null {
  const { weight_kg: w, height_cm: h, age: a } = profile
  if (!w || !h || !a || !profile.job_activity) return null
  const bmr = 10 * w + 6.25 * h - 5 * a + SEX_OFFSET[profile.sex ?? 'unspecified']
  return Math.round((bmr * ACTIVITY_FACTOR[profile.job_activity]) / 10) * 10
}

/**
 * Gradini calorici (23/09, "la scala" di Rossi): distanza dalla normocalorica arrotondata a
 * 250 kcal, da -500 (deficit) a +1000 (surplus aggressivo). Con normo 2500: 2000, 2250, 2500,
 * 2750, 3000, 3250, 3500. Sono relativi alla PERSONA, non numeri fissi.
 */
export type CalorieStep = -500 | -250 | 0 | 250 | 500 | 750 | 1000
export const CALORIE_STEPS: CalorieStep[] = [-500, -250, 0, 250, 500, 750, 1000]

export function stepDaOffset(offset: number): CalorieStep {
  const rounded = Math.round(offset / 250) * 250
  return Math.max(-500, Math.min(1000, rounded)) as CalorieStep
}

/** Fase "grossa" usata per l'interleave: -500/-250 deficit, 0/+250 normo, da +500 surplus. */
export function stepToPhase(step: CalorieStep): NutritionPhase {
  if (step <= -250) return 'deficit'
  if (step <= 250) return 'maintenance'
  return 'surplus'
}

export function stepLabel(step: CalorieStep): string {
  if (step === 1000) return 'surplus aggressivo'
  if (step >= 500) return 'surplus'
  if (step === 250) return 'leggero surplus'
  if (step === 0) return 'normocalorica'
  if (step === -250) return 'leggero deficit'
  return 'deficit'
}

export interface CalorieLogEntry {
  kcal: number
  maintenance_kcal: number | null
  step: number
  created_at: string
}

/** Normocalorica: quella dichiarata (calorie a cui il peso era stabile) vince sulla formula. */
export function normocaloricaEffettiva(profile: Profile): { kcal: number | null; source: 'dichiarata' | 'formula' | null } {
  if (profile.maintenance_kcal) return { kcal: profile.maintenance_kcal, source: 'dichiarata' }
  if (profile.weight_trend === 'stable' && profile.daily_kcal) return { kcal: profile.daily_kcal, source: 'dichiarata' }
  const formula = stimaNormocalorica(profile)
  return { kcal: formula, source: formula ? 'formula' : null }
}

export function gradinoCalorie(profile: Profile): CalorieStep | null {
  const normo = normocaloricaEffettiva(profile).kcal
  if (profile.daily_kcal && normo) {
    const step = stepDaOffset(profile.daily_kcal - normo)
    // L'andamento del peso è misurato, la formula è una stima: se si contraddicono vince il peso
    // (es. 3500 kcal ma il peso scende -> la normo reale è più alta della formula, sei in deficit).
    if (profile.weight_trend === 'losing' && step > -250) return -500
    if (profile.weight_trend === 'gaining' && step < 250) return 500
    return step
  }
  if (profile.weight_trend === 'losing') return -500
  if (profile.weight_trend === 'stable') return 0
  if (profile.weight_trend === 'gaining') return 500
  return null
}

const DAY = 86_400_000
/** Il volume passa al nuovo gradino solo dopo 7 giorni alle nuove calorie... */
export const GIORNI_RITARDO_VOLUME = 7
/** ...e si sposta di un solo gradino ogni 7 giorni, in salita e in discesa (scelte di Rossi 23/09). */
export const GIORNI_PER_GRADINO = 7

export interface RampaVolume {
  volume_step: CalorieStep
  days_since_change: number | null
  next_change_in_days: number | null
  direction: 'up' | 'down' | null
}

/**
 * "Le calorie guidano, il volume segue" (Principio 11 di Rossi). Simula giorno per giorno lo
 * storico delle calorie: il volume insegue il gradino calorico tenuto da almeno 7 giorni, un
 * gradino alla volta, uno a settimana. Anche un salto 2000 -> 3000 in un giorno diventa così una
 * scala. Senza storico il volume coincide col gradino attuale (primo inserimento, nessuna rampa).
 */
export function rampaVolume(currentStep: CalorieStep, log: CalorieLogEntry[] = [], now: Date = new Date()): RampaVolume {
  const entries = log
    .map((entry) => ({ t: new Date(entry.created_at).getTime(), step: stepDaOffset(entry.step) }))
    .filter((entry) => Number.isFinite(entry.t) && entry.t <= now.getTime())
    .sort((a, b) => a.t - b.t)
  if (entries.length === 0) return { volume_step: currentStep, days_since_change: null, next_change_in_days: null, direction: null }
  if (entries[entries.length - 1].step !== currentStep) entries.push({ t: now.getTime(), step: currentStep })

  const nowT = now.getTime()
  const start = Math.max(entries[0].t, nowT - 400 * DAY)
  let vol: number = entries.find((entry) => entry.t >= start)?.step ?? entries[0].step
  // Gradino di partenza: quello in vigore all'inizio della finestra simulata.
  for (const entry of entries) if (entry.t <= start) vol = entry.step
  let lastMove = start
  let volAtNow: number = vol
  let nextChange: number | null = null
  for (let t = start + DAY; t <= nowT + 60 * DAY; t += DAY) {
    let target = vol
    for (const entry of entries) if (entry.t <= t - GIORNI_RITARDO_VOLUME * DAY) target = entry.step
    if (target !== vol && t - lastMove >= GIORNI_PER_GRADINO * DAY) {
      vol += target > vol ? 250 : -250
      lastMove = t
      if (t > nowT && nextChange === null) nextChange = Math.ceil((t - nowT) / DAY)
    }
    if (t <= nowT) volAtNow = vol
    if (t > nowT && nextChange !== null) break
  }
  const lastChange = entries[entries.length - 1].t
  return {
    volume_step: volAtNow as CalorieStep,
    days_since_change: Math.floor((nowT - lastChange) / DAY),
    next_change_in_days: volAtNow === currentStep ? null : nextChange,
    direction: volAtNow === currentStep ? null : currentStep > volAtNow ? 'up' : 'down',
  }
}

export interface PhaseInfo {
  /** Fase reale dichiarata/calcolata (dal gradino calorico). */
  phase: NutritionPhase
  /** Fase usata per l'interleave: quella del gradino di volume effettivo. */
  training_phase: NutritionPhase
  source: 'trend' | 'calcolo'
  maintenance_kcal: number | null
  maintenance_source: 'dichiarata' | 'formula' | null
  daily_kcal: number | null
  recovery_limited: boolean
  /** Gradino delle calorie di oggi. */
  calorie_step: CalorieStep
  /** Gradino su cui il motore calibra serie/RIR/tecniche: segue le calorie con la scala e
   *  scende di uno se sonno o stress limitano il recupero. */
  training_step: CalorieStep
  ramp: RampaVolume
  /** Spiegazione in italiano semplice, mostrata nel Profilo e nell'anteprima. */
  summary: string
}

export function recuperoLimitato(profile: Pick<Profile, 'sleep_hours' | 'stress_level'>): boolean {
  return (profile.sleep_hours != null && profile.sleep_hours < 6) || profile.stress_level === 'high'
}

const kcalDi = (normo: number | null, step: number) => (normo ? `${normo + step} kcal` : `gradino ${step > 0 ? '+' : ''}${step}`)

export function determinaFase(profile: Profile | null | undefined, log: CalorieLogEntry[] = [], now: Date = new Date()): PhaseInfo | null {
  if (!profile) return null
  const calorieStep = gradinoCalorie(profile)
  if (calorieStep === null) return null
  const normo = normocaloricaEffettiva(profile)
  const kcal = profile.daily_kcal ?? null
  const ramp = rampaVolume(calorieStep, log, now)
  const limited = recuperoLimitato(profile)
  const trainingStep = (limited ? Math.max(-500, ramp.volume_step - 250) : ramp.volume_step) as CalorieStep
  const phase = stepToPhase(calorieStep)
  const source: PhaseInfo['source'] = kcal && normo.kcal ? 'calcolo' : 'trend'

  const parti: string[] = []
  parti.push(kcal && normo.kcal
    ? `${PHASE_LABELS[phase]} (${stepLabel(calorieStep)}): ${kcal} kcal contro una normocalorica ${normo.source === 'dichiarata' ? 'dichiarata' : 'stimata'} di ~${normo.kcal} kcal`
    : `${PHASE_LABELS[phase]}: lo dice l'andamento del tuo peso`)
  if (ramp.direction) {
    parti.push(`Calorie cambiate da ${ramp.days_since_change} giorni: il volume è ancora al livello ${kcalDi(normo.kcal, ramp.volume_step)} e ${ramp.direction === 'up' ? 'sale' : 'scende'} di un gradino${ramp.next_change_in_days ? ` tra ${ramp.next_change_in_days} giorni` : ''} (le calorie guidano, il volume segue)`)
  }
  if (limited) {
    parti.push(trainingStep !== ramp.volume_step
      ? 'Sonno o stress limitano il recupero: volume abbassato di un gradino'
      : 'Sonno o stress limitano il recupero: volume già al minimo')
  }
  return {
    phase,
    training_phase: stepToPhase(trainingStep),
    source,
    maintenance_kcal: normo.kcal,
    maintenance_source: normo.source,
    daily_kcal: kcal,
    recovery_limited: limited,
    calorie_step: calorieStep,
    training_step: trainingStep,
    ramp,
    summary: parti.join('. ') + '.',
  }
}

/**
 * Esercizi da evitare per fastidio articolare (Categoria 3 del prompt). Regole prudenti e
 * dichiarate, non una diagnosi: si tolgono solo i movimenti notoriamente più stressanti per
 * quell'articolazione, e resta sempre un'alternativa guidata (macchina/cavo) per il muscolo.
 */
const JOINT_EXCLUDED_IDS: Record<JointIssue, string[]> = {
  shoulders: ['dip_parallele', 'dip_panca', 'dip_assisted', 'military_press', 'push_jerk', 'clean_jerk', 'handstand_pushup', 'overhead_squat', 'power_snatch', 'bar_muscle_up', 'kb_thruster', 'db_thruster', 'wall_ball'],
  elbows: ['french_press', 'estensioni_sopra_testa', 'curl_bilanciere', 'piegamenti_diamante', 'dip_parallele', 'dip_panca'],
  wrists: ['front_squat', 'clean_jerk', 'power_clean', 'power_snatch', 'push_jerk', 'handstand_pushup', 'curl_bilanciere', 'overhead_squat'],
  lower_back: ['good_morning_libero', 'superman'],
  knees: ['pistol_squat', 'bulgarian_split', 'affondi_libero', 'affondi_man', 'box_jump_over', 'jumping_pullup'],
}

export function escludiPerFastidi<T extends { id: string; axial_load?: number; movement_pattern: string; primary_muscles: string[] }>(
  catalog: T[],
  issues: JointIssue[] | null | undefined,
): T[] {
  if (!issues?.length) return catalog
  const ids = new Set(issues.flatMap((issue) => JOINT_EXCLUDED_IDS[issue] ?? []))
  return catalog.filter((exercise) => {
    if (ids.has(exercise.id)) return false
    // Schiena bassa: fuori tutto ciò che carica la colonna (squat, stacchi, rematore bilanciere).
    if (issues.includes('lower_back') && (exercise.axial_load ?? 0) >= 2) return false
    // Ginocchia: niente salti (i polpacci usano lo stesso pattern ma non stressano il ginocchio).
    if (issues.includes('knees') && exercise.movement_pattern === 'jump' && !exercise.primary_muscles.includes('calves')) return false
    return true
  })
}
