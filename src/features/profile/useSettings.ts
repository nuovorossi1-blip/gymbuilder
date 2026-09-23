import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile, UserSettings } from '../../types'
import { gradinoCalorie, normocaloricaEffettiva, type CalorieLogEntry } from '../../engine/nutrition'

interface State {
  profile: Profile | null
  /** Storico delle calorie (23/09, la scala): da qui il volume segue le calorie con ritardo. */
  calorieLog: CalorieLogEntry[]
  settings: UserSettings | null
  loading: boolean
  error: string | null
}

export function useSettings(userId: string | undefined) {
  const [state, setState] = useState<State>({
    profile: null,
    calorieLog: [],
    settings: null,
    loading: true,
    error: null,
  })

  const load = useCallback(async () => {
    if (!userId) return
    setState((s) => ({ ...s, loading: true, error: null }))

    const results = await Promise.all([
      supabase.from('profiles').select('id:user_id, display_name, weight_kg, height_cm, age, sex, daily_kcal, job_activity, weight_trend, sleep_hours, stress_level, joint_issues, maintenance_kcal').eq('user_id', userId).maybeSingle(),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('calorie_log').select('kcal, maintenance_kcal, step, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(60),
    ])
    const p = results[0]
    const settingsResult = results[1]

    if (p.error || settingsResult.error) {
      setState({
        profile: null,
        calorieLog: [],
        settings: null,
        loading: false,
        error: 'Non riusciamo a leggere il tuo profilo. Controlla la connessione e riprova.',
      })
      return
    }

    setState({
      profile: p.data as Profile | null,
      // Lo storico è un di più: se la tabella non risponde il resto dell'app funziona uguale.
      calorieLog: ((results[2].data ?? []) as CalorieLogEntry[]).slice().reverse(),
      settings: settingsResult.data as UserSettings | null,
      loading: false,
      error: null,
    })
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  /** Salva un sottoinsieme di impostazioni. Ritorna true se e' andata. */
  const saveSettings = useCallback(
    async (patch: Partial<UserSettings>): Promise<boolean> => {
      if (!userId) return false
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
      if (error) return false
      setState((s) =>
        s.settings ? { ...s, settings: { ...s.settings, ...patch } } : s
      )
      return true
    },
    [userId]
  )

  const saveName = useCallback(
    async (display_name: string): Promise<boolean> => {
      if (!userId) return false
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, user_id: userId, display_name }, { onConflict: 'user_id' })
      if (error) return false
      setState((s) => (s.profile ? { ...s, profile: { ...s.profile, display_name } } : s))
      return true
    },
    [userId]
  )

  const saveProfile = useCallback(async (patch: Partial<Profile>): Promise<boolean> => {
    if (!userId) return false
    const profilePatch = { ...patch }
    delete profilePatch.id
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, user_id: userId, ...profilePatch }, { onConflict: 'user_id' })
    if (error) return false
    // Scala (23/09): ogni cambio di calorie finisce nello storico con il gradino di quel momento,
    // così il motore sa da quanti giorni sei alle nuove calorie e fa seguire il volume.
    let nuovaVoce: CalorieLogEntry | null = null
    const prima = state.profile
    const dopo = { ...(prima ?? { id: userId, display_name: null }), ...patch } as Profile
    const step = gradinoCalorie(dopo)
    if (dopo.daily_kcal && step !== null && dopo.daily_kcal !== prima?.daily_kcal) {
      const voce = { user_id: userId, kcal: dopo.daily_kcal, maintenance_kcal: normocaloricaEffettiva(dopo).kcal, step }
      const inserted = await supabase.from('calorie_log').insert(voce).select('kcal, maintenance_kcal, step, created_at').maybeSingle()
      if (!inserted.error && inserted.data) nuovaVoce = inserted.data as CalorieLogEntry
    }
    setState((current) => current.profile
      ? { ...current, profile: { ...current.profile, ...patch }, calorieLog: nuovaVoce ? [...current.calorieLog, nuovaVoce] : current.calorieLog }
      : current)
    return true
  }, [userId, state.profile])

  return { ...state, reload: load, saveSettings, saveName, saveProfile }
}
