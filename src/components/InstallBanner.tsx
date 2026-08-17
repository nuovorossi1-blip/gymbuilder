import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

export default function InstallBanner() {
  const [web, setWeb] = useState(false)

  useEffect(() => {
    setWeb(!Capacitor.isNativePlatform())
  }, [])

  if (!web) return null

  return (
    <aside className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-cyan-300/30 bg-[#0b1017]/95 px-4 py-3 shadow-xl backdrop-blur" aria-label="Scarica GymBuilder per Android">
      <div className="min-w-0">
        <p className="font-display text-sm font-black uppercase tracking-wide text-chalk">GymBuilder Android</p>
        <p className="truncate text-xs text-slate2">APK disponibile per il download</p>
      </div>
      <a
        className="shrink-0 rounded-xl bg-cyan-300 px-4 py-2 font-display text-xs font-black uppercase tracking-wide text-ink shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
        href="/gymbuilder.apk"
        download="gymbuilder.apk"
      >
        Scarica app
      </a>
    </aside>
  )
}
