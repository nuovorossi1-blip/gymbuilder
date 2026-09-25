import { useEffect, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { useAuth } from '../features/auth/AuthProvider'
import { useSettings } from '../features/profile/useSettings'
import { clearNativeCrashLog, isNativeDiagnosticsAvailable, readNativeCrashLog } from '../native/diagnostics'
import { clearJsErrorLog, formatJsErrorLog, readJsErrorLog } from '../lib/jsErrorLog'
import { loadTimerSettings, saveTimerSettings } from '../features/profile/timerSettings'
import {
  determinaFase, JOB_ACTIVITY_LABELS, JOINT_LABELS, STRESS_LABELS, WEIGHT_TREND_LABELS,
  type JobActivity, type JointIssue, type StressLevel, type WeightTrend,
} from '../engine/nutrition'
import type { Profile, Sex } from '../types'
import { LlmSettings } from '../features/profile/LlmSettings'

const SEX_LABELS: Record<Sex, string> = {
  female: 'Donna',
  male: 'Uomo',
  other: 'Altro',
  unspecified: 'Non specificato',
}

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const { profile, calorieLog, loading, error, saveProfile } = useSettings(user?.id)
  const [form, setForm] = useState({
    display_name: '',
    weight_kg: '',
    height_cm: '',
    age: '',
    sex: 'unspecified' as Sex,
    daily_kcal: '',
    job_activity: '' as JobActivity | '',
    weight_trend: '' as WeightTrend | '',
    sleep_hours: '',
    stress_level: '' as StressLevel | '',
    joint_issues: [] as JointIssue[],
    maintenance_kcal: '',
  })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [crashLog, setCrashLog] = useState('')
  const [crashLogCopied, setCrashLogCopied] = useState(false)
  const [jsErrorLog, setJsErrorLog] = useState('')
  const [jsErrorLogCopied, setJsErrorLogCopied] = useState(false)
  const [timerSettings, setTimerSettings] = useState(() => loadTimerSettings())

  useEffect(() => {
    if (!isNativeDiagnosticsAvailable()) return
    void readNativeCrashLog().then(setCrashLog)
  }, [])

  useEffect(() => {
    setJsErrorLog(formatJsErrorLog(readJsErrorLog()))
  }, [])

  useEffect(() => {
    if (!profile) return
    setForm({
      display_name: profile.display_name ?? '',
      weight_kg: profile.weight_kg?.toString() ?? '',
      height_cm: profile.height_cm?.toString() ?? '',
      age: profile.age?.toString() ?? '',
      sex: profile.sex ?? 'unspecified',
      daily_kcal: profile.daily_kcal?.toString() ?? '',
      job_activity: profile.job_activity ?? '',
      weight_trend: profile.weight_trend ?? '',
      sleep_hours: profile.sleep_hours?.toString() ?? '',
      stress_level: profile.stress_level ?? '',
      joint_issues: profile.joint_issues ?? [],
      maintenance_kcal: profile.maintenance_kcal?.toString() ?? '',
    })
  }, [profile])

  const numero = (value: string) => (value.trim() ? Number(value.replace(',', '.')) : null)
  const bozzaProfilo: Profile = {
    id: profile?.id ?? '',
    display_name: form.display_name.trim() || null,
    weight_kg: numero(form.weight_kg),
    height_cm: numero(form.height_cm),
    age: numero(form.age),
    sex: form.sex,
    daily_kcal: numero(form.daily_kcal),
    job_activity: form.job_activity || null,
    weight_trend: form.weight_trend || null,
    sleep_hours: numero(form.sleep_hours),
    stress_level: form.stress_level || null,
    joint_issues: form.joint_issues,
    // Peso stabile = quelle calorie SONO la tua normocalorica: la si fissa, così resta valida
    // anche quando poi sali o scendi di calorie (la scala si misura da lì).
    maintenance_kcal: form.weight_trend === 'stable' && numero(form.daily_kcal) ? numero(form.daily_kcal) : numero(form.maintenance_kcal),
  }
  // Anteprima dal vivo: la fase si aggiorna mentre si compilano i campi, prima di salvare.
  const fase = determinaFase(bozzaProfilo, calorieLog)

  async function save() {
    setStatus('saving')
    const patch = { ...bozzaProfilo }
    delete (patch as Partial<Profile>).id
    const ok = await saveProfile(patch)
    setStatus(ok ? 'saved' : 'error')
  }

  function toggleJoint(joint: JointIssue) {
    setForm((old) => ({
      ...old,
      joint_issues: old.joint_issues.includes(joint) ? old.joint_issues.filter((item) => item !== joint) : [...old.joint_issues, joint],
    }))
  }

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-slate2">Caricamento profilo...</div>
  if (error) return <p role="alert" className="px-5 pt-12 text-amber2">{error}</p>

  return (
    <main className="px-5 pb-8 pt-8">
      <BackButton />
      <h1 className="mt-2 font-display text-[2.4rem] font-extrabold uppercase leading-none">Profilo</h1>
      <p className="mt-2 font-data text-xs text-slate2">{user?.email}</p>
      <p className="mt-5 text-sm leading-relaxed text-slate2">
        Qui conservi account, dati fisici, alimentazione e recupero: servono a stimare le calorie e a calibrare volume e intensità.
        Split, durata, attrezzatura e preferenze appartengono a Genera.
      </p>

      <div className="mt-8 space-y-5">
        <Input label="Nome / Utente" value={form.display_name} onChange={(display_name) => setForm((old) => ({ ...old, display_name }))} />
        <Input label="Peso (kg)" value={form.weight_kg} type="number" onChange={(weight_kg) => setForm((old) => ({ ...old, weight_kg }))} />
        <Input label="Altezza (cm)" value={form.height_cm} type="number" onChange={(height_cm) => setForm((old) => ({ ...old, height_cm }))} />
        <Input label="Eta" value={form.age} type="number" onChange={(age) => setForm((old) => ({ ...old, age }))} />
        <label className="block">
          <span className="field-label">Sesso</span>
          <select className="input" value={form.sex} onChange={(event) => setForm((old) => ({ ...old, sex: event.target.value as Sex }))}>
            {(Object.keys(SEX_LABELS) as Sex[]).map((sex) => (
              <option key={sex} value={sex}>{SEX_LABELS[sex]}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="mt-8 rounded-2xl border border-edge p-4">
        <h2 className="font-display text-lg font-bold uppercase text-white">Alimentazione e recupero</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate2">
          Da qui l'app capisce se sei in deficit, normocalorica o surplus, e calibra serie, RIR,
          tecniche e ordine degli esercizi. Se sai che il peso scende, resta fermo o sale, indicalo:
          vale più della stima.
        </p>
        <div className="mt-4 space-y-4">
          <Input
            label="Calorie al giorno (kcal)"
            value={form.daily_kcal}
            type="number"
            onChange={(daily_kcal) => setForm((old) => (
              // Se il peso era stabile, le calorie di prima erano la normocalorica: la si conserva e
              // l'andamento torna "non lo so" finché non vedi come risponde il peso alle nuove.
              old.weight_trend === 'stable' && old.daily_kcal && daily_kcal !== old.daily_kcal
                ? { ...old, daily_kcal, maintenance_kcal: old.daily_kcal, weight_trend: '' }
                : { ...old, daily_kcal }
            ))}
          />
          <Input
            label="Normocalorica, se la conosci (kcal)"
            value={form.maintenance_kcal}
            type="number"
            onChange={(maintenance_kcal) => setForm((old) => ({ ...old, maintenance_kcal }))}
          />
          <Select
            label="Che lavoro fai"
            value={form.job_activity}
            options={JOB_ACTIVITY_LABELS}
            onChange={(job_activity) => setForm((old) => ({ ...old, job_activity: job_activity as JobActivity | '' }))}
          />
          <Select
            label="Andamento del peso"
            value={form.weight_trend}
            options={WEIGHT_TREND_LABELS}
            emptyLabel="Non lo so"
            onChange={(weight_trend) => setForm((old) => ({ ...old, weight_trend: weight_trend as WeightTrend | '' }))}
          />
          <Input label="Ore di sonno per notte" value={form.sleep_hours} type="number" onChange={(sleep_hours) => setForm((old) => ({ ...old, sleep_hours }))} />
          <Select
            label="Stress percepito"
            value={form.stress_level}
            options={STRESS_LABELS}
            onChange={(stress_level) => setForm((old) => ({ ...old, stress_level: stress_level as StressLevel | '' }))}
          />
          <fieldset>
            <legend className="field-label">Fastidi articolari</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(JOINT_LABELS) as JointIssue[]).map((joint) => {
                const on = form.joint_issues.includes(joint)
                return (
                  <button
                    key={joint}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleJoint(joint)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-amber2/60 bg-amber2/15 text-amber2' : 'border-edge text-slate2'}`}
                  >
                    {JOINT_LABELS[joint]}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate2">
              Il motore evita i movimenti più stressanti per quell'articolazione e preferisce macchine e cavi.
            </p>
          </fieldset>
        </div>
        <p className="mt-4 rounded-xl border border-edge bg-steel/50 p-3.5 text-sm leading-relaxed text-chalk" role="status">
          {fase
            ? fase.summary
            : 'Fase non ancora ricavabile: servono peso, altezza, età, lavoro e calorie, oppure l’andamento del peso.'}
        </p>
        {calorieLog.length > 0 && (
          <div className="mt-4">
            <p className="field-label">Ultimi cambi di calorie</p>
            <ul className="space-y-1 font-data text-[12px] text-slate2">
              {calorieLog.slice(-5).reverse().map((entry) => (
                <li key={entry.created_at} className="flex justify-between border-b border-edge/60 pb-1">
                  <span>{new Date(entry.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                  <span className="text-chalk">{entry.kcal} kcal</span>
                  <span>gradino {entry.step > 0 ? '+' : ''}{entry.step}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-slate2">
              Le calorie guidano, il volume segue: dopo un cambio la scheda resta com'è per 7 giorni, poi si
              sposta di un gradino a settimana, sia in salita sia in discesa.
            </p>
          </div>
        )}
      </section>

      <LlmSettings userId={user?.id} />

      <section className="mt-8 rounded-2xl border border-edge p-4">
        <h2 className="font-display text-lg font-bold uppercase text-white">Notifiche Timer</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate2">
          Vale per tutti gli allenamenti: si imposta una volta sola qui, non va rifatto ogni volta.
        </p>
        <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-edge bg-steel/50 p-3.5">
          <span className="text-sm text-chalk">Vibrazione a fine round/recupero</span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-cyan-500"
            checked={timerSettings.vibration}
            onChange={(event) => {
              const next = { ...timerSettings, vibration: event.target.checked }
              setTimerSettings(next)
              saveTimerSettings(next)
            }}
          />
        </label>
      </section>

      <button className="btn mt-8" disabled={status === 'saving'} onClick={save}>
        {status === 'saving' ? 'Salvataggio...' : 'Salva'}
      </button>
      <p className={`mt-3 text-center text-sm ${status === 'error' ? 'text-amber2' : 'text-slate2'}`} role="status">
        {status === 'saved' ? 'Profilo salvato.' : status === 'error' ? 'Salvataggio non riuscito.' : ''}
      </p>
      {isNativeDiagnosticsAvailable() && (
        <section className="mt-8 rounded-2xl border border-edge p-4">
          <h2 className="font-display text-lg font-bold uppercase text-white">Diagnostica crash</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate2">
            {crashLog
              ? "Registrati crash dell'app su questo dispositivo. Copiali e incollali in chat per farli analizzare."
              : 'Nessun crash registrato su questo dispositivo.'}
          </p>
          {crashLog && (
            <>
              <textarea readOnly className="input mt-3 min-h-40 font-data text-xs" value={crashLog} />
              <div className="mt-3 flex gap-2">
                <button
                  className="flex-1 rounded-xl border border-cyan-500/40 bg-cyan-500/15 py-2.5 font-data text-xs uppercase tracking-wider text-cyan-200"
                  onClick={async () => {
                    await navigator.clipboard.writeText(crashLog)
                    setCrashLogCopied(true)
                    setTimeout(() => setCrashLogCopied(false), 2000)
                  }}
                >
                  {crashLogCopied ? 'Copiato!' : 'Copia'}
                </button>
                <button
                  className="flex-1 rounded-xl border border-edge py-2.5 font-data text-xs uppercase tracking-wider text-slate2"
                  onClick={async () => { await clearNativeCrashLog(); setCrashLog('') }}
                >
                  Cancella log
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-edge p-4">
        <h2 className="font-display text-lg font-bold uppercase text-white">Errori JavaScript</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate2">
          {jsErrorLog
            ? 'Errori imprevisti dell’app su questo dispositivo. Copiali e incollali in chat per farli correggere.'
            : 'Nessun errore registrato su questo dispositivo.'}
        </p>
        {jsErrorLog && (
          <>
            <textarea readOnly className="input mt-3 min-h-40 font-data text-xs" value={jsErrorLog} />
            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 rounded-xl border border-cyan-500/40 bg-cyan-500/15 py-2.5 font-data text-xs uppercase tracking-wider text-cyan-200"
                onClick={async () => {
                  await navigator.clipboard.writeText(jsErrorLog)
                  setJsErrorLogCopied(true)
                  setTimeout(() => setJsErrorLogCopied(false), 2000)
                }}
              >
                {jsErrorLogCopied ? 'Copiato!' : 'Copia'}
              </button>
              <button
                className="flex-1 rounded-xl border border-edge py-2.5 font-data text-xs uppercase tracking-wider text-slate2"
                onClick={() => { clearJsErrorLog(); setJsErrorLog('') }}
              >
                Cancella log
              </button>
            </div>
          </>
        )}
      </section>

      <button className="mt-8 w-full rounded-xl border border-edge py-3.5 font-data text-xs uppercase tracking-wider text-slate2" onClick={signOut}>
        Disconnetti
      </button>
    </main>
  )
}

function Select({ label, value, options, onChange, emptyLabel = 'Non indicato' }: {
  label: string
  value: string
  options: Record<string, string>
  onChange: (value: string) => void
  emptyLabel?: string
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{emptyLabel}</option>
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>{text}</option>
        ))}
      </select>
    </label>
  )
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
