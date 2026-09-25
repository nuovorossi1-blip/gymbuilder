import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { CoachPlan } from './plan'

export interface MessaggioCoach {
  id: string
  role: 'coach' | 'utente'
  kind: 'colloquio' | 'controllo' | 'chat'
  content: string
  meta: Record<string, unknown> | null
  /** Conversazione (solo "Parla col coach"): ogni "Nuova chat" ne apre una. */
  thread_id?: string | null
  created_at: string
}

export interface PianoSalvato {
  id: string
  version: number
  plan: CoachPlan
  next_index: number
  created_at: string
}

/** Conversazione e piano attivo del Coach (Fase 3). */
export function useCoach(userId: string | undefined) {
  const [messaggi, setMessaggi] = useState<MessaggioCoach[] | null>(null)
  const [piano, setPiano] = useState<PianoSalvato | null | undefined>(undefined)
  const [versioni, setVersioni] = useState<{ id: string; version: number; source: string; note: string | null; created_at: string }[]>([])

  const carica = useCallback(async () => {
    if (!userId) return
    const [m, p, v] = await Promise.all([
      supabase.from('coach_messages').select('id, role, kind, content, meta, thread_id, created_at').eq('user_id', userId).order('created_at', { ascending: true }).limit(600),
      supabase.from('coach_plans').select('id, version, plan, next_index, created_at').eq('user_id', userId).eq('status', 'attivo').order('created_at', { ascending: false }).limit(1),
      supabase.from('coach_plans').select('id, version, source, note, created_at').eq('user_id', userId).order('version', { ascending: false }).limit(30),
    ])
    setVersioni((v.data ?? []) as typeof versioni)
    setMessaggi((m.data ?? []) as MessaggioCoach[])
    setPiano(((p.data ?? [])[0] as PianoSalvato | undefined) ?? null)
  }, [userId])
  useEffect(() => { void carica() }, [carica])

  const aggiungi = useCallback(async (msg: Omit<MessaggioCoach, 'id' | 'created_at'>) => {
    if (!userId) throw new Error('Accedi di nuovo.')
    const { data, error } = await supabase.from('coach_messages').insert({ ...msg, user_id: userId }).select('id, role, kind, content, meta, thread_id, created_at').single()
    if (error || !data) throw new Error('Messaggio non salvato.')
    setMessaggi((old) => [...(old ?? []), data as MessaggioCoach])
    return data as MessaggioCoach
  }, [userId])

  /** Toglie dei messaggi (es. per correggere l'ultimo messaggio inviato). */
  const eliminaMessaggi = useCallback(async (ids: string[]) => {
    if (!userId || ids.length === 0) return
    await supabase.from('coach_messages').delete().eq('user_id', userId).in('id', ids)
    setMessaggi((old) => (old ?? []).filter((m) => !ids.includes(m.id)))
  }, [userId])

  const cancellaConversazione = useCallback(async (kind: MessaggioCoach['kind']) => {
    if (!userId) return
    await supabase.from('coach_messages').delete().eq('user_id', userId).eq('kind', kind)
    setMessaggi((old) => (old ?? []).filter((m) => m.kind !== kind))
  }, [userId])

  const accettaPiano = useCallback(async (plan: CoachPlan, source: 'colloquio' | 'controllo' | 'chat', note?: string) => {
    if (!userId) throw new Error('Accedi di nuovo.')
    const { data: ultimi } = await supabase.from('coach_plans').select('version').eq('user_id', userId).order('version', { ascending: false }).limit(1)
    const version = ((ultimi?.[0]?.version as number | undefined) ?? 0) + 1
    await supabase.from('coach_plans').update({ status: 'archiviato' }).eq('user_id', userId).eq('status', 'attivo')
    const { data, error } = await supabase.from('coach_plans')
      .insert({ user_id: userId, version, status: 'attivo', source, plan, next_index: 0, note: note ?? null })
      .select('id, version, plan, next_index, created_at').single()
    if (error || !data) throw new Error('Piano non salvato. Riprova.')
    setPiano(data as PianoSalvato)
    setVersioni((old) => [{ id: data.id as string, version, source, note: note ?? null, created_at: data.created_at as string }, ...old])
    return data as PianoSalvato
  }, [userId])

  /** Elimina definitivamente una versione del programma (25/09, richiesta di Rossi). Se è quella
   *  attiva non resta nessun programma attivo: si ricomincia dal coach. */
  const eliminaPiano = useCallback(async (id: string) => {
    if (!userId) return
    const { error } = await supabase.from('coach_plans').delete().eq('user_id', userId).eq('id', id)
    if (error) throw new Error('Programma non eliminato. Riprova.')
    setVersioni((old) => old.filter((v) => v.id !== id))
    setPiano((old) => (old && old.id === id ? null : old))
  }, [userId])

  const impostaProssima = useCallback(async (index: number) => {
    if (!userId || !piano) return
    await supabase.from('coach_plans').update({ next_index: index }).eq('id', piano.id)
    setPiano({ ...piano, next_index: index })
  }, [userId, piano])

  return { messaggi, piano, versioni, aggiungi, eliminaMessaggi, eliminaPiano, cancellaConversazione, accettaPiano, impostaProssima, ricarica: carica }
}
