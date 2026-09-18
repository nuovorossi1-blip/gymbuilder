import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

const APK_URL = 'https://github.com/nuovorossi1-blip/gymbuilder/releases/latest/download/GymBuilder.apk'
const HIDDEN_KEY = 'gymbuilder.installBannerHidden'

/**
 * Invito a installare l'APK. Prima compariva sempre: anche su desktop, dove l'APK
 * non serve a niente, e nel browser di chi l'app ce l'ha gia' installata.
 * Ora si mostra solo nel browser di un telefono Android, fuori dall'app nativa,
 * e si puo' chiudere: la scelta resta salvata.
 */
export default function InstallBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return
    if (!/android/i.test(navigator.userAgent)) return
    try {
      if (localStorage.getItem(HIDDEN_KEY) === '1') return
    } catch {
      // localStorage non disponibile (navigazione privata): si mostra comunque
    }
    setShow(true)
  }, [])

  if (!show) return null

  const hide = () => {
    try {
      localStorage.setItem(HIDDEN_KEY, '1')
    } catch {
      // se non si puo' salvare, almeno sparisce per questa sessione
    }
    setShow(false)
  }

  return (
    <aside className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-cyan-300/30 bg-[#0b1017]/95 px-4 py-3 shadow-xl backdrop-blur" aria-label="Scarica GymBuilder per Android">
      <div className="min-w-0">
        <p className="font-display text-sm font-black uppercase tracking-wide text-chalk">GymBuilder Android</p>
        <p className="truncate text-xs text-slate2">APK disponibile per il download</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          className="rounded-xl bg-cyan-300 px-4 py-2 font-display text-xs font-black uppercase tracking-wide text-ink shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
          href={APK_URL}
        >
          Scarica app
        </a>
        <button
          type="button"
          onClick={hide}
          aria-label="Nascondi l'invito a installare l'app"
          className="rounded-xl border border-slate2/40 px-3 py-2 font-display text-xs font-black uppercase tracking-wide text-slate2 active:scale-[0.98]"
        >
          Nascondi
        </button>
      </div>
    </aside>
  )
}
