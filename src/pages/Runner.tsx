import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useWorkout } from '../features/workout/WorkoutContext'
import { registraCompletato } from '../lib/api'
import { FORMATO_A_GIRI, FORMATO_A_INTERVALLI, MUSCLE_LABELS, type PrescribedExercise } from '../types'
import { loadAudioSettings, saveAudioSettings, TimerAudio, type AudioTimerSettings, type TimerSound } from '../engine/audio'
import type { TimerEventType, TimerPhase } from '../engine/timer'

type Fase = { tipo: 'serie'; iEs: number; serie: number } | { tipo: 'recupero'; iEs: number; serie: number; sec: number }

const VALUTAZIONI = [
  { v: 'facile', l: 'Facile' },
  { v: 'giusto', l: 'Giusto' },
  { v: 'duro', l: 'Duro' },
  { v: 'troppo_duro', l: 'Troppo duro' },
]

export default function Runner() {
  const { user } = useAuth()
  const { workout, setWorkout } = useWorkout()
  const naviga = useNavigate()

  const esercizi = workout?.blocks.find((b) => b.kind === 'main')?.exercises ?? []
  const riscaldamento = workout?.blocks.find((b) => b.kind === 'warmup')
  const metconBlock = workout?.blocks.find((b) => b.kind === 'metcon')
  const metconEsercizi = metconBlock?.exercises ?? []
  const formato = metconBlock?.format
  const aIntervalli = !!formato && FORMATO_A_INTERVALLI.includes(formato)
  const aGiri = !!formato && FORMATO_A_GIRI.includes(formato)
  const isTabata = formato === 'tabata'
  // Tabata: tutti gli 8 round di un movimento, poi si passa al successivo (mai round-robin come EMOM/Intervals, sez. tabata.ts).
  const rondaPerMovimento = metconBlock?.rounds ?? 1
  const intervalliTotali = isTabata ? rondaPerMovimento * metconEsercizi.length : rondaPerMovimento
  function esercizioIntervallo(i: number): PrescribedExercise | undefined {
    if (metconEsercizi.length === 0) return undefined
    return isTabata ? metconEsercizi[Math.floor(i / rondaPerMovimento)] : metconEsercizi[i % metconEsercizi.length]
  }

  const [iniziato, setIniziato] = useState(false)
  const [fase, setFase] = useState<Fase>({ tipo: 'serie', iEs: 0, serie: 1 })
  const [rimanente, setRimanente] = useState(0)
  const [inPausa, setInPausa] = useState(false)
  const [sezione, setSezione] = useState<'principale' | 'metcon'>(esercizi.length > 0 ? 'principale' : 'metcon')
  const [metconFase, setMetconFase] = useState<'anteprima' | 'via' | 'fatto'>('anteprima')
  const [metconRimanente, setMetconRimanente] = useState(0)
  const [metconGiri, setMetconGiri] = useState(0)
  const [metconInPausa, setMetconInPausa] = useState(false)
  const [metconTrascorsi, setMetconTrascorsi] = useState(0)
  const [intervalIndice, setIntervalIndice] = useState(0)
  const [intervalSottofase, setIntervalSottofase] = useState<'lavoro' | 'riposo'>('lavoro')
  const [intervalRimanente, setIntervalRimanente] = useState(0)
  const [finito, setFinito] = useState(false)
  const [valutazione, setValutazione] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [salvataggio, setSalvataggio] = useState<'fermo' | 'salvo' | 'errore'>('fermo')
  const inizio = useRef<number>(Date.now())
  const [audioSettings, setAudioSettings] = useState<AudioTimerSettings>(() => loadAudioSettings())
  const audio = useRef<TimerAudio | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownDeadline = useRef(0)
  const afterCountdown = useRef<(() => void) | null>(null)
  const restDeadline = useRef(0)
  const metconDeadline = useRef(0)
  const intervalDeadline = useRef(0)
  const metconStartedAt = useRef(0)
  const lastWarning = useRef<string>('')
  const restPausedAt = useRef(0)
  const metconPausedAt = useRef(0)

  if (!audio.current) audio.current = new TimerAudio(audioSettings)

  function emit(type: TimerEventType, phase: TimerPhase, round?: number) {
    audio.current?.play({ type, phase, round, at: Date.now() })
  }

  function updateAudio(patch: Partial<AudioTimerSettings>) {
    const next = { ...audioSettings, ...patch }
    setAudioSettings(next); saveAudioSettings(next); audio.current?.update(next)
  }

  async function startWithCountdown(action: () => void) {
    await audio.current?.unlock()
    afterCountdown.current = action
    countdownDeadline.current = Date.now() + 3_000
    lastWarning.current = ''
    setCountdown(3)
    emit('COUNTDOWN_STARTED', 'countdown')
  }

  function toggleRestPause() {
    const now = Date.now()
    setInPausa((paused) => {
      if (paused) restDeadline.current += now - restPausedAt.current
      else restPausedAt.current = now
      return !paused
    })
  }

  function toggleMetconPause() {
    const now = Date.now()
    setMetconInPausa((paused) => {
      if (paused) {
        const delta = now - metconPausedAt.current
        metconDeadline.current += delta; intervalDeadline.current += delta; metconStartedAt.current += delta
      } else metconPausedAt.current = now
      return !paused
    })
  }

  useEffect(() => {
    if (countdown === null) return
    const tick = () => {
      const next = Math.max(0, Math.ceil((countdownDeadline.current - Date.now()) / 1000))
      setCountdown(next)
      if (next > 0 && lastWarning.current !== `countdown-${next}`) {
        lastWarning.current = `countdown-${next}`; emit('WARNING', 'countdown')
      }
      if (next === 0) {
        emit('TIMER_STARTED', 'work')
        const action = afterCountdown.current; afterCountdown.current = null
        setCountdown(null); action?.()
      }
    }
    tick(); const timer = window.setInterval(tick, 100)
    return () => window.clearInterval(timer)
  }, [countdown])

  // Timer del recupero
  useEffect(() => {
    if (fase.tipo !== 'recupero' || inPausa) return
    if (rimanente <= 0) {
      emit('SET_STARTED', 'set')
      avanza()
      return
    }
    const tick = () => {
      const next = Math.max(0, Math.ceil((restDeadline.current - Date.now()) / 1000))
      setRimanente(next)
      if (next > 0 && next <= 3 && lastWarning.current !== `rest-${next}`) { lastWarning.current = `rest-${next}`; emit('WARNING', 'rest') }
    }
    const t = window.setInterval(tick, 200); tick()
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, rimanente, inPausa])

  // Timer del Metcon AMRAP: conto alla rovescia dal tempo a disposizione.
  useEffect(() => {
    if (sezione !== 'metcon' || metconFase !== 'via' || formato !== 'amrap' || metconInPausa) return
    if (metconRimanente <= 0) {
      setMetconFase('fatto')
      return
    }
    const tick = () => {
      const next = Math.max(0, Math.ceil((metconDeadline.current - Date.now()) / 1000))
      setMetconRimanente(next)
      if (next > 0 && next <= 3 && lastWarning.current !== `amrap-${next}`) { lastWarning.current = `amrap-${next}`; emit('WARNING', 'amrap') }
      if (next === 0 && lastWarning.current !== 'amrap-complete') { lastWarning.current = 'amrap-complete'; emit('TIMER_COMPLETED', 'amrap') }
    }
    const t = window.setInterval(tick, 200); tick()
    return () => window.clearInterval(t)
  }, [sezione, metconFase, formato, metconRimanente, metconInPausa])

  // Cronometro del Metcon a giri (For Time/A giri/Circuit): conta in avanti, il tempo è il punteggio.
  useEffect(() => {
    if (sezione !== 'metcon' || metconFase !== 'via' || !aGiri || metconInPausa) return
    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - metconStartedAt.current) / 1000))
      const cap = (metconBlock?.time_cap_min ?? 0) * 60
      setMetconTrascorsi(elapsed)
      if (cap > 0 && elapsed >= cap && lastWarning.current !== 'time-cap') { lastWarning.current = 'time-cap'; emit('TIME_CAP_REACHED', 'cap'); setMetconFase('fatto') }
    }
    const t = window.setInterval(tick, 200); tick()
    return () => window.clearInterval(t)
  }, [sezione, metconFase, aGiri, metconTrascorsi, metconInPausa, metconBlock?.time_cap_min])

  // Timer a intervalli (EMOM/Intervals/Tabata): lavoro poi riposo (se previsto), poi il round successivo da solo.
  useEffect(() => {
    if (sezione !== 'metcon' || metconFase !== 'via' || !aIntervalli || metconInPausa) return
    if (intervalRimanente > 0) {
      const tick = () => {
        const next = Math.max(0, Math.ceil((intervalDeadline.current - Date.now()) / 1000))
        setIntervalRimanente(next)
        if (next > 0 && next <= 3 && lastWarning.current !== `interval-${intervalIndice}-${intervalSottofase}-${next}`) { lastWarning.current = `interval-${intervalIndice}-${intervalSottofase}-${next}`; emit('WARNING', intervalSottofase === 'lavoro' ? 'work' : 'rest', intervalIndice + 1) }
      }
      const t = window.setInterval(tick, 200); tick()
      return () => window.clearInterval(t)
    }
    const esCorrente = esercizioIntervallo(intervalIndice)
    if (intervalSottofase === 'lavoro' && esCorrente && esCorrente.rest_sec > 0) {
      setIntervalSottofase('riposo')
      setIntervalRimanente(esCorrente.rest_sec)
      intervalDeadline.current = Date.now() + esCorrente.rest_sec * 1000
      emit('REST_STARTED', 'rest', intervalIndice + 1)
      return
    }
    const prossimo = intervalIndice + 1
    if (prossimo >= intervalliTotali) {
      emit('TIMER_COMPLETED', isTabata ? 'tabata' : formato === 'emom' ? 'emom' : 'completed')
      setMetconFase('fatto')
      return
    }
    setIntervalIndice(prossimo)
    setIntervalSottofase('lavoro')
    setIntervalRimanente(metconBlock?.interval_sec ?? 20)
    intervalDeadline.current = Date.now() + (metconBlock?.interval_sec ?? 20) * 1000
    emit('ROUND_STARTED', formato === 'emom' ? 'emom' : isTabata ? 'tabata' : 'round', prossimo + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sezione, metconFase, aIntervalli, intervalRimanente, intervalSottofase, intervalIndice, metconInPausa])

  if (!workout || (esercizi.length === 0 && metconEsercizi.length === 0)) {
    return (
      <div className="px-5 pt-12">
        <h1 className="font-display font-extrabold uppercase text-3xl tracking-tight">Nessun allenamento</h1>
        <button className="btn mt-6" onClick={() => naviga('/')}>Vai a Crea</button>
      </div>
    )
  }

  if (countdown !== null) {
    return <div className="grid min-h-dvh place-items-center px-5 text-center" aria-live="assertive"><div><p className="eyebrow">Preparati</p><p className="mt-5 font-data text-[8rem] leading-none text-amber2">{countdown || 'VIA'}</p><p className="mt-5 font-display text-xl font-bold uppercase">Inizia ora</p></div></div>
  }

  const es = esercizi[fase.iEs]

  function completaSerie() {
    if (fase.serie < es.sets) {
      setFase({ tipo: 'recupero', iEs: fase.iEs, serie: fase.serie, sec: es.rest_sec })
      setRimanente(es.rest_sec)
      restDeadline.current = Date.now() + es.rest_sec * 1000
      emit('REST_STARTED', 'rest')
    } else if (fase.iEs < esercizi.length - 1) {
      setFase({ tipo: 'recupero', iEs: fase.iEs, serie: fase.serie, sec: es.rest_sec })
      setRimanente(es.rest_sec)
      restDeadline.current = Date.now() + es.rest_sec * 1000
      emit('REST_STARTED', 'rest')
    } else if (metconEsercizi.length > 0) {
      emit('TIMER_COMPLETED', 'set')
      setSezione('metcon')
    } else {
      emit('TIMER_COMPLETED', 'completed')
      setFinito(true)
    }
  }

  function avanza() {
    if (fase.tipo !== 'recupero') return
    if (fase.serie < esercizi[fase.iEs].sets) {
      setFase({ tipo: 'serie', iEs: fase.iEs, serie: fase.serie + 1 })
    } else {
      setFase({ tipo: 'serie', iEs: fase.iEs + 1, serie: 1 })
    }
  }

  async function concludi() {
    if (!user || !workout) return
    setSalvataggio('salvo')
    try {
      await registraCompletato(
        user.id,
        workout,
        Math.round((Date.now() - inizio.current) / 1000),
        valutazione,
        note.trim() || null
      )
      setWorkout(null)
      naviga('/')
    } catch {
      setSalvataggio('errore')
    }
  }

  // — Riepilogo finale —
  if (finito) {
    const durata = Math.round((Date.now() - inizio.current) / 60000)
    return (
      <div className="px-5 pt-12 pb-8">
        <p className="eyebrow mb-3">Finito</p>
        <h1 className="font-display font-extrabold uppercase leading-[0.9] tracking-tight text-[2.4rem]">
          Allenamento
          <br />completato
        </h1>
        <div className="mt-5 flex items-baseline gap-6 font-data">
          <span><span className="text-3xl">{durata}</span><span className="text-slate2 text-[13px]"> min</span></span>
          <span><span className="text-3xl">{esercizi.length}</span><span className="text-slate2 text-[13px]"> esercizi</span></span>
          {!!workout?.est_kcal && (
            <span><span className="text-3xl">~{workout.est_kcal}</span><span className="text-slate2 text-[13px]"> kcal stimate</span></span>
          )}
        </div>

        <p className="field-label mt-9">Com'è andata</p>
        <div className="grid grid-cols-2 gap-2">
          {VALUTAZIONI.map((r) => (
            <button
              key={r.v}
              onClick={() => setValutazione(r.v)}
              aria-pressed={valutazione === r.v}
              className={`chip text-left ${valutazione === r.v ? 'chip-on' : ''}`}
            >
              {r.l}
            </button>
          ))}
        </div>

        <p className="field-label mt-7">Note</p>
        <textarea
          className="input min-h-24 resize-none"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Il secondo esercizio era troppo pesante…"
        />

        {salvataggio === 'errore' && (
          <p className="mt-4 text-[13px] text-amber2" role="alert">
            Non siamo riusciti a registrarlo. Riprova.
          </p>
        )}

        <button className="btn mt-7 !py-4 text-lg" onClick={concludi} disabled={salvataggio === 'salvo'}>
          {salvataggio === 'salvo' ? 'Un attimo…' : 'Chiudi e salva'}
        </button>
      </div>
    )
  }

  // — Riscaldamento —
  if (!iniziato) {
    return (
      <div className="px-5 pt-12 pb-8">
        <p className="eyebrow mb-3">Prima di cominciare</p>
        <h1 className="font-display font-extrabold uppercase leading-[0.9] tracking-tight text-[2.4rem]">
          Riscaldamento
        </h1>
        <p className="mt-2 font-data text-[13px] text-slate2">{riscaldamento?.duration_min} minuti</p>
        <ul className="mt-7 space-y-2.5">
          {riscaldamento?.exercises.map((e, i) => (
            <li key={i} className="slab flex items-baseline justify-between gap-3 !py-3.5">
              <span className="text-[15px]">{e.name}</span>
              <span className="font-data text-[13px] text-slate2 whitespace-nowrap">{e.reps}</span>
            </li>
          ))}
        </ul>
        <AudioControls settings={audioSettings} onChange={updateAudio} />
        <button className="btn mt-8 !py-4 text-lg" onClick={() => void startWithCountdown(() => { inizio.current = Date.now(); setIniziato(true); emit('SET_STARTED', 'set') })}>
          Comincia
        </button>
      </div>
    )
  }

  // — Metcon —
  if (sezione === 'metcon') {
    if (metconFase === 'anteprima') {
      return (
        <div className="px-5 pt-12 pb-8 min-h-dvh flex flex-col">
          <p className="eyebrow mb-3">Metcon</p>
          <h1 className="font-display font-extrabold uppercase leading-[0.9] tracking-tight text-[2.2rem]">
            {metconBlock?.title}
          </h1>
          <p className="mt-2 font-data text-[13px] text-slate2">
            {formato === 'amrap' && `${metconBlock?.time_cap_min} minuti · quanti giri fai`}
            {formato === 'for_time' && `cap ${metconBlock?.time_cap_min} minuti · il più veloce possibile`}
            {formato === 'rounds' && `${metconBlock?.rounds} giri, riposa il necessario fra un giro e l'altro`}
            {formato === 'circuit' && `${metconBlock?.rounds} giri, recupero fisso fra un esercizio e l'altro`}
            {formato === 'emom' && `${metconBlock?.rounds} minuti, un compito ogni minuto`}
            {formato === 'intervals' && `${metconBlock?.interval_sec}″ lavoro / recupero, a ripetere`}
            {formato === 'tabata' && `${metconBlock?.interval_sec ?? 20}″ lavoro / ${metconEsercizi[0]?.rest_sec ?? 10}″ riposo × ${metconBlock?.rounds ?? 8}, un movimento alla volta`}
          </p>
          <ul className="mt-7 space-y-2.5">
            {metconEsercizi.map((e, i) => (
              <li key={i} className="slab !py-3.5">
                <p className="text-[15px] font-medium">{e.name}</p>
                <p className="mt-1 font-data text-[13px] text-slate2">
                  {e.reps}{e.note ? ` · ${e.note}` : ''}
                </p>
              </li>
            ))}
          </ul>
          <button
            className="btn mt-auto !py-4 text-lg"
            onClick={() => void startWithCountdown(() => {
              if (formato === 'amrap') {
                const duration = (metconBlock?.time_cap_min ?? 0) * 60
                setMetconRimanente(duration); metconDeadline.current = Date.now() + duration * 1000
              } else if (aGiri) {
                setMetconTrascorsi(0); metconStartedAt.current = Date.now()
                setMetconGiri(0)
              } else if (aIntervalli) {
                setIntervalIndice(0)
                setIntervalSottofase('lavoro')
                const duration = metconBlock?.interval_sec ?? 20
                setIntervalRimanente(duration); intervalDeadline.current = Date.now() + duration * 1000
                emit('ROUND_STARTED', formato === 'emom' ? 'emom' : isTabata ? 'tabata' : 'round', 1)
              }
              setMetconFase('via')
            })}
          >
            Comincia
          </button>
        </div>
      )
    }

    if (metconFase === 'via' && formato === 'amrap') {
      return (
        <div className="px-5 pt-16 pb-8 min-h-dvh flex flex-col">
          <p className="eyebrow text-center">AMRAP</p>
          <p className="mt-6 text-center font-data text-[5rem] leading-none tabular-nums text-amber2">
            {String(Math.floor(metconRimanente / 60))}:{String(metconRimanente % 60).padStart(2, '0')}
          </p>

          <div className="mt-8 text-center">
            <p className="eyebrow mb-2">Giri completati</p>
            <p className="font-data text-[3.5rem] leading-none">{metconGiri}</p>
          </div>

          <ul className="mt-8 space-y-2">
            {metconEsercizi.map((e, i) => (
              <li key={i} className="flex items-baseline justify-between border-b border-edge/60 pb-1.5">
                <span className="text-[14px] text-slate2">{e.name}</span>
                <span className="font-data text-[13px] whitespace-nowrap">{e.reps}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto space-y-2.5 pt-8">
            <button className="btn !py-4" onClick={() => setMetconGiri((g) => g + 1)}>
              +1 Giro completato
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                className="rounded-xl border border-edge bg-steel py-3.5 font-data text-[11px] uppercase tracking-[0.14em] text-chalk active:bg-edge"
                onClick={toggleMetconPause}
              >
                {metconInPausa ? 'Riprendi' : 'Pausa'}
              </button>
              <button
                className="rounded-xl border border-edge bg-steel py-3.5 font-data text-[11px] uppercase tracking-[0.14em] text-chalk active:bg-edge"
                onClick={() => setMetconFase('fatto')}
              >
                Termina
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (metconFase === 'via' && aGiri) {
      const rounds = metconBlock?.rounds ?? 1
      const ultimoGiro = rounds > 1 && metconGiri + 1 >= rounds
      return (
        <div className="px-5 pt-16 pb-8 min-h-dvh flex flex-col">
          <p className="eyebrow text-center">{metconBlock?.title}</p>
          <p className="mt-6 text-center font-data text-[5rem] leading-none tabular-nums text-amber2">
            {String(Math.floor(metconTrascorsi / 60))}:{String(metconTrascorsi % 60).padStart(2, '0')}
          </p>

          <div className="mt-8 text-center">
            <p className="eyebrow mb-2">{rounds > 1 ? `Giro ${Math.min(metconGiri + 1, rounds)} di ${rounds}` : 'Giri completati'}</p>
            <p className="font-data text-[3.5rem] leading-none">{metconGiri}</p>
          </div>

          <ul className="mt-8 space-y-2">
            {metconEsercizi.map((e, i) => (
              <li key={i} className="flex items-baseline justify-between border-b border-edge/60 pb-1.5">
                <span className="text-[14px] text-slate2">{e.name}</span>
                <span className="font-data text-[13px] whitespace-nowrap">{e.reps}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto space-y-2.5 pt-8">
            <button
              className="btn !py-4"
              onClick={() => {
                const nuovi = metconGiri + 1
                setMetconGiri(nuovi)
                if (formato === 'for_time' || (rounds > 1 && nuovi >= rounds)) { emit('TIMER_COMPLETED', 'for_time'); setMetconFase('fatto') }
              }}
            >
              {ultimoGiro || formato === 'for_time' ? 'Fatto' : '+1 Giro completato'}
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                className="rounded-xl border border-edge bg-steel py-3.5 font-data text-[11px] uppercase tracking-[0.14em] text-chalk active:bg-edge"
                onClick={toggleMetconPause}
              >
                {metconInPausa ? 'Riprendi' : 'Pausa'}
              </button>
              <button
                className="rounded-xl border border-edge bg-steel py-3.5 font-data text-[11px] uppercase tracking-[0.14em] text-chalk active:bg-edge"
                onClick={() => setMetconFase('fatto')}
              >
                Termina
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (metconFase === 'via' && aIntervalli) {
      const esCorrente = esercizioIntervallo(intervalIndice)
      const inLavoro = intervalSottofase === 'lavoro'
      return (
        <div className="px-5 pt-16 pb-8 min-h-dvh flex flex-col">
          <p className="eyebrow text-center">Round {intervalIndice + 1} di {intervalliTotali}</p>
          <p className={`mt-6 text-center font-data text-[5rem] leading-none tabular-nums ${inLavoro ? 'text-amber2' : 'text-slate2'}`}>
            {String(Math.floor(intervalRimanente / 60))}:{String(intervalRimanente % 60).padStart(2, '0')}
          </p>
          <p className="mt-2 text-center font-data text-[11px] uppercase tracking-[0.14em] text-slate2">
            {inLavoro ? 'Lavoro' : 'Riposo'}
          </p>

          <div className="slab mt-10 text-center">
            <p className="eyebrow mb-2">{inLavoro ? 'Adesso' : 'Poi tocca a'}</p>
            <p className="text-[18px] font-medium">{esCorrente?.name}</p>
            <p className="mt-1 font-data text-[13px] text-slate2">{esCorrente?.reps}</p>
          </div>

          <div className="mt-auto space-y-2.5 pt-10">
            <button
              className="w-full rounded-xl border border-edge py-3.5 font-data text-[11px] uppercase tracking-[0.14em] text-slate2 active:bg-steel"
              onClick={toggleMetconPause}
            >
              {metconInPausa ? 'Riprendi' : 'Pausa'}
            </button>
            <button className="btn !py-4" onClick={() => setMetconFase('fatto')}>Termina</button>
          </div>
        </div>
      )
    }

    // metconFase === 'fatto'
    return (
      <div className="px-5 pt-12 pb-8">
        <p className="eyebrow mb-3">Metcon finito</p>
        <h1 className="font-display font-extrabold uppercase leading-[0.9] tracking-tight text-[2.2rem]">
          {aGiri && `${String(Math.floor(metconTrascorsi / 60))}:${String(metconTrascorsi % 60).padStart(2, '0')}`}
          {aIntervalli && `${intervalliTotali} round completati`}
          {formato === 'amrap' && `${metconGiri} ${metconGiri === 1 ? 'giro completato' : 'giri completati'}`}
        </h1>
        <button
          className="btn mt-8 !py-4 text-lg"
          onClick={() => {
            setNote((n) => {
              if (n) return n
              if (aGiri) {
                const min = Math.floor(metconTrascorsi / 60)
                const sec = String(metconTrascorsi % 60).padStart(2, '0')
                return `Metcon: finito in ${min}:${sec}${metconGiri > 1 ? ` (${metconGiri} giri)` : ''}.`
              }
              if (aIntervalli) return `Metcon: ${metconBlock?.title} completato.`
              return `Metcon: ${metconGiri} giri completati in ${metconBlock?.time_cap_min} min.`
            })
            setFinito(true)
          }}
        >
          Fine allenamento
        </button>
      </div>
    )
  }

  // — Recupero —
  if (fase.tipo === 'recupero') {
    const prossimo = fase.serie < es.sets ? es : esercizi[fase.iEs + 1]
    const prossimaSerie = fase.serie < es.sets ? fase.serie + 1 : 1
    return (
      <div className="px-5 pt-16 pb-8 min-h-dvh flex flex-col">
        <p className="eyebrow text-center">Recupero</p>
        <p className="mt-8 text-center font-data text-[5.5rem] leading-none tabular-nums text-amber2">
          {String(Math.floor(rimanente / 60))}:{String(rimanente % 60).padStart(2, '0')}
        </p>

        <div className="slab mt-12">
          <p className="eyebrow mb-2">Poi tocca a</p>
          <p className="text-[16px] font-medium">{prossimo.name}</p>
          <p className="mt-1 font-data text-[13px] text-slate2">
            serie {prossimaSerie} di {prossimo.sets} · {prossimo.reps} ripetizioni
          </p>
        </div>

        <div className="mt-auto space-y-2.5 pt-10">
          <button className="btn !py-4" onClick={avanza}>Salta il recupero</button>
          <button
            className="w-full rounded-xl border border-edge py-3.5 font-data text-[11px] uppercase tracking-[0.14em] text-slate2 active:bg-steel"
            onClick={toggleRestPause}
          >
            {inPausa ? 'Riprendi' : 'Pausa'}
          </button>
        </div>
      </div>
    )
  }

  // — Serie in corso —
  return (
    <div className="px-5 pt-12 pb-8 min-h-dvh flex flex-col">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Esercizio {fase.iEs + 1} di {esercizi.length}</p>
        <button className="font-data text-[11px] uppercase tracking-[0.14em] text-slate2" onClick={() => setFinito(true)}>
          Termina
        </button>
      </div>

      {/* Barra di avanzamento */}
      <div className="mt-3 flex gap-1" aria-hidden>
        {esercizi.map((_, i) => (
          <span key={i} className={`h-[3px] flex-1 rounded-full ${i < fase.iEs ? 'bg-chalk' : i === fase.iEs ? 'bg-amber2' : 'bg-edge'}`} />
        ))}
      </div>

      <h1 className="mt-9 font-display font-extrabold uppercase leading-[0.95] tracking-tight text-[2.1rem]">
        {es.name}
      </h1>
      {es.muscle && (
        <p className="mt-2 font-data text-[11px] uppercase tracking-[0.14em] text-slate2">
          {MUSCLE_LABELS[es.muscle]}
        </p>
      )}
      {es.instructions && <p className="mt-2 text-[13px] text-slate2 leading-relaxed">{es.instructions}</p>}

      <div className="mt-12 text-center">
        <p className="eyebrow mb-3">Serie</p>
        <p className="font-data text-[4.5rem] leading-none tabular-nums">
          {fase.serie}<span className="text-slate2 text-[2rem]">/{es.sets}</span>
        </p>
        <p className="mt-6 font-data text-2xl">{es.reps} <span className="text-slate2 text-base">ripetizioni</span></p>
        {/* Nessun sensore collegato: architettura predisposta (sez. 55-58), mai un valore inventato. */}
        <p className="mt-5 flex items-center justify-center gap-4 font-data text-[12px] text-slate2">
          <span>♡ FC non disponibile</span>
          {!!es.est_kcal && <span>~{es.est_kcal} kcal stimate</span>}
        </p>
      </div>

      <div className="mt-auto pt-10">
        <button className="btn !py-5 text-lg" onClick={completaSerie}>
          Serie completata
        </button>
      </div>
    </div>
  )
}

function AudioControls({ settings, onChange }: { settings: AudioTimerSettings; onChange: (patch: Partial<AudioTimerSettings>) => void }) {
  const sounds: TimerSound[] = ['beep', 'ding', 'silent']
  return <section className="mt-7 rounded-xl border border-edge bg-steel p-4"><div className="flex items-center justify-between"><span className="text-sm font-medium">Audio timer</span><button className={`chip ${settings.enabled ? 'chip-on' : ''}`} aria-pressed={settings.enabled} onClick={() => onChange({ enabled: !settings.enabled })}>{settings.enabled ? 'ON' : 'OFF'}</button></div>{settings.enabled ? <div className="mt-4 grid grid-cols-2 gap-3"><AudioSelect label="Suono inizio" value={settings.startSound} sounds={sounds} onChange={(startSound) => onChange({ startSound })} /><AudioSelect label="Suono fine" value={settings.endSound} sounds={sounds} onChange={(endSound) => onChange({ endSound })} /><label className="col-span-2 flex items-center gap-3 text-sm text-slate2"><input type="checkbox" checked={settings.countdown} onChange={(event) => onChange({ countdown: event.target.checked })} />Countdown 3–2–1</label></div> : null}</section>
}

function AudioSelect({ label, value, sounds, onChange }: { label: string; value: TimerSound; sounds: TimerSound[]; onChange: (sound: TimerSound) => void }) {
  return <label className="text-xs text-slate2">{label}<select className="input mt-1 !py-2" value={value} onChange={(event) => onChange(event.target.value as TimerSound)}>{sounds.map((sound) => <option key={sound} value={sound}>{sound === 'beep' ? 'Beep' : sound === 'ding' ? 'Ding' : 'Silenzioso'}</option>)}</select></label>
}
