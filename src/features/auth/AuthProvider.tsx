import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

interface AuthValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  /** Recupero password (24/09): true quando l'utente arriva dal link dell'email. */
  recovering: boolean
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

/** Dove porta il link dell'email: il sito vero anche quando si parte dall'app Android. */
function redirectRecupero(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return origin.startsWith('http') ? origin : 'https://gymbuilder-lemon.vercel.app'
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    // getSession legge prima la sessione persistita. Un errore di rete non deve
    // lasciare l'interfaccia bloccata sul caricamento durante un allenamento.
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => undefined)
      .finally(() => setLoading(false))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // Il link dell'email apre l'app con una sessione "di recupero": prima di tutto si chiede
      // la nuova password, poi si entra normalmente.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(traduciErrore(error.message))
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(traduciErrore(error.message))
    // Se la conferma via email e' attiva, la sessione non arriva subito.
    return { needsConfirmation: !data.session }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectRecupero() })
    if (error) throw new Error(traduciErrore(error.message))
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(traduciErrore(error.message))
    setRecovering(false)
  }

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, session, loading, signIn, signUp, signOut, recovering, requestPasswordReset, updatePassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth va usato dentro AuthProvider')
  return ctx
}

// Messaggi comprensibili invece dell'errore tecnico grezzo (specifica sez. 79)
function traduciErrore(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o password non corretti.'
  if (m.includes('already registered')) return 'Questa email è già registrata. Prova ad accedere.'
  if (m.includes('password should be')) return 'La password deve avere almeno 6 caratteri.'
  if (m.includes('unable to validate email')) return "L'indirizzo email non sembra valido."
  if (m.includes('email rate limit') || m.includes('rate limit')) return 'Troppi tentativi. Riprova fra qualche minuto.'
  if (m.includes('should be different')) return 'La nuova password deve essere diversa da quella vecchia.'
  if (m.includes('auth session missing') || m.includes('expired')) return 'Il link è scaduto: chiedine uno nuovo da "Password dimenticata?".'
  return 'Qualcosa non ha funzionato. Riprova fra un momento.'
}
