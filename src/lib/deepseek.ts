import type { LocalAiSettings } from '../features/profile/aiSettings'
import type {
  CrossFitBenchmark, Experience, Exercise, GeneratedWorkout, Goal, Intensity, MetconFormat, Muscle,
  PrescribedExercise, PublicMode, Split, SplitSystem, WeeklyProgram, WeeklyProgramConfig,
} from '../types'

interface DeepSeekPlannerInput {
  config: WeeklyProgramConfig
  prompt: string
}

interface DeepSeekWorkoutGenerationInput {
  config: WeeklyProgramConfig
  prompt: string
  program: WeeklyProgram
  catalog: Exercise[]
}

interface CatalogExerciseSnapshot {
  id: string
  name: string
  primary_muscles: Muscle[]
  secondary_muscles: Muscle[]
  equipment: Exercise['equipment']
  movement_pattern: string
  min_experience: Experience
  roles: string[]
  required_equipment: Exercise['required_equipment']
  metcon_safe: boolean
}

type PlannerPatch = Partial<Pick<
  WeeklyProgramConfig,
  'goal' | 'experience' | 'duration_min' | 'training_days' | 'split_system' |
  'single_session_split' | 'single_session_target_muscles' | 'weak_points' |
  'selected_modes' | 'crossfit_format' | 'hybrid_method' | 'hybrid_format' |
  'strength_method' | 'intensity' | 'crossfit_benchmark'
>>

interface DeepSeekSessionWorkout {
  session_id: string
  workout: GeneratedWorkout
}

interface DeepSeekWorkoutGenerationResult {
  sessions: DeepSeekSessionWorkout[]
}

export const PROFESSIONAL_WORKOUT_SYSTEM_PROMPT = `Sei un professionista esperto nella creazione di allenamenti personalizzati e nella programmazione sportiva.
Devi restituire esclusivamente JSON valido, senza commenti esterni al JSON, e compilare una sessione concreta per ogni session_id ricevuto.
Considera tutte le scelte dell'utente vincoli reali: disciplina, obiettivo, livello, durata, giorni, intensità, attrezzatura disponibile, formato, benchmark, muscoli target, esercizi esclusi e preferiti.
I muscoli indicati come target/carenze di oggi sono un vincolo primario, non un suggerimento: gli esercizi allenanti devono avere almeno uno di quei muscoli fra i primary_muscles. Altri muscoli, per esempio il petto, possono essere coinvolti soltanto come secondari e non devono occupare uno slot principale. Questa regola vale per Bodybuilding, Strength, CrossFit e Hybrid. Se è stato scelto un benchmark CrossFit ufficiale, mantieni invece intatto il suo Metcon e usa il blocco precedente per allenare i target.
Adatta il tuo ruolo alla disciplina scelta:
- CrossFit: agisci come coach CrossFit e genera un WOD autentico. Usa warm-up pertinente, eventuale forza/skill e un Metcon coerente con il formato richiesto (AMRAP, EMOM, For Time, Rounds, Chipper, Ladder o Intervals). Non trasformarlo in una scheda Bodybuilding. Bilancia weightlifting/gymnastics/monostructural secondo catalogo, livello, tempo e attrezzatura.
- CrossFit Hybrid: combina un blocco Strength/Bodybuilding strutturato con un Metcon realmente metabolico e sicuro sotto fatica.
- Bodybuilding: agisci come coach di ipertrofia; usa ordine compound-isolamenti, volume, recuperi e priorità muscolari coerenti.
- Strength: agisci come strength coach; rispetta metodo, fondamentali, complementari, recuperi lunghi e livello tecnico.
- Tabata: rispetta esattamente lavoro, recupero, round e prescrizione selezionati.
Se l'utente seleziona palestra completa, sfrutta in modo sensato l'attrezzatura completa; se seleziona un inventario limitato usa solo ciò che è disponibile.
Usa esclusivamente exercise_id presenti nel catalogo fornito. Non usare esercizi esclusi e non inventare ID.
Regole inderogabili sul numero di esercizi allenanti, senza contare il warm-up: Bodybuilding, CrossFit Standard e CrossFit Hybrid almeno 6; Strength almeno 5; Tabata conserva esattamente il protocollo scelto. Questi minimi valgono per ogni durata e configurazione. Nel CrossFit usa complessità decrescente e benchmark autentici come riferimento quando coerenti; enfatizza le carenze senza compromettere sicurezza e recupero.`

