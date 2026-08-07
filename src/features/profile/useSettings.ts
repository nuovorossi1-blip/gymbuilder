import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile, UserSettings } from '../../types'

interface State {
  profile: Profile | null
  settings: UserSettings | null
  loading: boolean
  error: string | null
}

export function useSettings(userId: string | undefined) {
  const [state, setState] = useState<State>({
    profile: null,
    settings: null,
    loading: true,
    error: null,
  })

  const load = useCallback(async () => {
    if (!userId) return
    setState((s) => ({ ...s, loading: true, error: null }))

    const results = await Promise.all([
      supabase.from('profiles').select('id:user_id, display_name, weight_kg, height_cm, age, sex').eq('user_id', userId).maybeSingle(),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    ])
    const p = results[0]
    const settingsResult = results[1]

    if (p.error || settingsResult.error) {
      setState({
        profile: null,
        settings: null,
        loading: false,
        error: 'Non riusciamo a leggere il tuo profilo. Controlla la connessione e riprova.',
      })
      return
    }

    setState({
      profile: p.data as Profile | null,
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
    setState((current) => current.profile ? { ...current, profile: { ...current.profile, ...patch } } : current)
    return true
  }, [userId])

  return { ...state, reload: load, saveSettings, saveName, saveProfile }
}
