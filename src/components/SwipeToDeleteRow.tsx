import { useState, type MouseEvent, type ReactNode, type TouchEvent } from 'react'
import { useSwipeGesture } from '../hooks/useSwipeGesture'

interface SwipeToDeleteRowProps {
  children: ReactNode
  onDelete: () => void
  confirmLabel: string
}

/**
 * Swipe a destra su una riga -> conferma inline "vuoi eliminare?" al posto della card, con
 * Conferma/Annulla. stopPropagation() sui gesti e' necessario perche' la pagina (Saved.tsx) usa
 * gia' uno SwipeContainer a livello di pagina per navigare (swipe destra -> Home): senza fermare
 * la bolla degli eventi, uno swipe che parte su una card farebbe partire entrambi i gesti insieme.
 */
export function SwipeToDeleteRow({ children, onDelete, confirmLabel }: SwipeToDeleteRowProps) {
  const [confirming, setConfirming] = useState(false)
  const swipe = useSwipeGesture({ onSwipeRight: () => setConfirming(true) })

  if (confirming) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/50 bg-red-500/10 p-4">
        <p className="text-[13px] leading-snug text-red-200">{confirmLabel}</p>
        <div className="flex shrink-0 gap-2">
          <button
            className="rounded-xl border border-edge px-3.5 py-2.5 font-data text-[11px] uppercase tracking-wider text-slate2"
            onClick={() => setConfirming(false)}
          >
            Annulla
          </button>
          <button
            className="rounded-xl bg-red-500 px-3.5 py-2.5 font-data text-[11px] font-bold uppercase tracking-wider text-white"
            onClick={() => { setConfirming(false); onDelete() }}
          >
            Elimina
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="touch-pan-y"
      onTouchStart={(event: TouchEvent) => { event.stopPropagation(); swipe.onTouchStart(event) }}
      onTouchMove={(event: TouchEvent) => { event.stopPropagation(); swipe.onTouchMove(event) }}
      onTouchEnd={(event: TouchEvent) => { event.stopPropagation(); swipe.onTouchEnd() }}
      onMouseDown={(event: MouseEvent) => { event.stopPropagation(); swipe.onMouseDown(event) }}
      onMouseMove={(event: MouseEvent) => { event.stopPropagation(); swipe.onMouseMove(event) }}
      onMouseUp={(event: MouseEvent) => { event.stopPropagation(); swipe.onMouseUp() }}
      onMouseLeave={(event: MouseEvent) => { event.stopPropagation(); swipe.onMouseLeave() }}
    >
      {children}
    </div>
  )
}
