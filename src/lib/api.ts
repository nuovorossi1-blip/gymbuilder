import { supabase } from './supabase'
import type { CompletedWorkout, Exercise, GeneratedWorkout, Muscle, SavedWorkout } from '../types'
import { volumeSettimanale } from '../generators/weakPoints'

export async function caricaCatalogo(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('active', true)
    .order('id')
  if (error) throw new Error('Non riusciamo a caricare gli esercizi.')
  return (data ?? []) as Exercise[]
}

export async function salvaAllenamento(
  userId: string,
  w: GeneratedWorkout,
  nome?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('saved_workouts')
    .insert({
      user_id: userId,
      name: nome?.trim() || w.name,
      mode: w.mode,
      split: w.split,
      goal: w.goal,
      experience: w.experience,
      duration_min: w.duration_min,
      blocks: w.blocks,
    })
    .select('id')
    .single()
  if (error) throw new Error('Non siamo riusciti a salvare. Riprova.')
  return data.id as string
}

export async function elencoSalvati(userId: string): Promise<SavedWorkout[]> {
  const { data, error } = await supabase
    .from('saved_workouts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error('Non riusciamo a leggere i tuoi allenamenti.')
  return (data ?? []) as SavedWorkout[]
}

export async function cambiaPreferito(id: string, favorite: boolean): Promise<void> {
  await supabase.from('saved_workouts').update({ favorite }).eq('id', id)
}

export async function eliminaSalvato(id: string): Promise<void> {
  await supabase.from('saved_workouts').delete().eq('id', id)
}

export async function registraCompletato(
  userId: string,
  w: GeneratedWorkout,
  durataSec: number,
  rating: string | null,
  note: string | null
): Promise<void> {
  const { error } = await supabase.from('completed_workouts').insert({
    user_id: userId,
    name: w.name,
    mode: w.mode,
    blocks: w.blocks,
    duration_sec: durataSec,
    rating,
    notes: note,
  })
  if (error) throw new Error('Allenamento finito, ma non siamo riusciti a registrarlo.')
}

export async function elencoStorico(userId: string): Promise<CompletedWorkout[]> {
  const { data, error } = await supabase
    .from('completed_workouts')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(100)
  if (error) throw new Error('Non riusciamo a leggere lo storico.')
  return (data ?? []) as CompletedWorkout[]
}

/**
 * Volume settimanale per muscolo dagli ultimi allenamenti completati, usato
 * dal motore per decidere i richiami sui muscoli carenti (weakPoints.ts).
 * In caso di errore non blocca la generazione: si genera senza quel dato.
 */
export async function volumeSettimanaleUtente(
  userId: string,
  catalogo: Exercise[]
): Promise<Record<Muscle, number> | undefined> {
  try {
    const storico = await elencoStorico(userId)
    return volumeSettimanale(storico, catalogo)
  } catch {
    return undefined
  }
}
