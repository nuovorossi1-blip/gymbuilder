import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

interface SwipeToDeleteRowProps {
  children: ReactNode
  onDelete: () => void
  confirmLabel: string
}

const REVEAL_THRESHOLD = 70

/**
 * Swipe a destra su una riga -> segue il dito (cosi' si vede subito che il gesto e' riconosciuto,
 * a differenza di un rilevamento "solo al rilascio" che sembra rotto se il gesto non viene
 * completato) e oltre soglia si ferma sulla conferma inline "vuoi eliminare?" con Conferma/Annulla.
 * Pointer Events con soglia di movimento (non touch/mouse separati) cosi' la card puo' anche
 * scorrere verticalmente nella lista finche' il gesto non e' chiaramente orizzontale; a quel punto
 * si blocca lo scroll nativo (touch-action -> none) per non perdere il drag a meta'.
 * user-select/touch-callout disattivati perche' il long-press nativo del WebView (selezione
 * testo/menu contestuale) puo' altrimenti interrompere il gesto prima che parta.
 */
export function SwipeToDeleteRow({ children, onDelete, confirmLabel }: SwipeToDeleteRowProps) {
  const [confirming, setConfirming] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const state = useRef<{ pointerId: number; startX: number; startY: number; committed: boolean } | null>(null)

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    state.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, committed: false }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = state.current
    if (!current || event.pointerId !== current.pointerId) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    if (!current.committed) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
      if (Math.abs(dy) > Math.abs(dx)) { state.current = null; return }
      current.committed = true
      setDragging(true)
      try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* capture opzionale */ }
    }
    event.preventDefault()
    setDragX(Math.max(0, Math.min(dx, REVEAL_THRESHOLD * 1.6)))
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = state.current
    state.current = null
    setDragging(false)
    if (!current || event.pointerId !== current.pointerId) return
    if (dragX >= REVEAL_THRESHOLD) setConfirming(true)
    setDragX(0)
  }

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
    <div className="relative overflow-hidden rounded-2xl">
      {dragX > 0 && (
        <div className="absolute inset-0 flex items-center justify-start rounded-2xl bg-red-500/80 pl-5 text-sm font-bold uppercase tracking-wider text-white">
          🗑️ Elimina
        </div>
      )}
      <div
        className="relative select-none"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 180ms ease-out',
          touchAction: 'pan-y',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // Un singolo gesto touch genera sia PointerEvent che TouchEvent: la pagina (Saved.tsx)
        // ha uno SwipeContainer a livello di pagina che ascolta i TouchEvent per navigare
        // (swipe destra -> Home). preventDefault() sui pointer non ferma quella bolla separata,
        // quindi va fermata esplicitamente qui.
        onTouchStart={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