const VALID_EXPERIENCE = new Set<Experience>(['beginner', 'intermediate', 'advanced'])
const VALID_GOAL = new Set<Goal>(['hypertrophy', 'strength', 'conditioning', 'mixed'])
const VALID_INTENSITY = new Set<Intensity>(['low', 'medium', 'high'])
const VALID_SPLIT_SYSTEM = new Set<SplitSystem>(['ppl', 'upper_lower', 'bro_split', 'front_back'])
const VALID_MODES = new Set<PublicMode>(['bodybuilding', 'crossfit', 'crossfit_hybrid', 'strength', 'tabata'])
const VALID_MUSCLES = new Set<Muscle>(['chest', 'back', 'front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'])
const VALID_METCON = new Set<MetconFormat>(['amrap', 'emom', 'for_time', 'rounds', 'circuit', 'chipper', 'ladder', 'intervals', 'tabata'])
const VALID_BENCHMARK = new Set<CrossFitBenchmark>(['custom', 'cindy', 'fran', 'grace', 'helen'])
const VALID_BLOCK_KIND = new Set(['warmup', 'main', 'metcon'])
const VALID_ROLE = new Set(['compound', 'isolation', 'warmup', 'metcon'])

function deepSeekError(status: number, payload: unknown): Error {
  const apiMessage = payload && typeof payload === 'object'
    ? (payload as { error?: string | { message?: string } }).error
    : undefined
  const detail = typeof apiMessage === 'string' ? apiMessage : apiMessage?.message
  if (status === 401 || status === 403) return new Error('Chiave API DeepSeek non valida o non autorizzata. Controllala nel Profilo.')
  if (status === 402) return new Error('Il credito DeepSeek è insufficiente. Controlla il saldo del tuo account.')
  if (status === 429) return new Error('DeepSeek ha ricevuto troppe richieste. Attendi un minuto e riprova.')
  if (status === 504) return new Error('DeepSeek sta impiegando troppo tempo. Riprova o usa il modello Flash.')
  return new Error(detail || `DeepSeek ha risposto con errore ${status}.`)
}

async function requestDeepSeek(
  settings: LocalAiSettings,
  messages: Array<{ role: 'system' | 'user'; content: string }>
): Promise<{ choices?: Array<{ message?: { content?: string } }> }> {
  let response: Response
  try {
    response = await fetch('/api/deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: settings.deepseek_api_key.trim(),
        payload: {
          model: settings.deepseek_model,
          temperature: 0.2,
          thinking: { type: 'disabled' },
          response_format: { type: 'json_object' },
          max_tokens: 16_000,
          messages,
        },
      }),
      signal: AbortSignal.timeout(120_000),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw Object.assign(new Error('DeepSeek sta impiegando troppo tempo. Riprova o usa il modello Flash.'), { cause: error })
    }
    throw Object.assign(new Error('Impossibile contattare DeepSeek. Controlla la connessione e riprova.'), { cause: error })
  }
  const payload = await response.json().catch(() => ({})) as { choices?: Array<{ message?: { content?: string } }> }
  if (!response.ok) throw deepSeekError(response.status, payload)
  return payload
}

function extractJsonObject(text: string): string {
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first < 0 || last <= first) throw new Error('Risposta AI non valida.')
  return text.slice(first, last + 1)
}

