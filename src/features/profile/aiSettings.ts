export type DeepSeekModel = 'deepseek-v4-flash' | 'deepseek-v4-pro'

export interface LocalAiSettings {
  deepseek_api_key: string
  deepseek_model: DeepSeekModel
}

const STORAGE_KEY = 'gymbuilder:ai-settings:v1'

const DEFAULT_SETTINGS: LocalAiSettings = {
  deepseek_api_key: '',
  deepseek_model: 'deepseek-v4-flash',
}

export function loadLocalAiSettings(): LocalAiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as LocalAiSettings
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveLocalAiSettings(settings: LocalAiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage opzionale: se non disponibile, la UI resta comunque usabile.
  }
}

