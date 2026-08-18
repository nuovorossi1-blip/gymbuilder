import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useWorkout } from '../features/workout/WorkoutContext'
import { caricaCatalogo, elencoStorico, eliminaStorico } from '../lib/api'
import type { CompletedWorkout } from '../types'
import { SwipeToDeleteRow } from '../components/SwipeToDeleteRow'

const VALUTAZIONI: Record<string, string> = {
  facile: 'Facile', giusto: 'Giusto', duro: 'Duro', troppo_duro: 'Troppo duro',
}

export default function History() {
  const { user } = useAuth()
  const { catalog, setCatalog, setWorkout, setGenerationConfig, startWorkoutSession } = useWorkout()
  const naviga = useNavigate()
  const [lista, setLista] = useState<CompletedWorkout[] | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    elencoStorico(user.id).then(setLista).catch((e) => setErrore(e.message))
  }, [user])

  useEffect(() => {
    if (catalog.length === 0) void caricaCatalogo().then(setCatalog).catch(() => undefined)
  }, [catalog.length, setCatalog])

  function apri(c: CompletedWorkout, startImmediate = false) {
    const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]))
    const blocks = c.blocks.map((block) => ({
      ...block,
      exercises: block.exercises.map((prescribed) => {
        const canonicalId = prescribed.exercise_id === 'leg_extension_unilaterale' ? 'leg_extension' : prescribed.exercise_id
        const current = byId.get(canonicalId)
        return current ? {
          ...prescribed,
          exercise_id: current.id,
          name: current.name,
          instructions: current.instructions,
        } : prescribed
      }),
    }))
    const nextWorkout = {
      name: c.name,
      mode: c.mode,
      split: null,
      goal: 'mixed' as const,
      experience: 'intermediate' as const,
      duration_min: Math.max(1, Math.round(c.duration_sec / 60)),
      blocks,
      warnings: [],
    }
    setGenerationConfig(null)
    setWorkout(nextWorkout)
    if (startImmediate) startWorkoutSession(nextWorkout, null)
    naviga(startImmediate ? '/avvia' : '/allenamento')
  }

  async function elimina(c: CompletedWorkout) {
    try {
      await eliminaStorico(c.id)
      setLista((current) => current?.filter((item) => item.id !== c.id) ?? [])
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non siamo riusciti a eliminare l'allenamento.")
    }
  }

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
          <li key={c.id}>
            <SwipeToDeleteRow confirmLabel={`Eliminare “${c.name}” dallo storico?`} onDelete={() => elimina(c)}>
              <div className="slab space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display font-bold uppercase tracking-wide text-[16px]">{c.name}</span>
                  <span className="font-data text-[12px] text-slate2 whitespace-nowrap">
                    {Math.round(c.duration_sec / 60)} min
                  </span>
                </div>
                <p className="font-data text-[11px] uppercase tracking-[0.12em] text-slate2">
                  {new Date(c.completed_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                  {c.rating && ` · ${VALUTAZIONI[c.rating] ?? c.rating}`}
                </p>
                <div className="grid grid-cols-2 gap-2 border-t border-edge/60 pt-3">
                  <button
                    className="rounded-xl border border-edge bg-steel py-2.5 font-data text-[11px] uppercase tracking-[0.14em] text-chalk active:bg-edge"
                    onClick={() => apri(c, false)}
                  >
                    👁️ Vedi dettagli
                  </button>
                  <button
                    className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-white active:scale-[0.98]"
                    onClick={() => apri(c, true)}
                  >
                    ▶ Ripeti
                  </button>
                </div>
              </div>
            </SwipeToDeleteRow>
          </li>
        ))}
      </ul>
    </div>
  )
}
