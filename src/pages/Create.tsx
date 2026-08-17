import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { filterExercisesByPreferences, preferencePlacementForMode } from '../engine/preferences'
import { adaptiveExcludedIds } from '../engine/feedback'
import { applyAutomaticProgramming, applyWorkoutRecovery, generateWeeklyProgram, selectProgramMode, updateWeeklySession } from '../engine/weeklyPlan'
import { adaptPrescriptionForProfile, resolveEffectiveWeakPoints } from '../engine/biomechanics'
import { validateWorkout } from '../engine/validator'
import { useAuth } from '../features/auth/AuthProvider'
import { loadLocalAiSettings } from '../features/profile/aiSettings'
import { useSettings } from '../features/profile/useSettings'
import { useWorkout } from '../features/workout/WorkoutContext'
import { generaBodybuilding } from '../generators/bodybuilding'
import { FORMATI_CROSSFIT, generaCrossFit } from '../generators/crossfit'
import { isExerciseAvailable, PRESET_EQUIPMENT } from '../generators/equipment'
import { generaHybrid } from '../generators/hybrid'
import { generaForza } from '../generators/strength'
import { generaTabata } from '../generators/tabata'
import type { WeeklyTrainingState } from '../generators/weakPoints'
import { aggiornaProgramma, caricaCatalogo, salvaProgramma, situazioneSettimanaleUtente } from '../lib/api'
import { generateWorkoutsWithDeepSeek } from '../lib/deepseek'
import {
  CROSSFIT_BENCHMARK_HINTS, CROSSFIT_BENCHMARK_LABELS, DURATIONS, EQUIPMENT_ITEM_LABELS, EQUIPMENT_LABELS, EXERCISE_POLICY_LABELS,
  METCON_FORMAT_HINTS, METCON_FORMAT_LABELS, MODE_LABELS, MUSCLE_LABELS, PUBLIC_MODES, SPLIT_LABELS,
  SPLIT_SYSTEM_LABELS, type Equipment, type EquipmentItem, type Exercise,
  type ExercisePolicy, type Muscle,
  type CrossFitBenchmark, type PublicMode, type Split, type SplitSystem, type Weekday, type WeeklyProgram,
  type WeeklyProgramConfig, type WeeklySession, type WorkoutGenerationConfig,
} from '../types'
import { SwipeContainer } from '../components/SwipeContainer'

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
  intensity: 'medium', crossfit_format: 'amrap', crossfit_benchmark: 'custom',
  tabata: { work_sec: 20, rest_sec: 10, rounds: 8, prescription: 'time' },
}

