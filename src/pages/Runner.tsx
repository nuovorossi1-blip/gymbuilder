import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useWorkout } from '../features/workout/WorkoutContext'
import { registraCompletato } from '../lib/api'
import { MUSCLE_LABELS } from '../types'

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

  const [iniziato, setIniziato] = useState(false)
  const [fase, setFase] = useState<Fase>({ tipo: 'serie', iEs: 0, serie: 1 })
  const [rimanente, setRimanente] = useState(0)
  const [inPausa, setInPausa] = useState(false)
  const [sezione, setSezione] = useState<'principale' | 'metcon'>(esercizi.length > 0 ? 'principale' : 'metcon')
  const [metconFase, setMetconFase] = useState<'anteprima' | 'via' | 'fatto'>('anteprima')
  const [metconRimanente, setMetconRimanente] = useState(0)
  const [metconGiri, setMetconGiri] = useState(0)
  const [metconInPausa, setMetconInPausa] = useState(false)
  const [finito, setFinito] = useState(false)
  const [valutazione, setValutazione] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [salvataggio, setSalvataggio] = useState<'fermo' | 'salvo' | 'errore'>('fermo')
  const inizio = useRef<number>(Date.now())

  // Timer del recupero
  useEffect(() => {
    if (fase.tipo !== 'recupero' || inPausa) return
    if (rimanente <= 0) {
      avanza()
      return
    }
    const t = setTimeout(() => setRimanente((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [fase, rimanente, inPausa])

  // Timer del Metcon (AMRAP): conto alla rovescia dal tempo a disposizione.
  useEffect(() => {
    if (sezione !== 'metcon' || metconFase !== 'via' || metconInPausa) return
    if (metconRimanente <= 0) {
      setMetconFase('fatto')
      return
    }
    const t = setTimeout(() => setMetconRimanente((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [sezione, metconFase, metconRimanente, metconInPausa])

  if (!workout || (esercizi.length === 0 && metconEsercizi.length === 0)) {
    return (
      <div className="px-5 pt-12">
        <h1 className="font-display font-extrabold uppercase text-3xl tracking-tight">Nessun allenamento</h1>
        <button className="btn mt-6" onClick={() => naviga('/')}>Vai a Crea</button>
      </div>
    )
  }

  const es = esercizi[fase.iEs]

  function completaSerie() {
    if (fase.serie < es.sets) {
      setFase({ tipo: 'recupero', iEs: fase.iEs, serie: fase.serie, sec: es.rest_sec })
      setRimanente(es.rest_sec)
    } else if (fase.iEs < esercizi.length - 1) {
      setFase({ tipo: 'recupero', iEs: fase.iEs, serie: fase.serie, sec: es.rest_sec })
      setRimanente(es.rest_sec)
    } else if (metconEsercizi.length > 0) {
      setSezione('metcon')
    } else {
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
      naviga('/storico')
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
        <button className="btn mt-8 !py-4 text-lg" onClick={() => { inizio.current = Date.now(); setIniziato(true) }}>
          Comincia
        </button>
      </div>
    )
  }

  // — Metcon (AMRAP) —
  if (sezione === 'metcon') {
    if (metconFase === 'anteprima') {
      return (
        <div className="px-5 pt-12 pb-8 min-h-dvh flex flex-col">
          <p className="eyebrow mb-3">Metcon</p>
          <h1 className="font-display font-extrabold uppercase leading-[0.9] tracking-tight text-[2.2rem]">
            {metconBlock?.title}
          </h1>
          <p className="mt-2 font-data text-[13px] text-slate2">
            {metconBlock?.time_cap_min} minuti · quanti giri fai
          </p>
          <ul className="mt-7 space-y-2.5">
            {metconEsercizi.map((e, i) => (
              <li key={i} className="slab !py-3.5">
                <p className="text-[15px] font-medium">{e.name}</p>
                <p className="mt-1 font-data text-[13px] text-slate2">{e.reps}</p>
              </li>
            ))}
          </ul>
          <button
            className="btn mt-auto !py-4 text-lg"
            onClick={() => {
              setMetconRimanente((metconBlock?.time_cap_min ?? 0) * 60)
              setMetconFase('via')
            }}
          >
            Comincia AMRAP
          </button>
        </div>
      )
    }

    if (metconFase === 'via') {
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
                onClick={() => setMetconInPausa((p) => !p)}
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

    // metconFase === 'fatto'
    return (
      <div className="px-5 pt-12 pb-8">
        <p className="eyebrow mb-3">Metcon finito</p>
        <h1 className="font-display font-extrabold uppercase leading-[0.9] tracking-tight text-[2.2rem]">
          {metconGiri} {metconGiri === 1 ? 'giro completato' : 'giri completati'}
        </h1>
        <button
          className="btn mt-8 !py-4 text-lg"
          onClick={() => {
            setNote((n) => n || `Metcon: ${metconGiri} giri completati in ${metconBlock?.time_cap_min} min.`)
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
            onClick={() => setInPausa((p) => !p)}
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