function sanitizePatch(raw: unknown, base: WeeklyProgramConfig): PlannerPatch {
  if (!raw || typeof raw !== 'object') return {}
  const patch = raw as Record<string, unknown>
  const next: PlannerPatch = {}

  if (typeof patch.goal === 'string' && VALID_GOAL.has(patch.goal as Goal)) next.goal = patch.goal as Goal
  if (typeof patch.experience === 'string' && VALID_EXPERIENCE.has(patch.experience as Experience)) next.experience = patch.experience as Experience
  if (typeof patch.intensity === 'string' && VALID_INTENSITY.has(patch.intensity as Intensity)) next.intensity = patch.intensity as Intensity
  if (typeof patch.duration_min === 'number' && [30, 45, 60, 75, 90].includes(patch.duration_min)) next.duration_min = patch.duration_min
  if (typeof patch.training_days === 'number' && patch.training_days >= 1 && patch.training_days <= 7) next.training_days = Math.round(patch.training_days)
  if (typeof patch.split_system === 'string' && VALID_SPLIT_SYSTEM.has(patch.split_system as SplitSystem)) next.split_system = patch.split_system as SplitSystem
  if (typeof patch.single_session_split === 'string') next.single_session_split = patch.single_session_split as WeeklyProgramConfig['single_session_split']
  if (Array.isArray(patch.single_session_target_muscles)) next.single_session_target_muscles = patch.single_session_target_muscles.filter((item): item is Muscle => typeof item === 'string' && VALID_MUSCLES.has(item as Muscle)).slice(0, 6)
  if (Array.isArray(patch.weak_points)) next.weak_points = patch.weak_points.filter((item): item is Muscle => typeof item === 'string' && VALID_MUSCLES.has(item as Muscle)).slice(0, 6)
  if (Array.isArray(patch.selected_modes)) {
    const modes = patch.selected_modes.filter((item): item is PublicMode => typeof item === 'string' && VALID_MODES.has(item as PublicMode))
    if (modes.length > 0) next.selected_modes = [...new Set(modes)].slice(0, base.program_kind === 'single_session' ? 1 : 2)
  }
  if (typeof patch.crossfit_format === 'string') next.crossfit_format = patch.crossfit_format as WeeklyProgramConfig['crossfit_format']
  if (typeof patch.crossfit_benchmark === 'string' && VALID_BENCHMARK.has(patch.crossfit_benchmark as CrossFitBenchmark)) next.crossfit_benchmark = patch.crossfit_benchmark as CrossFitBenchmark
  if (typeof patch.hybrid_method === 'string') next.hybrid_method = patch.hybrid_method as WeeklyProgramConfig['hybrid_method']
  if (typeof patch.hybrid_format === 'string') next.hybrid_format = patch.hybrid_format as WeeklyProgramConfig['hybrid_format']
  if (typeof patch.strength_method === 'string') next.strength_method = patch.strength_method as WeeklyProgramConfig['strength_method']

  return next
}

function toCatalogSnapshot(catalog: Exercise[]): CatalogExerciseSnapshot[] {
  return catalog.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    primary_muscles: exercise.primary_muscles,
    secondary_muscles: exercise.secondary_muscles,
    equipment: exercise.equipment,
    movement_pattern: exercise.movement_pattern,
    min_experience: exercise.min_experience,
    roles: exercise.roles,
    required_equipment: exercise.required_equipment,
    metcon_safe: exercise.metcon_safe,
  }))
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.round(value))
}

function sanitizeExerciseRole(value: unknown, fallback: PrescribedExercise['role']): PrescribedExercise['role'] {
  return typeof value === 'string' && VALID_ROLE.has(value) ? value as PrescribedExercise['role'] : fallback
}

function sanitizeMuscleList(value: unknown): Muscle[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Muscle => typeof item === 'string' && VALID_MUSCLES.has(item as Muscle))
}

function sanitizeMetconFormat(value: unknown): MetconFormat | undefined {
  return typeof value === 'string' && VALID_METCON.has(value as MetconFormat) ? value as MetconFormat : undefined
}

