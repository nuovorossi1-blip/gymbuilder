export interface RemoteAppVersion {
  version: string
  versionCode: number
  apkUrl: string
  releaseUrl: string
  notes?: string
  mandatory?: boolean
}

export function isNewerVersion(remote: string, current: string): boolean {
  const normalize = (value: string) => value.replace(/^v/i, '').split('-')[0].split('.').map((part) => Number.parseInt(part, 10) || 0)
  const next = normalize(remote)
  const installed = normalize(current)
  const length = Math.max(next.length, installed.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (next[index] ?? 0) - (installed[index] ?? 0)
    if (difference !== 0) return difference > 0
  }
  return false
}

export async function fetchRemoteVersion(): Promise<RemoteAppVersion> {
  const response = await fetch(`/version.json?time=${Date.now()}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Version check ${response.status}`)
  return response.json() as Promise<RemoteAppVersion>
}
