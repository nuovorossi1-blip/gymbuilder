import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { determinaFase, patchCambioCalorie } from '../engine/nutrition'
import { analizzaStallo, gradinoDiOggi } from '../engine/stallo'
import { useAuth } from '../features/auth/AuthProvider'
import { useSettings } from '../features/profile/useSettings'

/**
 * Blocco 3 (23/09): diario peso/girovita, riconoscimento dello stallo e scala proposta.
 * L'app suggerisce, Rossi conferma: niente cambia alle calorie senza un tocco esplicito.
 */
export default function BodyLog() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile, calorieLog, bodyLog, addBodyEntry, saveProfile } = useSettings(user?.id)
  const [peso, setPeso] = useState('')
  const [vita, setVita] = useState('')
  const [piatto, setPiatto] = useState(false)
  const [stato, setStato] = useState<'idle' | 'salvo' | 'errore'>('idle')
  const fase = determinaFase(profile, calorieLog)
  const piano = profile?.ladder_plan ?? null
  const oggi = gradinoDiOggi(piano)
  const ultimoCambio = calorieLog.length ? calorieLog[calorieLog.length - 1].created_at : null
  const stallo = !oggi ? analizzaStallo(bodyLog, fase?.calorie_step ?? null, profile?.daily_kcal ?? null, ultimoCambio) : null

  const numero = (value: string) => (value.trim() ? Number(value.replace(',', '.')) : null)

  async function registra() {
    const w = numero(peso)
    if (!w) return
    setStato('salvo')
    const ok = await addBodyEntry({ weight_kg: w, waist_cm: numero(vita), feels_flat: piatto })
    setStato(ok ? 'idle' : 'errore')
    if (ok) { setPeso(''); setVita(''); setPiatto(false) }
  }

  async function accettaScala() {
    if (!stallo || !profile) return
    const primo = stallo.piano.gradini[0].kcal
    await saveProfile({ ...patchCambioCalorie(profile, primo), ladder_plan: { ...stallo.piano, started_at: new Date().toISOString() } })
  }

  async function applicaGradino() {
    if (!oggi || !profile) return
    await saveProfile(patchCambioCalorie(profile, oggi.kcal))
  }

  const ultimi = bodyLog.slice(-12)
  const min = Math.min(...ultimi.map((e) => e.weight_kg))
  const max = Math.max(...ultimi.map((e) => e.weight_kg))
  const punti = ultimi.map((e, i) => {
    const x = ultimi.length > 1 ? (i / (ultimi.length - 1)) * 300 : 150
    const y = max > min ? 70 - ((e.weight_kg - min) / (max - min)) * 60 : 40
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <main className="px-5 pb-28 pt-12">
      <button className="font-data text-xs text-slate2" onClick={() => navigate('/')}>← Indietro</button>
      <h1 className="mt-3 font-display text-[2.2rem] font-extrabold uppercase leading-none">Peso e girovita</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate2">
        Una misura a settimana, alla stessa ora. Dopo 2 settimane l'app capisce se sei in stallo e ti propone
        una scala di calorie da 250 kcal: decidi tu se seguirla.
      </p>

      <p className="mt-5 rounded-xl border border-edge bg-steel/50 p-3.5 text-sm leading-relaxed text-chalk">
        {fase ? fase.summary : 'Fase non ancora nota: compila "Alimentazione e recupero" nel Profilo.'}
      </p>

      {oggi && piano && (
        <section className="mt-5 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4" aria-live="polite">
          <h2 className="font-display text-sm font-bold uppercase text-white">
            {piano.tipo === 'mini_surplus' ? 'Mini surplus' : 'Mini cut'} in corso · gradino {oggi.indice} di {oggi.totale}
          </h2>
          <p className="mt-1 text-sm text-chalk">Oggi: <span className="font-data">{oggi.kcal} kcal</span>, ancora {oggi.fineTra} {oggi.fineTra === 1 ? 'giorno' : 'giorni'}.</p>
          <p className="mt-1 font-data text-[12px] text-slate2">{piano.gradini.map((g) => g.kcal).join(' → ')}</p>
          <div className="mt-3 flex gap-2">
            {profile?.daily_kcal !== oggi.kcal && (
              <button className="btn flex-1" onClick={() => { void applicaGradino() }}>Aggiorna le calorie a {oggi.kcal}</button>
            )}
            <button className="rounded-xl border border-edge px-3 py-2 text-xs text-slate2" onClick={() => { void saveProfile({ ladder_plan: null }) }}>Interrompi</button>
          </div>
        </section>
      )}

      {stallo && (
        <section className="mt-5 rounded-2xl border border-amber2/40 bg-amber2/10 p-4" aria-live="polite">
          <h2 className="font-display text-sm font-bold uppercase text-amber2">Proposta: {stallo.tipo === 'mini_surplus' ? 'mini surplus' : 'mini cut'}</h2>
          <p className="mt-1 text-sm text-chalk">{stallo.motivo}.</p>
          <p className="mt-2 font-data text-[13px] text-chalk">{profile?.daily_kcal} → {stallo.piano.gradini.map((g) => g.kcal).join(' → ')} kcal</p>
          <p className="mt-1 text-xs leading-relaxed text-slate2">
            Un gradino ogni 7 giorni. Le calorie cambiano col gradino, il volume della scheda le segue da solo
            una settimana dopo.
          </p>
          <button className="btn mt-3" onClick={() => { void accettaScala() }}>Accetta la scala</button>
        </section>
      )}

      <section className="mt-6 space-y-4">
        <label className="block">
          <span className="field-label">Peso (kg)</span>
          <input className="input" inputMode="decimal" value={peso} onChange={(event) => setPeso(event.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">Girovita (cm, facoltativo)</span>
          <input className="input" inputMode="decimal" value={vita} onChange={(event) => setVita(event.target.value)} />
        </label>
        <label className="flex items-center gap-3 text-sm text-chalk">
          <input type="checkbox" checked={piatto} onChange={(event) => setPiatto(event.target.checked)} className="h-5 w-5" />
          Mi sento piatto o la forza sta calando
        </label>
        <button className="btn" disabled={!numero(peso) || stato === 'salvo'} onClick={() => { void registra() }}>
          {stato === 'salvo' ? 'Salvataggio…' : 'Registra'}
        </button>
        {stato === 'errore' && <p role="alert" className="text-sm text-amber2">Non salvato. Riprova.</p>}
      </section>

      {ultimi.length > 0 && (
        <section className="mt-8">
          <h2 className="field-label">Andamento</h2>
          {ultimi.length > 1 && (
            <svg viewBox="0 0 300 80" className="h-24 w-full" role="img" aria-label={`Peso da ${ultimi[0].weight_kg} a ${ultimi[ultimi.length - 1].weight_kg} kg`}>
              <polyline points={punti} fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400" />
            </svg>
          )}
          <ul className="mt-2 space-y-1 font-data text-[12px] text-slate2">
            {ultimi.slice().reverse().slice(0, 6).map((e) => (
              <li key={e.created_at} className="flex justify-between border-b border-edge/60 pb-1">
                <span>{new Date(e.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                <span className="text-chalk">{e.weight_kg} kg</span>
                <span>{e.waist_cm ? `${e.waist_cm} cm` : '—'}{e.feels_flat ? ' · piatto' : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
