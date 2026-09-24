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
  /** Fase nutrizionale, recupero e fastidi (engine/nutrition.ts): regole di programmazione. */
  programming?: {
    fase: string | null
    fase_per_volume: string | null
    sintesi_fase: string | null
    recupero_limitato: boolean
    fastidi_articolari: string[]
    /** Scala (23/09): gradino delle calorie e gradino su cui è già il volume (-500..+1000). */
    gradino_calorie?: number | null
    gradino_volume?: number | null
    normocalorica?: number | null
  }
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
  /** Quanto affatica il muscolo lavorato, 1-3 (sez. Lagging Muscle Engine): serve al modello
   *  per non concatenare esercizi che stancano lo stesso muscolo, anche solo come secondario. */
  local_fatigue: number
  technical_complexity: number
  /** Capo/porzione enfatizzato, solo su un sottoinsieme del catalogo (bicipiti/tricipiti). */
  focus_portion?: Exercise['focus_portion']
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
I muscoli indicati come target/carenze sono un vincolo primario per Bodybuilding e Strength. Nel CrossFit non filtrare il WOD per muscoli: mantieni equilibrio fra pattern e capacità, usando le carenze soltanto per orientare Skill/Strength e 1-2 Accessory/Prehab.
Adatta il tuo ruolo alla disciplina scelta:
- CrossFit: agisci come coach CrossFit e genera un WOD autentico: warm-up, un solo elemento Skill/Strength, Metcon compatto da 8-18 minuti e 1-2 Accessory/Prehab. Non trasformarlo in una scheda Bodybuilding. Bilancia weightlifting/gymnastics/monostructural secondo catalogo, livello, tempo e attrezzatura. Se l'inventario è limitato sostituisci il movimento con una variante disponibile che conservi pattern e stimolo. Per beginner applica Meccanica -> Costanza -> Intensità, carichi leggeri, bassa complessità e scaling sicuro.
- CrossFit Hybrid: combina un blocco Strength/Bodybuilding strutturato con un Metcon realmente metabolico e sicuro sotto fatica.
- Bodybuilding: agisci come coach di ipertrofia; usa ordine compound-isolamenti, volume, recuperi e priorità muscolari coerenti.
- Strength: agisci come strength coach; rispetta metodo, fondamentali, complementari, recuperi lunghi e livello tecnico.
- Tabata: rispetta esattamente lavoro, recupero, round e prescrizione selezionati.
Se l'utente seleziona palestra completa, sfrutta in modo sensato l'attrezzatura completa; se seleziona un inventario limitato usa solo ciò che è disponibile.
Usa esclusivamente exercise_id presenti nel catalogo fornito. Non usare esercizi esclusi e non inventare ID.
Gestione del carico e ordine degli esercizi (Bodybuilding/Strength, vale anche per il blocco Strength di CrossFit Hybrid): l'ordine non è solo compound-prima-isolamenti, è gestione della fatica reale.
- Ogni esercizio del catalogo ha local_fatigue (1-3, quanto affatica il muscolo lavorato) e secondary_muscles (i muscoli coinvolti indirettamente, non solo quello target). Non mettere in sequenza due esercizi che affaticano pesantemente lo stesso muscolo — anche solo come secondario dell'uno o dell'altro: es. non fare due esercizi petto seguiti subito da Dip, che coinvolgono il petto come secondario ed è già stanco. Alternale con un gruppo muscolare diverso in mezzo.
- Se un muscolo è fra quelli carenti (muscoli_carenti) e compare come secondario in un esercizio successivo della sessione, anticipa un isolamento leggero e fresco su quel muscolo subito prima di quell'esercizio (priming): il muscolo arriva già attivato, si ricluta meglio, e se è carente si allena mentre è ancora fresco invece che dopo essere già stato tirato in causa indirettamente.
- Non concatenare più di due esercizi ad alta fatica sistemica/locale senza intervallarli con un esercizio più leggero su un gruppo diverso: l'accumulo di fatica in una singola sessione non è sostenibile, alza lo stress percepito e compromette la progressione nelle sessioni successive.
- Alcuni esercizi hanno focus_portion (bicipiti/tricipiti: quale capo lavorano di più). Se generi più sessioni nella stessa settimana con lo stesso muscolo carente, fai lavorare capi diversi in sessioni diverse invece di ripetere lo stesso angolo.
- Se devi sostituire un esercizio (in chat o rigenerando), scegli un'alternativa con lo stesso muscolo primario, la stessa focus_portion se presente, e local_fatigue/technical_complexity comparabili: altrimenti si perde l'effort allenante dell'esercizio originale.
Programmazione Bodybuilding (regole di Rossi, valgono anche per il blocco Strength di CrossFit Hybrid):
- La programmazione non è scegliere gli esercizi: è DOVE metti ogni esercizio, COSA metti prima e dopo, QUANTO volume dai alle carenze e QUANTO POCO ai muscoli in mantenimento.
- Gerarchia di posizione: senza carenze i muscoli grandi (petto, dorso, quadricipiti, femorali, glutei) vanno per primi con manubri/bilanciere, i piccoli dopo. Se le carenze sono muscoli piccoli, la carenza piccola apre la sessione e i muscoli grandi stanno subito dopo in una fascia di fatica accettabile (slot 2-4 su 6, 2-5 su 7-8), MAI in fondo. Se è carente un muscolo grande: piccolo carente slot 1, grande carente slot 2-3. Manubri e bilanciere prima delle macchine: le macchine tollerano la fatica e vanno negli slot bassi.
- Interleave secondo la fase ricevuta in programmazione.fase_per_volume: deficit = mai due esercizi dello stesso muscolo in fila; normocalorica = al massimo 2 in fila; surplus = fino a 3 in fila sui muscoli grandi. Sul muscolo carente l'interleave vale SEMPRE, anche in surplus.
- Calibrazione per fase (stesso programma, cambiano solo volume, RIR e tecniche). Deficit: carenze 12-16 serie/settimana, mantenimento 6-8, composti RIR 2, zero tecniche di intensità. Normocalorica: carenze 16-20, mantenimento 8-10, composti RIR 1, un drop set solo sull'ultima serie delle carenze. Surplus: carenze 18-24, mantenimento 10-14, RIR 0-1, drop set/rest-pause/myo-reps sulle carenze. Se recupero_limitato è true il volume è già abbassato di una fase: rispettalo.
- Scala calorica (Principio 11): i gradini sono di 250 kcal rispetto alla normocalorica, da -500 (deficit) a +1000 (surplus aggressivo). programmazione.gradino_volume è il gradino su cui calibrare serie, RIR e tecniche: segue le calorie con 7 giorni di ritardo e un gradino a settimana, in salita E in discesa (le calorie guidano, il volume segue). Se gradino_volume è diverso da gradino_calorie NON anticipare il volume. Il volume extra va prima alle carenze: i muscoli in mantenimento salgono solo dai gradini alti. Tabella indicativa per gradino -500/-250/0/+250/+500/+750/+1000: RIR multiarticolari 1-2/1-2/1/1/0-1/0-1/0-1; RIR isolamenti 0-1/0-1/0-1/0/0/0/0; serie richiamo 2/2/3/3/3/4/4; tecniche nessuna/nessuna/1 drop set/1-2 drop set/drop set + 1 rest-pause/drop set + rest-pause + myo-reps/tutte. Nessun multiarticolare, dip compreso, all'ultimo slot.
- Richiamo antagonista: in Push 2 serie (deficit) o 3 serie (normo/surplus) di bicipiti a metà sessione (slot 4-5); in Pull le stesse di tricipiti a fine sessione. Solo isolamenti, RIR 1 fisso, mai a cedimento, mai tecniche. Scrivi note "antagonista" su quell'esercizio. Se quel muscolo è carente non è un richiamo, è un esercizio pieno.
- Varianti: cambia variante per un muscolo carente fra le sedute della settimana solo se c'è un motivo biomeccanico (angolo, profilo di resistenza, allungamento vs accorciamento, unilaterale).
- Fastidi articolari in programmazione.fastidi_articolari: evita i movimenti che caricano quell'articolazione e preferisci macchine o cavi a traiettoria guidata.
- Per ogni esercizio compila anche "rir" (stringa, es. "2" o "0-1") e, solo quando previsto dalla fase, "technique" (es. "Drop set sull'ultima serie"). Serie, ripetizioni e RIR sono sempre numeri precisi, mai termini vaghi.
Regole inderogabili sul numero di esercizi allenanti, senza contare il warm-up: Bodybuilding e CrossFit Hybrid almeno 6; Strength almeno 5; CrossFit Standard segue la struttura per componenti e non deve essere gonfiato per raggiungere sei esercizi; Tabata conserva esattamente il protocollo scelto.`

const VALID_EXPERIENCE = new Set<Experience>(['beginner', 'intermediate', 'advanced'])
const VALID_GOAL = new Set<Goal>(['hypertrophy', 'strength', 'conditioning', 'mixed'])
const VALID_INTENSITY = new Set<Intensity>(['low', 'medium', 'high'])
const VALID_SPLIT_SYSTEM = new Set<SplitSystem>(['ppl', 'upper_lower', 'bro_split', 'front_back'])
const VALID_MODES = new Set<PublicMode>(['bodybuilding', 'crossfit', 'crossfit_hybrid', 'strength', 'tabata'])
const VALID_MUSCLES = new Set<Muscle>(['chest', 'back', 'front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'adductors', 'calves', 'core'])
const VALID_METCON = new Set<MetconFormat>(['amrap', 'emom', 'for_time', 'rounds', 'circuit', 'chipper', 'ladder', 'intervals', 'tabata'])
const VALID_BENCHMARK = new Set<CrossFitBenchmark>(['custom', 'cindy', 'fran', 'grace', 'helen'])
const VALID_BLOCK_KIND = new Set(['warmup', 'main', 'metcon'])
const VALID_ROLE = new Set(['compound', 'isolation', 'warmup', 'metcon'])

function deepSeekError(status: number, payload: unknown): Error {
  const apiMessage = payload && typeof payload === 'object'
    ? (payload as { error?: string | { message?: string } }).error
    : undefined
  const detail = typeof apiMessage === 'string' ? apiMessage : apiMessage?.message
  // Il proxy (api/deepseek.js) risponde 400/401 con un messaggio già in italiano.
  if ((status === 400 || status === 401) && detail) return new Error(detail)
  if (status === 401 || status === 403) return new Error('Chiave LLM non valida o non autorizzata. Controllala nel Profilo.')
  if (status === 402) return new Error('Il credito del tuo LLM è insufficiente. Controlla il saldo del tuo account.')
  if (status === 429) return new Error('L’LLM ha ricevuto troppe richieste. Attendi un minuto e riprova.')
  if (status === 504) return new Error('L’LLM sta impiegando troppo tempo. Riprova.')
  return new Error(detail || `DeepSeek ha risposto con errore ${status}.`)
}

export type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string }

async function requestDeepSeek(
  settings: LocalAiSettings,
  messages: LlmMessage[]
): Promise<{ choices?: Array<{ message?: { content?: string } }> }> {
  // La chiave DeepSeek sta solo sul server (variabile DEEPSEEK_API_KEY su Vercel, 23/09): dal
  // browser parte il token di sessione Supabase, che api/deepseek.js verifica prima di spendere
  // credito — senza, l'endpoint sarebbe un proxy aperto a chiunque.
  // Import dinamico: il client Supabase richiede le variabili d'ambiente e non deve caricarsi
  // quando questo modulo viene solo importato (test, prompt).
  const { supabase } = await import('./supabase')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Accedi di nuovo per usare il Coach.')
  let response: Response
  try {
    response = await fetch('/api/deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
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
      throw Object.assign(new Error('L’LLM sta impiegando troppo tempo. Riprova.'), { cause: error })
    }
    throw Object.assign(new Error('Impossibile contattare l’LLM. Controlla la connessione e riprova.'), { cause: error })
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
    local_fatigue: exercise.local_fatigue,
    technical_complexity: exercise.technical_complexity,
    focus_portion: exercise.focus_portion ?? undefined,
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
      rir: asOptionalString(candidate.rir) ?? (typeof candidate.rir === 'number' ? String(candidate.rir) : undefined),
      technique: asOptionalString(candidate.technique),
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
              `Oggi voglio allenare come target principali: ${(input.config.single_session_target_muscles ?? []).join(', ') || 'quelli previsti dallo split selezionato'}. ` +
              `Muscoli carenti da richiamare senza snaturare lo split: ${input.config.weak_points.join(', ') || 'nessuno'}. ` +
              `Livello ${input.config.experience}; attrezzatura ${input.config.equipment.preset}. ` +
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
                : [],
              metodo_hybrid: input.config.hybrid_method,
              formato_hybrid: input.config.hybrid_format,
              metodo_forza: input.config.strength_method,
              protocollo_tabata: input.config.tabata,
              esercizi_preferiti: input.config.preferences.preferred_exercise_ids,
              esercizi_esclusi: input.config.preferences.excluded_exercise_ids,
            },
            programmazione: input.programming ?? null,
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
                            rir: '1',
                            technique: 'string opzionale',
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
    const minimum = session.workout.mode === 'strength' ? 5 : session.workout.mode === 'crossfit' ? 3 : 6
    if (count < minimum) {
      throw new Error(`DeepSeek ha generato solo ${count} esercizi allenanti: per ${session.workout.mode} ne servono almeno ${minimum}. Riprova la generazione.`)
    }
    const targets = input.config.single_session_target_muscles?.length
      ? input.config.single_session_target_muscles
      : []
    const strictTargets = session.workout.mode !== 'crossfit' && input.config.program_kind === 'single_session' && targets.length > 0 &&
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

// ---------------------------------------------------------------------------------------------
// "Analizza la mia scheda" (23/09, Fase 3 del prompt di programmazione di Rossi): l'utente scrive
// il proprio ordine di esercizi e l'LLM lo analizza PRIMA di proporre la sua versione, poi offre
// un ibrido. È ragionamento su testo libero, l'unico punto dove un LLM rende più del motore.
// ---------------------------------------------------------------------------------------------

export interface SchedaAnalysisInput {
  scheda: string
  seduta?: string
  carenze: Muscle[]
  programmazione: DeepSeekWorkoutGenerationInput['programming'] | null
  livello?: Experience
  /** Catalogo dell'app: DeepSeek abbina ogni riga a un exercise_id (blocco 5, scheda salvabile). */
  catalogo?: Exercise[]
}

export interface SchedaRiga { slot: number; testo: string; exercise_id: string | null; sets: number; reps: string; rir: string }

export interface SchedaCheck { ok: boolean; nota: string }

export interface SchedaAnalysis {
  sequenza: string
  controlli: { interleave: SchedaCheck; priorita: SchedaCheck; dimensione: SchedaCheck; volume: SchedaCheck }
  confronto: Array<{ slot: number; utente: string; proposta: string; vincitore: 'utente' | 'proposta' | 'pari'; perche: string }>
  ibrida: Array<{ slot: number; esercizio: string; muscolo: string; serie_reps: string; rir: string; nota?: string }>
  pregi: string[]
  difetti: string[]
  conclusione: string
  /** La scheda dell'utente abbinata al catalogo, nel SUO ordine. */
  tua: SchedaRiga[]
  /** La versione del coach, abbinata al catalogo, slot per slot. */
  proposta: SchedaRiga[]
}

export const ANALISI_SCHEDA_SYSTEM_PROMPT = `Sei un coach di bodybuilding natural specializzato in programmazione per l'ipertrofia.
La programmazione non è scegliere gli esercizi: è DOVE metti ogni esercizio, COSA metti prima e dopo, QUANTO dai alle carenze e QUANTO POCO ai muscoli in mantenimento, per QUANTO TEMPO è sostenibile.
L'utente ti manda la SUA scheda. NON generare subito la tua versione: prima analizza la sua.
1. Scrivi la sequenza dei muscoli: A → B → C...
2. Interleave: ci sono esercizi dello stesso muscolo consecutivi? Regola per fase: deficit mai; normocalorica al massimo 2 in fila; surplus fino a 3 sui muscoli grandi. Sul muscolo carente l'interleave vale sempre. Fase sconosciuta: valuta come normocalorica e dillo.
3. Priorità: le carenze sono nei primi slot? Nessun multiarticolare, dip compreso, all'ultimo slot. Se le carenze sono muscoli piccoli la carenza piccola apre e i muscoli grandi seguono subito in fascia accettabile (slot 2-4 su 6), mai in fondo. Senza carenze i grandi vanno per primi.
4. Dimensione: manubri e bilanciere sui muscoli grandi nei primi slot, macchine negli slot bassi (tollerano la fatica).
5. Volume: valutalo sul gradino di programmazione.gradino_volume (scala di 250 kcal dalla normocalorica: il volume segue le calorie con 7 giorni di ritardo, un gradino a settimana, in salita e in discesa). Serie per distretto coerenti con la fase (deficit carenze 12-16/sett e mantenimento 6-8; normo 16-20 e 8-10; surplus 18-24 e 10-14), richiamo antagonista max 2 serie in deficit / 3 in normo-surplus a RIR 1.
Poi confronta slot per slot la scheda dell'utente con la tua proposta e di' chi vince e perché. Se la scheda ha pregi e difetti proponi una versione IBRIDA che prende il meglio di entrambe. Mai dire "è sbagliata" senza spiegare perché e senza offrire l'alternativa. Rispetta i fastidi articolari ricevuti.
Serie, ripetizioni e RIR sempre numeri precisi. Scrivi in italiano semplice.
Ti arriva anche il catalogo esercizi dell'app: abbina OGNI riga della scheda dell'utente all'exercise_id del catalogo più vicino (stesso movimento e attrezzo; se non c'è nulla di sensato metti null) in "tua", rispettando esattamente il suo ordine, le sue serie e ripetizioni. In "proposta" metti la tua versione slot per slot, SOLO con exercise_id del catalogo, lo stesso numero di slot di "confronto".
Rispondi SOLO con un JSON object con questa forma:
{"tua":[{"slot":1,"testo":"riga originale","exercise_id":"id|null","sets":3,"reps":"8-12","rir":"1"}],"proposta":[{"slot":1,"testo":"nome esercizio","exercise_id":"id","sets":3,"reps":"8-12","rir":"1"}],"sequenza":"string","controlli":{"interleave":{"ok":true,"nota":"string"},"priorita":{"ok":true,"nota":"string"},"dimensione":{"ok":true,"nota":"string"},"volume":{"ok":true,"nota":"string"}},"confronto":[{"slot":1,"utente":"string","proposta":"string","vincitore":"utente|proposta|pari","perche":"string"}],"ibrida":[{"slot":1,"esercizio":"string","muscolo":"string","serie_reps":"3x8-12","rir":"1","nota":"string opzionale"}],"pregi":["string"],"difetti":["string"],"conclusione":"string"}`

function sanitizeCheck(value: unknown): SchedaCheck {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return { ok: v.ok === true, nota: asString(v.nota, '') }
}

function sanitizeRiga(row: Record<string, unknown>, index: number): SchedaRiga {
  const id = typeof row.exercise_id === 'string' && row.exercise_id.trim() && row.exercise_id !== 'null' ? row.exercise_id.trim() : null
  return {
    slot: asPositiveInt(row.slot, index + 1),
    testo: asString(row.testo, ''),
    exercise_id: id,
    sets: asPositiveInt(row.sets, 3),
    reps: typeof row.reps === 'number' ? String(row.reps) : asString(row.reps, '8-12'),
    rir: typeof row.rir === 'number' ? String(row.rir) : asString(row.rir, ''),
  }
}

export function sanitizeSchedaAnalysis(raw: unknown): SchedaAnalysis {
  const c = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const controlli = c.controlli && typeof c.controlli === 'object' ? c.controlli as Record<string, unknown> : {}
  const list = (value: unknown) => (Array.isArray(value) ? value : []).filter((item) => item && typeof item === 'object') as Record<string, unknown>[]
  const strings = (value: unknown) => (Array.isArray(value) ? value : []).filter((item): item is string => typeof item === 'string' && !!item.trim())
  const vincitore = (value: unknown): 'utente' | 'proposta' | 'pari' => value === 'utente' || value === 'proposta' ? value : 'pari'
  const result: SchedaAnalysis = {
    sequenza: asString(c.sequenza, ''),
    controlli: {
      interleave: sanitizeCheck(controlli.interleave),
      priorita: sanitizeCheck(controlli.priorita),
      dimensione: sanitizeCheck(controlli.dimensione),
      volume: sanitizeCheck(controlli.volume),
    },
    confronto: list(c.confronto).map((row, index) => ({
      slot: asPositiveInt(row.slot, index + 1),
      utente: asString(row.utente, '—'),
      proposta: asString(row.proposta, '—'),
      vincitore: vincitore(row.vincitore),
      perche: asString(row.perche, ''),
    })),
    ibrida: list(c.ibrida).map((row, index) => ({
      slot: asPositiveInt(row.slot, index + 1),
      esercizio: asString(row.esercizio, '—'),
      muscolo: asString(row.muscolo, ''),
      serie_reps: asString(row.serie_reps, ''),
      rir: typeof row.rir === 'number' ? String(row.rir) : asString(row.rir, ''),
      nota: asOptionalString(row.nota),
    })),
    pregi: strings(c.pregi),
    difetti: strings(c.difetti),
    conclusione: asString(c.conclusione, ''),
    tua: list(c.tua).map((row, index) => sanitizeRiga(row, index)),
    proposta: list(c.proposta).map((row, index) => sanitizeRiga(row, index)),
  }
  if (!result.sequenza && result.confronto.length === 0 && result.ibrida.length === 0) {
    throw new Error("DeepSeek non ha restituito un'analisi utilizzabile. Riprova.")
  }
  return result
}

export async function analyzeSchedaWithDeepSeek(settings: LocalAiSettings, input: SchedaAnalysisInput): Promise<SchedaAnalysis> {
  if (!input.scheda.trim()) throw new Error('Scrivi prima la tua scheda, un esercizio per riga.')
  const payload = await requestDeepSeek(settings, [
    { role: 'system', content: ANALISI_SCHEDA_SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        scheda_utente: input.scheda.trim(),
        seduta: input.seduta || 'non specificata',
        muscoli_carenti: input.carenze,
        livello: input.livello ?? 'non specificato',
        programmazione: input.programmazione,
        catalogo: (input.catalogo ?? []).filter((e) => !e.roles.includes('warmup')).map((e) => ({
          id: e.id, name: e.name, primary_muscles: e.primary_muscles, equipment: e.equipment, compound: e.roles.includes('compound'),
        })),
      }),
    },
  ])
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek non ha restituito contenuto utile.')
  return sanitizeSchedaAnalysis(JSON.parse(extractJsonObject(content)))
}

// ---------------------------------------------------------------------------------------------
// Fase 2 (25/09): lettura di una cartella .md modificata fuori dall'app (a mano o da un altro
// LLM). DeepSeek la riporta nella struttura CartellaCliente; normalizzaCartella la ripulisce.
// ---------------------------------------------------------------------------------------------
export const CARTELLA_IMPORT_SYSTEM_PROMPT = `Ricevi la cartella di un cliente di bodybuilding in Markdown (può essere stata aggiornata da un altro coach o LLM) ed eventualmente la versione precedente in JSON.
Estrai i dati e rispondi SOLO con un JSON object con esattamente queste chiavi:
{"livello_note":"string","obiettivo":{"primario":"string","secondario":"string","indiretto":"string"},"vincoli":[{"zona":"string","problema":"string","vietati":["nome esercizio"],"strategia":"string"}],"carenze":[{"muscolo":"id","note":"string"}],"punti_forti":[{"muscolo":"id","note":"string"}],"esercizi_ok":[{"nome":"string","nota":"string"}],"esercizi_perdita_tensione":[{"nome":"string","nota":"soluzione"}],"obbligatori":[{"nome":"string","seduta":"string","slot":1}],"attrezzatura":["string"],"riscaldamento":{"descrizione":"string","minuti":8},"macro":{"proteine_g":150,"grassi_g":70,"carboidrati_g":250},"note_coach":"string","controlli":[{"data":"AAAA-MM-GG","peso":82,"girovita":84,"specchio":"string","energia":"string","recupero":"string","sonno":"string","fame":"string","fastidi":"string","carichi":[{"esercizio":"string","carico":"string","reps":"string"}],"decisioni":"string"}]}
Muscoli ammessi (id): chest, back, front_delts, lateral_delts, rear_delts, biceps, triceps, forearms, quads, hamstrings, glutes, adductors, calves, core.
Se il file contiene una scheda o un programma (Parte 4), aggiungi anche la chiave "piano" con questa forma, altrimenti "piano": null:
{"titolo":"string","giorni_settimana":5,"durata_min":75,"calorie":2000,"macro":{"proteine_g":150,"grassi_g":60,"carboidrati_g":200},"note":"string","sedute":[{"nome":"Pull A","split":"pull","logica":"sequenza e logica energia della seduta","esercizi":[{"nome":"nome esercizio","serie":3,"reps":"10-12","rir":"1","recupero_sec":90,"nota":"perché lì","alternativa":"string","tecnica":"string"}]}]}
Il testo Markdown vince sul JSON precedente dove sono diversi. Non inventare dati che non ci sono: lascia stringhe vuote o liste vuote.`

export async function leggiCartellaConLlm(settings: LocalAiSettings, markdown: string, precedente: unknown): Promise<unknown> {
  const payload = await requestDeepSeek(settings, [
    { role: 'system', content: CARTELLA_IMPORT_SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify({ markdown: markdown.slice(0, 60_000), json_precedente: precedente ?? null }) },
  ])
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek non ha restituito contenuto utile.')
  return JSON.parse(extractJsonObject(content))
}

/** Chiamata generica (Coach, Fase 3): risponde con l'oggetto JSON prodotto dall'LLM. */
export async function chiediJsonAlLlm(messages: LlmMessage[]): Promise<Record<string, unknown>> {
  const { loadLocalAiSettings } = await import('../features/profile/aiSettings')
  const payload = await requestDeepSeek(loadLocalAiSettings(), messages)
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('L’LLM non ha restituito una risposta.')
  return JSON.parse(extractJsonObject(content)) as Record<string, unknown>
}
