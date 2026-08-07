import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { filterExercisesByPreferences } from '../engine/preferences'
import { adaptiveExcludedIds } from '../engine/feedback'
import { applyAutomaticProgramming, applyWorkoutRecovery, generateWeeklyProgram, selectProgramMode, updateWeeklySession } from '../engine/weeklyPlan'
import { validateWorkout } from '../engine/validator'
import { useAuth } from '../features/auth/AuthProvider'
import { useSettings } from '../features/profile/useSettings'
import { useWorkout } from '../features/workout/WorkoutContext'
import { generaBodybuilding } from '../generators/bodybuilding'
import { generaCrossFit } from '../generators/crossfit'
import { PRESET_EQUIPMENT } from '../generators/equipment'
import { generaHybrid } from '../generators/hybrid'
import { generaForza } from '../generators/strength'
import { generaTabata } from '../generators/tabata'
import type { WeeklyTrainingState } from '../generators/weakPoints'
import { aggiornaProgramma, caricaCatalogo, salvaProgramma, situazioneSettimanaleUtente } from '../lib/api'
import {
  DURATIONS, EQUIPMENT_ITEM_LABELS, EQUIPMENT_LABELS, EXERCISE_POLICY_LABELS,
  EXPERIENCE_LABELS, MODE_LABELS, MUSCLE_LABELS, PUBLIC_MODES, SPLIT_LABELS,
  SPLIT_SYSTEM_LABELS, type Equipment, type EquipmentItem, type Exercise,
  type ExercisePolicy, type Experience, type Muscle,
  type PublicMode, type Split, type SplitSystem, type Weekday, type WeeklyProgram,
  type WeeklyProgramConfig, type WeeklySession, type WorkoutGenerationConfig,
} from '../types'

