import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ACTIVE_TIMER_EVENT, readActiveTimer, type ActiveTimerState } from '../engine/backgroundTimer'

function remaining(state: ActiveTimerState | null): number {
  if (!state) return 0
  if (state.paused || state.deadline === 0) return state.remainingSec
  return Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000))
}

export default function ActiveTimerBanner() {
  const { pathname } = useLocation()
  const [state, setState] = useState<ActiveTimerState | null>(() => readActiveTimer())
  const [seconds, setSeconds] = useState(() => remaining(state))

  useEffect(() => {
    const update = (event: Event) => {
      const next = (event as CustomEvent<ActiveTimerState | null>).detail
      setState(next)
      setSeconds(remaining(next))
    }
    const syncStorage = () => {
      const next = readActiveTimer()
      setState(next)
      setSeconds(remaining(next))
    }
    window.addEventListener(ACTIVE_TIMER_EVENT, update)
    window.addEventListener('storage', syncStorage)
    return () => {
      window.removeEventListener(ACTIVE_TIMER_EVENT, update)
      window.removeEventListener('storage', syncStorage)
    }
  }, [])

  useEffect(() => {
    if (!state) return
    const tick = () => setSeconds(remaining(state))
    tick()
    const timer = window.setInterval(tick, 500)
    return () => window.clearInterval(timer)
  }, [state])

  if (!state || seconds <= 0 || pathname === '/avvia') return null
  return (
    <Link
      to={state.href}
      className="fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-amber2/50 bg-ink/95 px-4 py-2 shadow-xl backdrop-blur"
      aria-label={`${state.label}, ${seconds} secondi. Torna all'allenamento`}
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-amber2" aria-hidden />
      <span className="font-data text-[11px] uppercase tracking-[0.12em] text-chalk">{state.label}</span>
      <span className="font-data text-sm tabular-nums text-amber2">
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </span>
    </Link>
  )
}
