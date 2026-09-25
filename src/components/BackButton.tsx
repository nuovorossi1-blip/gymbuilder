import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Tasto ← uguale in tutta l'app (25/09, Rossi: "serve il tasto indietro per ogni cosa che apro
 * per tornare a quello che stavo vedendo prima"). Torna alla schermata precedente della
 * cronologia; se la pagina è stata aperta direttamente (nessuna cronologia) va a `fallback`.
 */
export function BackButton({ fallback = '/', label = 'Indietro', className = '' }: { fallback?: string; label?: string; className?: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const haCronologia = location.key !== 'default'
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 rounded-lg py-1.5 pr-3 font-data text-xs text-slate2 hover:text-white ${className}`}
      onClick={() => (haCronologia ? navigate(-1) : navigate(fallback))}
      aria-label={label}
    >
      <span aria-hidden className="text-base leading-none">←</span> {label}
    </button>
  )
}
