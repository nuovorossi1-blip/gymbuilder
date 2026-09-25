import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Tasto ← uguale in tutta l'app (25/09). Rossi: "poco visibile e troppo in alto": ora è una
 * pillola ben visibile che resta ATTACCATA in cima mentre si scorre (sticky), sotto la barra di
 * stato del telefono (safe area). Torna alla schermata precedente della cronologia; se la pagina
 * è stata aperta direttamente va a `fallback`.
 */
export function BackButton({ fallback = '/', label = 'Indietro', className = '' }: { fallback?: string; label?: string; className?: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const haCronologia = location.key !== 'default'
  return (
    <div className={`sticky top-[max(0.75rem,env(safe-area-inset-top))] z-30 mb-3 ${className}`}>
      <button
        type="button"
        className="inline-flex h-11 items-center gap-2 rounded-full border border-cyan-500/50 bg-ink/90 px-4 text-sm font-bold text-cyan-100 shadow-lg backdrop-blur active:scale-[0.97]"
        onClick={() => (haCronologia ? navigate(-1) : navigate(fallback))}
        aria-label={label}
      >
        <span aria-hidden className="text-lg leading-none">←</span> {label}
      </button>
    </div>
  )
}
