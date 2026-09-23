import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { determinaFase, PHASE_LABELS } from '../engine/nutrition'
import { useAuth } from '../features/auth/AuthProvider'
import { loadLocalAiSettings } from '../features/profile/aiSettings'
import { useSettings } from '../features/profile/useSettings'
import { analyzeSchedaWithDeepSeek, type SchedaAnalysis, type SchedaCheck } from '../lib/deepseek'
import { MUSCLE_LABELS, type Muscle } from '../types'

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
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile, settings } = useSettings(user?.id)
  const [scheda, setScheda] = useState('')
  const [seduta, setSeduta] = useState('Push')
  const [carenze, setCarenze] = useState<Muscle[]>([])
  const [stato, setStato] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errore, setErrore] = useState('')
  const [analisi, setAnalisi] = useState<SchedaAnalysis | null>(null)
  const fase = determinaFase(profile)

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
        programmazione: {
          fase: fase?.phase ?? null,
          fase_per_volume: fase?.training_phase ?? null,
          sintesi_fase: fase?.summary ?? null,
          recupero_limitato: fase?.recovery_limited ?? false,
          fastidi_articolari: profile?.joint_issues ?? [],
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
      <button className="font-data text-xs text-slate2" onClick={() => navigate('/')}>← Indietro</button>
      <h1 className="mt-3 font-display text-[2.2rem] font-extrabold uppercase leading-none">Analizza la mia scheda</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate2">
        Scrivi i tuoi esercizi nell'ordine in cui li fai, uno per riga. Prima analizzo la tua versione,
        poi la confronto con la mia e ti propongo un ibrido.
      </p>

      <p className="mt-5 rounded-xl border border-edge bg-steel/50 p-3.5 text-sm leading-relaxed text-chalk">
        {fase
          ? `Fase: ${PHASE_LABELS[fase.phase]}. ${fase.summary}`
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
