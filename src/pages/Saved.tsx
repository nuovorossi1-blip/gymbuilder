import { useCallback, useEffect, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useWorkout } from '../features/workout/WorkoutContext'
import { cambiaPreferito, caricaCatalogo, elencoProgrammi, elencoSalvati, eliminaProgramma, eliminaSalvato, rinominaProgramma, rinominaSalvato, type ProgrammaSalvato } from '../lib/api'
import { useCoach } from '../features/coach/useCoach'
import { useCartella } from '../features/cartella/useCartella'
import { sedutaComeWorkout } from '../features/coach/plan'
import { SPLIT_LABELS, type Goal, type Mode, type SavedWorkout, type Split } from '../types'
import { SwipeContainer } from '../components/SwipeContainer'
import { SwipeToDeleteRow } from '../components/SwipeToDeleteRow'

export default function Saved() {
  const { user } = useAuth()
  const { catalog, setCatalog, setWorkout, setGenerationConfig, startWorkoutSession, setWeeklyProgram } = useWorkout()
  // 26/09 (Rossi: "coach, singole, dal piano, programmi: troppa confusione"): tre sezioni.
  //  - Programma del coach: il programma attivo e le sue sedute salvate;
  //  - Le mie schede: tutto quello che hai salvato tu (Analizza, allenamento rapido);
  //  - Archivio: i vecchi programmi settimanali del wizard (tolto) e le loro sedute.
  const [sezione, setSezione] = useState<'coach' | 'mie' | 'archivio'>('coach')
  const { piano: pianoCoach, impostaProssima, eliminaPiano, rinominaPiano } = useCoach(user?.id)
  const { cartella } = useCartella(user?.id)
  const [programmi, setProgrammi] = useState<ProgrammaSalvato[] | null>(null)
  const naviga = useNavigate()
  const [lista, setLista] = useState<SavedWorkout[] | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  const carica = useCallback(() => {
    if (!user) return
    elencoSalvati(user.id).then(setLista).catch((e) => setErrore(e.message))
    elencoProgrammi(user.id).then(setProgrammi).catch((e) => setErrore(e.message))
  }, [user])
  const dalPiano = (s: SavedWorkout) => s.generation_config?.program_kind === 'program'
  const dalCoach = (s: SavedWorkout) => s.origine === 'coach'
  const visibili = lista?.filter((s) => (sezione === 'coach' ? dalCoach(s) : sezione === 'archivio' ? dalPiano(s) && !dalCoach(s) : !dalPiano(s) && !dalCoach(s))) ?? null
  const origine = (s: SavedWorkout) => dalCoach(s) ? 'Protocollo del coach' : dalPiano(s) ? 'Da un vecchio programma' : s.generation_config ? 'Allenamento rapido' : 'Scritta da te'
  // Nomi uguali tra le schede: vanno segnalati per poterli distinguere e rinominare.
  const doppi = new Set((lista ?? []).map((s) => s.name.trim().toLowerCase()).filter((n, i, a) => a.indexOf(n) !== i))

  async function rinomina(s: SavedWorkout) {
    const nuovo = prompt('Nuovo nome della scheda', s.name)
    if (nuovo === null || !nuovo.trim() || nuovo.trim() === s.name) return
    try {
      await rinominaSalvato(s.id, nuovo)
      setLista((cur) => cur?.map((x) => (x.id === s.id ? { ...x, name: nuovo.trim() } : x)) ?? null)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Nome non salvato.')
    }
  }

  async function rinominaProg(p: ProgrammaSalvato) {
    const nuovo = prompt('Nuovo nome del programma', p.name)
    if (nuovo === null || !nuovo.trim() || nuovo.trim() === p.name) return
    try {
      await rinominaProgramma(p.id, nuovo)
      setProgrammi((cur) => cur?.map((x) => (x.id === p.id ? { ...x, name: nuovo.trim() } : x)) ?? null)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Nome non salvato.')
    }
  }

  function iniziaSedutaCoach(i: number) {
    if (!pianoCoach) return
    const carenze = cartella?.carenze.map((c) => c.muscolo) ?? []
    setGenerationConfig(null)
    setWorkout(sedutaComeWorkout(pianoCoach.plan.sedute[i], catalog, cartella, carenze))
    void impostaProssima((i + 1) % pianoCoach.plan.sedute.length)
    naviga('/allenamento')
  }

  function apriProgramma(p: ProgrammaSalvato) {
    setWeeklyProgram(p.program)
    naviga('/crea')
  }

  async function eliminaProg(p: ProgrammaSalvato) {
    try {
      await eliminaProgramma(p.id)
      setProgrammi((current) => current?.filter((item) => item.id !== p.id) ?? [])
    } catch {
      setErrore('Non siamo riusciti a eliminare il programma. Riprova.')
    }
  }

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
    const nextWorkout = {
      name: s.name, mode: s.mode as Mode, split: s.split as Split | null,
      goal: s.goal as Goal, experience: s.experience as never,
      duration_min: s.duration_min, blocks, warnings: [],
      origine: s.origine ?? undefined,
    }
    setGenerationConfig(s.generation_config ?? null)
    setWorkout(nextWorkout)
    if (startImmediate) startWorkoutSession(nextWorkout, s.generation_config ?? null)
    naviga(startImmediate ? '/avvia' : '/allenamento')
  }

  async function elimina(s: SavedWorkout) {
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
      <BackButton />
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

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-edge p-1" role="tablist">
        {([['coach', 'Programma del coach'], ['mie', 'Le mie schede'], ['archivio', 'Archivio']] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={sezione === key}
            onClick={() => setSezione(key)}
            className={`rounded-lg px-1 py-2 text-[12px] font-semibold leading-tight ${sezione === key ? 'bg-chalk text-ink' : 'text-slate2'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate2">
        {sezione === 'coach' ? 'Il programma che ti ha preparato il coach, con le sue sedute.' : sezione === 'mie' ? 'Le schede che hai salvato tu: scritte in "Analizza la mia scheda" o generate con "Allenamento rapido".' : 'I vecchi programmi settimanali (non si creano più) e le loro sedute. Puoi riaprirli o cancellarli.'}
      </p>

      {sezione === 'coach' && (
        <section className="space-y-3">
          {!pianoCoach && <p className="text-sm text-slate-400">Nessun programma del coach ancora: fai il colloquio dalla Home.</p>}
          {pianoCoach && (
            <div className="rounded-2xl glass-card border border-cyan-500/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <button className="text-left font-display font-bold text-white" onClick={() => { const t = prompt('Nuovo nome del programma', pianoCoach.plan.titolo); if (t && t.trim()) void rinominaPiano(t).catch((e) => setErrore(e.message)) }}>{pianoCoach.plan.titolo} <span className="text-xs text-slate-400">✏️</span></button>
                <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 font-data text-[10px] uppercase text-cyan-300">Protocollo del coach · v{pianoCoach.version}</span>
              </div>
              <ol className="space-y-2">
                {pianoCoach.plan.sedute.map((sd, i) => (
                  <li key={i} className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 ${i === pianoCoach.next_index ? 'border-cyan-400/60' : 'border-edge'}`}>
                    <span className="text-sm text-white">{String.fromCharCode(65 + i)} · {sd.nome} <span className="text-[11px] text-slate-400">{sd.esercizi.length} esercizi{i === pianoCoach.next_index ? ' · prossima' : ''}</span></span>
                    <button className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300" onClick={() => iniziaSedutaCoach(i)}>▶ Inizia</button>
                  </li>
                ))}
              </ol>
              <button className="w-full rounded-xl glass-card py-2.5 text-xs font-bold uppercase text-slate-300" onClick={() => naviga('/coach')}>Apri il programma e parla col coach</button>
              <button
                className="w-full rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-xs font-bold uppercase text-red-300"
                onClick={() => {
                  if (!confirm(`Eliminare definitivamente “${pianoCoach.plan.titolo}”? Poi il coach ne prepara uno nuovo.`)) return
                  void eliminaPiano(pianoCoach.id).then(() => naviga('/coach')).catch(() => setErrore('Programma non eliminato. Riprova.'))
                }}
              >
                🗑 Elimina e creane uno nuovo
              </button>
            </div>
          )}
          {visibili && visibili.length > 0 && <h3 className="eyebrow text-slate-400">Sedute del coach salvate</h3>}
        </section>
      )}

      {sezione === 'archivio' && (
        <ul className="space-y-3">
          {programmi === null && <li className="h-20 animate-pulse rounded-2xl glass-card" aria-hidden />}
          {programmi?.length === 0 && <li className="text-sm text-slate-400">Nessun vecchio programma settimanale.</li>}
          {programmi?.map((p, index) => (
            <li key={p.id}>
              <SwipeToDeleteRow confirmLabel={`Eliminare il programma “${p.name}”?`} onDelete={() => eliminaProg(p)}>
                <div className="rounded-2xl glass-card border border-edge p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <button className="text-left font-display font-bold text-white" onClick={() => { void rinominaProg(p) }}>{p.name} <span className="text-xs text-slate-400">✏️</span></button>
                    <span className="rounded-full bg-steel px-2 py-0.5 font-data text-[10px] uppercase text-slate-400">
                      {index === 0 ? 'Più recente' : 'Vecchio programma'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {p.program.week.length} sedute · creato il {new Date(p.created_at).toLocaleDateString('it-IT')}
                  </p>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <button onClick={() => apriProgramma(p)} className="rounded-xl glass-card py-2.5 font-display text-xs font-bold uppercase text-slate-300 hover:text-white">
                      Apri la settimana
                    </button>
                    <button aria-label="Elimina definitivamente" onClick={() => { if (confirm(`Eliminare definitivamente il programma “${p.name}”?`)) void eliminaProg(p) }} className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 text-sm text-red-300">🗑</button>
                  </div>
                </div>
              </SwipeToDeleteRow>
            </li>
          ))}
        </ul>
      )}

      {sezione === 'archivio' && visibili && visibili.length > 0 && <h3 className="eyebrow text-slate-400">Sedute salvate dai vecchi programmi</h3>}

      {visibili === null && !errore && (
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-2xl glass-card" aria-hidden />
          <div className="h-28 animate-pulse rounded-2xl glass-card" aria-hidden />
        </div>
      )}

      {sezione === 'mie' && visibili?.length === 0 && (
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

      {<ul className="space-y-3">
        {visibili?.map((s) => (
          <li key={s.id}>
            <SwipeToDeleteRow
              confirmLabel={`Eliminare “${s.name}” dai salvati?`}
              onDelete={() => elimina(s)}
            >
              <div className="rounded-2xl glass-card border border-edge p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <button className="text-left font-display font-bold text-base text-white" onClick={() => { void rinomina(s) }} aria-label={`Rinomina ${s.name}`}>
                        {s.name} <span className="text-xs font-normal text-slate-400">✏️</span>
                      </button>
                      {doppi.has(s.name.trim().toLowerCase()) && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 font-data text-[10px] uppercase text-amber-300">Nome doppio</span>}
                      {s.favorite && (
                        <span className="text-amber-400 text-sm">★</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <span className={dalCoach(s) ? 'text-cyan-300' : ''}>{origine(s)}</span>
                      {s.split && SPLIT_LABELS[s.split as Split] ? ` · ${SPLIT_LABELS[s.split as Split]}` : ''} · {s.duration_min} min · {new Date(s.created_at).toLocaleDateString('it-IT')}
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

                {/* 1-Tap Action Row · elimina: pulsante 🗑 (25/09) oppure swipe sulla card */}
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-edge/60 pt-3">
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
                    aria-label="Elimina definitivamente"
                    onClick={() => { if (confirm(`Eliminare definitivamente “${s.name}”?`)) void elimina(s) }}
                    className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 text-sm text-red-300"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </SwipeToDeleteRow>
          </li>
        ))}
      </ul>}
    </SwipeContainer>
  )
}
