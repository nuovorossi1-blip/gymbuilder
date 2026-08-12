import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ACTIVE_TIMER_EVENT, readActiveTimer, type ActiveTimerState } from '../engine/backgroundTimer'

export function ActiveTimerBanner() {
  const [timerState, setTimerState] = useState<ActiveTimerState | null>(() => readActiveTimer())
  const [remaining, setRemaining] = useState<number>(0)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handleTimerChange = (event: Event) => {
      const customEvent = event as CustomEvent<ActiveTimerState | null>
      setTimerState(customEvent.detail)
    }
    window.addEventListener(ACTIVE_TIMER_EVENT, handleTimerChange)
    return () => window.removeEventListener(ACTIVE_TIMER_EVENT, handleTimerChange)
  }, [])

  useEffect(() => {
    if (!timerState || timerState.paused) {
      if (timerState?.remainingSec) setRemaining(timerState.remainingSec)
      return
    }
    const update = () => {
      const now = Date.now()
      const rem = Math.max(0, Math.ceil((timerState.deadline - now) / 1000))
      setRemaining(rem)
    }
    update()
    const interval = setInterval(update, 200)
    return () => clearInterval(interval)
  }, [timerState])

  // Non mostrare se si trova già su /avvia o se il timer non è attivo / scaduto
  if (location.pathname === '/avvia' || !timerState || remaining <= 0) {
    return null
  }

  const min = Math.floor(remaining / 60)
  const sec = String(remaining % 60).padStart(2, '0')

  return (
    <div
      onClick={() => navigate('/avvia')}
      className="fixed top-2 left-3 right-3 z-50 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-zinc-950/90 px-4 py-3 shadow-2xl backdrop-blur-xl transition-all active:scale-[0.98] cursor-pointer animate-in fade-in slide-in-from-top-2"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex h-3 w-3 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </div>
        <div>
          <div className="flex items-center gap-2 font-display text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
            <span>⏱️ {timerState.label}</span>
          </div>
          <p className="font-mono text-xl font-black text-white tabular-nums">
            {min}:{sec}
          </p>
        </div>
      </div>
      <button className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-black shadow-lg shadow-amber-500/20 active:bg-amber-400">
        Ritorna ▶
      </button>
    </div>
  )
}
