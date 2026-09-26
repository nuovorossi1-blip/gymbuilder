import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackButton } from '../components/BackButton'
import { determinaFase } from '../engine/nutrition'
import { useAuth } from '../features/auth/AuthProvider'
import { loadLocalAiSettings } from '../features/profile/aiSettings'
import { useSettings } from '../features/profile/useSettings'
import { analyzeSchedaWithDeepSeek, type SchedaAnalysis, type SchedaCheck } from '../lib/deepseek'
import { componiSchedaSalvabile, righeMancanti, type RigaScheda } from '../engine/schedaUtente'
import { useWorkout } from '../features/workout/WorkoutContext'
import { caricaCatalogo, elencoSalvati, eliminaSalvato, nomeLibero, salvaAllenamento } from '../lib/api'
import { MUSCLE_LABELS, type Exercise, type Muscle } from '../types'
import type { SchedaRiga } from '../lib/deepseek'
import type { PhaseInfo } from '../engine/nutrition'

/**
 * "Analizza la mia scheda" (23/09, Fase 3 del prompt di programmazione di Rossi).
 * L'utente scrive il proprio ordine di esercizi; DeepSeek lo analizza PRIMA di proporre la sua
 * versione (interleave, priorità, dimensione, volume), poi confronta slot per slot e propone un
 * ibrido. Il risultato è un parere testuale: non diventa una scheda eseguibile, per quella c'è
 * il motore in Genera.
 */
const SEDUTE = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Altro']
const CHECK_LABELS: Record<keyof SchedaAnalysis['controlli'], string> = {
  interleave: 'Alternanza muscoli',
  priorita: 'Priorità alle carenze',
  dimensione: 'Grandi prima, macchine in fondo',
  volume: 'Volume per la tua fase',
}