const DAY_LABELS: Record<Weekday, string> = { monday: 'Lunedì', tuesday: 'Martedì', wednesday: 'Mercoledì', thursday: 'Giovedì', friday: 'Venerdì', saturday: 'Sabato', sunday: 'Domenica' }
const EDITABLE_SPLITS: Split[] = ['push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'front_body', 'back_body', 'bro_chest', 'bro_back', 'bro_shoulders', 'bro_arms', 'bro_legs']
const STRENGTH_SPLITS: Split[] = ['push', 'pull', 'legs', 'upper', 'lower', 'full_body']

const DEFAULT_CONFIG: WeeklyProgramConfig = {
  program_kind: 'program', duration_weeks: 4,
  training_days: 5, selected_modes: ['bodybuilding'], goal: 'hypertrophy',
  split_system: 'ppl', experience: 'beginner', duration_min: 60,
  single_session_split: 'push', hybrid_balance: 'bb_dominant',
  strength_method: '5x5', hybrid_method: 'full_body_functional', hybrid_format: 'amrap',
  equipment: { preset: 'full_gym', available: PRESET_EQUIPMENT.full_gym }, weak_points: [],
  preferences: { excluded_exercise_ids: [], preferred_exercise_ids: [], bodyweight_policy: 'always', elastic_policy: 'always' },
  intensity: 'medium', crossfit_format: 'amrap',
  tabata: { work_sec: 20, rest_sec: 10, rounds: 8, prescription: 'time' },
}

export default function Create() {
  const { user } = useAuth()
  const { profile } = useSettings(user?.id)
  const { weeklyProgram, setWeeklyProgram, setWorkout, setGenerationConfig, setCatalog, clearRejectedExercises } = useWorkout()
  const navigate = useNavigate()
  const [catalog, setLocalCatalog] = useState<Exercise[]>([])
  const [weeklyState, setWeeklyState] = useState<WeeklyTrainingState>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    caricaCatalogo().then((items) => {
      setLocalCatalog(items); setCatalog(items)
      if (user) void situazioneSettimanaleUtente(user.id, items).then(setWeeklyState)
    }).catch((reason: Error) => setError(reason.message))
  }, [setCatalog, user])

  async function createProgram(config: WeeklyProgramConfig) {
    try {
      const automaticConfig = applyAutomaticProgramming(config)
      const generated = generateWeeklyProgram(automaticConfig)
      if (automaticConfig.program_kind === 'single_session') {
        setWeeklyProgram(generated)
        generateDay(generated.week[0], generated)
        return
      }
      const program = automaticConfig.program_kind === 'program' && user ? await salvaProgramma(user.id, generated) : generated
      setWeeklyProgram(program); setError(null)
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Configurazione settimanale non valida.') }
  }

  function updateProgram(program: WeeklyProgram) {
    setWeeklyProgram(program)
    if (user && program.persisted) void aggiornaProgramma(user.id, program).catch((reason: Error) => setError(reason.message))
  }

  function generateDay(session: WeeklySession, sourceProgram = weeklyProgram) {
    if (!sourceProgram || catalog.length === 0) return
    const global = sourceProgram.config
    const adaptiveExcluded = user ? adaptiveExcludedIds(user.id, catalog) : []
    const excluded = [...new Set([...global.preferences.excluded_exercise_ids, ...adaptiveExcluded])]
    const usableCatalog = filterExercisesByPreferences(catalog, {
      excludedExerciseIds: excluded,
      bodyweightPolicy: global.preferences.bodyweight_policy,
      elasticPolicy: global.preferences.elastic_policy,
    }, 'normal')
    const dayCatalog = session.fatigue_avoid_muscles?.length
      ? usableCatalog.filter((exercise) => exercise.systemic_fatigue <= 1 || !exercise.primary_muscles.some((muscle) => session.fatigue_avoid_muscles?.includes(muscle)))
      : usableCatalog
    const common = {
      experience: global.experience, equipment: global.equipment.preset,
      available_equipment: global.equipment.available, duration_min: global.duration_min,
      priority_muscles: global.weak_points,
      excluded_exercises: excluded,
      preferred_exercises: global.preferences.preferred_exercise_ids,
      intensity: global.intensity, weight_kg: profile?.weight_kg ?? null,
      seed: Date.now() % 100000,
    }
    const split = session.split ?? 'full_body'
    const forzaCrossFit = global.selected_modes.includes('strength') && global.selected_modes.includes('crossfit')
    const workout = session.mode === 'crossfit'
      ? forzaCrossFit
        ? generaHybrid(dayCatalog, { ...common, format: global.crossfit_format === 'emom' ? 'emom' : global.crossfit_format === 'for_time' ? 'for_time' : 'amrap' })
        : generaCrossFit(dayCatalog, { ...common, format: global.crossfit_format })
      : session.mode === 'crossfit_hybrid' ? generaHybrid(dayCatalog, { ...common, priority_muscles: session.priority_muscles, method: global.program_kind === 'single_session' ? global.hybrid_method : session.priority_muscles.length > 0 ? 'specialization' : global.hybrid_method, format: global.program_kind === 'single_session' || session.variant === 'A' ? (global.hybrid_format ?? 'amrap') : 'emom' })
      : session.mode === 'strength' ? generaForza(dayCatalog, { ...common, split, method: global.strength_method, weekly_volume: weeklyState?.volume, last_trained_at: weeklyState?.last_trained_at })
      : session.mode === 'tabata' ? generaTabata(dayCatalog, { ...common, ...global.tabata })
      : generaBodybuilding(dayCatalog, { ...common, priority_muscles: session.priority_muscles ?? global.weak_points, split, goal: 'hypertrophy', weekly_volume: weeklyState?.volume, last_trained_at: weeklyState?.last_trained_at })
    if (forzaCrossFit && session.mode === 'crossfit') workout.name = `Forza + CrossFit · ${workout.name}`
    if (forzaCrossFit && session.mode === 'crossfit') workout.mode = 'crossfit'
    if (global.selected_modes.includes('bodybuilding') && global.selected_modes.includes('strength') && session.mode === 'strength') workout.name = `Powerlifting · ${workout.name}`
    workout.name = `${DAY_LABELS[session.day]} — ${workout.name}`
    workout.max_duration_min = Math.ceil(global.duration_min * 1.15)
    const config: WorkoutGenerationConfig = {
      mode: session.mode, goal: global.goal, split_system: global.split_system,
      training_days: global.training_days, current_day: session.split,
      experience: global.experience, duration_min: global.duration_min,
      equipment: global.equipment, weak_points: global.weak_points,
      preferences: { ...global.preferences, excluded_exercise_ids: excluded }, intensity: global.intensity,
      workout_format: session.mode === 'crossfit' ? global.crossfit_format : undefined,
      tabata: session.mode === 'tabata' ? global.tabata : undefined,
    }
    const validation = validateWorkout(workout, config, catalog)
    if (!validation.valid) { setError(validation.errors.join(' ')); return }
    clearRejectedExercises()
    updateProgram(applyWorkoutRecovery(sourceProgram, session.id, workout, catalog))
    setGenerationConfig(config); setWorkout(workout); setError(null); navigate('/allenamento')
  }

  return <main className="px-5 pb-6 pt-10">
    <p className="eyebrow mb-3">{profile?.display_name ? `Ciao ${profile.display_name.split(' ')[0]}` : 'GymBuilder'}</p>
    {weeklyProgram
      ? <WeekView program={weeklyProgram} error={error} onUpdate={updateProgram} onGenerate={generateDay} onReset={() => setWeeklyProgram(null)} />
      : <WeeklyBuilder catalog={catalog} error={error} initial={DEFAULT_CONFIG} onCreate={createProgram} />}
  </main>
}

