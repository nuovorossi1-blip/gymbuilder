/**
 * Esecuzione dal vivo del protocollo Density Tri-Set 3-6-9 (Fase 2, 21/08).
 *
 * Isolata di proposito da Runner.tsx (vedi AIOS_STATE.md per la discussione col utente): non
 * tocca la sua macchina a stati né il suo `RunnerProgress`. Riusa però le stesse utility
 * condivise già testate sul resto dell'app — timer.ts (TimerClock, deterministico via
 * timestamp), backgroundTimer.ts (stesso servizio nativo Android, stesso pattern "non
 * fermarlo mai fra una fase e l'altra" del fix crash già in AIOS_STATE.md), audio.ts — così
 * eredita il comportamento in background senza reinventarlo né rischiare di romperlo altrove.
 *
 * Non ancora verificato in un browser o dispositivo reale (nessun tool di automazione
 * browser disponibile in questa sessione): il flusso a schermo bloccato in particolare va
 * provato con attenzione da un dispositivo Android vero prima di fidarsene per un allenamento.
 *
 * Ingresso ancora minimo (query string, non il wizard): la Fase 3 (wizard/UI completa) resta
 * da fare, vedi TODO.md.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useWorkout } from '../features/workout/WorkoutContext'
import { useSettings } from '../features/profile/useSettings'
import { registraCompletato } from '../lib/api'
import { generaDensity369, type DensitySplit, type Density369Workout } from '../generators/density369'
import {
  avanza, durataFaseSec, progressoTesto, statoIniziale, stazioneCorrente, type DensityRunnerState,
} from '../engine/densityRunnerEngine'
import { type TimerClock, remainingSeconds, pauseClock, resumeClock, countdownEvents } from '../engine/timer'
import { loadAudioSettings, TimerAudio } from '../engine/audio'
import { notifyTimerEvent, publishBackgroundTimer, requestTimerNotifications, resetBackgroundTimer } from '../engine/backgroundTimer'
import type { GeneratedWorkout, PrescribedExercise } from '../types'

const NOME_SPLIT: Record<DensitySplit, string> = { push: 'Push', pull: 'Pull', legs: 'Legs' }

/** Trasforma il workout Density in una forma compatibile con lo storico esistente
 *  (`completed_workouts`, via registraCompletato): un esercizio per stazione, `sets` pari ai
 *  giri del blocco (la stazione si ripete quella volta), non un log giro-per-giro — perde il
 *  dettaglio del circuito ma resta leggibile nella cronologia senza toccare lo schema DB. */
function comeWorkoutRegistrabile(w: Density369Workout, durataSec: number): GeneratedWorkout {
  const esercizi: PrescribedExercise[] = w.blocks.flatMap((blocco) =>
    blocco.stations.map((s): PrescribedExercise => ({
      exercise_id: s.exercise_id,
      name: `${s.name} (Blocco ${blocco.label}, Stazione ${s.role})`,
      role: s.role === 3 ? 'isolation' : 'compound',
      muscle: s.muscle,
      sets: blocco.rounds,
      reps: s.reps,
      rest_sec: s.role === 3 ? blocco.round_rest_sec : s.rest_after_sec,
    }))
  )
  return {
    name: w.name,
    mode: 'bodybuilding',
    split: w.split,
    goal: 'hypertrophy',
    experience: 'advanced',
    duration_min: Math.round(durataSec / 60),
    blocks: [{ kind: 'main', title: w.name, exercises: esercizi }],
  } as GeneratedWorkout
}

