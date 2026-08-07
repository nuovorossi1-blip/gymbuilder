import type { TimerEventType } from './timer'

const DEFAULT_TITLE = 'GymBuilder'

export function timerTitle(label: string, remainingSec: number): string {
  const safe = Math.max(0, Math.round(remainingSec))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')} · ${label}`
}

export async function requestTimerNotifications(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

export function publishBackgroundTimer(label: string, remainingSec: number): void {
  if (typeof document === 'undefined') return
  document.title = document.hidden ? timerTitle(label, remainingSec) : DEFAULT_TITLE
}

export function notifyTimerEvent(type: TimerEventType, label: string): void {
  if (typeof document === 'undefined' || !document.hidden || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  if (type !== 'TIMER_COMPLETED' && type !== 'TIME_CAP_REACHED' && type !== 'REST_STARTED' && type !== 'WORK_STARTED') return
  const body = type === 'REST_STARTED' ? 'Inizia il recupero.' : type === 'WORK_STARTED' ? 'Riprendi il lavoro.' : type === 'TIME_CAP_REACHED' ? 'Tempo massimo raggiunto.' : 'Timer completato.'
  new Notification(label, { body, tag: 'gymbuilder-active-timer' })
}

export function resetBackgroundTimer(): void {
  if (typeof document !== 'undefined') document.title = DEFAULT_TITLE
}
