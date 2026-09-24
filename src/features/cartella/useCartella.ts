import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { normalizzaCartella } from './cartella'
import { CARTELLA_VUOTA, type CartellaCliente } from './types'

/** Carica e salva la cartella del cliente (una riga per utente in client_folder). */
export function useCartella(userId: string | undefined) {
  const [cartella, setCartella] = useState<CartellaCliente | null>(null)
  const [aggiornata, setAggiornata] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    supabase.from('client_folder').select('data, updated_at').eq('user_id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setErrore('Non riesco a leggere la cartella.'); setCartella(CARTELLA_VUOTA); return }
        setCartella(data ? normalizzaCartella(data.data) : CARTELLA_VUOTA)
        setAggiornata((data?.updated_at as string | undefined) ?? null)
      })
  }, [userId])

  const salva = useCallback(async (nuova: CartellaCliente) => {
    if (!userId) return false
    const updated_at = new Date().toISOString()
    const { error } = await supabase.from('client_folder').upsert({ user_id: userId, data: nuova, updated_at })
    if (error) { setErrore('Cartella non salvata. Riprova.'); return false }
    setCartella(nuova); setAggiornata(updated_at); setErrore(null)
    return true
  }, [userId])

  return { cartella, aggiornata, errore, salva }
}