export default function Analyze() {
  const { user } = useAuth()
  const { profile, settings, calorieLog } = useSettings(user?.id)
  const [scheda, setScheda] = useState('')
  const [seduta, setSeduta] = useState('Push')
  const [carenze, setCarenze] = useState<Muscle[]>([])
  const [stato, setStato] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errore, setErrore] = useState('')
  const [analisi, setAnalisi] = useState<SchedaAnalysis | null>(null)
  const fase = determinaFase(profile, calorieLog)
  const { catalog: ctxCatalog, setCatalog } = useWorkout()
  const [catalog, setLocalCatalog] = useState<Exercise[]>(ctxCatalog ?? [])

  useEffect(() => {
    if (catalog.length > 0) return
    caricaCatalogo().then((items) => { setLocalCatalog(items); setCatalog(items) }).catch(() => undefined)
  }, [catalog.length, setCatalog])

  useEffect(() => {
    if (settings?.priority_muscles?.length) setCarenze(settings.priority_muscles)
  }, [settings])

  function toggle(muscle: Muscle) {
    setCarenze((old) => (old.includes(muscle) ? old.filter((item) => item !== muscle) : [...old, muscle]))
  }

  async function analizza() {
    setStato('loading'); setErrore(''); setAnalisi(null)
    try {
      const result = await analyzeSchedaWithDeepSeek(loadLocalAiSettings(), {
        scheda,
        seduta,
        carenze,
        livello: settings?.experience,
        catalogo: catalog,
        programmazione: {
          fase: fase?.phase ?? null,
          fase_per_volume: fase?.training_phase ?? null,
          sintesi_fase: fase?.summary ?? null,
          recupero_limitato: fase?.recovery_limited ?? false,
          fastidi_articolari: profile?.joint_issues ?? [],
          gradino_calorie: fase?.calorie_step ?? null,
          gradino_volume: fase?.training_step ?? null,
          normocalorica: fase?.maintenance_kcal ?? null,
        },
      })
      setAnalisi(result)
      setStato('idle')
    } catch (reason) {
      setErrore(reason instanceof Error ? reason.message : 'Analisi non riuscita.')
      setStato('error')
    }
  }

  return (
    <main className="px-5 pb-28 pt-12">
      <BackButton />
      <h1 className="mt-3 font-display text-[2.2rem] font-extrabold uppercase leading-none">Analizza la mia scheda</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate2">
        Scrivi i tuoi esercizi nell'ordine in cui li fai, uno per riga. Prima analizzo la tua versione,
        poi la confronto con la mia e ti propongo un ibrido.
      </p>

      <p className="mt-5 rounded-xl border border-edge bg-steel/50 p-3.5 text-sm leading-relaxed text-chalk">
        {fase
          ? fase.summary
          : 'Fase sconosciuta: compila "Alimentazione e recupero" nel Profilo per un giudizio sul volume più preciso.'}
      </p>

      <div className="mt-6 space-y-5">
        <label className="block">
          <span className="field-label">Seduta</span>
          <select className="input" value={seduta} onChange={(event) => setSeduta(event.target.value)}>
            {SEDUTE.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">La tua scheda</span>
          <textarea
            className="input min-h-44"
            value={scheda}
            onChange={(event) => setScheda(event.target.value)}
            placeholder={'Panca piana manubri 4x8\nAlzate laterali 3x12\nPanca inclinata 3x10\nCurl manubri 2x12\nDip 3x10\nPushdown 3x12'}
          />
        </label>
        <fieldset>
          <legend className="field-label">Muscoli carenti</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MUSCLE_LABELS) as Muscle[]).map((muscle) => {
              const on = carenze.includes(muscle)
              return (
                <button
                  key={muscle}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(muscle)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-amber2/60 bg-amber2/15 text-amber2' : 'border-edge text-slate2'}`}
                >
                  {MUSCLE_LABELS[muscle]}
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>

      <button className="btn mt-8" disabled={!scheda.trim() || stato === 'loading'} onClick={() => { void analizza() }}>
        {stato === 'loading' ? 'Analisi in corso…' : 'Analizza'}
      </button>
      {errore && <p role="alert" className="mt-3 text-sm text-amber2">{errore}</p>}

      {analisi && <Risultato analisi={analisi} />}
      {analisi && (analisi.tua.length > 0 || analisi.proposta.length > 0) && catalog.length > 0 && (
        <SchedaFinale
          key={analisi.sequenza + analisi.tua.length}
          analisi={analisi}
          catalog={catalog}
          seduta={seduta}
          carenze={carenze}
          fase={fase}
          experience={settings?.experience ?? 'intermediate'}
          userId={user?.id}
        />
      )}
    </main>
  )
}

function Check({ label, check }: { label: string; check: SchedaCheck }) {
  return (
    <li className="flex gap-3 border-b border-edge/60 pb-2.5">
      <span aria-hidden className={check.ok ? 'text-emerald-300' : 'text-amber2'}>{check.ok ? '✓' : '!'}</span>
      <div>
        <p className="text-[14px] font-medium">{label} <span className="sr-only">{check.ok ? 'ok' : 'da migliorare'}</span></p>
        {check.nota && <p className="mt-0.5 text-[13px] leading-relaxed text-slate2">{check.nota}</p>}
      </div>
    </li>
  )
}

function Risultato({ analisi }: { analisi: SchedaAnalysis }) {
  return (
    <section className="mt-10 space-y-8">
      {analisi.sequenza && (
        <div>
          <h2 className="field-label">La tua sequenza</h2>
          <p className="font-data text-[14px] leading-relaxed text-chalk">{analisi.sequenza}</p>
        </div>
      )}

      <div>
        <h2 className="field-label">Controlli</h2>
        <ul className="space-y-2.5">
          {(Object.keys(CHECK_LABELS) as (keyof SchedaAnalysis['controlli'])[]).map((key) => (
            <Check key={key} label={CHECK_LABELS[key]} check={analisi.controlli[key]} />
          ))}
        </ul>
      </div>

      {analisi.confronto.length > 0 && (
        <div>
          <h2 className="field-label">Confronto slot per slot</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead className="text-slate2">
                <tr>
                  <th className="py-2 pr-2 font-normal">#</th>
                  <th className="py-2 pr-2 font-normal">Tua</th>
                  <th className="py-2 pr-2 font-normal">Proposta</th>
                  <th className="py-2 font-normal">Chi vince e perché</th>
                </tr>
              </thead>
              <tbody>
                {analisi.confronto.map((row) => (
                  <tr key={row.slot} className="border-t border-edge/60 align-top">
                    <td className="py-2 pr-2 font-data text-slate2">{row.slot}</td>
                    <td className={`py-2 pr-2 ${row.vincitore === 'utente' ? 'text-emerald-300' : ''}`}>{row.utente}</td>
                    <td className={`py-2 pr-2 ${row.vincitore === 'proposta' ? 'text-emerald-300' : ''}`}>{row.proposta}</td>
                    <td className="py-2 text-slate2">{row.vincitore === 'pari' ? 'Pari' : row.vincitore === 'utente' ? 'La tua' : 'La proposta'}{row.perche ? ` — ${row.perche}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(analisi.pregi.length > 0 || analisi.difetti.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {analisi.pregi.length > 0 && (
            <div>
              <h2 className="field-label">Pregi</h2>
              <ul className="space-y-1.5 text-[13px] leading-relaxed text-chalk">{analisi.pregi.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div>
          )}
          {analisi.difetti.length > 0 && (
            <div>
              <h2 className="field-label">Da sistemare</h2>
              <ul className="space-y-1.5 text-[13px] leading-relaxed text-chalk">{analisi.difetti.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {analisi.ibrida.length > 0 && (
        <div>
          <h2 className="field-label">Versione ibrida</h2>
          <ol className="space-y-2">
            {analisi.ibrida.map((row) => (
              <li key={row.slot} className="flex items-baseline gap-3 border-b border-edge/60 pb-2">
                <span className="w-4 shrink-0 font-data text-[13px] text-slate2">{row.slot}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">{row.esercizio}</p>
                  <p className="mt-0.5 font-data text-[12px] text-slate2">
                    {[row.muscolo, row.serie_reps, row.rir ? `RIR ${row.rir}` : ''].filter(Boolean).join(' · ')}
                  </p>
                  {row.nota && <p className="mt-0.5 text-[12px] text-slate2">{row.nota}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {analisi.conclusione && <p className="text-sm leading-relaxed text-chalk">{analisi.conclusione}</p>}
    </section>
  )
}

type Scelta = 'tua' | 'proposta'

/**
 * Blocco 5 (23/09): scheda finale slot per slot. Default = vincitore del confronto (pari -> la tua).
 * L'ordine resta quello degli slot: niente riordino automatico di una scheda confermata.
 */
function SchedaFinale({ analisi, catalog, seduta, carenze, fase, experience, userId }: {
  analisi: SchedaAnalysis
  catalog: Exercise[]
  seduta: string
  carenze: Muscle[]
  fase: PhaseInfo | null
  experience: 'beginner' | 'intermediate' | 'advanced'
  userId?: string
}) {
  const navigate = useNavigate()
  const { setWorkout, setGenerationConfig } = useWorkout()
  const byId = new Map(catalog.map((e) => [e.id, e]))
  const allenanti = catalog.filter((e) => !e.roles.includes('warmup')).sort((a, b) => a.name.localeCompare(b.name, 'it'))
  const n = Math.max(analisi.tua.length, analisi.proposta.length)
  const [scelte, setScelte] = useState<Scelta[]>(() => Array.from({ length: n }, (_, i) => {
    const vince = analisi.confronto.find((row) => row.slot === i + 1)?.vincitore
    if (vince === 'proposta' && analisi.proposta[i]) return 'proposta'
    return analisi.tua[i] ? 'tua' : 'proposta'
  }))
  const [override, setOverride] = useState<Record<number, string>>({})
  const [nome, setNome] = useState(`${seduta} — mia scheda`)
  const [stato, setStato] = useState<'idle' | 'salvo' | 'salvato' | 'errore'>('idle')
  const [msg, setMsg] = useState('')
  const [salvataId, setSalvataId] = useState<string | null>(null)

  const rigaDi = (i: number): SchedaRiga | undefined => (scelte[i] === 'proposta' ? analisi.proposta[i] : analisi.tua[i]) ?? analisi.tua[i] ?? analisi.proposta[i]
  const righe: RigaScheda[] = Array.from({ length: n }, (_, i) => {
    const r = rigaDi(i)!
    return { exercise_id: override[i] ?? r.exercise_id, sets: r.sets, reps: r.reps, rir: r.rir }
  })
  const mancanti = righeMancanti(righe, byId)

  function costruisci() {
    return componiSchedaSalvabile(righe, catalog, {
      nome, seduta, carenze, phase: fase?.training_phase ?? null, experience, note: fase?.summary,
    })
  }

  async function salva() {
    if (!userId) return
    setStato('salvo')
    try {
      // 26/09: due schede con lo stesso nome non si distinguono: se il nome c'è già si usa
      // "Nome (2)" e lo si dice (si può rinominare in Salvati con ✏️).
      const esistenti = (await elencoSalvati(userId).catch(() => [])).map((x) => x.name)
      const libero = nomeLibero(nome, esistenti)
      setSalvataId(await salvaAllenamento(userId, costruisci(), libero))
      if (libero !== nome.trim()) setNome(libero)
      setStato('salvato')
      setMsg(libero !== nome.trim() ? `Esisteva già una scheda "${nome.trim()}": l'ho salvata come "${libero}". Puoi rinominarla in Salvati con ✏️.` : 'Salvata: la trovi in Salvati → Le mie schede.')
    } catch (e) {
      setStato('errore'); setMsg(e instanceof Error ? e.message : 'Non salvata.')
    }
  }

  function inizia() {
    setGenerationConfig(null)
    setWorkout(costruisci())
    navigate('/allenamento')
  }

  return (
    <section className="mt-10 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4">
      <h2 className="font-display text-lg font-bold uppercase text-white">Scheda finale</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate2">
        Per ogni slot scegli la tua versione o la proposta (preselezionata quella che ha vinto il confronto).
        L'ordine resta questo: se qualcosa va contro le regole ti avviso, ma decidi tu.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" className="rounded-lg border border-edge px-3 py-1.5 text-xs text-slate2" onClick={() => setScelte((old) => old.map((_, i) => (analisi.tua[i] ? 'tua' : 'proposta')))}>Tutta la mia</button>
        <button type="button" className="rounded-lg border border-edge px-3 py-1.5 text-xs text-slate2" onClick={() => setScelte((old) => old.map((_, i) => (analisi.proposta[i] ? 'proposta' : 'tua')))}>Tutta la proposta</button>
      </div>
      <ol className="mt-4 space-y-3">
        {righe.map((riga, i) => {
          const ex = riga.exercise_id ? byId.get(riga.exercise_id) : undefined
          const r = rigaDi(i)
          const stessoMuscolo = ex ? allenanti.filter((e) => e.primary_muscles.some((m) => ex.primary_muscles.includes(m))) : allenanti
          return (
            <li key={i} className="border-b border-edge/60 pb-3">
              <div className="flex items-baseline gap-3">
                <span className="w-4 shrink-0 font-data text-[13px] text-slate2">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex gap-1.5">
                    {(['tua', 'proposta'] as Scelta[]).map((v) => {
                      const disponibile = v === 'tua' ? !!analisi.tua[i] : !!analisi.proposta[i]
                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={!disponibile}
                          aria-pressed={scelte[i] === v}
                          onClick={() => { setScelte((old) => old.map((x, k) => (k === i ? v : x))); setOverride((old) => { const next = { ...old }; delete next[i]; return next }) }}
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] disabled:opacity-30 ${scelte[i] === v ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-200' : 'border-edge text-slate2'}`}
                        >
                          {v === 'tua' ? 'Mia' : 'Proposta'}
                        </button>
                      )
                    })}
                  </div>
                  {r?.testo && <p className="mt-1 text-[12px] text-slate2">Scritto: {r.testo}</p>}
                  <select
                    className={`input mt-1.5 ${ex ? '' : 'border-amber2/60'}`}
                    value={riga.exercise_id && ex ? riga.exercise_id : ''}
                    onChange={(event) => setOverride((old) => ({ ...old, [i]: event.target.value }))}
                  >
                    {!ex && <option value="">Scegli l'esercizio del catalogo…</option>}
                    {(stessoMuscolo.length ? stessoMuscolo : allenanti).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  <p className="mt-1 font-data text-[12px] text-slate2">{riga.sets}×{riga.reps}{riga.rir ? ` · RIR ${riga.rir}` : ''}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {mancanti.length > 0 && (
        <p className="mt-3 text-sm text-amber2">Abbina ancora {mancanti.length === 1 ? 'la riga' : 'le righe'} {mancanti.map((i) => i + 1).join(', ')} a un esercizio del catalogo.</p>
      )}
      <label className="mt-4 block">
        <span className="field-label">Nome della scheda</span>
        <input className="input" value={nome} onChange={(event) => setNome(event.target.value)} />
      </label>
      <div className="mt-4 flex gap-2">
        <button className="btn flex-1" disabled={mancanti.length > 0 || !userId || stato === 'salvo'} onClick={() => { void salva() }}>
          {stato === 'salvo' ? 'Salvataggio…' : 'Salva'}
        </button>
        <button className="flex-1 rounded-xl border border-cyan-500/40 bg-cyan-500/15 py-3 font-display text-sm font-bold uppercase text-cyan-200 disabled:opacity-40" disabled={mancanti.length > 0} onClick={inizia}>
          Inizia subito
        </button>
      </div>
      {msg && <p role="status" className={`mt-3 text-sm ${stato === 'errore' ? 'text-amber2' : 'text-slate2'}`}>{msg}</p>}
      {stato === 'salvato' && salvataId && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-xs font-bold text-red-300" onClick={() => { void eliminaSalvato(salvataId).then(() => { setSalvataId(null); setStato('idle'); setMsg('Scheda eliminata dai Salvati.') }) }}>🗑 Non mi piace, elimina</button>
          <button className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-2.5 text-xs font-bold text-cyan-200" onClick={() => window.location.assign('/analizza')}>✨ Nuova analisi</button>
        </div>
      )}
    </section>
  )
}
