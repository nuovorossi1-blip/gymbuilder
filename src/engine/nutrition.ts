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

export interface PhaseInfo {
  /** Fase reale dichiarata/calcolata. */
  phase: NutritionPhase
  /** Fase usata per volume, RIR e tecniche: una sotto se il recupero è limitato. */
  training_phase: NutritionPhase
  source: 'trend' | 'calcolo'
  maintenance_kcal: number | null
  daily_kcal: number | null
  recovery_limited: boolean
  /** Spiegazione in italiano semplice, mostrata nel Profilo e nell'anteprima. */
  summary: string
}

const PHASE_DOWN: Record<NutritionPhase, NutritionPhase> = { surplus: 'maintenance', maintenance: 'deficit', deficit: 'deficit' }

export function recuperoLimitato(profile: Pick<Profile, 'sleep_hours' | 'stress_level'>): boolean {
  return (profile.sleep_hours != null && profile.sleep_hours < 6) || profile.stress_level === 'high'
}

export function determinaFase(profile: Profile | null | undefined): PhaseInfo | null {
  if (!profile) return null
  const maintenance = stimaNormocalorica(profile)
  const kcal = profile.daily_kcal ?? null
  let phase: NutritionPhase | null = null
  let source: PhaseInfo['source'] = 'calcolo'
  if (profile.weight_trend) {
    phase = profile.weight_trend === 'losing' ? 'deficit' : profile.weight_trend === 'gaining' ? 'surplus' : 'maintenance'
    source = 'trend'
  } else if (kcal && maintenance) {
    const ratio = kcal / maintenance
    phase = ratio < 0.9 ? 'deficit' : ratio > 1.1 ? 'surplus' : 'maintenance'
  }
  if (!phase) return null
  const limited = recuperoLimitato(profile)
  const training = limited ? PHASE_DOWN[phase] : phase
  const base = source === 'trend'
    ? `${PHASE_LABELS[phase]}: lo dice l'andamento del tuo peso`
    : `${PHASE_LABELS[phase]}: mangi ${kcal} kcal contro una normocalorica stimata di ~${maintenance} kcal`
  const extra = source === 'trend' && kcal && maintenance ? ` (mangi ${kcal} kcal, normocalorica stimata ~${maintenance})` : ''
  const recovery = limited && training !== phase
    ? `. Sonno o stress limitano il recupero: il volume segue le regole ${PHASE_LABELS[training].toLowerCase()}`
    : limited ? '. Sonno o stress limitano il recupero: volume già al minimo efficace' : ''
  return {
    phase, training_phase: training, source, maintenance_kcal: maintenance, daily_kcal: kcal,
    recovery_limited: limited, summary: `${base}${extra}${recovery}.`,
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
