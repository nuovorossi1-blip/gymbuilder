import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useSettings } from '../features/profile/useSettings'
import { useWorkout } from '../features/workout/WorkoutContext'
import { caricaCatalogo, salvaAllenamento, volumeSettimanaleUtente } from '../lib/api'
import { generaBodybuilding } from '../generators/bodybuilding'
import { EXPERIENCE_LABELS, GOAL_LABELS, MUSCLE_LABELS, SPLIT_LABELS } from '../types'

export default function WorkoutPreview() {
  const { user } = useAuth()
  const { settings } = useSettings(user?.id)
  const { workout, setWorkout } = useWorkout()
  const naviga = useNavigate()
  const [stato, setStato] = useState<'fermo' | 'salvo' | 'salvato' | 'errore'>('fermo')
  const [messaggio, setMessaggio] = useState<string | null>(null)

  if (!workout) {
    return (
      <div className="px-5 pt-12">
        <h1 className="font-display font-extrabold uppercase text-3xl tracking-tight">
          Nessun allenamento
        </h1>
        <p className="mt-3 text-slate2 text-[15px]">Torna indietro e generane uno.</p>
        <button className="btn mt-6" onClick={() => naviga('/')}>
          Vai a Crea
        </button>
      </div>
    )
  }

  const riscaldamento = workout.blocks.find((b) => b.kind === 'warmup')
  const principale = workout.blocks.find((b) => b.kind === 'main')

  async function rigenera() {
    if (!settings || !workout || !user) return
    const catalogo = await caricaCatalogo()
    const volumeSettimanale = await volumeSettimanaleUtente(user.id, catalogo)
    setWorkout(
      generaBodybuilding(catalogo, {
        split: workout.split,
        goal: workout.goal,
        experience: settings.experience,
        equipment: settings.equipment,
        duration_min: workout.duration_min,
        priority_muscles: settings.priority_muscles,
        excluded_exercises: settings.excluded_exercises,
        preferred_exercises: settings.favorite_exercises,
        weekly_volume: volumeSettimanale,
        seed: Date.now() % 100000,
      })
    )
    setStato('fermo')
    setMessaggio(null)
  }

  async function salva() {
    if (!user || !workout) return
    setStato('salvo')
    try {
      await salvaAllenamento(user.id, workout)
      setStato('salvato')
      setMessaggio('Lo trovi in Salvati.')
    } catch (e) {
      setStato('errore')
      setMessaggio(e instanceof Error ? e.message : 'Non salvato.')
    }
  }

  return (
    <div className="px-5 pt-12 pb-8">
      <p className="eyebrow mb-2">{EXPERIENCE_LABELS[workout.experience]} · {GOAL_LABELS[workout.goal]}</p>
      <h1 className="font-display font-extrabold uppercase leading-[0.9] tracking-tight text-[2.4rem]">
        {SPLIT_LABELS[workout.split]}
      </h1>

      <div className="mt-4 flex items-baseline gap-6 font-data">
        <span>
          <span className="text-3xl">{workout.duration_min}</span>
          <span className="text-slate2 text-[13px]"> min</span>
        </span>
        <span>
          <span className="text-3xl">{principale?.exercises.length ?? 0}</span>
          <span className="text-slate2 text-[13px]"> esercizi</span>
        </span>
      </div>

      {workout.warnings.map((w, i) => (
        <p key={i} className="mt-4 rounded-lg border border-amber2/40 bg-amber2/10 px-3 py-2.5 text-[13px] text-amber2">
          {w}
        </p>
      ))}

      {/* Riscaldamento */}
      {riscaldamento && riscaldamento.exercises.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="field-label !mb-0">Riscaldamento</h2>
            <span className="font-data text-[11px] text-slate2">{riscaldamento.duration_min} min</span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {riscaldamento.exercises.map((e, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 border-b border-edge/60 pb-1.5">
                <span className="text-[14px] text-slate2">{e.name}</span>
                <span className="font-data text-[12px] whitespace-nowrap">{e.reps}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Allenamento */}
      <section className="mt-8">
        <h2 className="field-label">Allenamento</h2>
        <ol className="space-y-2.5">
          {principale?.exercises.map((e, i) => (
            <li key={i} className="slab !py-3.5">
              <div className="flex items-baseline gap-3">
                <span className="font-data text-[13px] text-slate2 w-4 shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[15px] leading-snug">{e.name}</p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-3 font-data text-[12px] text-slate2">
                    <span className="text-chalk text-[15px]">
                      {e.sets}<span className="text-slate2 text-[12px]">×</span>{e.reps}
                    </span>
                    <span>recupero {formattaRec(e.rest_sec)}</span>
                  </p>
                </div>
                <span className="font-data text-[9px] uppercase tracking-[0.12em] text-slate2 shrink-0">
                  {e.role === 'compound' ? 'base' : 'isol.'}
                </span>
              </div>
              {e.muscle && (
                <p className="mt-1.5 pl-7 font-data text-[10px] uppercase tracking-[0.12em] text-slate2">
                  {MUSCLE_LABELS[e.muscle]}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {messaggio && (
        <p className={`mt-6 text-[13px] ${stato === 'errore' ? 'text-amber2' : 'text-slate2'}`} role="status">
          {messaggio}
        </p>
      )}

      {/* Azioni */}
      <div className="mt-8 space-y-2.5">
        <button className="btn !py-4 text-lg" onClick={() => naviga('/avvia')}>
          Avvia allenamento
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            className="rounded-xl border border-edge bg-steel py-3.5 font-data text-[11px] uppercase tracking-[0.14em] text-chalk active:bg-edge disabled:opacity-40"
            onClick={salva}
            disabled={stato === 'salvo' || stato === 'salvato'}
          >
            {stato === 'salvato' ? 'Salvato' : 'Salva'}
          </button>
          <button
            className="rounded-xl border border-edge bg-steel py-3.5 font-data text-[11px] uppercase tracking-[0.14em] text-chalk active:bg-edge"
            onClick={rigenera}
          >
            Rigenera
          </button>
        </div>
      </div>
    </div>
  )
}

export function formattaRec(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`
}
