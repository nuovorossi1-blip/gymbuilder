import { Capacitor, registerPlugin } from '@capacitor/core'

interface WorkoutTimerPlugin {
  start(options: { label: string; deadline: number }): Promise<{ started: boolean; notificationsGranted: boolean }>
  stop(): Promise<void>
}

const NativeWorkoutTimer = registerPlugin<WorkoutTimerPlugin>('WorkoutTimer')
let activeNativeTimer: { label: string; deadline: number } | null = null

export function isNativeWorkoutTimerAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function startNativeWorkoutTimer(label: string, deadline: number): Promise<void> {
  if (!isNativeWorkoutTimerAvailable()) return
  if (activeNativeTimer?.label === label && Math.abs(activeNativeTimer.deadline - deadline) < 1_500) return
  await NativeWorkoutTimer.start({ label, deadline })
  activeNativeTimer = { label, deadline }
}

export async function stopNativeWorkoutTimer(): Promise<void> {
  if (!isNativeWorkoutTimerAvailable()) return
  await NativeWorkoutTimer.stop()
  activeNativeTimer = null
}
