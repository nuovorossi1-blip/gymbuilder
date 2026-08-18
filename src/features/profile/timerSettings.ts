export interface TimerNotificationSettings {
  vibration: boolean
}

const STORAGE_KEY = 'gymbuilder:timer-settings:v1'

const DEFAULT_SETTINGS: TimerNotificationSettings = {
  vibration: true,
}

/**
 * Preferenze di notifica del timer (vibrazione a fine round, ecc.): impostate una volta sola in
 * Profilo e applicate a ogni allenamento, non chieste/reimpostate a ogni sessione.
 */
export function loadTimerSettings(): TimerNotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as TimerNotificationSettings
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveTimerSettings(settings: TimerNotificationSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage opzionale: se non disponibile, la preferenza resta solo per la sessione corrente.
  }
}
