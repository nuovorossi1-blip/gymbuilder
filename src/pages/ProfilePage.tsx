import { useEffect, useState } from 'react'
import { useAuth } from '../features/auth/AuthProvider'
import { useSettings } from '../features/profile/useSettings'
import type { Sex } from '../types'

const SEX_LABELS: Record<Sex, string> = { female: 'Donna', male: 'Uomo', other: 'Altro', unspecified: 'Non specificato' }

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const { profile, loading, error, saveProfile } = useSettings(user?.id)
  const [form, setForm] = useState({ display_name: '', weight_kg: '', height_cm: '', age: '', sex: 'unspecified' as Sex })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (!profile) return
    setForm({
      display_name: profile.display_name ?? '', weight_kg: profile.weight_kg?.toString() ?? '',
      height_cm: profile.height_cm?.toString() ?? '', age: profile.age?.toString() ?? '',
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
    setStatus(ok ? 'saved' : 'error')
  }

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-slate2">Caricamento profilo…</div>
  if (error) return <p role="alert" className="px-5 pt-12 text-amber2">{error}</p>
  return (
    <main className="px-5 pb-8 pt-12">
      <h1 className="font-display text-[2.4rem] font-extrabold uppercase leading-none">Profilo</h1>
      <p className="mt-2 font-data text-xs text-slate2">{user?.email}</p>
      <p className="mt-5 text-sm leading-relaxed text-slate2">Qui conservi solo account e dati fisici usati per le calorie stimate. Split, durata, attrezzatura e preferenze appartengono a Genera.</p>
      <div className="mt-8 space-y-5">
        <Input label="Nome / Utente" value={form.display_name} onChange={(display_name) => setForm((old) => ({ ...old, display_name }))} />
        <Input label="Peso (kg)" value={form.weight_kg} type="number" onChange={(weight_kg) => setForm((old) => ({ ...old, weight_kg }))} />
        <Input label="Altezza (cm)" value={form.height_cm} type="number" onChange={(height_cm) => setForm((old) => ({ ...old, height_cm }))} />
        <Input label="Età" value={form.age} type="number" onChange={(age) => setForm((old) => ({ ...old, age }))} />
        <label className="block"><span className="field-label">Sesso</span><select className="input" value={form.sex} onChange={(event) => setForm((old) => ({ ...old, sex: event.target.value as Sex }))}>{(Object.keys(SEX_LABELS) as Sex[]).map((sex) => <option key={sex} value={sex}>{SEX_LABELS[sex]}</option>)}</select></label>
      </div>
      <button className="btn mt-8" disabled={status === 'saving'} onClick={save}>{status === 'saving' ? 'Salvataggio…' : 'Salva'}</button>
      <p className={`mt-3 text-center text-sm ${status === 'error' ? 'text-amber2' : 'text-slate2'}`} role="status">{status === 'saved' ? 'Profilo salvato.' : status === 'error' ? 'Salvataggio non riuscito.' : ''}</p>
      <button className="mt-8 w-full rounded-xl border border-edge py-3.5 font-data text-xs uppercase tracking-wider text-slate2" onClick={signOut}>Disconnetti</button>
    </main>
  )
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block"><span className="field-label">{label}</span><input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}
