export type DeepSeekModel = 'deepseek-v4-flash' | 'deepseek-v4-pro'

/** Solo la scelta del modello resta sul dispositivo: dal 23/09 la chiave DeepSeek vive sul
 *  server (variabile DEEPSEEK_API_KEY su Vercel) e non passa più dal browser. */
export interface LocalAiSettings {
  deepseek_model: DeepSeekModel
}

const STORAGE_KEY = 'gymbuilder:ai-settings:v1'

const DEFAULT_SETTINGS: LocalAiSettings = {
  deepseek_model: 'deepseek-v4-flash',
}

export function loadLocalAiSettings(): LocalAiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const stored = JSON.parse(raw) as Partial<LocalAiSettings> & { deepseek_api_key?: string }
    // Una chiave salvata dalle versioni precedenti non serve più: la si cancella dal dispositivo.
    if ('deepseek_api_key' in stored) {
      delete stored.deepseek_api_key
      saveLocalAiSettings({ ...DEFAULT_SETTINGS, ...stored })
    }
    return { ...DEFAULT_SETTINGS, ...stored }
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