function WeeklyBuilder({ catalog, error, initial, onCreate }: { catalog: Exercise[]; error: string | null; initial: WeeklyProgramConfig; onCreate: (config: WeeklyProgramConfig) => void | Promise<void> }) {
  const [config, setConfig] = useState(initial)
  const [advanced, setAdvanced] = useState(false)
  const [exercisePreferences, setExercisePreferences] = useState(false)
  const valid = config.selected_modes.length > 0 && config.selected_modes.length <= (config.program_kind === 'single_session' ? 1 : 2) && catalog.length > 0
  const patch = <K extends keyof WeeklyProgramConfig>(key: K, value: WeeklyProgramConfig[K]) => setConfig((old) => ({ ...old, [key]: value }))
  const toggleMode = (mode: PublicMode) => patch('selected_modes', selectProgramMode(config.selected_modes, mode))
  const toggleMuscle = (muscle: Muscle) => patch('weak_points', config.weak_points.includes(muscle) ? config.weak_points.filter((item) => item !== muscle) : [...config.weak_points, muscle])
  const setPolicy = (key: 'bodyweight_policy' | 'elastic_policy', value: ExercisePolicy) => patch('preferences', { ...config.preferences, [key]: value })
  const toggleExercise = (key: 'preferred_exercise_ids' | 'excluded_exercise_ids', id: string) => {
    const current = config.preferences[key]
    patch('preferences', { ...config.preferences, [key]: current.includes(id) ? current.filter((item) => item !== id) : [...current, id] })
  }
  return <>
    <h1 className="font-display text-[2.7rem] font-extrabold uppercase leading-[.88] tracking-tight">Costruisci il<br />tuo allenamento</h1>
    <p className="mt-4 max-w-md text-sm leading-relaxed text-slate2">Tu scegli struttura e preferenze. GymBuilder decide automaticamente metodologie, intensità e ordine degli esercizi.</p>
    <Field title="Cosa vuoi creare?"><Grid><Choice active={config.program_kind === 'program'} onClick={() => patch('program_kind', 'program')}>Programma</Choice><Choice active={config.program_kind === 'single_session'} onClick={() => { patch('program_kind', 'single_session'); patch('selected_modes', [config.selected_modes[0] ?? 'bodybuilding']) }}>Sessione singola</Choice></Grid><p className="mt-2 text-xs text-slate2">Il programma salva una split ripetibile; la sessione singola vale soltanto per oggi.</p></Field>
    {config.program_kind === 'program' ? <><Field title="Numero giorni"><div className="grid grid-cols-5 gap-2">{[3, 4, 5, 6, 7].map((days) => <Choice key={days} active={config.training_days === days} onClick={() => patch('training_days', days)}>{days}</Choice>)}</div></Field><Field title="Durata programma"><div className="grid grid-cols-4 gap-2">{[2, 4, 6, 8].map((weeks) => <Choice key={weeks} active={config.duration_weeks === weeks} onClick={() => patch('duration_weeks', weeks)}>{weeks} sett.</Choice>)}</div><p className="mt-2 text-xs text-slate2">Minimo due settimane. Potrai mantenere gli stessi slot e alternare le varianti A/B.</p></Field></> : null}
    <Field title={config.program_kind === 'program' ? 'Discipline della settimana' : 'Tipo di sessione'}><div className="grid grid-cols-2 gap-2">{PUBLIC_MODES.map((mode) => <Choice key={mode} active={config.selected_modes.includes(mode)} onClick={() => config.program_kind === 'single_session' ? patch('selected_modes', [mode]) : toggleMode(mode)}>{MODE_LABELS[mode]}</Choice>)}</div>{config.program_kind === 'program' && config.selected_modes.length > 0 ? <div className="mt-3 rounded-xl border border-amber2/40 bg-amber2/10 px-3 py-3"><p className="text-[.65rem] uppercase tracking-widest text-amber2">Selezione attiva · {config.selected_modes.length}/2</p><p className="mt-1 font-display font-bold uppercase">{config.selected_modes.map((mode) => MODE_LABELS[mode]).join(' + ')}</p></div> : null}<p className="mt-2 text-xs text-slate2">{config.program_kind === 'program' ? 'Puoi scegliere al massimo due discipline. Se ne hai già scelte due, toccarne una nuova sostituisce la seconda.' : 'Scegli una sola modalità per l’allenamento di oggi.'}</p></Field>
    {config.program_kind === 'program' && config.selected_modes.includes('bodybuilding') ? <Field title="Sistema Bodybuilding"><Grid>{(Object.keys(SPLIT_SYSTEM_LABELS) as SplitSystem[]).map((system) => <Choice key={system} active={config.split_system === system} onClick={() => patch('split_system', system)}>{SPLIT_SYSTEM_LABELS[system]}</Choice>)}</Grid><p className="mt-2 text-xs text-slate2">Definisce prima la struttura settimanale; gli esercizi si generano soltanto dopo aver salvato la split.</p></Field> : null}
    {config.program_kind === 'single_session' && (config.selected_modes.includes('bodybuilding') || config.selected_modes.includes('strength')) ? <Field title="Seduta di oggi"><div className="grid grid-cols-2 gap-2">{(config.selected_modes.includes('strength') ? STRENGTH_SPLITS : EDITABLE_SPLITS).map((split) => <Choice key={split} active={config.single_session_split === split} onClick={() => patch('single_session_split', split)}>{SPLIT_LABELS[split]}</Choice>)}</div><p className="mt-2 text-xs text-slate2">Scegli direttamente Push, Pull, Legs, Upper, Lower, Front, Back o il giorno Bro Split: non viene creato un calendario.</p></Field> : null}
    {config.program_kind === 'single_session' && config.selected_modes.includes('strength') ? <Field title="Metodologia della sessione"><div className="grid grid-cols-2 gap-2">{([['5x5','5×5'],['3x5','3×5'],['max_strength','Forza massimale'],['strength_accessories','Forza + complementari']] as const).map(([method,label]) => <Choice key={method} active={config.strength_method === method} onClick={() => patch('strength_method', method)}>{label}</Choice>)}</div></Field> : null}
    {config.program_kind === 'single_session' && config.selected_modes.includes('crossfit') ? <Field title="Formato della sessione"><div className="grid grid-cols-2 gap-2">{(['amrap', 'emom', 'for_time', 'rounds', 'chipper', 'ladder', 'intervals'] as const).map((format) => <Choice key={format} active={config.crossfit_format === format} onClick={() => patch('crossfit_format', format)}>{format === 'for_time' ? 'For Time' : format === 'rounds' ? 'Rounds For Time' : format.charAt(0).toUpperCase() + format.slice(1)}</Choice>)}</div></Field> : null}
    {config.program_kind === 'single_session' && config.selected_modes.includes('crossfit_hybrid') ? <Field title="Metodologia della sessione"><div className="grid grid-cols-2 gap-2">{([['upper_conditioning','Upper / Conditioning'],['lower_conditioning','Lower / Conditioning'],['full_body_functional','Full Body Functional'],['specialization','Specializzazione carenze']] as const).map(([method,label]) => <Choice key={method} active={config.hybrid_method === method} onClick={() => patch('hybrid_method', method)}>{label}</Choice>)}</div><div className="mt-3 grid grid-cols-2 gap-2">{(['amrap','emom','for_time','intervals'] as const).map((format) => <Choice key={format} active={config.hybrid_format === format} onClick={() => patch('hybrid_format', format)}>{format === 'for_time' ? 'For Time' : format.toUpperCase()}</Choice>)}</div></Field> : null}
    {config.program_kind === 'program' && config.selected_modes.length === 2 && config.selected_modes.includes('bodybuilding') && config.selected_modes.includes('crossfit_hybrid') ? <Field title="Distribuzione BB + Hybrid"><div className="space-y-2"><Choice active={config.hybrid_balance === 'bb_dominant'} onClick={() => patch('hybrid_balance', 'bb_dominant')}>BB dominante</Choice><Choice active={config.hybrid_balance === 'balanced'} onClick={() => patch('hybrid_balance', 'balanced')}>BB + HY equilibrato</Choice><Choice active={config.hybrid_balance === 'hy_dominant'} onClick={() => patch('hybrid_balance', 'hy_dominant')}>HY più frequente</Choice></div></Field> : null}
    {config.program_kind === 'program' ? <section className="mt-5 rounded-2xl border border-amber2/30 bg-amber2/10 p-4"><p className="eyebrow text-amber2">Programmazione automatica</p><h2 className="mt-1 font-display text-lg font-bold uppercase">Il motore completa il piano</h2><p className="mt-2 text-sm leading-relaxed text-slate2">Metodo Forza, formato CrossFit o Hybrid, intensità, volume, recuperi e ordine vengono scelti in base alle tue discipline, al livello, alla durata e alla fatica accumulata.</p></section> : null}
    {config.selected_modes.includes('tabata') ? <Field title="Protocollo Tabata"><NumberField label="Lavoro (sec)" value={config.tabata.work_sec} onChange={(work_sec) => patch('tabata', { ...config.tabata, work_sec })} /><NumberField label="Riposo (sec)" value={config.tabata.rest_sec} onChange={(rest_sec) => patch('tabata', { ...config.tabata, rest_sec })} /><NumberField label="Round" value={config.tabata.rounds} onChange={(rounds) => patch('tabata', { ...config.tabata, rounds })} /><Grid><Choice active={config.tabata.prescription === 'time'} onClick={() => patch('tabata', { ...config.tabata, prescription: 'time' })}>A tempo</Choice><Choice active={config.tabata.prescription === 'reps'} onClick={() => patch('tabata', { ...config.tabata, prescription: 'reps' })}>A ripetizioni</Choice></Grid></Field> : null}
    <Field title="Livello"><div className="grid grid-cols-2 gap-2">{(['beginner', 'advanced'] as Experience[]).map((experience) => <Choice key={experience} active={config.experience === experience || (experience === 'beginner' && config.experience === 'intermediate')} onClick={() => patch('experience', experience)}>{EXPERIENCE_LABELS[experience]}</Choice>)}</div><p className="mt-2 text-xs text-slate2">Principiante include le progressioni intermedie; Avanzato include avanzato ed esperto.</p></Field>
    {config.selected_modes.includes('crossfit') ? <section className="mt-6 rounded-xl border border-edge bg-steel p-4"><h3 className="font-display font-bold uppercase">Cos’è CrossFit Standard</h3><p className="mt-2 text-sm leading-relaxed text-slate2">Una seduta full body, costantemente variata, composta da movimenti funzionali: riscaldamento, tecnica o forza, WOD e recupero. Il WOD combina cardio, sollevamento e ginnastica; non usa esercizi di isolamento bodybuilding.</p><p className="mt-2 text-xs text-slate2">Hybrid è diverso: applica AMRAP, EMOM, For Time o Intervals a cardio e complementari bodybuilding a carico controllato.</p></section> : null}
    <Field title="Durata per sessione"><div className="grid grid-cols-5 gap-2">{DURATIONS.map((duration) => <Choice key={duration} active={config.duration_min === duration} onClick={() => patch('duration_min', duration)}>{duration}</Choice>)}</div></Field>
    <Field title="Attrezzatura globale"><Grid>{(Object.keys(EQUIPMENT_LABELS) as Equipment[]).filter((item) => ['full_gym', 'dumbbells', 'barbell', 'machines', 'home_gym'].includes(item)).map((equipment) => <Choice key={equipment} active={config.equipment.preset === equipment} onClick={() => patch('equipment', { preset: equipment, available: PRESET_EQUIPMENT[equipment] })}>{EQUIPMENT_LABELS[equipment]}</Choice>)}</Grid><button className="mt-3 text-xs uppercase tracking-wider text-amber2" onClick={() => setAdvanced((old) => !old)}>{advanced ? 'Chiudi inventario' : 'Configurazione avanzata'}</button>{advanced ? <div className="mt-3 grid grid-cols-2 gap-2">{(Object.keys(EQUIPMENT_ITEM_LABELS) as EquipmentItem[]).map((item) => <Choice key={item} active={config.equipment.available.includes(item)} onClick={() => patch('equipment', { ...config.equipment, available: config.equipment.available.includes(item) ? config.equipment.available.filter((value) => value !== item) : [...config.equipment.available, item] })}>{EQUIPMENT_ITEM_LABELS[item]}</Choice>)}</div> : null}</Field>
    <Field title="Muscoli carenti globali"><div className="flex flex-wrap gap-2">{(Object.keys(MUSCLE_LABELS) as Muscle[]).map((muscle) => <Choice key={muscle} active={config.weak_points.includes(muscle)} onClick={() => toggleMuscle(muscle)}>{MUSCLE_LABELS[muscle]}</Choice>)}</div></Field>
    <Field title="Policy globali"><Policy title="Corpo libero" value={config.preferences.bodyweight_policy} onChange={(value) => setPolicy('bodyweight_policy', value)} /><Policy title="Elastici" value={config.preferences.elastic_policy} onChange={(value) => setPolicy('elastic_policy', value)} /><button className="mt-4 text-xs uppercase tracking-wider text-amber2" onClick={() => setExercisePreferences((old) => !old)}>{exercisePreferences ? 'Chiudi esercizi' : 'Preferiti / Esclusi'}</button>{exercisePreferences ? <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{catalog.filter((exercise) => !exercise.roles.includes('warmup')).map((exercise) => <div key={exercise.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-edge py-2 text-sm"><span>{exercise.name}</span><button className={config.preferences.preferred_exercise_ids.includes(exercise.id) ? 'text-amber2' : 'text-slate2'} onClick={() => toggleExercise('preferred_exercise_ids', exercise.id)}>Preferito</button><button className={config.preferences.excluded_exercise_ids.includes(exercise.id) ? 'text-amber2' : 'text-slate2'} onClick={() => toggleExercise('excluded_exercise_ids', exercise.id)}>Escludi</button></div>)}</div> : null}</Field>
    {config.selected_modes.length > 2 ? <p className="mt-5 text-amber2">Un programma può combinare al massimo due discipline.</p> : null}
    {error ? <p role="alert" className="mt-5 text-amber2">{error}</p> : null}
    <button className="btn mt-8 !py-4 text-lg" disabled={!valid} onClick={() => void onCreate(config)}>{catalog.length ? (config.program_kind === 'program' ? 'Salva la split' : 'Genera la sessione') : 'Caricamento esercizi…'}</button>
  </>
}

function WeekView({ program, error, onUpdate, onGenerate, onReset }: { program: WeeklyProgram; error: string | null; onUpdate: (program: WeeklyProgram) => void; onGenerate: (session: WeeklySession) => void; onReset: () => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  return <>
    <p className="eyebrow mb-3">{program.config.program_kind === 'program' ? 'Programma salvato' : 'Sessione singola'}</p><h1 className="font-display text-[2.7rem] font-extrabold uppercase leading-[.88] tracking-tight">{program.config.program_kind === 'program' ? <>La tua<br />settimana</> : <>Allenamento<br />di oggi</>}</h1>
    <p className="mt-4 text-sm text-slate2">{program.config.program_kind === 'program' ? `${program.config.training_days} giorni · ${program.config.duration_weeks} settimane · ` : ''}{program.config.selected_modes.map((mode) => MODE_LABELS[mode]).join(' + ')}</p>
    {program.warnings.map((warning) => <p key={`${warning.code}-${warning.day_ids.join('-')}`} className="mt-4 rounded-lg border border-amber2/40 bg-amber2/10 px-3 py-2 text-sm text-amber2">{warning.message}</p>)}
    <div className="mt-7 space-y-3">{program.week.map((session) => <article key={session.id} className="slab"><p className="eyebrow">{DAY_LABELS[session.day]}</p><h2 className="mt-1 font-display text-lg font-bold uppercase">{session.label}</h2>{editing === session.id ? <SessionEditor session={session} onChange={(patch) => onUpdate(updateWeeklySession(program, session.id, patch))} onClose={() => setEditing(null)} /> : <div className="mt-4 grid grid-cols-2 gap-2"><button className="rounded-xl border border-edge py-3 font-data text-xs uppercase" onClick={() => setEditing(session.id)}>Modifica</button><button className="rounded-xl bg-chalk py-3 font-data text-xs uppercase text-ink" onClick={() => onGenerate(session)}>Genera giorno</button></div>}</article>)}</div>
    {error ? <p role="alert" className="mt-5 text-amber2">{error}</p> : null}
    <button className="mt-7 w-full rounded-xl border border-edge py-3.5 font-data text-xs uppercase text-slate2" onClick={onReset}>Crea una nuova settimana</button>
  </>
}

function SessionEditor({ session, onChange, onClose }: { session: WeeklySession; onChange: (patch: Partial<Pick<WeeklySession, 'day' | 'mode' | 'split'>>) => void; onClose: () => void }) {
  const splits = session.mode === 'strength' ? STRENGTH_SPLITS : EDITABLE_SPLITS
  return <div className="mt-4 space-y-3 border-t border-edge pt-4"><label className="block text-xs text-slate2">Giorno<select className="input mt-1" value={session.day} onChange={(event) => onChange({ day: event.target.value as Weekday })}>{(Object.keys(DAY_LABELS) as Weekday[]).map((day) => <option key={day} value={day}>{DAY_LABELS[day]}</option>)}</select></label><label className="block text-xs text-slate2">Modalità<select className="input mt-1" value={session.mode} onChange={(event) => onChange({ mode: event.target.value as PublicMode, split: null })}>{PUBLIC_MODES.map((mode) => <option key={mode} value={mode}>{MODE_LABELS[mode]}</option>)}</select></label>{session.mode === 'bodybuilding' || session.mode === 'strength' ? <label className="block text-xs text-slate2">Split<select className="input mt-1" value={session.split ?? 'full_body'} onChange={(event) => onChange({ split: event.target.value as Split })}>{splits.map((split) => <option key={split} value={split}>{SPLIT_LABELS[split]}</option>)}</select></label> : null}<button className="text-xs uppercase tracking-wider text-amber2" onClick={onClose}>Fine modifica</button></div>
}

function Field({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-4 rounded-2xl border border-edge bg-steel/70 p-4"><h2 className="field-label">{title}</h2>{children}</section> }
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-2 gap-2">{children}</div> }
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" aria-pressed={active} onClick={onClick} className={`chip w-full text-left ${active ? 'chip-on' : ''}`}>{children}</button> }
function Policy({ title, value, onChange }: { title: string; value: ExercisePolicy; onChange: (value: ExercisePolicy) => void }) { return <div className="mt-3"><p className="mb-2 text-sm">{title}</p><div className="grid grid-cols-3 gap-2">{(Object.keys(EXERCISE_POLICY_LABELS) as ExercisePolicy[]).map((policy) => <Choice key={policy} active={value === policy} onClick={() => onChange(policy)}>{EXERCISE_POLICY_LABELS[policy]}</Choice>)}</div></div> }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="mb-3 grid grid-cols-[1fr_6rem] items-center gap-3 text-sm">{label}<input className="input" type="number" min="1" value={value} onChange={(event) => onChange(Math.max(1, Number(event.target.value)))} /></label> }
