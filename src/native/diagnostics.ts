import { Capacitor, registerPlugin } from '@capacitor/core'

interface DiagnosticsPlugin {
  readCrashLog(): Promise<{ content: string }>
  clearCrashLog(): Promise<void>
}

const NativeDiagnostics = registerPlugin<DiagnosticsPlugin>('Diagnostics')

export function isNativeDiagnosticsAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function readNativeCrashLog(): Promise<string> {
  if (!isNativeDiagnosticsAvailable()) return ''
  const { content } = await NativeDiagnostics.readCrashLog()
  return content
}

export async function clearNativeCrashLog(): Promise<void> {
  if (!isNativeDiagnosticsAvailable()) return
  await NativeDiagnostics.clearCrashLog()
}
