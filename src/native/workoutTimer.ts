import { Capacitor, registerPlugin } from '@capacitor/core'
import { loadTimerSettings } from '../features/profile/timerSettings'

export type NativeTimerPhase = 'work' | 'rest' | 'other'

interface WorkoutTimerPlugin {
  start(options: { label: string; deadline: number; phase: NativeTimerPhase; vibrate: boolean }): Promise<{ started: boolean; notificationsGranted: boolean }>
  stop(): Promise<void>
  ensurePermission(): Promise<{ granted: boolean }>
}

const NativeWorkoutTimer = registerPlugin<WorkoutTimerPlugin>('WorkoutTimer')
let activeNativeTimer: { label: string; deadline: number; phase: NativeTimerPhase } | null = null

export function isNativeWorkoutTimerAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

// La vibrazione a fine round e' una preferenza dell'app impostata una volta in Profilo (non per
// singolo allenamento): letta qui a ogni avvio/aggiornamento del timer nativo invece di essere
// passata dai chiamanti, cosi' un cambio in Profilo si applica subito senza dover toccare Runner.
export async function startNativeWorkoutTimer(label: string, deadline: number, phase: NativeTimerPhase = 'other'): Promise<void> {
  if (!isNativeWorkoutTimerAvailable()) return
  if (activeNativeTimer?.label === label && activeNativeTimer.phase === phase && Math.abs(activeNativeTimer.deadline - deadline) < 1_500) return
  const vibrate = loadTimerSettings().vibration
  await NativeWorkoutTimer.start({ label, deadline, phase, vibrate })
  activeNativeTimer = { label, deadline, phase }
}

export async function stopNativeWorkoutTimer(): Promise<void> {
  if (!isNativeWorkoutTimerAvailable()) return
  await NativeWorkoutTimer.stop()
  activeNativeTimer = null
}

// Chiesto una volta, prima del countdown iniziale, cosi' il dialogo di sistema non compare
// implicitamente a meta' del primo round (dove andrebbe in corsa con i cambi fase successivi).
export async function ensureNativeTimerPermission(): Promise<boolean> {
  if (!isNativeWorkoutTimerAvailable()) return true
  const { granted } = await NativeWorkoutTimer.ensurePermission()
  return granted
}
