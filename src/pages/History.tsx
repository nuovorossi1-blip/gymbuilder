import { useEffect, useState } from 'react'
import { useAuth } from '../features/auth/AuthProvider'
import { elencoStorico } from '../lib/api'
import type { CompletedWorkout } from '../types'

const VALUTAZIONI: Record<string, string> = {
  facile: 'Facile', giusto: 'Giusto', duro: 'Duro', troppo_duro: 'Troppo duro',
}

export default function History() {
  const { user } = useAuth()
  const [lista, setLista] = useState<CompletedWorkout[] | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    elencoStorico(user.id).then(setLista).catch((e) => setErrore(e.message))
  }, [user])

  return (
    <div className="px-5 pt-12 pb-4">
      <h1 className="font-display font-extrabold uppercase text-[2.4rem] leading-none tracking-tight">Ultimo allenamento</h1>

      {errore && <p className="mt-6 text-sm text-amber2" role="alert">{errore}</p>}
      {lista === null && !errore && <div className="mt-8 h-24 animate-pulse rounded-xl bg-steel" aria-hidden />}

      {lista?.length === 0 && (
        <div className="slab mt-8">
          <p className="text-[15px] text-slate2 leading-relaxed">
            Qui comparirà l’ultimo allenamento che hai portato a termine.
          </p>
        </div>
      )}

      <ul className="mt-7 space-y-2.5">
        {lista?.slice(0, 1).map((c) => (
          <li key={c.id} className="slab">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display font-bold uppercase tracking-wide text-[16px]">{c.name}</span>
              <span className="font-data text-[12px] text-slate2 whitespace-nowrap">
                {Math.round(c.duration_sec / 60)} min
              </span>
            </div>
            <p className="mt-1 font-data text-[11px] uppercase tracking-[0.12em] text-slate2">
              {new Date(c.completed_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
              {c.rating && ` · ${VALUTAZIONI[c.rating] ?? c.rating}`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
