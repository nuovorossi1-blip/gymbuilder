import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useSettings } from '../features/profile/useSettings'
import { useCoach } from '../features/coach/useCoach'
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
  const { piano: pianoCoach } = useCoach(user?.id)
  const prossimaSeduta = pianoCoach?.plan.sedute[pianoCoach.next_index % Math.max(1, pianoCoach.plan.sedute.length)]?.nome ?? null
  const gradino = gradinoDiOggi(profile?.ladder_plan)
  const avvisoScala = gradino && profile?.daily_kcal !== gradino.kcal
    ? `Ciclo delle calorie: oggi passa a ${gradino.kcal} kcal`
    : !gradino && analizzaStallo(bodyLog, determinaFase(profile, calorieLog)?.calorie_step ?? null, profile?.daily_kcal ?? null, calorieLog.length ? calorieLog[calorieLog.length - 1].created_at : null)
      ? 'Stallo: c’è una proposta di pausa in normocalorica'
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
        ) : pianoCoach && prossimaSeduta ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                🧑‍🏫 Il tuo programma · v{pianoCoach.version}
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-white mb-1">Oggi: {prossimaSeduta}</h2>
            <p className="text-xs text-slate-300 mb-5">{pianoCoach.plan.titolo} · fai sempre la prossima della lista.</p>
            <button
              onClick={() => navigate('/coach')}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 px-4 font-display text-sm font-bold uppercase tracking-wider text-white shadow-lg glow-cyan transition-transform active:scale-[0.98]"
            >
              <span>▶ VAI AL PROGRAMMA</span>
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

      {/* Fase 5 (25/09): tre ingressi principali + Strumenti (richiesta di Rossi). */}
      <section className="space-y-3">
        <h3 className="eyebrow text-slate-400">Il tuo allenamento</h3>
        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => navigate('/coach')}
            className="group relative flex items-center justify-between rounded-xl glass-card p-4 border border-cyan-500/40 text-left transition-all hover:border-cyan-400 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 text-2xl border border-cyan-500/30">🧑‍🏫</div>
              <div>
                <div className="font-display font-bold text-white group-hover:text-cyan-300 transition-colors">Coach LLM</div>
                <div className="text-xs text-slate-400">{pianoCoach ? `Il tuo programma: ${pianoCoach.plan.titolo}` : 'Colloquio e programma cucito su di te'}</div>
                {prossimaSeduta && <div className="mt-0.5 text-xs font-bold text-emerald-300">Oggi: {prossimaSeduta}</div>}
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-cyan-400 transition-transform group-hover:translate-x-1">➔</span>
          </button>
          <button
            onClick={() => createFreshWorkout('single_session')}
            className="group relative flex items-center justify-between rounded-xl glass-card p-4 border border-edge text-left transition-all hover:border-cyan-400 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 text-2xl border border-cyan-500/30">⚡</div>
              <div>
                <div className="font-display font-bold text-white group-hover:text-cyan-300 transition-colors">Allenamento rapido</div>
                <div className="text-xs text-slate-400">Una seduta al volo, generata per oggi</div>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-cyan-400 transition-transform group-hover:translate-x-1">➔</span>
          </button>
          <button
            onClick={() => navigate('/analizza')}
            className="group relative flex items-center justify-between rounded-xl glass-card p-4 border border-edge text-left transition-all hover:border-cyan-400 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 text-2xl border border-cyan-500/30">🔍</div>
              <div>
                <div className="font-display font-bold text-white group-hover:text-cyan-300 transition-colors">Analizza la mia scheda</div>
                <div className="text-xs text-slate-400">Scrivi la tua scheda: il coach la valuta e la salvi</div>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-cyan-400 transition-transform group-hover:translate-x-1">➔</span>
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="eyebrow text-slate-400">Strumenti</h3>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/peso')} className="rounded-xl glass-card border border-edge p-3.5 text-left active:scale-[0.99]">
            <div className="text-2xl">⚖️</div>
            <div className="mt-1 font-display text-sm font-bold text-white">Peso e girovita</div>
            <div className={`text-[11px] ${avvisoScala ? 'text-amber-300' : 'text-slate-400'}`}>{avvisoScala ?? 'Diario e stallo'}</div>
          </button>
          <button onClick={() => navigate('/cartella')} className="rounded-xl glass-card border border-edge p-3.5 text-left active:scale-[0.99]">
            <div className="text-2xl">📋</div>
            <div className="mt-1 font-display text-sm font-bold text-white">La mia cartella</div>
            <div className="text-[11px] text-slate-400">Chi sei, obiettivi, storico</div>
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
