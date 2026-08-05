import { useEffect, useState } from 'react'
import { useAuth } from '../features/auth/AuthProvider'
import { useSettings } from '../features/profile/useSettings'
import {
  DURATIONS,
  EQUIPMENT_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  MUSCLE_LABELS,
  type Equipment,
  type Experience,
  type Goal,
  type Muscle,
} from '../types'

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const { profile, settings, loading, error, saveSettings, saveName } = useSettings(user?.id)

  const [nome, setNome] = useState('')
  const [stato, setStato] = useState<'fermo' | 'salvo' | 'salvato' | 'errore'>('fermo')

  useEffect(() => {
    if (profile?.display_name) setNome(profile.display_name)
  }, [profile?.display_name])

  async function applica(fn: () => Promise<boolean>) {
    setStato('salvo')
    const ok = await fn()
    setStato(ok ? 'salvato' : 'errore')
    if (ok) setTimeout(() => setStato('fermo'), 1600)
  }

  if (loading) {
    return (
      <div className="px-5 pt-12 space-y-3">
        <div className="h-8 w-40 animate-pulse rounded bg-steel" />
        <div className="h-28 animate-pulse rounded-xl bg-steel" />
        <div className="h-28 animate-pulse rounded-xl bg-steel" />
      </div>
    )
  }

  if (error || !settings) {
    return (
      <div className="px-5 pt-12">
        <h1 className="font-display font-extrabold uppercase text-3xl tracking-tight">Profilo</h1>
        <p className="mt-4 text-amber2 text-[15px]">
          {error ?? 'Le tue impostazioni non sono ancora disponibili.'}
        </p>
        <button className="btn mt-6" onClick={() => location.reload()}>Riprova</button>
      </div>
    )
  }

  return (
    <div className="px-5 pt-12 space-y-8">
      <div>
        <h1 className="font-display font-extrabold uppercase text-[2.4rem] leading-none tracking-tight">
          Profilo
        </h1>
        <p className="mt-2 font-data text-[12px] text-slate2">{user?.email}</p>
      </div>

      <section>
        <label className="field-label" htmlFor="nome">Come ti chiami</label>
        <div className="flex gap-2">
          <input
            id="nome"
            className="input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Il tuo nome"
          />
          <button
            className="shrink-0 rounded-xl border border-edge bg-steel px-4 font-data text-[11px] uppercase tracking-[0.14em] text-chalk active:bg-edge"
            onClick={() => applica(() => saveName(nome.trim()))}
            disabled={!nome.trim() || nome.trim() === profile?.display_name}
          >
            Salva
          </button>
        </div>
      </section>

      <Gruppo titolo="Esperienza">
        <Scelte
          opzioni={Object.keys(EXPERIENCE_LABELS) as Experience[]}
          etichette={EXPERIENCE_LABELS}
          attiva={settings.experience}
          onPick={(v) => applica(() => saveSettings({ experience: v }))}
        />
      </Gruppo>

      <Gruppo titolo="Obiettivo principale">
        <Scelte
          opzioni={Object.keys(GOAL_LABELS) as Goal[]}
          etichette={GOAL_LABELS}
          attiva={settings.primary_goal}
          onPick={(v) => applica(() => saveSettings({ primary_goal: v }))}
        />
      </Gruppo>

      <Gruppo titolo="Durata abituale">
        <div className="grid grid-cols-5 gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              className={`chip font-data ${settings.default_duration === d ? 'chip-on' : ''}`}
              onClick={() => applica(() => saveSettings({ default_duration: d }))}
              aria-pressed={settings.default_duration === d}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-slate2">Minuti a sessione.</p>
      </Gruppo>

      <Gruppo titolo="Quante volte a settimana">
        <div className="grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              className={`chip font-data !px-0 text-center ${
                settings.training_frequency === n ? 'chip-on' : ''
              }`}
              onClick={() => applica(() => saveSettings({ training_frequency: n }))}
              aria-pressed={settings.training_frequency === n}
            >
              {n}
            </button>
          ))}
        </div>
      </Gruppo>

      <Gruppo titolo="Attrezzatura disponibile">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((e) => (
            <button
              key={e}
              className={`chip text-left ${settings.equipment === e ? 'chip-on' : ''}`}
              onClick={() => applica(() => saveSettings({ equipment: e }))}
              aria-pressed={settings.equipment === e}
            >
              {EQUIPMENT_LABELS[e]}
            </button>
          ))}
        </div>
      </Gruppo>

      <Gruppo titolo="Muscoli da recuperare">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MUSCLE_LABELS) as Muscle[]).map((m) => {
            const on = settings.priority_muscles.includes(m)
            return (
              <button
                key={m}
                className={`chip ${on ? 'chip-on' : ''}`}
                aria-pressed={on}
                onClick={() =>
                  applica(() =>
                    saveSettings({
                      priority_muscles: on
                        ? settings.priority_muscles.filter((x) => x !== m)
                        : [...settings.priority_muscles, m],
                    })
                  )
                }
              >
                {MUSCLE_LABELS[m]}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[12px] text-slate2">
          Puoi sceglierne più di uno. Il generatore ridistribuirà il volume su questi,
          senza allungare la sessione.
        </p>
      </Gruppo>

      <button
        className="w-full rounded-xl border border-edge py-3.5 font-data text-[11px] uppercase tracking-[0.16em] text-slate2 active:bg-steel"
        onClick={signOut}
      >
        Esci
      </button>

      {/* Stato del salvataggio */}
      <div
        className="fixed bottom-24 inset-x-0 flex justify-center pointer-events-none"
        role="status"
        aria-live="polite"
      >
        {stato === 'salvato' && (
          <span className="rounded-full bg-chalk px-4 py-1.5 font-data text-[11px] uppercase tracking-[0.14em] text-ink">
            Salvato
          </span>
        )}
        {stato === 'errore' && (
          <span className="rounded-full bg-amber2 px-4 py-1.5 font-data text-[11px] uppercase tracking-[0.14em] text-ink">
            Non salvato, riprova
          </span>
        )}
      </div>
    </div>
  )
}

function Gruppo({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="field-label">{titolo}</h2>
      {children}
    </section>
  )
}

function Scelte<T extends string>({
  opzioni,
  etichette,
  attiva,
  onPick,
}: {
  opzioni: T[]
  etichette: Record<T, string>
  attiva: T
  onPick: (v: T) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {opzioni.map((o) => (
        <button
          key={o}
          className={`chip text-left ${attiva === o ? 'chip-on' : ''}`}
          aria-pressed={attiva === o}
          onClick={() => onPick(o)}
        >
          {etichette[o]}
        </button>
      ))}
    </div>
  )
}