function sanitizeBlockExercises(
  raw: unknown,
  catalogById: Map<string, Exercise>,
  fallbackRole: PrescribedExercise['role']
): PrescribedExercise[] {
  if (!Array.isArray(raw)) return []
  const sanitized: PrescribedExercise[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Record<string, unknown>
    const exerciseId = asString(candidate.exercise_id, '')
    const catalogExercise = catalogById.get(exerciseId)
    if (!catalogExercise) continue
    sanitized.push({
      exercise_id: catalogExercise.id,
      name: catalogExercise.name,
      role: sanitizeExerciseRole(candidate.role, fallbackRole),
      muscle: sanitizeMuscleList(candidate.muscle ? [candidate.muscle] : [catalogExercise.primary_muscles[0]])[0] ?? catalogExercise.primary_muscles[0] ?? null,
      sets: Math.max(1, asPositiveInt(candidate.sets, fallbackRole === 'metcon' ? 1 : 3)),
      reps: asString(candidate.reps, fallbackRole === 'metcon' ? '10' : catalogExercise.default_reps),
      rest_sec: asPositiveInt(candidate.rest_sec, fallbackRole === 'metcon' ? 0 : catalogExercise.default_rest),
      note: asOptionalString(candidate.note),
      instructions: catalogExercise.instructions || undefined,
    })
  }

  return sanitized
}

function sanitizeWorkout(
  raw: unknown,
  sessionMode: PublicMode,
  sessionSplit: Split | null,
  durationMin: number,
  catalogById: Map<string, Exercise>
): GeneratedWorkout {
  const candidate = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rawBlocks = Array.isArray(candidate.blocks) ? candidate.blocks : []
  const blocks: GeneratedWorkout['blocks'] = rawBlocks
    .map((block) => {
      if (!block || typeof block !== 'object') return null
      const rawBlock = block as Record<string, unknown>
      const kind = typeof rawBlock.kind === 'string' && VALID_BLOCK_KIND.has(rawBlock.kind)
        ? rawBlock.kind as 'warmup' | 'main' | 'metcon'
        : null
      if (!kind) return null
      const fallbackRole: PrescribedExercise['role'] = kind === 'warmup' ? 'warmup' : kind === 'metcon' ? 'metcon' : 'compound'
      const exercises = sanitizeBlockExercises(rawBlock.exercises, catalogById, fallbackRole)
      return {
        kind,
        title: asString(rawBlock.title, kind === 'main' ? 'Allenamento' : kind === 'metcon' ? 'Metcon' : 'Riscaldamento'),
        duration_min: kind === 'warmup' ? asPositiveInt(rawBlock.duration_min, 8) : undefined,
        exercises,
        format: kind === 'metcon' ? sanitizeMetconFormat(rawBlock.format) : undefined,
        time_cap_min: kind === 'metcon' && typeof rawBlock.time_cap_min === 'number' ? asPositiveInt(rawBlock.time_cap_min, durationMin) : undefined,
        rounds: kind === 'metcon' && typeof rawBlock.rounds === 'number' ? asPositiveInt(rawBlock.rounds, 1) : undefined,
        interval_sec: kind === 'metcon' && typeof rawBlock.interval_sec === 'number' ? asPositiveInt(rawBlock.interval_sec, 0) : undefined,
      }
    })
    .filter((block): block is NonNullable<typeof block> => !!block)
    .filter((block) => block.exercises.length > 0)

  return {
    name: asString(candidate.name, sessionMode === 'crossfit' ? 'CrossFit Standard' : sessionMode === 'crossfit_hybrid' ? 'CrossFit Hybrid' : 'Allenamento AI'),
    mode: sessionMode,
    split: sessionSplit,
    goal: typeof candidate.goal === 'string' && VALID_GOAL.has(candidate.goal as Goal) ? candidate.goal as Goal : sessionMode === 'crossfit' ? 'conditioning' : 'hypertrophy',
    experience: typeof candidate.experience === 'string' && VALID_EXPERIENCE.has(candidate.experience as Experience) ? candidate.experience as Experience : 'intermediate',
    duration_min: asPositiveInt(candidate.duration_min, durationMin),
    max_duration_min: typeof candidate.max_duration_min === 'number' ? asPositiveInt(candidate.max_duration_min, Math.ceil(durationMin * 1.15)) : Math.ceil(durationMin * 1.15),
    blocks,
    warnings: Array.isArray(candidate.warnings) ? candidate.warnings.filter((item): item is string => typeof item === 'string') : [],
    est_kcal: typeof candidate.est_kcal === 'number' && Number.isFinite(candidate.est_kcal) ? Math.round(candidate.est_kcal) : undefined,
  }
}

