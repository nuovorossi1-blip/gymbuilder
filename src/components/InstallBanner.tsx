import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { fetchRemoteVersion, type RemoteAppVersion } from '../native/versioning'

const DISMISSED_KEY = 'gymbuilder:install-banner-dismissed:v1'

export default function InstallBanner() {
  const [release, setRelease] = useState<RemoteAppVersion | null>(null)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (Capacitor.isNativePlatform() || localStorage.getItem(DISMISSED_KEY) === 'true') return
    const android = /Android/i.test(navigator.userAgent)
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    if ((!android && !ios) || standalone) return
    setDismissed(false)
    void fetchRemoteVersion().then(setRelease).catch(() => setRelease(null))
  }, [])

  if (dismissed) return null
  const android = /Android/i.test(navigator.userAgent)
  const downloadUrl = release?.apkUrl || release?.releaseUrl

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  return (
    <aside className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-cyan-300/30 bg-[#12161d]/95 p-4 shadow-2xl backdrop-blur" aria-label="Installa GymBuilder">
      <button type="button" className="absolute right-3 top-2 text-xl text-slate2" aria-label="Chiudi" onClick={dismiss}>×</button>
      <p className="font-display font-black text-chalk">Porta GymBuilder sul telefono</p>
      <p className="mt-1 pr-5 text-sm text-slate2">{android ? 'Installa l’APK Android e ricevi gli aggiornamenti direttamente nell’app.' : 'In Safari: Condividi → Aggiungi alla schermata Home.'}</p>
      {android && downloadUrl && <a className="mt-3 inline-flex rounded-xl bg-cyan-300 px-4 py-2 font-bold text-ink" href={downloadUrl} target="_blank" rel="noreferrer">Scarica app</a>}
    </aside>
  )
}
