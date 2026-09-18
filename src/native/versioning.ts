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

const RELEASES_API = 'https://api.github.com/repos/nuovorossi1-blip/gymbuilder/releases/latest'
const RELEASE_PAGE = 'https://github.com/nuovorossi1-blip/gymbuilder/releases/latest'
const APK_ASSET = 'GymBuilder.apk'

interface GithubReleaseAsset {
  name: string
  browser_download_url: string
}

interface GithubRelease {
  tag_name: string
  body?: string
  assets?: GithubReleaseAsset[]
}

/**
 * L'APK non e' piu' servito da Vercel (/version.json + /gymbuilder.apk): esce come
 * GitHub Release, dove APK e metadati vengono pubblicati insieme e non possono
 * essere sfasati. Il tag ha la forma apk-v1.0.N: N e' anche il versionCode.
 */
export async function fetchRemoteVersion(): Promise<RemoteAppVersion> {
  const response = await fetch(`${RELEASES_API}?time=${Date.now()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) throw new Error(`Version check ${response.status}`)
  const release = (await response.json()) as GithubRelease

  const version = (release.tag_name || '').replace(/^apk-v/i, '').replace(/^v/i, '')
  if (!version) throw new Error('Release senza tag di versione')

  const asset = (release.assets || []).find((a) => a.name === APK_ASSET)
  const versionCode = Number.parseInt(version.split('.').pop() || '0', 10) || 0

  return {
    version,
    versionCode,
    apkUrl: asset?.browser_download_url ?? `${RELEASE_PAGE}/download/${APK_ASSET}`,
    releaseUrl: RELEASE_PAGE,
    notes: release.body?.split('\n')[0]?.trim() || undefined,
    mandatory: false,
  }
}
