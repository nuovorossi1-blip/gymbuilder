/**
 * Esecuzione dal vivo del Density 3-6-9 EDT (25/09, sostituisce il runner del tri-set).
 *
 * Fasi: intro (zone, esercizi, record, sostituzioni) -> zona a tempo (15 min: due esercizi
 * alternati a mini-serie, un tocco aggiunge le ripetizioni fatte) -> pausa (5 min) -> ... ->
 * riepilogo (totali contro record, pesi usati, salva). Il tempo segue il timestamp (timer.ts),
 * il servizio in background e i suoni sono quelli già usati dal resto dell'app.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useWorkout } from '../features/workout/WorkoutContext'
import { useSettings } from '../features/profile/useSettings'
import { elencoStorico, registraCompletato } from '../lib/api'
import {
  densityEdtComeGeneratedWorkout, generaDensityEdt, leggiStoricoEdt,
  type DensityEdtWorkout, type DensitySplit, type StoricoEdt,
} from '../generators/densityEdt'
import { ultimiPesiPerEsercizio } from '../engine/weightHistory'
import { countdownEvents, pauseClock, remainingSeconds, resumeClock, type TimerClock } from '../engine/timer'
import { loadAudioSettings, TimerAudio } from '../engine/audio'
import { notifyTimerEvent, publishBackgroundTimer, requestTimerNotifications, resetBackgroundTimer } from '../engine/backgroundTimer'
import { SPLIT_LABELS } from '../types'

type Fase = { tipo: 'intro' } | { tipo: 'zona'; i: number } | { tipo: 'pausa'; i: number } | { tipo: 'fine' }

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`

export default function DensityRunner() {
  const { user } = useAuth()
  const { catalog } = useWorkout()
  const { settings } = useSettings(user?.id)
  const [searchParams] = useSearchParams()
  const naviga = useNavigate()
  const split = (searchParams.get('split') as DensitySplit) ?? 'push'
  const durata = Number(searchParams.get('min')) || settings?.default_duration || 60

  const [storico, setStorico] = useState<StoricoEdt | null>(null)
  const [pesi, setPesi] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!user) return
    elencoStorico(user.id)
      .then((lista) => { setStorico(leggiStoricoEdt(lista)); setPesi(ultimiPesiPerEsercizio(lista)) })
      .catch(() => setStorico({ ultimaFase: null, totali: {} }))
  }, [user])

  const generato = useMemo(() => {
    if (!catalog?.length || !storico) return null
    return generaDensityEdt(catalog, {
      split, duration_min: durata, storico,
      equipment: settings?.equipment ?? 'full_gym',
      available_equipment: settings?.available_equipment ?? null,
      excluded_exercises: settings?.excluded_exercises ?? [],
      preferred_exercises: settings?.favorite_exercises ?? [],
    })
  }, [catalog, split, durata, settings, storico])

  const [workout, setWorkout] = useState<DensityEdtWorkout | null>(null)
  useEffect(() => { setWorkout((w) => w ?? generato) }, [generato])
  useEffect(() => {
    setWorkout((w) => w && {
      ...w,
      zones: w.zones.map((z) => ({ ...z, pair: z.pair.map((e) => (e.logged_weight_kg === undefined && pesi[e.exercise_id] ? { ...e, logged_weight_kg: pesi[e.exercise_id] } : e)) as typeof z.pair })),
    })
  }, [pesi])

  const [fase, setFase] = useState<Fase>({ tipo: 'intro' })
  const [clock, setClock] = useState<TimerClock | null>(null)
  const [paused, setPaused] = useState(false)
  const [, ridisegna] = useState(0)
  const [salvataggio, setSalvataggio] = useState<'fermo' | 'salvo' | 'errore'>('fermo')
  const audioRef = useRef<TimerAudio | null>(null)
  const ultimoRef = useRef<number | null>(null)
  const inizioRef = useRef(Date.now())
  if (!audioRef.current) audioRef.current = new TimerAudio(loadAudioSettings())

  const avvia = (nuova: Fase) => {
    setFase(nuova)
    setPaused(false)
    if (!workout || nuova.tipo === 'intro' || nuova.tipo === 'fine') { setClock(null); return }
    const sec = nuova.tipo === 'zona' ? workout.zones[nuova.i].minutes * 60 : workout.rest_between_min * 60
    setClock({ startedAt: Date.now(), durationSec: sec, pausedTotalMs: 0 })
    ultimoRef.current = sec
    void audioRef.current?.unlock()
    audioRef.current?.play({ type: nuova.tipo === 'zona' ? 'WORK_STARTED' : 'REST_STARTED', at: Date.now(), phase: nuova.tipo === 'zona' ? 'work' : 'rest' })
  }

  const avanti = useCallback(() => {
    if (!workout) return
    setFase((f) => {
      let next: Fase = f
      if (f.tipo === 'zona') next = f.i + 1 < workout.zones.length ? { tipo: 'pausa', i: f.i } : { tipo: 'fine' }
      else if (f.tipo === 'pausa') next = { tipo: 'zona', i: f.i + 1 }
      setTimeout(() => avvia(next), 0)
      return f
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout])

  useEffect(() => {
    if (!clock || paused) return
    const id = setInterval(() => {
      ridisegna((n) => n + 1)
      const r = remainingSeconds(clock)
      if (ultimoRef.current !== null) for (const ev of countdownEvents(ultimoRef.current, r, 'rest')) audioRef.current?.play(ev)
      ultimoRef.current = r
      if (r <= 0) { setClock(null); avanti() }
    }, 250)
    return () => clearInterval(id)
  }, [clock, paused, avanti])

  useEffect(() => {
    if (!workout || fase.tipo === 'intro' || fase.tipo === 'fine') return
    const label = fase.tipo === 'zona' ? `Density · Zona ${fase.i + 1}` : `Pausa · poi Zona ${fase.i + 2}`
    publishBackgroundTimer(label, clock ? remainingSeconds(clock) : 0, paused, fase.tipo === 'zona' ? 'work' : 'rest')
  }, [fase, workout, clock, paused])

  const aggiungi = (zi: number, ei: 0 | 1, delta: number) => setWorkout((w) => w && {
    ...w,
    zones: w.zones.map((z, i) => (i !== zi ? z : { ...z, pair: z.pair.map((e, j) => (j === ei ? { ...e, reps_done: Math.max(0, e.reps_done + delta) } : e)) as typeof z.pair })),
  })
  const impostaPeso = (zi: number, ei: 0 | 1, kg: number | undefined) => setWorkout((w) => w && {
    ...w,
    zones: w.zones.map((z, i) => (i !== zi ? z : { ...z, pair: z.pair.map((e, j) => (j === ei ? { ...e, logged_weight_kg: kg } : e)) as typeof z.pair })),
  })
  const sostituisci = (zi: number, ei: 0 | 1, id: string) => setWorkout((w) => {
    if (!w) return w
    const zones = w.zones.map((z, i) => {
      if (i !== zi) return z
      const e = z.pair[ei]
      const nuovo = e.alternatives.find((a) => a.exercise_id === id)
      if (!nuovo) return z
      const pair = z.pair.map((x, j) => (j === ei ? { ...x, exercise_id: nuovo.exercise_id, name: nuovo.name, alternatives: [{ exercise_id: e.exercise_id, name: e.name }, ...e.alternatives.filter((a) => a.exercise_id !== id)] } : x)) as typeof z.pair
      // Coppia cambiata = record diverso: si confronta solo con la stessa coppia.
      const key = `${pair[0].exercise_id}+${pair[1].exercise_id}`
      return { ...z, pair, key, record: storico?.totali[`${key}|${w.rep_target}`]?.reduce((a, b) => Math.max(a, b), 0) || null, suggerisci_carico: false }
    })
    return { ...w, zones }
  })

  async function salva() {
    if (!workout || !user) { naviga('/'); return }
    setSalvataggio('salvo')
    try {
      const sec = Math.floor((Date.now() - inizioRef.current) / 1000)
      await registraCompletato(user.id, densityEdtComeGeneratedWorkout(workout, sec), sec, null, null)
      resetBackgroundTimer(true)
      void notifyTimerEvent('TIMER_COMPLETED', 'Allenamento completato')
      naviga('/ultimo')
    } catch {
      setSalvataggio('errore')
    }
  }

  if (!workout) {
    return (
      <main className="px-5 pt-12 pb-8">
        <p className="text-slate-300">{storico ? 'Non riesco a comporre il Density con l’attrezzatura e le esclusioni attuali.' : 'Carico lo storico…'}</p>
        <button className="btn mt-6" onClick={() => naviga('/')}>Torna alla Home</button>
      </main>
    )
  }

  const rimanente = clock ? remainingSeconds(clock) : 0
  const totaleZona = (i: number) => workout.zones[i].pair.reduce((t, e) => t + e.reps_done, 0)

  if (fase.tipo === 'intro') {
    return (
      <main className="px-5 pt-10 pb-10">
        <button className="font-data text-xs text-slate2" onClick={() => naviga(-1)}>← Indietro</button>
        <p className="eyebrow mt-3">Density 3-6-9 · {SPLIT_LABELS[workout.split]}</p>
        <h1 className="mt-1 font-display text-[2rem] font-extrabold uppercase leading-none">
          {workout.fase === 'scarico' ? 'Scarico' : `Mini-serie da ${workout.rep_target}`}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate2">
          {workout.zones.length} zone da {workout.zones[0].minutes} minuti, {workout.rest_between_min} minuti di pausa fra una e l’altra.
          In ogni zona alterni i due esercizi senza sosta: {workout.rep_target} ripetizioni, poi l’altro, e così via.
          Usa {workout.load_hint}, lascia {workout.rir} ripetizioni in riserva: mai a cedimento. ~{workout.estimated_duration_min} min con il riscaldamento.
        </p>
        <ol className="mt-6 space-y-4">
          {workout.zones.map((z, zi) => (
            <li key={zi} className="rounded-2xl border border-edge p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-sm font-bold uppercase text-white">Zona {zi + 1}</span>
                <span className="font-data text-[12px] text-slate2">{z.record ? `record ${z.record} rip` : 'nessun record ancora'}</span>
              </div>
              {z.suggerisci_carico && <p className="mt-1 text-[12px] text-emerald-300">L’ultima volta hai superato il record del 20%: oggi +5% di carico.</p>}
              {z.pair.map((e, ei) => (
                <div key={ei} className="mt-3">
                  <p className="text-[15px] font-medium">{ei === 0 ? 'A' : 'B'} · {e.name}</p>
                  {e.alternatives.length > 0 && (
                    <select className="input mt-1 text-sm" value="" onChange={(ev) => sostituisci(zi, ei as 0 | 1, ev.target.value)}>
                      <option value="">Sostituisci…</option>
                      {e.alternatives.map((a) => <option key={a.exercise_id} value={a.exercise_id}>{a.name}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </li>
          ))}
        </ol>
        <button className="btn mt-8" onClick={() => { void requestTimerNotifications(); inizioRef.current = Date.now(); avvia({ tipo: 'zona', i: 0 }) }}>Inizia la Zona 1</button>
      </main>
    )
  }

  if (fase.tipo === 'zona') {
    const z = workout.zones[fase.i]
    const tot = totaleZona(fase.i)
    return (
      <main className="flex min-h-dvh flex-col px-5 pt-8 pb-8">
        <p className="eyebrow">Zona {fase.i + 1} di {workout.zones.length} · mini-serie da {workout.rep_target}</p>
        <p className="mt-2 font-data text-[3.6rem] leading-none text-white" aria-live="off">{mmss(rimanente)}</p>
        <p className="mt-2 font-data text-sm text-slate2">
          Totale <span className="text-chalk">{tot}</span>{z.record ? ` · record ${z.record}` : ''}{z.record && tot > z.record ? ' · nuovo record!' : ''}
        </p>
        <div className="mt-6 grid flex-1 gap-3">
          {z.pair.map((e, ei) => (
            <div key={ei} className="flex flex-col justify-between rounded-2xl border border-edge p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[16px] font-medium">{ei === 0 ? 'A' : 'B'} · {e.name}</p>
                <p className="font-data text-xl text-chalk">{e.reps_done}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="w-14 rounded-xl border border-edge py-3 font-data text-lg" aria-label="Una ripetizione in meno" onClick={() => aggiungi(fase.i, ei as 0 | 1, -1)}>−1</button>
                <button className="flex-1 rounded-xl bg-cyan-500/20 py-3 font-display text-lg font-bold text-cyan-200" onClick={() => aggiungi(fase.i, ei as 0 | 1, workout.rep_target)}>
                  +{workout.rep_target} fatte
                </button>
                <button className="w-14 rounded-xl border border-edge py-3 font-data text-lg" aria-label="Una ripetizione in più" onClick={() => aggiungi(fase.i, ei as 0 | 1, 1)}>+1</button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button className="flex-1 rounded-xl border border-edge py-3 text-sm" onClick={() => { setPaused((p) => !p); setClock((c) => (c ? (paused ? resumeClock(c) : pauseClock(c)) : c)) }}>{paused ? 'Riprendi' : 'Pausa'}</button>
          <button className="flex-1 rounded-xl border border-edge py-3 text-sm text-slate2" onClick={() => { setClock(null); avanti() }}>Chiudi zona</button>
        </div>
      </main>
    )
  }

  if (fase.tipo === 'pausa') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
        <p className="eyebrow">Pausa · poi Zona {fase.i + 2}</p>
        <p className="mt-3 font-data text-[4rem] leading-none">{mmss(rimanente)}</p>
        <p className="mt-3 text-sm text-slate2">Zona {fase.i + 1}: {totaleZona(fase.i)} ripetizioni.</p>
        <p className="mt-6 text-sm text-chalk">Prossima: {workout.zones[fase.i + 1].pair.map((e) => e.name).join(' + ')}</p>
        <button className="btn mt-8" onClick={() => { setClock(null); avanti() }}>Inizia subito</button>
      </main>
    )
  }

  return (
    <main className="px-5 pt-10 pb-10">
      <p className="eyebrow">Density 3-6-9 completato</p>
      <h1 className="mt-1 font-display text-2xl font-bold">Riepilogo</h1>
      <ul className="mt-5 space-y-4">
        {workout.zones.map((z, zi) => {
          const tot = totaleZona(zi)
          return (
            <li key={zi} className="rounded-2xl border border-edge p-4">
              <p className="font-display text-sm font-bold uppercase">Zona {zi + 1}: {tot} ripetizioni {z.record !== null && tot > z.record ? '· nuovo record' : ''}</p>
              {z.record !== null && <p className="text-[12px] text-slate2">Record precedente {z.record}{tot >= z.record * 1.2 ? ' · oltre il +20%: la prossima volta +5% di carico' : ''}</p>}
              {z.pair.map((e, ei) => (
                <label key={ei} className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span>{e.name} · {e.reps_done} rip</span>
                  <input
                    className="input w-24 text-right" inputMode="decimal" placeholder="kg"
                    value={e.logged_weight_kg ?? ''}
                    onChange={(ev) => impostaPeso(zi, ei as 0 | 1, ev.target.value ? Number(ev.target.value.replace(',', '.')) : undefined)}
                  />
                </label>
              ))}
            </li>
          )
        })}
      </ul>
      <button className="btn mt-8" disabled={salvataggio === 'salvo'} onClick={() => { void salva() }}>{salvataggio === 'salvo' ? 'Salvataggio…' : 'Salva e chiudi'}</button>
      {salvataggio === 'errore' && <p role="alert" className="mt-3 text-sm text-amber2">Non salvato. Riprova.</p>}
    </main>
  )
}
