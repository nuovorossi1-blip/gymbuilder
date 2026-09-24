import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useSettings } from '../features/profile/useSettings'
import { determinaFase } from '../engine/nutrition'
import { analizzaStallo, gradinoDiOggi } from '../engine/stallo'
import { useWorkout } from '../features/workout/WorkoutContext'
import { elencoSalvati, elencoStorico } from '../lib/api'
import type { CompletedWorkout, Goal, Mode, SavedWorkout, Split } from '../types'
import { SwipeContainer } from '../components/SwipeContainer'

export default function HomeDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Blocco 3: avviso in Home solo quando serve (gradino della scala da applicare o stallo).
  const { profile, calorieLog, bodyLog } = useSettings(user?.id)
  const gradino = gradinoDiOggi(profile?.ladder_plan)
  const avvisoScala = gradino && profile?.daily_kcal !== gradino.kcal
    ? `Scala in corso: oggi passa a ${gradino.kcal} kcal`
    : !gradino && analizzaStallo(bodyLog, determinaFase(profile, calorieLog)?.calorie_step ?? null, profile?.daily_kcal ?? null, calorieLog.length ? calorieLog[calorieLog.length - 1].created_at : null)
      ? 'Possibile stallo: c’è una proposta di scala per le calorie'
      : null
  const {
    activeSession, resumeActiveSession, setWorkout, setGenerationConfig,
    weeklyProgram, setWeeklyProgram, clearRejectedExercises, catalog,
  } = useWorkout()
  const [savedList, setSavedList] = useState<SavedWorkout[]>([])
  const [lastCompleted, setLastCompleted] = useState<CompletedWorkout | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    let active = true
    setLoadingSaved(true)

    Promise.all([
      elencoSalvati(user.id).catch(() => []),
      elencoStorico(user.id).catch(() => []),
    ])
      .then(([saved, history]) => {
        if (active) {
          if (saved) setSavedList(saved.slice(0, 3))
          if (history && history.length > 0) setLastCompleted(history[0])
        }
      })
      .finally(() => {
        if (active) setLoadingSaved(false)
      })

    return () => {
      active = false
    }
  }, [user])

  const handleResumeWorkout = () => {
    if (activeSession) {
      resumeActiveSession()
      navigate('/avvia')
    }
  }

  const createFreshWorkout = (programKind: 'program' | 'single_session' = 'single_session') => {
    setWorkout(null)
    setGenerationConfig(null)
    setWeeklyProgram(null)
    clearRejectedExercises()
    navigate(`/crea?program_kind=${programKind}&fresh=1`)
  }

  const openSavedWorkout = (sw: SavedWorkout) => {
    const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]))
    const blocks = sw.blocks.map((block) => ({
      ...block,
      exercises: block.exercises.map((prescribed) => {
        const canonicalId =
          prescribed.exercise_id === 'leg_extension_unilaterale'
            ? 'leg_extension'
            : prescribed.exercise_id
        const current = byId.get(canonicalId)
        return current
          ? {
              ...prescribed,
              exercise_id: current.id,
              name: current.name,
              instructions: current.instructions,
            }
          : prescribed
      }),
    }))

    setWorkout({
      name: sw.name,
      mode: sw.mode as Mode,
      split: sw.split as Split | null,
      goal: sw.goal as Goal,
      experience: sw.experience as never,
      duration_min: sw.duration_min,
      blocks,
      warnings: [],
    })
    navigate('/allenamento')
  }

  return (
    <SwipeContainer
      onSwipeLeft={() => navigate('/ultimo')}
      onSwipeRight={() => navigate('/salvati')}
      className="space-y-6 px-4 pt-6 pb-28"
    >
      {/* Header Top Bar */}
      <header className="flex items-center justify-between">
        <div>
          <span className="eyebrow text-cyan-400">GymBuilder AI</span>
          <h1 className="font-display text-2xl font-black tracking-tight text-white">
            OGGI
          </h1>
        </div>
        <button
          onClick={() => navigate('/profilo')}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-steel/80 border border-edge text-slate2 transition-colors hover:text-white"
          aria-label="Profilo"
        >
          👤
        </button>
      </header>

      {/* Main Today Action Card */}
      <div className="relative overflow-hidden rounded-2xl glass-card border border-cyan-500/30 p-5 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 h-28 w-28 rounded-full bg-cyan-500/10 blur-2xl pointer-events-none" />

        {activeSession ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                Sessione in Corso
              </span>
              <span className="font-data text-xs text-slate-400">
                {new Date().toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>

            <h2 className="font-display text-xl font-bold text-white mb-1">
              {activeSession.workout.name}
            </h2>

            <p className="text-xs text-slate-300 mb-5">
              {activeSession.workout.duration_min} min · {activeSession.workout.blocks.length} blocchi pronti
            </p>

            <button
              onClick={handleResumeWorkout}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 px-4 font-display text-sm font-bold uppercase tracking-wider text-white shadow-lg glow-cyan transition-transform active:scale-[0.98]"
            >
              <span>▶ CONTINUA ALLENAMENTO</span>
            </button>
          </>
        ) : weeklyProgram && weeklyProgram.config.program_kind === 'program' && weeklyProgram.week.length > 1 ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-purple-300">
                🗓️ Programma Settimanale in Corso
              </span>
              <span className="font-data text-xs text-slate-400">
                {weeklyProgram.week.filter((giorno) => giorno.generated_workout).length}/{weeklyProgram.week.length} giorni generati
              </span>
            </div>

            <h2 className="font-display text-xl font-bold text-white mb-1">
              {weeklyProgram.week.map((giorno) => giorno.label).join(' · ')}
            </h2>

            <p className="text-xs text-slate-300 mb-5">
              Riprendi da dove hai lasciato senza perdere la settimana già costruita.
            </p>

            <button
              onClick={() => navigate('/crea')}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 py-3.5 px-4 font-display text-sm font-bold uppercase tracking-wider text-white shadow-lg transition-transform active:scale-[0.98]"
            >
              <span>📅 CONTINUA LA SETTIMANA</span>
            </button>
          </>
        ) : lastCompleted ? (
          <>

            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Ultimo Allenamento Completato
              </span>
              <span className="font-data text-xs text-slate-400">
                {new Date(lastCompleted.completed_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
              </span>
            </div>

            <h2 className="font-display text-xl font-bold text-white mb-1">
              {lastCompleted.name}
            </h2>

            <p className="text-xs text-slate-300 mb-5">
              Durata: {Math.round(lastCompleted.duration_sec / 60)} min {lastCompleted.rating ? `· Valutazione: ${lastCompleted.rating}` : ''}
            </p>

            <button
              onClick={() => createFreshWorkout()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 px-4 font-display text-sm font-bold uppercase tracking-wider text-white shadow-lg glow-cyan transition-transform active:scale-[0.98]"
            >
              <span>⚡ CREA NUOVO ALLENAMENTO</span>
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                🏋️ Nessun Allenamento
              </span>
            </div>

            <h2 className="font-display text-xl font-bold text-white mb-1">
              Nessun Allenamento Recente
            </h2>

            <p className="text-xs text-slate-300 mb-5">
              Non hai ancora completato nessun allenamento. Genera la tua prima scheda per iniziare!
            </p>

            <button
              onClick={() => createFreshWorkout()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 px-4 font-display text-sm font-bold uppercase tracking-wider text-white shadow-lg glow-cyan transition-transform active:scale-[0.98]"
            >
              <span>⚡ CREA IL TUO PRIMO ALLENAMENTO</span>
            </button>
          </>
        )}
      </div>

      {/* 2 Main Selection Action Cards */}
      <section className="space-y-3">
        <h3 className="eyebrow text-slate-400">Genera Nuovo Allenamento</h3>

        <div className="grid grid-cols-1 gap-3">
          {/* Card 1: Settimana */}
          <button
            onClick={() => createFreshWorkout('program')}
            className="group relative flex items-center justify-between rounded-xl glass-card p-4 border border-edge text-left transition-all hover:border-cyan-500/40 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-2xl border border-purple-500/30">
                🗓️
              </div>
              <div>
                <div className="font-display font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Pianifica Settimana
                </div>
                <div className="text-xs text-slate-400">
                  Programma 3-7 giorni (PPL, Upper/Lower, Hybrid)
                </div>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-cyan-400 transition-transform group-hover:translate-x-1">
              ➔
            </span>
          </button>

          {/* Card 2: Sessione Singola */}
          <button
            onClick={() => createFreshWorkout('single_session')}
            className="group relative flex items-center justify-between rounded-xl glass-card p-4 border border-edge text-left transition-all hover:border-cyan-500/40 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 text-2xl border border-cyan-500/30">
                ⚡
              </div>
              <div>
                <div className="font-display font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Allenamento Singolo Rapido
                </div>
                <div className="text-xs text-slate-400">
                  Genera una scheda al volo per la giornata di oggi
                </div>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-cyan-400 transition-transform group-hover:translate-x-1">
              ➔
            </span>
          </button>

          {/* Card 6: Il mio piano (Coach, Fase 3) */}
          <button
            onClick={() => navigate('/coach')}
            className="group relative flex items-center justify-between rounded-xl glass-card p-4 border border-cyan-500/40 text-left transition-all hover:border-cyan-400 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 text-2xl border border-cyan-500/40">🧑‍🏫</div>
              <div>
                <div className="font-display font-bold text-white group-hover:text-cyan-300 transition-colors">Il mio piano (Coach)</div>
                <div className="text-xs text-slate-400">Colloquio con il tuo coach LLM e piano su misura a rotazione</div>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-cyan-400 transition-transform group-hover:translate-x-1">➔</span>
          </button>

          {/* Card 5: La mia cartella (Fase 2, 25/09) */}
          <button
            onClick={() => navigate('/cartella')}
            className="group relative flex items-center justify-between rounded-xl glass-card p-4 border border-edge text-left transition-all hover:border-cyan-500/40 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 text-2xl border border-indigo-500/30">
                📋
              </div>
              <div>
                <div className="font-display font-bold text-white group-hover:text-cyan-300 transition-colors">La mia cartella</div>
                <div className="text-xs text-slate-400">Carenze, vincoli, esercizi e obiettivi per il Coach · scarica il file .md</div>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-cyan-400 transition-transform group-hover:translate-x-1">➔</span>
          </button>

          {/* Card 4: Peso e girovita (blocco 3) */}
          <button
            onClick={() => navigate('/peso')}
            className="group relative flex items-center justify-between rounded-xl glass-card p-4 border border-edge text-left transition-all hover:border-cyan-500/40 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-2xl border border-emerald-500/30">
                ⚖️
              </div>
              <div>
                <div className="font-display font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Peso e girovita
                </div>
                <div className={`text-xs ${avvisoScala ? 'text-amber-300' : 'text-slate-400'}`}>
                  {avvisoScala ?? 'Una misura a settimana: l’app riconosce lo stallo e propone la scala'}
                </div>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-cyan-400 transition-transform group-hover:translate-x-1">
              ➔
            </span>
          </button>

          {/* Card 3: Analizza la mia scheda (23/09) */}
          <button
            onClick={() => navigate('/analizza')}
            className="group relative flex items-center justify-between rounded-xl glass-card p-4 border border-edge text-left transition-all hover:border-cyan-500/40 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 text-2xl border border-amber-500/30">
                🔍
              </div>
              <div>
                <div className="font-display font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Analizza la mia scheda
                </div>
                <div className="text-xs text-slate-400">
                  Scrivi la tua scheda: ordine, alternanza e volume valutati da DeepSeek
                </div>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-cyan-400 transition-transform group-hover:translate-x-1">
              ➔
            </span>
          </button>
        </div>
      </section>

      {/* Quick Access: Saved Workouts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="eyebrow text-slate-400">Ultimi Allenamenti Salvati</h3>
          <button
            onClick={() => navigate('/salvati')}
            className="text-xs font-medium text-cyan-400 hover:underline"
          >
            Vedi tutti ➔
          </button>
        </div>

        {loadingSaved ? (
          <div className="rounded-xl glass-card p-4 text-center text-xs text-slate-400">
            Caricamento libreria…
          </div>
        ) : savedList.length === 0 ? (
          <div className="rounded-xl glass-card p-5 text-center space-y-2 border border-dashed border-edge">
            <p className="text-xs text-slate-400">
              Non hai ancora schede salvate in libreria.
            </p>
            <button
              onClick={() => navigate('/crea')}
              className="text-xs font-bold text-cyan-400 hover:underline"
            >
              + Genera e Salva la tua prima scheda
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {savedList.map((sw) => (
              <div
                key={sw.id}
                className="flex items-center justify-between rounded-xl glass-card p-3.5 border border-edge"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="font-display font-bold text-sm text-white truncate">
                    {sw.name}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {sw.duration_min} min · {sw.blocks.length} blocchi
                  </div>
                </div>
                <button
                  onClick={() => openSavedWorkout(sw)}
                  className="rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                >
                  ▶ Vedi
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </SwipeContainer>
  )
}
