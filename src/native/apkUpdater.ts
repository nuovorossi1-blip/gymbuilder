import { registerPlugin } from '@capacitor/core'

interface InstalledVersion {
  version: string
  versionCode: number
}

interface InstallCapability {
  allowed: boolean
}

interface ApkUpdaterPlugin {
  getCurrentVersion(): Promise<InstalledVersion>
  canInstallPackages(): Promise<InstallCapability>
  openInstallSettings(): Promise<void>
  downloadAndInstall(options: { url: string; fileName: string }): Promise<{ started: boolean }>
}

export const ApkUpdater = registerPlugin<ApkUpdaterPlugin>('ApkUpdater')