export default function DensityRunner() {
  const { user } = useAuth()
  const { catalog } = useWorkout()
  const { settings } = useSettings(user?.id)
  const [searchParams] = useSearchParams()
  const naviga = useNavigate()

  const split = (searchParams.get('split') as DensitySplit) ?? 'push'

  const workout = useMemo(() => {
    if (!catalog || catalog.length === 0) return null
    return generaDensity369(catalog, {
      split,
      equipment: settings?.equipment ?? 'full_gym',
      available_equipment: settings?.available_equipment ?? null,
      excluded_exercises: settings?.excluded_exercises ?? [],
      preferred_exercises: settings?.favorite_exercises ?? [],
      seed: Date.now(),
    })
  }, [catalog, split, settings])

  const [stato, setStato] = useState<DensityRunnerState>(statoIniziale)
  const [clock, setClock] = useState<TimerClock | null>(null)
  const [paused, setPaused] = useState(false)
  const [, forceRender] = useState(0)
  const [salvataggio, setSalvataggio] = useState<'fermo' | 'salvo' | 'errore'>('fermo')
  const inizioRef = useRef(Date.now())
  const audioRef = useRef<TimerAudio | null>(null)
  const ultimoRimanenteRef = useRef<number | null>(null)

  useEffect(() => {
    audioRef.current = new TimerAudio(loadAudioSettings())
    void requestTimerNotifications()
    return () => { resetBackgroundTimer(true) }
  }, [])

  // Ogni volta che si entra in una fase di riposo si crea un nuovo orologio con la durata
  // giusta; le fasi 'lavoro'/'completato' non hanno orologio (avanzamento manuale).
  useEffect(() => {
    if (!workout) return
    const durata = durataFaseSec(stato, workout)
    if (durata > 0) {
      setClock({ startedAt: Date.now(), durationSec: durata, pausedTotalMs: 0 })
      ultimoRimanenteRef.current = durata
      void audioRef.current?.unlock()
    } else {
      setClock(null)
    }
  }, [stato, workout])

  const avanzaFase = useCallback(() => {
    if (!workout) return
    setStato((s) => avanza(s, workout))
  }, [workout])

  // Tick: ridisegna ogni secondo e avanza da sola quando un riposo arriva a zero. Lo stesso
  // pattern "il timestamp è la verità, l'intervallo serve solo a ridisegnare" di Runner.tsx.
  useEffect(() => {
    if (!clock || paused) return
    const id = setInterval(() => {
      forceRender((n) => n + 1)
      const rimanente = remainingSeconds(clock)
      if (ultimoRimanenteRef.current !== null) {
        for (const evento of countdownEvents(ultimoRimanenteRef.current, rimanente, 'rest')) audioRef.current?.play(evento)
      }
      ultimoRimanenteRef.current = rimanente
      if (rimanente <= 0) avanzaFase()
    }, 250)
    return () => clearInterval(id)
  }, [clock, paused, avanzaFase])

  // Sincronizza col servizio in background — stesso meccanismo del resto dell'app, mai
  // fermato fra una fase e l'altra (solo alla fine, sopra). L'href puntato dal tocco su una
  // notifica in background resta '/avvia' (limite noto, non ancora generalizzato — vedi
  // AIOS_STATE.md): qui serve solo a tenere vivo il servizio nativo e aggiornare titolo/media
  // session, non a riportare l'utente nel punto esatto.
  useEffect(() => {
    if (!workout) return
    const label = stato.phase === 'lavoro'
      ? `${stazioneCorrente(stato, workout).name} · ${progressoTesto(stato, workout)}`
      : `Recupero · ${progressoTesto(stato, workout)}`
    const rimanente = clock ? remainingSeconds(clock) : 0
    publishBackgroundTimer(label, rimanente, paused, stato.phase === 'lavoro' ? 'work' : 'rest')
  }, [stato, workout, clock, paused])

  const togglePausa = () => {
    setPaused((p) => !p)
    setClock((c) => {
      if (!c) return c
      return paused ? resumeClock(c) : pauseClock(c)
    })
  }

  const salvaEEsci = async () => {
    if (!workout || !user) { naviga('/'); return }
    setSalvataggio('salvo')
    try {
      const durataSec = Math.floor((Date.now() - inizioRef.current) / 1000)
      await registraCompletato(user.id, comeWorkoutRegistrabile(workout, durataSec), durataSec, null, null)
      void notifyTimerEvent('TIMER_COMPLETED', 'Allenamento completato')
      naviga('/salvati')
    } catch {
      setSalvataggio('errore')
    }
  }

  if (!workout) {
    return (
      <div className="px-5 pt-12 pb-8">
        <p className="text-slate-300">
          Non riesco a generare questa sessione con l'attrezzatura/esclusioni attuali — prova a
          cambiarle dal profilo.
        </p>
        <button className="btn mt-6" onClick={() => naviga('/')}>Torna alla Home</button>
      </div>
    )
  }

  if (stato.phase === 'completato') {
    return (
      <div className="px-5 pt-12 pb-8 text-center">
        <p className="eyebrow mb-2">Density Tri-Set 3-6-9</p>
        <h1 className="font-display text-2xl font-bold text-white mb-6">Sessione completata 💪</h1>
        <div className="space-y-2">
          <button
            onClick={salvaEEsci}
            disabled={salvataggio === 'salvo'}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3.5 font-display text-sm font-bold uppercase text-white shadow-lg glow-emerald disabled:opacity-60"
          >
            {salvataggio === 'salvo' ? 'Salvo…' : '💾 Salva e vai alla Libreria'}
          </button>
          {salvataggio === 'errore' && (
            <p className="text-xs text-rose-300">Salvataggio non riuscito — riprova, o torna alla Home senza salvare.</p>
          )}
          <button onClick={() => naviga('/')} className="w-full rounded-xl glass-card py-3.5 font-display text-sm font-bold uppercase text-slate-300 hover:text-white">
            Torna alla Home senza salvare
          </button>
        </div>
      </div>
    )
  }

  const st = stazioneCorrente(stato, workout)
  const inRiposo = stato.phase !== 'lavoro'
  const rimanente = clock ? remainingSeconds(clock) : 0

  return (
    <div className="px-5 pt-12 pb-8">
      <p className="eyebrow mb-1">{NOME_SPLIT[workout.split]} · Density Tri-Set 3-6-9</p>
      <p className="text-xs text-slate-400 mb-6">{progressoTesto(stato, workout)}</p>

      {inRiposo ? (
        <div className="text-center">
          <p className="text-sm uppercase tracking-wider text-cyan-300 mb-2">
            {stato.phase === 'riposo_stazione' ? 'Cambio stazione' : stato.phase === 'riposo_giro' ? 'Fine giro' : 'Cambio blocco'}
          </p>
          <p className="font-data text-6xl font-bold text-white mb-4">{rimanente}s</p>
          <p className="text-sm text-slate-300 mb-8">Prossima: {st.name} · {st.reps} rep</p>
          <button onClick={togglePausa} className="rounded-xl glass-card px-6 py-3 text-sm font-bold uppercase text-slate-300 hover:text-white">
            {paused ? '▶ Riprendi' : '⏸ Pausa'}
          </button>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm uppercase tracking-wider text-purple-300 mb-2">Stazione {st.role} · {st.reps} rep</p>
          <h2 className="font-display text-3xl font-bold text-white mb-8">{st.name}</h2>
          <button
            onClick={avanzaFase}
            className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 py-4 font-display text-base font-bold uppercase text-white shadow-lg"
          >
            ✓ Fatto — prossima
          </button>
        </div>
      )}
    </div>
  )
}
