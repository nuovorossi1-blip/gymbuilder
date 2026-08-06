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
      supabase.from('profiles').select('id, display_name, weight_kg, height_cm, age, sex').eq('id', userId).maybeSingle(),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    ])
    let p = results[0]
    const settingsResult = results[1]

    // Compatibilità mentre la migrazione dei dati fisici non è ancora applicata al remoto.
    if (p.error) {
      const legacy = await supabase.from('profiles').select('id, display_name').eq('id', userId).maybeSingle()
      p = legacy.error ? p : { ...legacy, data: legacy.data ? { ...legacy.data, weight_kg: null, height_cm: null, age: null, sex: 'unspecified' } : null }
    }

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
        .upsert({ id: userId, display_name }, { onConflict: 'id' })
      if (error) return false
      setState((s) => (s.profile ? { ...s, profile: { ...s.profile, display_name } } : s))
      return true
    },
    [userId]
  )

  const saveProfile = useCallback(async (patch: Partial<Profile>): Promise<boolean> => {
    if (!userId) return false
    const { error } = await supabase.from('profiles').upsert({ id: userId, ...patch }, { onConflict: 'id' })
    if (error) return false
    setState((current) => current.profile ? { ...current, profile: { ...current.profile, ...patch } } : current)
    return true
  }, [userId])

  return { ...state, reload: load, saveSettings, saveName, saveProfile }
}
