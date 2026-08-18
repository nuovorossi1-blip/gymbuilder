import { useEffect, useState } from 'react'
import { useAuth } from '../features/auth/AuthProvider'
import { loadLocalAiSettings, saveLocalAiSettings, type DeepSeekModel } from '../features/profile/aiSettings'
import { useSettings } from '../features/profile/useSettings'
import { clearNativeCrashLog, isNativeDiagnosticsAvailable, readNativeCrashLog } from '../native/diagnostics'
import { clearJsErrorLog, formatJsErrorLog, readJsErrorLog } from '../lib/jsErrorLog'
import type { Sex } from '../types'

const SEX_LABELS: Record<Sex, string> = {
  female: 'Donna',
  male: 'Uomo',
  other: 'Altro',
  unspecified: 'Non specificato',
}

const DEEPSEEK_MODEL_LABELS: Record<DeepSeekModel, string> = {
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
}

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const { profile, loading, error, saveProfile } = useSettings(user?.id)
  const [form, setForm] = useState({
    display_name: '',
    weight_kg: '',
    height_cm: '',
    age: '',
    sex: 'unspecified' as Sex,
  })
  const [aiForm, setAiForm] = useState(() => loadLocalAiSettings())
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [crashLog, setCrashLog] = useState('')
  const [crashLogCopied, setCrashLogCopied] = useState(false)
  const [jsErrorLog, setJsErrorLog] = useState('')
  const [jsErrorLogCopied, setJsErrorLogCopied] = useState(false)

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
    })
  }, [profile])

  async function save() {
    setStatus('saving')
    const ok = await saveProfile({
      display_name: form.display_name.trim() || null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      age: form.age ? Number(form.age) : null,
      sex: form.sex,
    })
    if (ok) saveLocalAiSettings({ ...aiForm, deepseek_api_key: aiForm.deepseek_api_key.trim() })
    setStatus(ok ? 'saved' : 'error')
  }

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-slate2">Caricamento profilo...</div>
  if (error) return <p role="alert" className="px-5 pt-12 text-amber2">{error}</p>

  return (
    <main className="px-5 pb-8 pt-12">
      <h1 className="font-display text-[2.4rem] font-extrabold uppercase leading-none">Profilo</h1>
      <p className="mt-2 font-data text-xs text-slate2">{user?.email}</p>
      <p className="mt-5 text-sm leading-relaxed text-slate2">
        Qui conservi account, dati fisici usati per le calorie stimate e la chiave AI locale del dispositivo.
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

      <section className="mt-8 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4">
        <h2 className="font-display text-lg font-bold uppercase text-white">DeepSeek AI</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate2">
          La chiave API viene salvata solo in locale su questo dispositivo.
          Viene usata per suggerire configurazioni di allenamento o programma da Genera.
        </p>
        <div className="mt-4 space-y-4">
          <Input
            label="Chiave API DeepSeek"
            value={aiForm.deepseek_api_key}
            type="password"
            onChange={(deepseek_api_key) => setAiForm((old) => ({ ...old, deepseek_api_key }))}
          />
          <label className="block">
            <span className="field-label">Modello</span>
            <select className="input" value={aiForm.deepseek_model} onChange={(event) => setAiForm((old) => ({ ...old, deepseek_model: event.target.value as DeepSeekModel }))}>
              {(Object.keys(DEEPSEEK_MODEL_LABELS) as DeepSeekModel[]).map((model) => (
                <option key={model} value={model}>{DEEPSEEK_MODEL_LABELS[model]}</option>
              ))}
            </select>
          </label>
        </div>
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

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
