import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { ApkUpdater } from '../native/apkUpdater'
import { fetchRemoteVersion, isNewerVersion, type RemoteAppVersion } from '../native/versioning'

type UpdateState = 'ready' | 'permission' | 'downloading' | 'error'

export default function NativeUpdater() {
  const [release, setRelease] = useState<RemoteAppVersion | null>(null)
  const [state, setState] = useState<UpdateState>('ready')

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return
    let active = true
    Promise.all([ApkUpdater.getCurrentVersion(), fetchRemoteVersion()])
      .then(([installed, remote]) => {
        if (active && remote.apkUrl && isNewerVersion(remote.version, installed.version)) setRelease(remote)
      })
      .catch(() => { /* il controllo aggiornamenti non deve impedire l'avvio */ })
    return () => { active = false }
  }, [])

  if (!release) return null

  async function install() {
    if (!release) return
    setState('downloading')
    try {
      const capability = await ApkUpdater.canInstallPackages()
      if (!capability.allowed) {
        setState('permission')
        await ApkUpdater.openInstallSettings()
        return
      }
      await ApkUpdater.downloadAndInstall({ url: release.apkUrl, fileName: `GymBuilder-${release.version}.apk` })
    } catch {
      setState('error')
    }
  }

  const dismissible = !release.mandatory && state !== 'downloading'
  return (
    <div className="fixed inset-0 z-[100] grid place-items-end bg-black/70 p-4 sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="native-update-title">
      <section className="glass-card animate-modal-in w-full max-w-md rounded-2xl p-5">
        <p className="eyebrow text-cyan-300">Aggiornamento Android</p>
        <h2 id="native-update-title" className="mt-2 font-display text-2xl font-black text-chalk">GymBuilder {release.version}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate2">{release.notes || 'È disponibile una nuova versione dell’app.'}</p>
        {state === 'permission' && <p className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">Autorizza GymBuilder a installare app, poi torna qui e premi nuovamente Aggiorna.</p>}
        {state === 'error' && <p className="mt-3 rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-200">Download non riuscito. Controlla la connessione e riprova.</p>}
        <button className="btn mt-5" type="button" disabled={state === 'downloading'} onClick={() => void install()}>
          {state === 'downloading' ? 'Download in corso…' : state === 'permission' ? 'Ho autorizzato, riprova' : 'Aggiorna app'}
        </button>
        {dismissible && <button className="mt-3 w-full py-2 text-sm text-slate2" type="button" onClick={() => setRelease(null)}>Più tardi</button>}
      </section>
    </div>
  )
}
