import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useWorkout } from '../features/workout/WorkoutContext'
import { cambiaPreferito, caricaCatalogo, elencoSalvati, eliminaSalvato } from '../lib/api'
import { GOAL_LABELS, SPLIT_LABELS, type Goal, type Mode, type SavedWorkout, type Split } from '../types'

export default function Saved() {
  const { user } = useAuth()
  const { catalog, setCatalog, setWorkout, setGenerationConfig } = useWorkout()
  const naviga = useNavigate()
  const [lista, setLista] = useState<SavedWorkout[] | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  const carica = useCallback(() => {
    if (!user) return
    elencoSalvati(user.id).then(setLista).catch((e) => setErrore(e.message))
  }, [user])

  useEffect(carica, [carica])

  useEffect(() => {
    if (catalog.length === 0) void caricaCatalogo().then(setCatalog).catch(() => undefined)
  }, [catalog.length, setCatalog])

  function apri(s: SavedWorkout) {
    const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]))
    const blocks = s.blocks.map((block) => ({
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
    setGenerationConfig(s.generation_config ?? null)
    setWorkout({
      name: s.name, mode: s.mode as Mode, split: s.split as Split | null,
      goal: s.goal as Goal, experience: s.experience as never,
      duration_min: s.duration_min, blocks, warnings: [],
    })
    naviga('/allenamento')
  }

  async function elimina(s: SavedWorkout) {
    if (!window.confirm(`Eliminare “${s.name}” dai tuoi allenamenti salvati?`)) return
    try {
      await eliminaSalvato(s.id)
      setLista((current) => current?.filter((item) => item.id !== s.id) ?? [])
    } catch {
      setErrore('Non siamo riusciti a eliminare la scheda. Riprova.')
    }
  }

  return (
    <div className="px-5 pt-12 pb-4">
      <h1 className="font-display font-extrabold uppercase text-[2.4rem] leading-none tracking-tight">Salvati</h1>

      {errore && <p className="mt-6 text-sm text-amber2" role="alert">{errore}</p>}
      {lista === null && !errore && <div className="mt-8 h-24 animate-pulse rounded-xl bg-steel" aria-hidden />}

      {lista?.length === 0 && (
        <div className="slab mt-8">
          <p className="text-[15px] text-slate2 leading-relaxed">
            Qui finiscono gli allenamenti che salvi. Generane uno e premi Salva.
          </p>
        </div>
      )}

      <ul className="mt-7 space-y-2.5">
        {lista?.map((s) => (
          <li key={s.id} className="slab">
            <button className="block w-full text-left" onClick={() => apri(s)}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display font-bold uppercase tracking-wide text-[16px]">
                  {SPLIT_LABELS[s.split as Split] ?? s.name}
                </span>
                <span className="font-data text-[12px] text-slate2 whitespace-nowrap">{s.duration_min} min</span>
              </div>
              <p className="mt-1 font-data text-[11px] uppercase tracking-[0.12em] text-slate2">
                {GOAL_LABELS[s.goal as Goal]} · {new Date(s.created_at).toLocaleDateString('it-IT')}
              </p>
            </button>
            <div className="mt-3 flex gap-2 border-t border-edge pt-3">
              <button
                className="font-data text-[11px] uppercase tracking-[0.12em] text-slate2"
                onClick={async () => { await cambiaPreferito(s.id, !s.favorite); carica() }}
              >
                {s.favorite ? '★ preferito' : '☆ preferito'}
              </button>
              <button
                className="ml-auto rounded-lg border border-red-400/30 px-3 py-1.5 font-data text-[11px] uppercase tracking-[0.12em] text-red-300"
                onClick={() => void elimina(s)}
              >
                Elimina scheda
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
