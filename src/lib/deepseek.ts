import type { LocalAiSettings } from '../features/profile/aiSettings'
import type { Experience, Goal, Intensity, Muscle, PublicMode, SplitSystem, WeeklyProgramConfig } from '../types'

interface DeepSeekPlannerInput {
  config: WeeklyProgramConfig
  prompt: string
}

type PlannerPatch = Partial<Pick<
  WeeklyProgramConfig,
  'goal' | 'experience' | 'duration_min' | 'training_days' | 'split_system' |
  'single_session_split' | 'single_session_target_muscles' | 'weak_points' |
  'selected_modes' | 'crossfit_format' | 'hybrid_method' | 'hybrid_format' |
  'strength_method' | 'intensity'
>>

const VALID_EXPERIENCE = new Set<Experience>(['beginner', 'intermediate', 'advanced'])
const VALID_GOAL = new Set<Goal>(['hypertrophy', 'strength', 'conditioning', 'mixed'])
const VALID_INTENSITY = new Set<Intensity>(['low', 'medium', 'high'])
const VALID_SPLIT_SYSTEM = new Set<SplitSystem>(['ppl', 'upper_lower', 'bro_split', 'front_back'])
const VALID_MODES = new Set<PublicMode>(['bodybuilding', 'crossfit', 'crossfit_hybrid', 'strength', 'tabata'])
const VALID_MUSCLES = new Set<Muscle>(['chest', 'back', 'front_delts', 'lateral_delts', 'rear_delts', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'])

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
  if (typeof patch.hybrid_method === 'string') next.hybrid_method = patch.hybrid_method as WeeklyProgramConfig['hybrid_method']
  if (typeof patch.hybrid_format === 'string') next.hybrid_format = patch.hybrid_format as WeeklyProgramConfig['hybrid_format']
  if (typeof patch.strength_method === 'string') next.strength_method = patch.strength_method as WeeklyProgramConfig['strength_method']

  return next
}

export async function suggestWorkoutConfigWithDeepSeek(
  settings: LocalAiSettings,
  input: DeepSeekPlannerInput
): Promise<PlannerPatch> {
  const apiKey = settings.deepseek_api_key.trim()
  if (!apiKey) throw new Error('Inserisci prima la chiave API DeepSeek nel profilo.')

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: settings.deepseek_model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Sei un planner di configurazioni per GymBuilder. Devi restituire solo un JSON object con un patch compatibile con WeeklyProgramConfig. Non inventare campi. Rispetta questi limiti: selected_modes max 1 per single_session, max 2 per program; single_session_target_muscles max 6; weak_points max 6; duration_min solo 30/45/60/75/90.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            richiesta_utente: input.prompt,
            configurazione_corrente: input.config,
            obiettivo: 'Suggerisci solo i campi da modificare per generare un workout o programma migliore con il motore esistente.',
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`DeepSeek ha risposto con errore ${response.status}.`)
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek non ha restituito contenuto utile.')
  const parsed = JSON.parse(extractJsonObject(content))
  return sanitizePatch(parsed, input.config)
}
