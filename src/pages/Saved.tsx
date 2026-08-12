import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useWorkout } from '../features/workout/WorkoutContext'
import { cambiaPreferito, caricaCatalogo, elencoSalvati, eliminaSalvato } from '../lib/api'
import { GOAL_LABELS, SPLIT_LABELS, type Goal, type Mode, type SavedWorkout, type Split } from '../types'
import { SwipeContainer } from '../components/SwipeContainer'

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

  function apri(s: SavedWorkout, startImmediate = false) {
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
    naviga(startImmediate ? '/avvia' : '/allenamento')
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
    <SwipeContainer
      onSwipeLeft={() => naviga('/profilo')}
      onSwipeRight={() => naviga('/')}
      className="px-4 pt-6 pb-28 space-y-6"
    >
      <header className="flex items-center justify-between">
        <div>
          <span className="eyebrow text-cyan-400">Libreria Personale</span>
          <h1 className="font-display text-2xl font-black uppercase text-white">
            Allenamenti Salvati
          </h1>
        </div>
        <button
          onClick={() => naviga('/crea')}
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-2 font-display text-xs font-bold uppercase text-white shadow-md glow-cyan"
        >
          + Nuova Scheda
        </button>
      </header>

      {errore && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300" role="alert">
          {errore}
        </p>
      )}

      {lista === null && !errore && (
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-2xl glass-card" aria-hidden />
          <div className="h-28 animate-pulse rounded-2xl glass-card" aria-hidden />
        </div>
      )}

      {lista?.length === 0 && (
        <div className="rounded-2xl glass-card p-6 text-center space-y-3 border border-dashed border-edge">
          <div className="text-3xl">📂</div>
          <h2 className="font-display text-lg font-bold text-white uppercase">
            Nessuna scheda salvata
          </h2>
          <p className="text-xs text-slate-400">
            Qui ritrovi tutti gli allenamenti che decidi di conservare. Generane uno e premi “Salva in Libreria”.
          </p>
          <button
            onClick={() => naviga('/crea')}
            className="inline-block rounded-xl bg-cyan-500/20 border border-cyan-500/40 px-4 py-2 text-xs font-bold text-cyan-300 uppercase tracking-wider"
          >
            Genera la tua prima scheda
          </button>
        </div>
      )}

      <ul className="space-y-3">
        {lista?.map((s) => (
          <li key={s.id} className="rounded-2xl glass-card border border-edge p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-base text-white">
                    {SPLIT_LABELS[s.split as Split] ?? s.name}
                  </span>
                  {s.favorite && (
                    <span className="text-amber-400 text-sm">★</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {GOAL_LABELS[s.goal as Goal]} · {s.duration_min} min · {new Date(s.created_at).toLocaleDateString('it-IT')}
                </p>
              </div>
              <button
                className="text-slate-400 hover:text-amber-400 transition-colors text-lg"
                onClick={async () => { await cambiaPreferito(s.id, !s.favorite); carica() }}
                aria-label="Preferito"
              >
                {s.favorite ? '★' : '☆'}
              </button>
            </div>

            {/* 1-Tap Action Row */}
            <div className="grid grid-cols-3 gap-2 border-t border-edge/60 pt-3">
              <button
                onClick={() => apri(s, true)}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 font-display text-xs font-bold uppercase text-white shadow-md glow-emerald active:scale-[0.98]"
              >
                ▶ Inizia
              </button>
              <button
                onClick={() => apri(s, false)}
                className="rounded-xl glass-card py-2.5 font-display text-xs font-bold uppercase text-slate-300 hover:text-white"
              >
                👁️ Dettagli
              </button>
              <button
                onClick={() => void elimina(s)}
                className="rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 font-display text-xs font-bold uppercase text-red-300 hover:bg-red-500/20"
              >
                🗑️ Elimina
              </button>
            </div>
          </li>
        ))}
      </ul>
    </SwipeContainer>
  )
}
