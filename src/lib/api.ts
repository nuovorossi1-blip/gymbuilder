import { supabase } from './supabase'
import type { CompletedWorkout, Exercise, ExerciseRecord, GeneratedWorkout, SavedWorkout, WeeklyProgram, WorkoutGenerationConfig } from '../types'
import { analizzaSettimana, type WeeklyTrainingState } from '../generators/weakPoints'
import { normalizeExercise } from '../data/exercises/normalize'

export async function caricaCatalogo(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('active', true)
    .order('id')
  if (error) throw new Error('Non riusciamo a caricare gli esercizi.')
  return ((data ?? []) as ExerciseRecord[]).map(normalizeExercise)
}

export async function salvaAllenamento(
  userId: string,
  w: GeneratedWorkout,
  nome?: string,
  generationConfig?: WorkoutGenerationConfig | null
): Promise<string> {
  const base = {
    user_id: userId, name: nome?.trim() || w.name, mode: w.mode, split: w.split,
    goal: w.goal, experience: w.experience, duration_min: w.duration_min, blocks: w.blocks,
  }
  let result = await supabase.from('saved_workouts').insert({ ...base, generation_config: generationConfig ?? null }).select('id').single()
  // Continuità col database remoto finché la nuova migrazione non viene applicata.
  if (result.error?.code === 'PGRST204' || result.error?.code === '42703') {
    result = await supabase.from('saved_workouts').insert(base).select('id').single()
  }
  const { data, error } = result
  if (error) throw new Error('Non siamo riusciti a salvare. Riprova.')
  return data.id as string
}

export async function salvaProgramma(userId: string, program: WeeklyProgram): Promise<WeeklyProgram> {
  if (program.config.program_kind !== 'program' || program.config.duration_weeks < 2) {
    throw new Error('Un programma deve durare almeno due settimane.')
  }
  const { data, error } = await supabase.from('training_programs').insert({
    user_id: userId,
    name: `${program.config.training_days} giorni · ${program.config.duration_weeks} settimane`,
    duration_weeks: program.config.duration_weeks,
    config: program.config,
    week: program.week,
  }).select('id').single()
  if (error) throw new Error('Non siamo riusciti a salvare il programma.')
  return { ...program, id: data.id as string, persisted: true }
}

export async function aggiornaProgramma(userId: string, program: WeeklyProgram): Promise<void> {
  if (!program.persisted || program.config.program_kind !== 'program') return
  const { error } = await supabase.from('training_programs').update({
    duration_weeks: program.config.duration_weeks,
    config: program.config,
    week: program.week,
    updated_at: new Date().toISOString(),
  }).eq('id', program.id).eq('user_id', userId)
  if (error) throw new Error('Non siamo riusciti ad aggiornare il programma.')
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
  const { error } = await supabase.from('saved_workouts').delete().eq('id', id)
  if (error) throw new Error('Non siamo riusciti a eliminare la scheda.')
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

export async function eliminaStorico(id: string): Promise<void> {
  const { error } = await supabase.from('completed_workouts').delete().eq('id', id)
  if (error) throw new Error("Non siamo riusciti a eliminare l'allenamento.")
}

/**
 * Volume settimanale per muscolo dagli ultimi allenamenti completati, usato
 * dal motore per decidere i richiami sui muscoli carenti (weakPoints.ts).
 * In caso di errore non blocca la generazione: si genera senza quel dato.
 */
export async function situazioneSettimanaleUtente(
  userId: string,
  catalogo: Exercise[]
): Promise<WeeklyTrainingState | undefined> {
  try {
    const storico = await elencoStorico(userId)
    return analizzaSettimana(storico, catalogo)
  } catch {
    return undefined
  }
}