export default function Create() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { profile } = useSettings(user?.id)
  const { weeklyProgram, setWeeklyProgram, setWorkout, setGenerationConfig, setCatalog, startWorkoutSession, clearRejectedExercises } = useWorkout()
  const navigate = useNavigate()
  const [catalog, setLocalCatalog] = useState<Exercise[]>([])
  const [weeklyState, setWeeklyState] = useState<WeeklyTrainingState>()
  const [error, setError] = useState<string | null>(null)

  const initialKind = searchParams.get('program_kind') === 'single_session' ? 'single_session' : 'program'
  const freshEntry = searchParams.get('fresh') === '1'
  const [builderInitial, setBuilderInitial] = useState<WeeklyProgramConfig>(() =>
    weeklyProgram && !freshEntry
      ? weeklyProgram.config
      : {
          ...DEFAULT_CONFIG,
          program_kind: initialKind,
        }
  )
  const [builderStep, setBuilderStep] = useState<1 | 2>(1)
  const freshResetDone = useRef(false)

  useEffect(() => {
    if (!freshEntry || freshResetDone.current) return
    freshResetDone.current = true
    setWeeklyProgram(null)
    setWorkout(null)
    setGenerationConfig(null)
    clearRejectedExercises()
  }, [clearRejectedExercises, freshEntry, setGenerationConfig, setWeeklyProgram, setWorkout])

  useEffect(() => {
    caricaCatalogo().then((items) => {
      setLocalCatalog(items); setCatalog(items)
      if (user) void situazioneSettimanaleUtente(user.id, items).then(setWeeklyState)
    }).catch((reason: Error) => setError(reason.message))
  }, [setCatalog, user])

  async function createProgram(config: WeeklyProgramConfig) {
    try {
      const effectiveWeakPoints = resolveEffectiveWeakPoints(config.weak_points, profile)
      const isTabata = config.selected_modes.includes('tabata')
      const configWithProfile = {
        ...config,
        weak_points: effectiveWeakPoints,
        program_kind: isTabata ? ('single_session' as const) : config.program_kind,
      }
      const automaticConfig = applyAutomaticProgramming(configWithProfile)
      const generated = generateWeeklyProgram(automaticConfig)
      setBuilderInitial(generated.config)
      if (automaticConfig.program_kind === 'single_session' || isTabata) {
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

  function buildGenerationConfig(sourceProgram: WeeklyProgram, session: WeeklySession, excluded: string[], llmPrompt?: string): WorkoutGenerationConfig {
    const global = sourceProgram.config
    return {
      program_kind: global.program_kind,
      duration_weeks: global.duration_weeks,
      generator_source: session.generated_workout ? 'llm' : 'engine',
      llm_provider: session.generated_workout ? 'deepseek' : undefined,
      llm_prompt: session.generated_workout ? llmPrompt : undefined,
      mode: session.mode,
      goal: global.goal,
      split_system: global.split_system,
      training_days: global.training_days,
      current_day: session.split,
      experience: global.experience,
      duration_min: global.duration_min,
      equipment: global.equipment,
      weak_points: global.weak_points,
      target_muscles: global.program_kind === 'single_session'
        ? (global.single_session_target_muscles?.length ? global.single_session_target_muscles : [])
        : session.priority_muscles,
      preferences: { ...global.preferences, excluded_exercise_ids: excluded },
      intensity: global.intensity,
      workout_format: session.mode === 'crossfit' ? global.crossfit_format : undefined,
      crossfit_benchmark: session.mode === 'crossfit' ? global.crossfit_benchmark : undefined,
      tabata: session.mode === 'tabata' ? global.tabata : undefined,
    }
  }

  function finalizeWorkout(
    session: WeeklySession,
    sourceProgram: WeeklyProgram,
    workoutBase: ReturnType<typeof generaBodybuilding> | ReturnType<typeof generaCrossFit>,
    llmPrompt?: string
  ) {
    const global = sourceProgram.config
    const adaptiveExcluded = user ? adaptiveExcludedIds(user.id, catalog) : []
    const excluded = [...new Set([...global.preferences.excluded_exercise_ids, ...adaptiveExcluded])]
    const workout = {
      ...workoutBase,
      blocks: workoutBase.blocks.map((block) => ({
        ...block,
        exercises: block.exercises.map((exercise) => ({ ...exercise })),
      })),
      warnings: [...workoutBase.warnings],
    }
    const forzaCrossFit = global.selected_modes.includes('strength') && global.selected_modes.includes('crossfit')
    if (forzaCrossFit && session.mode === 'crossfit') workout.name = `Forza + CrossFit · ${workout.name}`
    if (forzaCrossFit && session.mode === 'crossfit') workout.mode = 'crossfit'
    if (global.selected_modes.includes('bodybuilding') && global.selected_modes.includes('strength') && session.mode === 'strength') workout.name = `Powerlifting · ${workout.name}`
    if (!workout.name.startsWith(DAY_LABELS[session.day])) workout.name = `${DAY_LABELS[session.day]} — ${workout.name}`
    workout.max_duration_min = Math.ceil(global.duration_min * 1.15)
    if (profile) {
      workout.blocks = workout.blocks.map((block) => ({
        ...block,
        exercises: block.exercises.map((prescribed) => adaptPrescriptionForProfile(prescribed, profile)),
      }))
    }
    const generationConfig = buildGenerationConfig(sourceProgram, session, excluded, llmPrompt)
    const validation = validateWorkout(workout, generationConfig, catalog)
    if (!validation.valid) { setError(validation.errors.join(' ')); return }
    clearRejectedExercises()
    updateProgram(applyWorkoutRecovery(sourceProgram, session.id, workout, catalog))
    setGenerationConfig(generationConfig)
    setWorkout(workout)
    setError(null)
    if (session.mode === 'tabata') {
      startWorkoutSession(workout, generationConfig)
      navigate('/avvia')
    } else {
      navigate('/allenamento')
    }
  }

  function generateDay(session: WeeklySession, sourceProgram = weeklyProgram) {
    if (!sourceProgram || catalog.length === 0) return
    if (session.generated_workout) {
      finalizeWorkout(session, sourceProgram, session.generated_workout)
      return
    }
    const global = sourceProgram.config
    const adaptiveExcluded = user ? adaptiveExcludedIds(user.id, catalog) : []
    const excluded = [...new Set([...global.preferences.excluded_exercise_ids, ...adaptiveExcluded])]
    const usableCatalog = filterExercisesByPreferences(catalog, {
      excludedExerciseIds: excluded,
      bodyweightPolicy: global.preferences.bodyweight_policy,
      elasticPolicy: global.preferences.elastic_policy,
    }, preferencePlacementForMode(session.mode))
    const dayCatalog = session.fatigue_avoid_muscles?.length
      ? usableCatalog.filter((exercise) => exercise.systemic_fatigue <= 1 || !exercise.primary_muscles.some((muscle) => session.fatigue_avoid_muscles?.includes(muscle)))
      : usableCatalog
    const common = {
      experience: global.experience,
      equipment: global.equipment.preset,
      available_equipment: global.equipment.available,
      duration_min: global.duration_min,
      priority_muscles: global.weak_points,
      excluded_exercises: excluded,
      preferred_exercises: global.preferences.preferred_exercise_ids,
      intensity: global.intensity,
      weight_kg: profile?.weight_kg ?? null,
      seed: Date.now() % 100000,
    }
    const todayTargets = global.program_kind === 'single_session'
      ? (global.single_session_target_muscles?.length ? global.single_session_target_muscles : [])
      : session.priority_muscles
    const todayPriorities = global.program_kind === 'single_session' ? global.weak_points : session.priority_muscles
    const split = session.split ?? 'full_body'
    const forzaCrossFit = global.selected_modes.includes('strength') && global.selected_modes.includes('crossfit')
    const workout = session.mode === 'crossfit'
      ? forzaCrossFit
        ? generaHybrid(dayCatalog, { ...common, format: session.metcon_format === 'emom' ? 'emom' : session.metcon_format === 'for_time' ? 'for_time' : 'amrap' })
        : generaCrossFit(dayCatalog, { ...common, priority_muscles: todayPriorities, target_muscles: todayTargets, format: session.metcon_format ?? global.crossfit_format, benchmark: global.crossfit_benchmark })
      : session.mode === 'crossfit_hybrid'
        ? generaHybrid(dayCatalog, { ...common, priority_muscles: todayPriorities, target_muscles: todayTargets, method: global.program_kind === 'single_session' && todayTargets.length > 0 ? 'specialization' : global.program_kind === 'single_session' ? global.hybrid_method : session.priority_muscles.length > 0 ? 'specialization' : global.hybrid_method, format: (session.metcon_format === 'amrap' || session.metcon_format === 'emom' || session.metcon_format === 'for_time' || session.metcon_format === 'intervals') ? session.metcon_format : global.hybrid_format })
        : session.mode === 'strength'
          ? generaForza(dayCatalog, { ...common, priority_muscles: todayPriorities, target_muscles: todayTargets, split, method: global.strength_method, weekly_volume: weeklyState?.volume, last_trained_at: weeklyState?.last_trained_at })
          : session.mode === 'tabata'
            ? generaTabata(dayCatalog, { ...common, ...global.tabata })
            : generaBodybuilding(dayCatalog, { ...common, priority_muscles: todayPriorities, target_muscles: todayTargets, split, goal: 'hypertrophy', weekly_volume: weeklyState?.volume, last_trained_at: weeklyState?.last_trained_at })
    finalizeWorkout(session, sourceProgram, workout)
  }


  async function createProgramWithAi(config: WeeklyProgramConfig, prompt: string) {
    try {
      const effectiveWeakPoints = resolveEffectiveWeakPoints(config.weak_points, profile)
      const normalizedConfig = applyAutomaticProgramming({
        ...config,
        weak_points: effectiveWeakPoints,
        program_kind: config.selected_modes.includes('tabata') ? ('single_session' as const) : config.program_kind,
      })
      const skeletonProgram = generateWeeklyProgram(normalizedConfig)
      const adaptiveExcluded = user ? adaptiveExcludedIds(user.id, catalog) : []
      const excluded = [...new Set([...normalizedConfig.preferences.excluded_exercise_ids, ...adaptiveExcluded])]
      const preferredCatalog = filterExercisesByPreferences(catalog, {
        excludedExerciseIds: excluded,
        bodyweightPolicy: normalizedConfig.preferences.bodyweight_policy,
        elasticPolicy: normalizedConfig.preferences.elastic_policy,
      }, 'normal')
      const usableCatalog = preferredCatalog.filter((exercise) => isExerciseAvailable(
        exercise,
        normalizedConfig.equipment.preset,
        normalizedConfig.equipment.available
      ))
      const aiSettings = loadLocalAiSettings()
      const aiResult = await generateWorkoutsWithDeepSeek(aiSettings, {
        config: normalizedConfig,
        prompt: prompt.trim() || 'Genera un allenamento completo rispettando tutte le impostazioni selezionate.',
        program: skeletonProgram,
        catalog: usableCatalog,
      })
      const aiSessions = new Map(aiResult.sessions.map((item) => [item.session_id, item.workout]))
      const hydratedProgram: WeeklyProgram = {
        ...skeletonProgram,
        week: skeletonProgram.week.map((session) => ({
          ...session,
          generated_workout: aiSessions.get(session.id),
        })),
      }
      if (hydratedProgram.week.some((session) => !session.generated_workout)) {
        throw new Error('DeepSeek non ha compilato tutte le sessioni richieste.')
      }
      setBuilderInitial(hydratedProgram.config)
      if (hydratedProgram.config.program_kind === 'single_session') {
        setWeeklyProgram(hydratedProgram)
        finalizeWorkout(hydratedProgram.week[0], hydratedProgram, hydratedProgram.week[0].generated_workout!, prompt)
        return
      }
      const program = user ? await salvaProgramma(user.id, hydratedProgram) : hydratedProgram
      setWeeklyProgram(program)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Non siamo riusciti a generare con DeepSeek.')
      throw reason
    }
  }


  return (
    <main className="px-4 pb-28 pt-6">
      {weeklyProgram ? (
        <WeekView
          program={weeklyProgram}
          error={error}
          onUpdate={updateProgram}
          onGenerate={generateDay}
          onReset={() => {
            setBuilderInitial({
              ...DEFAULT_CONFIG,
              program_kind: initialKind,
            })
            setBuilderStep(1)
            setWeeklyProgram(null)
          }}
          onEditConfig={() => {
            setBuilderInitial(weeklyProgram.config)
            setBuilderStep(2)
            setWeeklyProgram(null)
          }}
        />
      ) : (
        <WizardBuilder
          catalog={catalog}
          error={error}
          initial={builderInitial}
          initialStep={builderStep}
          onCreate={createProgram}
          onCreateWithAi={createProgramWithAi}
        />
      )}
    </main>
  )
}

function WizardBuilder({
  catalog,
  error,
  initial,
  initialStep,
  onCreate,
  onCreateWithAi,
}: {
  catalog: Exercise[]
  error: string | null
  initial: WeeklyProgramConfig
  initialStep: 1 | 2
  onCreate: (config: WeeklyProgramConfig) => void | Promise<void>
  onCreateWithAi: (config: WeeklyProgramConfig, prompt: string) => void | Promise<void>
}) {
  const [step, setStep] = useState<1 | 2>(initialStep)
  const [config, setConfig] = useState(initial)
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left')
  const [advanced, setAdvanced] = useState(false)
  const [exercisePreferences, setExercisePreferences] = useState(false)
  const [singleSessionMode, setSingleSessionMode] = useState<'custom_muscles' | 'preset_split'>('custom_muscles')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    setConfig(initial)
    setStep(initialStep)
    setSlideDirection('left')
    setAdvanced(false)
    setExercisePreferences(false)
    setAiPrompt('')
    setAiState('idle')
    setAiError(null)
    setSingleSessionMode(initial.single_session_target_muscles?.length ? 'custom_muscles' : 'preset_split')
  }, [initial, initialStep])

  const valid =
    config.selected_modes.length > 0 &&
    config.selected_modes.length <= (config.program_kind === 'single_session' ? 1 : 2) &&
    catalog.length > 0

  const patch = <K extends keyof WeeklyProgramConfig>(key: K, value: WeeklyProgramConfig[K]) =>
    setConfig((old) => ({ ...old, [key]: value }))

  const toggleMode = (mode: PublicMode) => patch('selected_modes', selectProgramMode(config.selected_modes, mode))
  const toggleMuscle = (muscle: Muscle) =>
    patch(
      'weak_points',
      config.weak_points.includes(muscle)
        ? config.weak_points.filter((item) => item !== muscle)
        : [...config.weak_points, muscle]
    )

  const setPolicy = (key: 'bodyweight_policy' | 'elastic_policy', value: ExercisePolicy) =>
    patch('preferences', { ...config.preferences, [key]: value })

  const toggleExercise = (key: 'preferred_exercise_ids' | 'excluded_exercise_ids', id: string) => {
    const current = config.preferences[key]
    patch('preferences', {
      ...config.preferences,
      [key]: current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    })
  }

  const goNext = () => {
    setSlideDirection('left')
    setStep(2)
  }

  const goBack = () => {
    setSlideDirection('right')
    setStep(1)
  }

  async function generateWithAi() {
    setAiState('loading')
    setAiError(null)
    try {
      await onCreateWithAi(
        config,
        aiPrompt.trim() || 'Genera un allenamento completo rispettando tutte le impostazioni selezionate.'
      )
      setAiState('idle')
    } catch (reason) {
      setAiState('error')
      setAiError(reason instanceof Error ? reason.message : 'Non siamo riusciti a generare con DeepSeek.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Wizard Progress Bar & Header */}
      <header className="flex items-center justify-between">
        <div>
          <span className="eyebrow text-cyan-400">Step {step} di 2</span>
          <h1 className="font-display text-2xl font-black uppercase text-white">
            {step === 1 ? 'Scegli Disciplina' : 'Imposta Parametri'}
          </h1>
        </div>
        <div className="flex gap-1.5">
          <div className={`h-2.5 w-8 rounded-full transition-all ${step === 1 ? 'bg-cyan-400 glow-cyan' : 'bg-steel'}`} />
          <div className={`h-2.5 w-8 rounded-full transition-all ${step === 2 ? 'bg-cyan-400 glow-cyan' : 'bg-steel'}`} />
        </div>
      </header>

      {/* STEP 1: Discipline & Program Kind */}
      {step === 1 && (
        <SwipeContainer
          direction={slideDirection}
          onSwipeLeft={goNext}
          className="space-y-5"
        >
          <Field title="Cosa vuoi creare?">
            <Grid>
              <Choice
                active={config.program_kind === 'program'}
                onClick={() => patch('program_kind', 'program')}
              >
                🗓️ Programma Settimanale
              </Choice>
              <Choice
                active={config.program_kind === 'single_session'}
                onClick={() => {
                  patch('program_kind', 'single_session')
                  patch('selected_modes', [config.selected_modes[0] ?? 'bodybuilding'])
                }}
              >
                ⚡ Sessione Singola Oggi
              </Choice>
            </Grid>
          </Field>

          <Field title={config.program_kind === 'program' ? 'Discipline della settimana (max 2)' : 'Tipo di sessione'}>
            <div className="grid grid-cols-2 gap-2.5">
              {PUBLIC_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    config.program_kind === 'single_session'
                      ? patch('selected_modes', [mode])
                      : toggleMode(mode)
                  }
                  className={`relative flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all ${
                    config.selected_modes.includes(mode)
                      ? 'glass-card-active border-cyan-400 text-white shadow-lg'
                      : 'glass-card border-edge text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span className="font-display font-bold text-sm">{MODE_LABELS[mode]}</span>
                  <span className="text-[11px] text-slate-400">
                    {mode === 'bodybuilding'
                      ? 'Massa & Ipertrofia'
                      : mode === 'strength'
                      ? 'Forza Pura'
                      : mode === 'crossfit_hybrid'
                      ? 'Functional & Bodybuilding'
                      : mode === 'crossfit'
                      ? 'WOD & Conditioning'
                      : 'Alta Intensità'}
                  </span>
                </button>
              ))}
            </div>

            {config.program_kind === 'program' && config.selected_modes.length > 0 && (
              <div className="mt-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3">
                <p className="eyebrow text-cyan-300">Selezione Attiva · {config.selected_modes.length}/2</p>
                <p className="mt-1 font-display font-bold text-white text-base">
                  {config.selected_modes.map((mode) => MODE_LABELS[mode]).join(' + ')}
                </p>
              </div>
            )}
          </Field>

          <div className="pt-2">
            <button
              onClick={goNext}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-4 font-display font-bold uppercase text-white shadow-lg glow-cyan transition-transform active:scale-[0.98]"
            >
              <span>PROSEGUI ALLO STEP 2 (Swipe 👈)</span>
            </button>
          </div>
        </SwipeContainer>
      )}

      {/* STEP 2: Parameters & Generation */}
      {step === 2 && (
        <SwipeContainer
          direction={slideDirection}
          onSwipeRight={goBack}
          className="space-y-5"
        >
          {/* Top Return Indicator Bar */}
          <button
            onClick={goBack}
            className="w-full flex items-center justify-between rounded-xl glass-card p-3 border border-cyan-500/30 text-xs text-cyan-300"
          >
            <span>← Step 1: {config.selected_modes.map((m) => MODE_LABELS[m]).join(' + ')}</span>
            <span className="font-bold underline">Tocca per cambiare</span>
          </button>

          {config.program_kind === 'program' && (
            <>
              <Field title="Numero di Giorni">
                <div className="grid grid-cols-5 gap-2">
                  {[3, 4, 5, 6, 7].map((days) => (
                    <Choice
                      key={days}
                      active={config.training_days === days}
                      onClick={() => patch('training_days', days)}
                    >
                      {days} gg
                    </Choice>
                  ))}
                </div>
              </Field>

              {config.selected_modes.includes('bodybuilding') && (
                <Field title="Sistema Split Bodybuilding">
                  <Grid>
                    {(Object.keys(SPLIT_SYSTEM_LABELS) as SplitSystem[]).map((system) => (
                      <Choice
                        key={system}
                        active={config.split_system === system}
                        onClick={() => patch('split_system', system)}
                      >
                        {SPLIT_SYSTEM_LABELS[system]}
                      </Choice>
                    ))}
                  </Grid>
                </Field>
              )}
            </>
          )}

          {!config.selected_modes.includes('tabata') && (
            <Field title="Livello di Esperienza">
              <Grid>
                {([
                  ['beginner', 'Intermedio · include Principiante'],
                  ['advanced', 'Avanzato · include Esperto'],
                ] as const).map(([experience, label]) => (
                  <Choice
                    key={experience}
                    active={config.experience === experience}
                    onClick={() => patch('experience', experience)}
                  >
                    {label}
                  </Choice>
                ))}
              </Grid>
            </Field>
          )}

          {config.program_kind === 'single_session' &&
            (config.selected_modes.includes('bodybuilding') || config.selected_modes.includes('strength') || config.selected_modes.includes('crossfit') || config.selected_modes.includes('crossfit_hybrid')) && (
              <Field title="Composizione Seduta di Oggi">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Choice
                    active={singleSessionMode === 'custom_muscles'}
                    onClick={() => {
                      setSingleSessionMode('custom_muscles')
                      if (!config.single_session_target_muscles || config.single_session_target_muscles.length === 0) {
                        patch('single_session_target_muscles', ['front_delts', 'lateral_delts', 'biceps', 'triceps'])
                      }
                    }}
                  >
                    🎯 Gruppi a Scelta
                  </Choice>
                  <Choice
                    active={singleSessionMode === 'preset_split'}
                    onClick={() => {
                      setSingleSessionMode('preset_split')
                      patch('single_session_target_muscles', [])
                    }}
                  >
                    📋 Split Preimpostato
                  </Choice>
                </div>

                {singleSessionMode === 'custom_muscles' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-300">
                      Scegli i gruppi muscolari che vuoi allenare oggi (es. Spalle + Braccia + Gambe):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(MUSCLE_LABELS) as Muscle[]).map((muscle) => {
                        const active = (config.single_session_target_muscles ?? []).includes(muscle)
                        return (
                          <Choice
                            key={muscle}
                            active={active}
                            onClick={() => {
                              const current = config.single_session_target_muscles ?? []
                              const next = current.includes(muscle)
                                ? current.filter((m) => m !== muscle)
                                : [...current, muscle]
                              patch('single_session_target_muscles', next)
                            }}
                          >
                            {MUSCLE_LABELS[muscle]}
                          </Choice>
                        )
                      })}
                    </div>
                    {(config.single_session_target_muscles ?? []).length > 0 && (
                      <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3">
                        <p className="eyebrow text-cyan-300">Target Sessione Oggi</p>
                        <p className="mt-1 font-display font-bold text-white text-sm">
                          {(config.single_session_target_muscles ?? []).map((m) => MUSCLE_LABELS[m]).join(' + ')}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {(config.selected_modes.includes('strength') ? STRENGTH_SPLITS : EDITABLE_SPLITS).map((split) => (
                      <Choice
                        key={split}
                        active={config.single_session_split === split}
                        onClick={() => patch('single_session_split', split)}
                      >
                        {SPLIT_LABELS[split]}
                      </Choice>
                    ))}
                  </div>
                )}
              </Field>
            )}

          {config.selected_modes.includes('tabata') && (
            <Field title="⏱️ Parametri Timer Tabata / Intervalli">
              <div className="space-y-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                {/* 1. Numero di Giri */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    1. Numero di Giri (Rounds): {config.tabata.rounds} giri
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {[8, 10, 12, 15, 20, 25, 30].map((r) => (
                      <Choice
                        key={r}
                        active={config.tabata.rounds === r}
                        onClick={() => patch('tabata', { ...config.tabata, rounds: r })}
                      >
                        {r} Giri
                      </Choice>
                    ))}
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        type="button"
                        onClick={() => patch('tabata', { ...config.tabata, rounds: Math.max(1, config.tabata.rounds - 1) })}
                        className="px-2.5 py-1 rounded bg-steel border border-edge text-xs font-bold text-white active:scale-95"
                      >
                        -
                      </button>
                      <span className="text-xs font-data text-white w-6 text-center">{config.tabata.rounds}</span>
                      <button
                        type="button"
                        onClick={() => patch('tabata', { ...config.tabata, rounds: config.tabata.rounds + 1 })}
                        className="px-2.5 py-1 rounded bg-steel border border-edge text-xs font-bold text-white active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Tempo di Allenamento / Lavoro */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    2. Tempo di Allenamento (Lavoro): {config.tabata.work_sec}s {Math.floor(config.tabata.work_sec / 60) > 0 ? `(${Math.floor(config.tabata.work_sec / 60)}m ${config.tabata.work_sec % 60}s)` : ''}
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {[15, 20, 30, 45, 60, 90, 120].map((sec) => (
                      <Choice
                        key={sec}
                        active={config.tabata.work_sec === sec}
                        onClick={() => patch('tabata', { ...config.tabata, work_sec: sec })}
                      >
                        {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                      </Choice>
                    ))}
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        type="button"
                        onClick={() => patch('tabata', { ...config.tabata, work_sec: Math.max(5, config.tabata.work_sec - 5) })}
                        className="px-2.5 py-1 rounded bg-steel border border-edge text-xs font-bold text-white active:scale-95"
                      >
                        -5s
                      </button>
                      <button
                        type="button"
                        onClick={() => patch('tabata', { ...config.tabata, work_sec: config.tabata.work_sec + 5 })}
                        className="px-2.5 py-1 rounded bg-steel border border-edge text-xs font-bold text-white active:scale-95"
                      >
                        +5s
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Tempo di Recupero */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    3. Tempo di Recupero (Pausa): {config.tabata.rest_sec}s {Math.floor(config.tabata.rest_sec / 60) > 0 ? `(${Math.floor(config.tabata.rest_sec / 60)}m ${config.tabata.rest_sec % 60}s)` : ''}
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {[5, 10, 15, 30, 45, 60, 90].map((sec) => (
                      <Choice
                        key={sec}
                        active={config.tabata.rest_sec === sec}
                        onClick={() => patch('tabata', { ...config.tabata, rest_sec: sec })}
                      >
                        {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                      </Choice>
                    ))}
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        type="button"
                        onClick={() => patch('tabata', { ...config.tabata, rest_sec: Math.max(5, config.tabata.rest_sec - 5) })}
                        className="px-2.5 py-1 rounded bg-steel border border-edge text-xs font-bold text-white active:scale-95"
                      >
                        -5s
                      </button>
                      <button
                        type="button"
                        onClick={() => patch('tabata', { ...config.tabata, rest_sec: config.tabata.rest_sec + 5 })}
                        className="px-2.5 py-1 rounded bg-steel border border-edge text-xs font-bold text-white active:scale-95"
                      >
                        +5s
                      </button>
                    </div>
                  </div>
                </div>

                {/* Riepilogo Calcolato Timer */}
                <div className="rounded-lg border border-amber-500/40 bg-zinc-900/80 p-3 text-xs">
                  <p className="font-bold text-amber-300">
                    ⏱️ Riepilogo Timer: {config.tabata.rounds} Giri × ({config.tabata.work_sec}s Lavoro / {config.tabata.rest_sec}s Pausa)
                  </p>
                  <p className="mt-1 text-slate-300">
                    Durata Totale Timer: <span className="font-bold text-white">{Math.floor((config.tabata.rounds * (config.tabata.work_sec + config.tabata.rest_sec)) / 60)}m {((config.tabata.rounds * (config.tabata.work_sec + config.tabata.rest_sec)) % 60)}s</span>
                  </p>
                </div>
              </div>
            </Field>
          )}

          {!config.selected_modes.includes('tabata') && (
            <>
              {config.selected_modes.includes('crossfit') && (
                <Field title="Metodica / Benchmark CrossFit">
                  <div className="grid grid-cols-1 gap-2">
                    {(Object.keys(CROSSFIT_BENCHMARK_LABELS) as CrossFitBenchmark[]).map((benchmark) => (
                      <Choice
                        key={benchmark}
                        active={(config.crossfit_benchmark ?? 'custom') === benchmark}
                        onClick={() => patch('crossfit_benchmark', benchmark)}
                      >
                        <span className="block">{CROSSFIT_BENCHMARK_LABELS[benchmark]}</span>
                        <span className="mt-1 block text-[10px] font-normal text-slate-400">{CROSSFIT_BENCHMARK_HINTS[benchmark]}</span>
                      </Choice>
                    ))}
                  </div>
                  {(config.crossfit_benchmark ?? 'custom') !== 'custom' && (
                    <p className="mt-3 text-xs text-amber-300">
                      Il Metcon del benchmark resta ufficiale; i muscoli target vengono allenati nel blocco iniziale dedicato.
                    </p>
                  )}
                  {(config.crossfit_benchmark ?? 'custom') === 'custom' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {FORMATI_CROSSFIT.map((format) => (
                        <Choice
                          key={format}
                          active={config.crossfit_format === format}
                          onClick={() => patch('crossfit_format', format)}
                        >
                          <span className="block">{METCON_FORMAT_LABELS[format]}</span>
                          <span className="mt-1 block text-[10px] font-normal text-slate-400">{METCON_FORMAT_HINTS[format]}</span>
                        </Choice>
                      ))}
                    </div>
                  )}
                </Field>
              )}
              <Field title="Durata Sessione (minuti)">
                <div className="grid grid-cols-5 gap-2">
                  {DURATIONS.map((duration) => (
                    <Choice
                      key={duration}
                      active={config.duration_min === duration}
                      onClick={() => patch('duration_min', duration)}
                    >
                      {duration}m
                    </Choice>
                  ))}
                </div>
              </Field>

              <Field title="Attrezzatura Disponibile">
                <Grid>
                  {(Object.keys(EQUIPMENT_LABELS) as Equipment[])
                    .filter((item) => ['full_gym', 'dumbbells', 'barbell', 'machines', 'home_gym'].includes(item))
                    .map((equipment) => (
                      <Choice
                        key={equipment}
                        active={config.equipment.preset === equipment}
                        onClick={() =>
                          patch('equipment', { preset: equipment, available: PRESET_EQUIPMENT[equipment] })
                        }
                      >
                        {EQUIPMENT_LABELS[equipment]}
                      </Choice>
                    ))}
                </Grid>
                <button
                  className="mt-3 text-xs uppercase tracking-wider text-cyan-400"
                  onClick={() => setAdvanced((old) => !old)}
                >
                  {advanced ? 'Chiudi inventario' : '⚙️ Configurazione avanzata attrezzi'}
                </button>
                {advanced && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(Object.keys(EQUIPMENT_ITEM_LABELS) as EquipmentItem[]).map((item) => (
                      <Choice
                        key={item}
                        active={config.equipment.available.includes(item)}
                        onClick={() =>
                          patch('equipment', {
                            ...config.equipment,
                            available: config.equipment.available.includes(item)
                              ? config.equipment.available.filter((value) => value !== item)
                              : [...config.equipment.available, item],
                          })
                        }
                      >
                        {EQUIPMENT_ITEM_LABELS[item]}
                      </Choice>
                    ))}
                  </div>
                )}
              </Field>

              <Field title="Muscoli Carenti (Priorità)">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(MUSCLE_LABELS) as Muscle[]).map((muscle) => (
                    <Choice
                      key={muscle}
                      active={config.weak_points.includes(muscle)}
                      onClick={() => toggleMuscle(muscle)}
                    >
                      {MUSCLE_LABELS[muscle]}
                    </Choice>
                  ))}
                </div>
              </Field>

              <Field title="Assistente AI (DeepSeek)">
                <p className="text-xs text-slate-300">
                  Scrivi un focus libero. Se scegli DeepSeek, l'LLM riceve tutti i parametri impostati e restituisce direttamente il workout o il programma compilato.
                </p>
                <textarea
                  className="input min-h-28"
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  placeholder="Esempio: rapido upper con priorita' deltoidi e tricipiti, poco volume sul petto, massimo focus su un gruppo carente."
                />
                {!loadLocalAiSettings().deepseek_api_key.trim() && (
                  <p className="text-xs text-amber-300">
                    Aggiungi prima la chiave API DeepSeek nella pagina Profilo.
                  </p>
                )}
                {aiError && <p className="text-xs text-red-400">{aiError}</p>}
              </Field>

              <Field title="Preferenze Esercizi">
                <Policy
                  title="Corpo libero"
                  value={config.preferences.bodyweight_policy}
                  onChange={(value) => setPolicy('bodyweight_policy', value)}
                />
                <Policy
                  title="Elastici"
                  value={config.preferences.elastic_policy}
                  onChange={(value) => setPolicy('elastic_policy', value)}
                />
                <button
                  className="mt-4 text-xs uppercase tracking-wider text-cyan-400"
                  onClick={() => setExercisePreferences((old) => !old)}
                >
                  {exercisePreferences ? 'Chiudi preferiti' : '⭐ Preferiti / Esclusi'}
                </button>
                {exercisePreferences && (
                  <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                    {catalog
                      .filter((exercise) => !exercise.roles.includes('warmup'))
                      .map((exercise) => (
                        <div
                          key={exercise.id}
                          className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-edge py-2 text-sm text-white"
                        >
                          <span>{exercise.name}</span>
                          <button
                            className={
                              config.preferences.preferred_exercise_ids.includes(exercise.id)
                                ? 'text-cyan-400 font-bold'
                                : 'text-slate-400'
                            }
                            onClick={() => toggleExercise('preferred_exercise_ids', exercise.id)}
                          >
                            Preferito
                          </button>
                          <button
                            className={
                              config.preferences.excluded_exercise_ids.includes(exercise.id)
                                ? 'text-red-400 font-bold'
                                : 'text-slate-400'
                            }
                            onClick={() => toggleExercise('excluded_exercise_ids', exercise.id)}
                          >
                            Escludi
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </Field>
            </>
          )}

          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={goBack}
              className="w-1/3 rounded-xl glass-card py-4 font-display font-bold uppercase text-slate-300"
            >
              Indietro
            </button>
            <button
              disabled={!valid}
              onClick={() => {
                const finalConfig = config.selected_modes.includes('tabata')
                  ? { ...config, program_kind: 'single_session' as const }
                  : config
                void onCreate(finalConfig)
              }}
              className="w-2/3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-4 font-display font-bold uppercase text-white shadow-lg glow-amber transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              {config.selected_modes.includes('tabata')
                ? '▶ INIZIA TABATA'
                : catalog.length
                ? config.program_kind === 'program'
                  ? '🚀 Genera Programma'
                  : '🚀 Genera Sessione'
                : 'Caricamento…'}
            </button>
          </div>
          <button
            disabled={!valid || !loadLocalAiSettings().deepseek_api_key.trim() || aiState === 'loading'}
            onClick={() => { void generateWithAi() }}
            className="w-full rounded-xl border border-cyan-500/40 bg-cyan-500/15 py-4 font-display font-bold uppercase text-cyan-200 shadow-md transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            {aiState === 'loading' ? 'DeepSeek sta generando...' : 'Genera con DeepSeek usando questi parametri'}
          </button>
        </SwipeContainer>
      )}
    </div>
  )
}

function WeekView({
  program,
  error,
  onUpdate,
  onGenerate,
  onReset,
  onEditConfig,
}: {
  program: WeeklyProgram
  error: string | null
  onUpdate: (program: WeeklyProgram) => void
  onGenerate: (session: WeeklySession) => void
  onReset: () => void
  onEditConfig: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [dayIndex, setDayIndex] = useState(0)

  const handleNextDay = () => {
    if (dayIndex < program.week.length - 1) {
      setDayIndex((prev) => prev + 1)
    }
  }

  const handlePrevDay = () => {
    if (dayIndex > 0) {
      setDayIndex((prev) => prev - 1)
    }
  }

  const currentSession = program.week[dayIndex] ?? program.week[0]

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <span className="eyebrow text-cyan-400">
            {program.config.program_kind === 'program' ? 'Programma Settimanale' : 'Sessione Singola'}
          </span>
          <h1 className="font-display text-2xl font-black uppercase text-white">
            La Tua Settimana
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEditConfig}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs text-cyan-300 hover:text-white"
          >
            Modifica parametri
          </button>
          <button
            onClick={onReset}
            className="rounded-lg bg-steel px-3 py-1.5 text-xs text-slate-300 hover:text-white"
          >
            + Nuova
          </button>
        </div>
      </header>

      {program.warnings.map((warning) => (
        <p
          key={`${warning.code}-${warning.day_ids.join('-')}`}
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300"
        >
          {warning.message}
        </p>
      ))}

      {/* Swipeable Day Container */}
      <SwipeContainer
        onSwipeLeft={handleNextDay}
        onSwipeRight={handlePrevDay}
        className="space-y-4"
      >
        {/* Day Pagination Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {program.week.map((session, idx) => (
            <button
              key={session.id}
              onClick={() => setDayIndex(idx)}
              className={`flex-1 min-w-[70px] py-2 px-2 rounded-xl text-center transition-all ${
                idx === dayIndex
                  ? 'bg-cyan-500 text-white font-bold glow-cyan shadow-md'
                  : 'glass-card text-slate-400 hover:text-white'
              }`}
            >
              <div className="text-[10px] uppercase">{DAY_LABELS[session.day].slice(0, 3)}</div>
              <div className="text-xs font-bold truncate">{session.split ? SPLIT_LABELS[session.split] : 'WOD'}</div>
            </button>
          ))}
        </div>

        {/* Current Active Day Card */}
        {currentSession && (
          <article className="rounded-2xl glass-card border border-cyan-500/30 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-cyan-300">
                Giorno {dayIndex + 1} di {program.week.length} · {DAY_LABELS[currentSession.day]}
              </span>
              <span className="text-xs text-slate-400 font-data">
                Swipe 👈 ➡️ per scorrere i giorni
              </span>
            </div>

            <h2 className="font-display text-xl font-bold uppercase text-white">
              {currentSession.label}
            </h2>

            {currentSession.priority_muscles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {currentSession.priority_muscles.map((m) => (
                  <span
                    key={m}
                    className="rounded-md bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 text-[10px] font-bold text-purple-300 uppercase"
                  >
                    Target: {MUSCLE_LABELS[m]}
                  </span>
                ))}
              </div>
            )}

            {editing === currentSession.id ? (
              <SessionEditor
                session={currentSession}
                onChange={(patch) => onUpdate(updateWeeklySession(program, currentSession.id, patch))}
                onClose={() => setEditing(null)}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setEditing(currentSession.id)}
                  className="rounded-xl glass-card py-3 font-display text-xs font-bold uppercase text-slate-300 hover:text-white"
                >
                  ✏️ Modifica Slot
                </button>
                <button
                  onClick={() => onGenerate(currentSession)}
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 font-display text-xs font-bold uppercase text-white shadow-md glow-cyan active:scale-[0.98]"
                >
                  ▶ Genera & Apri
                </button>
              </div>
            )}
          </article>
        )}
      </SwipeContainer>

      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}

function SessionEditor({
  session,
  onChange,
  onClose,
}: {
  session: WeeklySession
  onChange: (patch: Partial<Pick<WeeklySession, 'day' | 'mode' | 'split'>>) => void
  onClose: () => void
}) {
  const splits = session.mode === 'strength' ? STRENGTH_SPLITS : EDITABLE_SPLITS
  return (
    <div className="mt-4 space-y-3 border-t border-edge pt-4">
      <label className="block text-xs text-slate-300">
        Giorno
        <select
          className="input mt-1"
          value={session.day}
          onChange={(event) => onChange({ day: event.target.value as Weekday })}
        >
          {(Object.keys(DAY_LABELS) as Weekday[]).map((day) => (
            <option key={day} value={day}>
              {DAY_LABELS[day]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-slate-300">
        Modalità
        <select
          className="input mt-1"
          value={session.mode}
          onChange={(event) => onChange({ mode: event.target.value as PublicMode, split: null })}
        >
          {PUBLIC_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>
      {(session.mode === 'bodybuilding' || session.mode === 'strength') && (
        <label className="block text-xs text-slate-300">
          Split
          <select
            className="input mt-1"
            value={session.split ?? 'full_body'}
            onChange={(event) => onChange({ split: event.target.value as Split })}
          >
            {splits.map((split) => (
              <option key={split} value={split}>
                {SPLIT_LABELS[split]}
              </option>
            ))}
          </select>
        </label>
      )}
      <button className="text-xs uppercase tracking-wider text-cyan-400" onClick={onClose}>
        ✓ Fine modifica
      </button>
    </div>
  )
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl glass-card p-4 space-y-2 border border-edge">
      <h2 className="field-label text-slate-400">{title}</h2>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`chip w-full text-left transition-all ${
        active
          ? 'glass-card-active border-cyan-400 text-white font-bold shadow-md'
          : 'glass-card text-slate-300 hover:border-slate-500'
      }`}
    >
      {children}
    </button>
  )
}

function Policy({
  title,
  value,
  onChange,
}: {
  title: string
  value: ExercisePolicy
  onChange: (value: ExercisePolicy) => void
}) {
  return (
    <div className="mt-3">
      <p className="mb-2 text-sm text-slate-300">{title}</p>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(EXERCISE_POLICY_LABELS) as ExercisePolicy[]).map((policy) => (
          <Choice key={policy} active={value === policy} onClick={() => onChange(policy)}>
            {EXERCISE_POLICY_LABELS[policy]}
          </Choice>
        ))}
      </div>
    </div>
  )
}
