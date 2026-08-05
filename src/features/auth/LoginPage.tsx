import { useState } from 'react'
import { useAuth } from './AuthProvider'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'in') {
        await signIn(email.trim(), password)
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password)
        if (needsConfirmation) {
          setNotice('Ti abbiamo mandato una email. Aprila per confermare l\u2019account.')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Qualcosa non ha funzionato.')
    } finally {
      setBusy(false)
    }
  }

  const valid = email.includes('@') && password.length >= 6

  return (
    <main className="min-h-dvh flex flex-col justify-between px-6 pt-16 pb-10">
      <div>
        <p className="eyebrow mb-3">Allenamenti su misura</p>
        <h1 className="font-display font-extrabold text-[3.25rem] leading-[0.9] uppercase tracking-tight">
          Gym
          <br />
          Builder
        </h1>
        <p className="mt-5 text-slate2 text-[15px] leading-relaxed max-w-xs">
          Dici cosa hai a disposizione e quanto tempo hai. Al resto pensa lui.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2 mb-5" role="tablist">
          {(['in', 'up'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m)
                setError(null)
                setNotice(null)
              }}
              className={`flex-1 rounded-lg py-2.5 font-data text-[11px] uppercase tracking-[0.16em] transition-colors ${
                mode === m ? 'bg-chalk text-ink' : 'bg-steel text-slate2 border border-edge'
              }`}
            >
              {m === 'in' ? 'Accedi' : 'Registrati'}
            </button>
          ))}
        </div>

        <div>
          <label className="field-label" htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@esempio.it"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="almeno 6 caratteri"
          />
        </div>

        {error && (
          <p className="text-sm text-amber2 pt-1" role="alert">{error}</p>
        )}
        {notice && (
          <p className="text-sm text-chalk pt-1" role="status">{notice}</p>
        )}

        <button className="btn !mt-6" disabled={!valid || busy} onClick={submit}>
          {busy ? 'Un attimo…' : mode === 'in' ? 'Accedi' : 'Crea account'}
        </button>
      </div>
    </main>
  )
}