export async function suggestWorkoutConfigWithDeepSeek(
  settings: LocalAiSettings,
  input: DeepSeekPlannerInput
): Promise<PlannerPatch> {
  const apiKey = settings.deepseek_api_key.trim()
  if (!apiKey) throw new Error('Inserisci prima la chiave API DeepSeek nel profilo.')

  const payload = await requestDeepSeek(settings, [
        {
          role: 'system',
          content:
            'Sei un planner di configurazioni per GymBuilder. Devi restituire solo un JSON object con un patch compatibile con WeeklyProgramConfig. Non inventare campi. Rispetta questi limiti: selected_modes max 1 per single_session, max 2 per program; single_session_target_muscles max 6; weak_points max 6; duration_min solo 30/45/60/75/90.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            richiesta_utente: input.prompt,
            istruzione_operativa:
              `Sei un master allenatore specializzato in ${input.config.selected_modes.join(' + ')}. ` +
              `Oggi voglio allenare come target principali: ${(input.config.single_session_target_muscles?.length ? input.config.single_session_target_muscles : input.config.weak_points).join(', ') || 'nessun target specifico'}. ` +
              `Livello ${input.config.experience}; elastici ${input.config.preferences.elastic_policy}; ` +
              `corpo libero ${input.config.preferences.bodyweight_policy}; attrezzatura ${input.config.equipment.preset}. ` +
              `Genera la sessione con la metodica selezionata e non usare altri muscoli come target primari.`,
            configurazione_corrente: input.config,
            obiettivo: 'Suggerisci solo i campi da modificare per generare un workout o programma migliore con il motore esistente.',
          }),
        },
      ])
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek non ha restituito contenuto utile.')
  const parsed = JSON.parse(extractJsonObject(content))
  return sanitizePatch(parsed, input.config)
}

