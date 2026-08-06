import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useSettings } from '../features/profile/useSettings'
import { useWorkout } from '../features/workout/WorkoutContext'
import { caricaCatalogo, volumeSettimanaleUtente } from '../lib/api'
import { generaBodybuilding } from '../generators/bodybuilding'
import { generaForza, SPLIT_FORZA } from '../generators/strength'
import { generaCrossFit } from '../generators/crossfit'
import {
  DURATIONS, EQUIPMENT_LABELS, GOAL_LABELS, INTENSITY_LABELS, MODES_IN_ARRIVO,
  MODE_LABELS, MUSCLE_LABELS, SPLIT_GROUPS, SPLIT_HINTS, SPLIT_LABELS,
  type Equipment, type Exercise, type Goal, type Intensity, type Mode, type Muscle, type Split,
} from '../types'

const SPLIT_GROUPS_FORZA = [{ label: 'Split', splits: SPLIT_FORZA }]

export default function Create() {
  const { user } = useAuth()
  const { profile, settings, loading } = useSettings(user?.id)
  const { setWorkout } = useWorkout()
  const naviga = useNavigate()

  const [catalogo, setCatalogo] = useState<Exercise[] | null>(null)
  const [erroreCatalogo, setErroreCatalogo] = useState<string | null>(null)
  const [volumeSettimanale, setVolumeSettimanale] = useState<Record<Muscle, number> | undefined>()

  // Scelte di oggi. Partono dal profilo ma valgono solo per questa sessione (sez. 7).
  const [mode, setMode] = useState<Mode>('bodybuilding')
  const [split, setSplit] = useState<Split>('push')
  const [goal, setGoal] = useState<Goal | null>(null)
  const [durata, setDurata] = useState<number | null>(null)
  const [attrezzi, setAttrezzi] = useState<Equipment | null>(null)
  const [muscoli, setMuscoli] = useState<Muscle[] | null>(null)
  const [intensita, setIntensita] = useState<Intensity | null>(null)
  const [avanzate, setAvanzate] = useState(false)

  // Cambiando modalità, si torna a uno split valido per quella modalità (sez. 84: Forza non usa Bro Split/Front/Back).
  function cambiaModalita(m: Mode) {
    setMode(m)
    if (m === 'strength' && !SPLIT_FORZA.includes(split)) setSplit('push')
  }

  useEffect(() => {
    caricaCatalogo().then(setCatalogo).catch((e) => setErroreCatalogo(e.message))
  }, [])

  useEffect(() => {
    if (!catalogo || !user) return
    volumeSettimanaleUtente(user.id, catalogo).then(setVolumeSettimanale)
  }, [catalogo, user])

  // Valori effettivi: la scelta di oggi se c'è, altrimenti il profilo
  const eff = useMemo(() => {
    if (!settings) return null
    return {
      goal: goal ?? settings.primary_goal,
      durata: durata ?? settings.default_duration,
      attrezzi: attrezzi ?? settings.equipment,
      muscoli: muscoli ?? settings.priority_muscles,
      intensita: intensita ?? settings.default_intensity,
    }
  }, [settings, goal, durata, attrezzi, muscoli, intensita])

  function genera() {
    if (!catalogo || !eff || !settings) return

    const w =
      mode === 'crossfit'
        ? generaCrossFit(catalogo, {
            experience: settings.experience,
            equipment: eff.attrezzi,
            duration_min: eff.durata,
            priority_muscles: eff.muscoli,
            excluded_exercises: settings.excluded_exercises,
            preferred_exercises: settings.favorite_exercises,
            intensity: eff.intensita,
            weight_kg: settings.weight_kg,
            seed: Date.now() % 100000,
          })
        : mode === 'strength'
        ? generaForza(catalogo, {
            split,
            experience: settings.experience,
            equipment: eff.attrezzi,
            duration_min: eff.durata,
            priority_muscles: eff.muscoli,
            excluded_exercises: settings.excluded_exercises,
            preferred_exercises: settings.favorite_exercises,
            weekly_volume: volumeSettimanale,
            intensity: eff.intensita,
            weight_kg: settings.weight_kg,
            seed: Date.now() % 100000,
          })
        : generaBodybuilding(catalogo, {
            split,
            goal: eff.goal,
            experience: settings.experience,
            equipment: eff.attrezzi,
            duration_min: eff.durata,
            priority_muscles: eff.muscoli,
            excluded_exercises: settings.excluded_exercises,
            preferred_exercises: settings.favorite_exercises,
            weekly_volume: volumeSettimanale,
            intensity: eff.intensita,
            weight_kg: settings.weight_kg,
            seed: Date.now() % 100000,
          })
    setWorkout(w)
    naviga('/allenamento')
  }

  const pronto = !!catalogo && !!eff && !loading

  return (
    <div className="px-5 pt-12 pb-4">
      <p className="eyebrow mb-3">
        {profile?.display_name ? `Ciao ${profile.display_name.split(' ')[0]}` : 'Bentornato'}
      </p>
      <h1 className="font-display font-extrabold uppercase leading-[0.88] tracking-tight text-[2.6rem]">
        Cosa alleni
        <br />
        oggi?
      </h1>

      {/* 0. Modalità (sez. 84: quelle non costruite si vedono ma non si finge che esistano) */}
      <p className="field-label mt-8">Modalità</p>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => cambiaModalita(m)}
            aria-pressed={mode === m}
            className={`chip text-left ${mode === m ? 'chip-on' : ''}`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {MODES_IN_ARRIVO.map((m) => (
          <div
            key={m.label}
            className="chip cursor-not-allowed text-left opacity-40"
            aria-disabled="true"
            title="In arrivo, non ancora costruita"
          >
            <span className="block">{m.label}</span>
            <span className="block text-[11px] text-slate2">{m.hint}</span>
          </div>
        ))}
      </div>

      {/* 1. Gruppo muscolare, raggruppato per tipo di split (sez. 15/71). CrossFit Standard non ha uno split: struttura fissa Forza/Skill + Metcon. */}
      {mode === 'crossfit' ? (
        <div className="mt-8 slab">
          <span className="block font-display font-bold uppercase tracking-wide text-[17px]">
            Forza/Skill + Metcon
          </span>
          <span className="block text-[13px] text-slate2 mt-0.5">
            Struttura fissa della classe: 1-2 alzate, poi un Metcon AMRAP a tempo.
          </span>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {(mode === 'strength' ? SPLIT_GROUPS_FORZA : SPLIT_GROUPS).map((gruppo) => (
            <div key={gruppo.label}>
              <p className="font-data text-[10px] uppercase tracking-[0.16em] text-slate2 mb-2">
                {gruppo.label}
              </p>
              <div className="space-y-2.5">
                {gruppo.splits.map((s) => {
                  const on = split === s
                  return (
                    <button
                      key={s}
                      onClick={() => setSplit(s)}
                      aria-pressed={on}
                      className={`slab flex items-center gap-4 ${on ? '!border-chalk' : ''}`}
                    >
                      <span
                        aria-hidden
                        className={`h-9 w-[3px] rounded-full ${on ? 'bg-amber2' : 'bg-edge'}`}
                      />
                      <span>
                        <span className="block font-display font-bold uppercase tracking-wide text-[17px]">
                          {SPLIT_LABELS[s]}
                        </span>
                        <span className="block text-[13px] text-slate2 mt-0.5">{SPLIT_HINTS[s]}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Durata: la scelta che cambia di più giorno per giorno */}
      <p className="field-label mt-8">Quanto tempo hai</p>
      <div className="grid grid-cols-5 gap-2">
        {DURATIONS.map((d) => (
          <button
            key={d}
            onClick={() => setDurata(d)}
            aria-pressed={eff?.durata === d}
            className={`chip font-data ${eff?.durata === d ? 'chip-on' : ''}`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* 3. Il resto, aperto solo se serve */}
      <button
        onClick={() => setAvanzate((v) => !v)}
        className="mt-6 flex w-full items-center justify-between border-t border-edge pt-4"
        aria-expanded={avanzate}
      >
        <span className="eyebrow !text-chalk">Cambia altro per oggi</span>
        <span className="font-data text-[11px] text-slate2">{avanzate ? '−' : '+'}</span>
      </button>

      {avanzate && eff && (
        <div className="mt-5 space-y-7">
          {mode === 'bodybuilding' && (
            <div>
              <p className="field-label">Obiettivo</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGoal(g)}
                    aria-pressed={eff.goal === g}
                    className={`chip text-left ${eff.goal === g ? 'chip-on' : ''}`}
                  >
                    {GOAL_LABELS[g]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="field-label">Intensità</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(INTENSITY_LABELS) as Intensity[]).map((i) => (
                <button
                  key={i}
                  onClick={() => setIntensita(i)}
                  aria-pressed={eff.intensita === i}
                  className={`chip text-center ${eff.intensita === i ? 'chip-on' : ''}`}
                >
                  {INTENSITY_LABELS[i]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="field-label">Attrezzatura di oggi</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((e) => (
                <button
                  key={e}
                  onClick={() => setAttrezzi(e)}
                  aria-pressed={eff.attrezzi === e}
                  className={`chip text-left ${eff.attrezzi === e ? 'chip-on' : ''}`}
                >
                  {EQUIPMENT_LABELS[e]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="field-label">Muscoli da recuperare</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MUSCLE_LABELS) as Muscle[]).map((m) => {
                const on = eff.muscoli.includes(m)
                return (
                  <button
                    key={m}
                    aria-pressed={on}
                    className={`chip ${on ? 'chip-on' : ''}`}
                    onClick={() =>
                      setMuscoli(on ? eff.muscoli.filter((x) => x !== m) : [...eff.muscoli, m])
                    }
                  >
                    {MUSCLE_LABELS[m]}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[12px] text-slate2">
              Il volume si sposta su questi senza allungare la sessione.
            </p>
          </div>

          <p className="text-[12px] text-slate2">
            Queste modifiche valgono solo per oggi. Le impostazioni fisse stanno nel profilo.
          </p>
        </div>
      )}

      {erroreCatalogo && (
        <p className="mt-6 text-sm text-amber2" role="alert">
          {erroreCatalogo}
        </p>
      )}

      {/* Il bottone che chiude tutto */}
      <button className="btn mt-8 !py-4 text-lg" disabled={!pronto} onClick={genera}>
        {pronto ? 'Genera allenamento' : 'Un attimo…'}
      </button>

      {eff && (
        <p className="mt-3 text-center font-data text-[11px] uppercase tracking-[0.14em] text-slate2">
          {mode === 'crossfit' ? MODE_LABELS.crossfit : SPLIT_LABELS[split]} · {eff.durata} min ·{' '}
          {mode === 'crossfit' ? GOAL_LABELS.conditioning : mode === 'strength' ? GOAL_LABELS.strength : GOAL_LABELS[eff.goal]}
        </p>
      )}
    </div>
  )
}
