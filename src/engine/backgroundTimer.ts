import type { TimerEventType } from './timer'
import { ensureNativeTimerPermission, isNativeWorkoutTimerAvailable, startNativeWorkoutTimer, stopNativeWorkoutTimer } from '../native/workoutTimer'

const DEFAULT_TITLE = 'GymBuilder'
const RESUME_WORKOUT_HREF = '/?resume=workout'
export const ACTIVE_TIMER_KEY = 'gymbuilder:active-timer:v1'
export const ACTIVE_TIMER_EVENT = 'gymbuilder:active-timer'

export interface ActiveTimerState {
  label: string
  deadline: number
  remainingSec: number
  paused: boolean
  href: '/avvia'
}

export function timerTitle(label: string, remainingSec: number): string {
  const safe = Math.max(0, Math.round(remainingSec))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')} · ${label}`
}

export async function requestTimerNotifications(): Promise<boolean> {
  // Nell'APK il permesso POST_NOTIFICATIONS appartiene al plugin Android: richiesto qui,
  // prima del countdown iniziale, cosi' il dialogo di sistema compare una sola volta e non
  // resta implicito a meta' del primo round (in corsa con i round successivi, specialmente
  // brevi come nel Tabata). Non avviare in parallelo anche il prompt Web Notification.
  if (isNativeWorkoutTimerAvailable()) return ensureNativeTimerPermission()
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

export function readActiveTimer(): ActiveTimerState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ACTIVE_TIMER_KEY)
    return raw ? JSON.parse(raw) as ActiveTimerState : null
  } catch {
    return null
  }
}

function updateMediaSession(label: string, remainingSec: number): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  try {
    const title = remainingSec > 0 ? `⏱️ ${timerTitle(label, remainingSec)}` : '💪 Allenamento GymBuilder'
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: 'GymBuilder · Timer Recupero',
      album: 'Sessione di Allenamento',
    })
  } catch {
    /* MediaSession non supportato o fallito */
  }
}

export function publishBackgroundTimer(label: string, remainingSec: number, paused = false): void {
  if (typeof document === 'undefined') return
  document.title = document.hidden ? timerTitle(label, remainingSec) : DEFAULT_TITLE
  updateMediaSession(label, remainingSec)
  const state: ActiveTimerState = {
    label,
    deadline: paused ? 0 : Date.now() + Math.max(0, remainingSec) * 1000,
    remainingSec: Math.max(0, remainingSec),
    paused,
    href: '/avvia',
  }
  try {
    if (remainingSec > 0) localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(state))
    else localStorage.removeItem(ACTIVE_TIMER_KEY)
    window.dispatchEvent(new CustomEvent(ACTIVE_TIMER_EVENT, { detail: remainingSec > 0 ? state : null }))
  } catch {
    /* Il timer principale continua anche se lo storage non è disponibile. */
  }
  if (!paused && remainingSec > 0) {
    void startNativeWorkoutTimer(label, state.deadline).catch(() => { /* fallback web già attivo */ })
  } else if (remainingSec <= 0) {
    // In pausa non si ferma il servizio nativo: fermarlo e riavviarlo a ogni pausa/ripresa
    // significa distruggere e ricreare il foreground service molte volte in una sessione,
    // superficie inutile per crash legati alle restrizioni Android sui foreground service
    // (sez. WorkoutTimerService). Da fermo per davvero (fine/uscita) resetBackgroundTimer(true)
    // chiama comunque stopNativeWorkoutTimer() direttamente.
    void stopNativeWorkoutTimer().catch(() => { /* nessun servizio nativo */ })
  }
}

export async function notifyTimerEvent(type: TimerEventType, label: string): Promise<void> {
  if (typeof document === 'undefined' || !document.hidden || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  if (type !== 'TIMER_COMPLETED' && type !== 'TIME_CAP_REACHED' && type !== 'REST_STARTED' && type !== 'WORK_STARTED' && type !== 'SET_STARTED') return

  const title = type === 'SET_STARTED' || type === 'WORK_STARTED' || type === 'TIMER_COMPLETED'
    ? '⏱️ RECUPERO TERMINATO!'
    : label
  const body = type === 'REST_STARTED' ? 'Inizia il recupero.' : type === 'WORK_STARTED' || type === 'SET_STARTED' ? 'Tempo trascorso! Tocca per iniziare la serie.' : type === 'TIME_CAP_REACHED' ? 'Tempo massimo raggiunto.' : 'Timer completato.'

  const options = {
    body,
    tag: 'gymbuilder-active-timer',
    vibrate: [1_000],
    data: { href: RESUME_WORKOUT_HREF },
  }
  try {
    const registration = await navigator.serviceWorker?.ready
    if (registration) {
      await registration.showNotification(title, options)
      return
    }
    new Notification(title, options)
  } catch {
    /* La notifica è un miglioramento progressivo: non blocca il timer. */
  }
}

export async function notifyTimerSnapshot(label: string, remainingSec: number): Promise<void> {
  if (remainingSec <= 0 || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const registration = await navigator.serviceWorker?.ready
    if (!registration) return
    const endTime = Date.now() + remainingSec * 1000

    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_BACKGROUND_TIMER',
        label,
        remainingSec,
        endTime,
      })
      return
    }

    await registration.showNotification(timerTitle(label, remainingSec), {
      body: 'Timer attivo · tocca per tornare all’allenamento.',
      tag: 'gymbuilder-active-timer',
      icon: '/gymbuilder-icon.svg',
      showChronometer: true,
      chronometerDirection: 'down',
      timestamp: endTime,
      data: { href: RESUME_WORKOUT_HREF },
      requireInteraction: true,
    } as NotificationOptions & { showChronometer?: boolean; chronometerDirection?: string })
  } catch { /* miglioramento progressivo */ }
}

export function resetBackgroundTimer(clearActive = false): void {
  void stopNativeWorkoutTimer().catch(() => { /* nessun servizio nativo */ })
  if (typeof document !== 'undefined') document.title = DEFAULT_TITLE
  if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_BACKGROUND_TIMER' })
  }
  if (clearActive && typeof window !== 'undefined') {
    try {
      localStorage.removeItem(ACTIVE_TIMER_KEY)
      window.dispatchEvent(new CustomEvent(ACTIVE_TIMER_EVENT, { detail: null }))
    } catch { /* storage opzionale */ }
  }
}