export async function generateWorkoutsWithDeepSeek(
  settings: LocalAiSettings,
  input: DeepSeekWorkoutGenerationInput
): Promise<DeepSeekWorkoutGenerationResult> {
  const apiKey = settings.deepseek_api_key.trim()
  if (!apiKey) throw new Error('Inserisci prima la chiave API DeepSeek nel profilo.')

  const payload = await requestDeepSeek(settings, [
        {
          role: 'system',
          content: PROFESSIONAL_WORKOUT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: JSON.stringify({
            richiesta_utente: input.prompt,
            brief_professionale: {
              tipo: input.config.program_kind,
              discipline: input.config.selected_modes,
              obiettivo: input.config.goal,
              livello: input.config.experience,
              durata_minuti: input.config.duration_min,
              giorni_settimana: input.config.training_days,
              intensita: input.config.intensity,
              attrezzatura_preset: input.config.equipment.preset,
              attrezzatura_disponibile: input.config.equipment.available,
              muscoli_carenti: input.config.weak_points,
              formato_crossfit: input.config.crossfit_format,
              benchmark_crossfit: input.config.crossfit_benchmark ?? 'custom',
              muscoli_target_oggi: input.config.single_session_target_muscles?.length
                ? input.config.single_session_target_muscles
                : input.config.weak_points,
              metodo_hybrid: input.config.hybrid_method,
              formato_hybrid: input.config.hybrid_format,
              metodo_forza: input.config.strength_method,
              protocollo_tabata: input.config.tabata,
              esercizi_preferiti: input.config.preferences.preferred_exercise_ids,
              esercizi_esclusi: input.config.preferences.excluded_exercise_ids,
              policy_corpo_libero: input.config.preferences.bodyweight_policy,
              policy_elastici: input.config.preferences.elastic_policy,
            },
            configurazione: input.config,
            sessioni_da_compilare: input.program.week.map((session) => ({
              session_id: session.id,
              day: session.day,
              mode: session.mode,
              split: session.split,
              label: session.label,
              priority_muscles: session.priority_muscles,
              custom_target_muscles: session.custom_target_muscles ?? [],
              metcon_format: session.metcon_format,
              duration_min: input.config.duration_min,
            })),
            catalogo_utilizzabile: toCatalogSnapshot(input.catalog),
            formato_output: {
              sessions: [
                {
                  session_id: 'session-id',
                  workout: {
                    name: 'string',
                    mode: 'bodybuilding|crossfit|crossfit_hybrid|strength|tabata',
                    split: 'split|null',
                    goal: 'hypertrophy|strength|conditioning|mixed',
                    experience: 'beginner|intermediate|advanced',
                    duration_min: 60,
                    max_duration_min: 69,
                    warnings: ['string'],
                    blocks: [
                      {
                        kind: 'warmup|main|metcon',
                        title: 'string',
                        duration_min: 8,
                        format: 'amrap|emom|for_time|rounds|circuit|chipper|ladder|intervals|tabata',
                        time_cap_min: 15,
                        rounds: 4,
                        interval_sec: 60,
                        exercises: [
                          {
                            exercise_id: 'catalog-id',
                            role: 'compound|isolation|warmup|metcon',
                            sets: 4,
                            reps: '8-10',
                            rest_sec: 90,
                            note: 'string'
                          }
                        ]
                      }
                    ]
                  }
                }
              ]
            },
          }),
        },
      ])
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek non ha restituito contenuto utile.')

  const parsed = JSON.parse(extractJsonObject(content)) as {
    sessions?: Array<{ session_id?: string; workout?: unknown }>
  }

  const catalogById = new Map(input.catalog.map((exercise) => [exercise.id, exercise]))
  const sessionById = new Map(input.program.week.map((session) => [session.id, session]))
  const sessions = (parsed.sessions ?? [])
    .map((item) => {
      const sessionId = asString(item.session_id, '')
      const session = sessionById.get(sessionId)
      if (!session) return null
      return {
        session_id: sessionId,
        workout: sanitizeWorkout(item.workout, session.mode, session.split, input.config.duration_min, catalogById),
      }
    })
    .filter((item): item is DeepSeekSessionWorkout => !!item && item.workout.blocks.length > 0)

  for (const session of sessions) {
    if (session.workout.mode === 'tabata') continue
    const count = session.workout.blocks
      .filter((block) => block.kind !== 'warmup')
      .reduce((total, block) => total + block.exercises.length, 0)
    const minimum = session.workout.mode === 'strength' ? 5 : 6
    if (count < minimum) {
      throw new Error(`DeepSeek ha generato solo ${count} esercizi allenanti: per ${session.workout.mode} ne servono almeno ${minimum}. Riprova la generazione.`)
    }
    const targets = input.config.single_session_target_muscles?.length
      ? input.config.single_session_target_muscles
      : input.config.weak_points
    const strictTargets = input.config.program_kind === 'single_session' && targets.length > 0 &&
      (input.config.crossfit_benchmark ?? 'custom') === 'custom'
    if (strictTargets) {
      const invalid = session.workout.blocks
        .filter((block) => block.kind !== 'warmup')
        .flatMap((block) => block.exercises)
        .find((item) => {
          const catalogExercise = catalogById.get(item.exercise_id)
          return !catalogExercise?.primary_muscles.some((muscle) => targets.includes(muscle))
        })
      if (invalid) {
        throw new Error(`DeepSeek ha inserito ${invalid.name} fuori dai muscoli target di oggi. Riprova: la sessione deve restare specifica sui gruppi scelti.`)
      }
    }
  }

  if (sessions.length === 0) {
    throw new Error('DeepSeek non ha generato workout validi per le sessioni richieste.')
  }

  return { sessions }
}
