import { useState } from 'react'
import { useAuth } from './AuthProvider'

/** Pagina aperta dal link "Password dimenticata?" (24/09): scegli la nuova password ed entri. */
export default function NewPasswordPage() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = password.length >= 6 && password === conferma

  async function salva() {
    setBusy(true); setError(null)
    try { await updatePassword(password) } catch (e) { setError(e instanceof Error ? e.message : 'Qualcosa non ha funzionato.') } finally { setBusy(false) }
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 py-16">
      <p className="eyebrow mb-3">Recupero password</p>
      <h1 className="font-display font-extrabold text-[2.4rem] leading-[0.95] uppercase">Nuova password</h1>
      <div className="mt-8 space-y-4">
        <label className="block">
          <span className="field-label">Nuova password</span>
          <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="almeno 6 caratteri" />
        </label>
        <label className="block">
          <span className="field-label">Ripeti la password</span>
          <input className="input" type="password" autoComplete="new-password" value={conferma} onChange={(e) => setConferma(e.target.value)} />
        </label>
        {conferma && password !== conferma && <p className="text-sm text-amber2">Le due password non coincidono.</p>}
        {error && <p className="text-sm text-amber2" role="alert">{error}</p>}
        <button className="btn" disabled={!valid || busy} onClick={() => { void salva() }}>{busy ? 'Un attimo…' : 'Salva e accedi'}</button>
      </div>
    </main>
  )
}
