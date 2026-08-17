import type { TimerEvent, TimerEventType } from './timer'

export type TimerSound = 'beep' | 'ding' | 'ring' | 'silent'
export interface AudioTimerSettings { enabled: boolean; startSound: TimerSound; endSound: TimerSound; countdown: boolean; vibration: boolean }

export const DEFAULT_AUDIO_SETTINGS: AudioTimerSettings = { enabled: true, startSound: 'beep', endSound: 'ding', countdown: true, vibration: true }
const STORAGE_KEY = 'gymbuilder:timer-audio:v1'

export function loadAudioSettings(): AudioTimerSettings {
  try { return { ...DEFAULT_AUDIO_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } }
  catch { return DEFAULT_AUDIO_SETTINGS }
}

export function saveAudioSettings(settings: AudioTimerSettings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* storage opzionale */ }
}

export function soundForEvent(type: TimerEventType, settings: AudioTimerSettings): TimerSound | null {
  if (!settings.enabled) return null
  if (type === 'WARNING') return settings.countdown ? 'beep' : null
  if (type === 'COUNTDOWN_COMPLETED' || type === 'TIMER_COMPLETED' || type === 'TIME_CAP_REACHED' || type === 'REST_STARTED') return settings.endSound
  if (type === 'TIMER_STARTED' || type === 'WORK_STARTED' || type === 'ROUND_STARTED' || type === 'SET_STARTED') return settings.startSound
  return null
}

export function vibrationForEvent(type: TimerEventType, settings: AudioTimerSettings): number | number[] | null {
  if (!settings.vibration) return null
  if (type === 'WARNING') return 70
  if (type === 'COUNTDOWN_COMPLETED') return 1_000
  if (type === 'TIMER_COMPLETED' || type === 'TIME_CAP_REACHED') return [140, 80, 180]
  if (type === 'REST_STARTED' || type === 'WORK_STARTED' || type === 'ROUND_STARTED' || type === 'SET_STARTED') return 45
  return null
}

/** Web Audio viene sbloccato dal tap su Comincia; non altera il volume del dispositivo. */
export class TimerAudio {
  private context: AudioContext | null = null
  constructor(private settings: AudioTimerSettings) {}
  update(settings: AudioTimerSettings) { this.settings = settings }
  async unlock(): Promise<void> {
    if (!this.settings.enabled) return
    this.context ??= new AudioContext()
    if (this.context.state === 'suspended') await this.context.resume()
  }
  play(event: TimerEvent): void {
    const vibration = vibrationForEvent(event.type, this.settings)
    if (vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(vibration)
    const sound = soundForEvent(event.type, this.settings)
    if (!sound || sound === 'silent' || !this.context || this.context.state !== 'running') return
    const now = this.context.currentTime
    if (event.type === 'WARNING') {
      this.tone(now, 760, 0.1, 0.28, 'square')
    } else if (event.type === 'COUNTDOWN_COMPLETED') {
      this.longSignal(now, sound, true)
    } else if (sound === 'ring' || event.phase === 'tabata' || event.type === 'ROUND_STARTED' || event.type === 'REST_STARTED') {
      this.playBoxingRingGong(now)
    } else if (event.type === 'TIMER_COMPLETED') {
      this.longSignal(now, sound)
    } else if (event.type === 'TIME_CAP_REACHED') {
      this.tone(now, 330, 0.2, 0.22); this.tone(now + 0.26, 330, 0.2, 0.22)
    } else if (sound === 'ding') {
      this.tone(now, 1040, 0.18, 0.22)
    } else {
      this.tone(now, 780, 0.12, 0.16)
    }
  }

  private playBoxingRingGong(at: number, duration = 1.2) {
    if (!this.context) return
    const freqs = [587.33, 1174.66, 1760]
    const gains = [0.45, 0.35, 0.2]
    freqs.forEach((freq, idx) => {
      if (!this.context) return
      const osc = this.context.createOscillator()
      const g = this.context.createGain()
      osc.type = idx === 0 ? 'sine' : 'triangle'
      osc.frequency.value = freq
      g.gain.setValueAtTime(gains[idx], at)
      g.gain.exponentialRampToValueAtTime(0.0001, at + duration)
      osc.connect(g)
      g.connect(this.context.destination)
      osc.start(at)
      osc.stop(at + duration)
    })
  }

  private longSignal(at: number, sound: Exclude<TimerSound, 'silent'>, emphasized = false) {
    const duration = emphasized ? 1.5 : 0.8
    if (sound === 'ring') {
      this.playBoxingRingGong(at, emphasized ? 1.8 : 1.2)
    } else if (sound === 'ding') {
      this.tone(at, 1040, duration, emphasized ? 0.38 : 0.24)
    } else {
      this.tone(at, 720, emphasized ? 1.3 : 0.7, emphasized ? 0.42 : 0.3, 'square')
    }
  }
  private tone(at: number, frequency: number, duration: number, gainValue: number, type: OscillatorType = 'sine') {
    if (!this.context) return
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = type; oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(gainValue, at); gain.gain.exponentialRampToValueAtTime(0.001, at + duration)
    oscillator.connect(gain); gain.connect(this.context.destination)
    oscillator.start(at); oscillator.stop(at + duration)
  }
}
