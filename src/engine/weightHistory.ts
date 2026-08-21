/**
 * Ultimo peso usato per esercizio, dallo storico degli allenamenti completati (21/08, parte
 * del tracciamento del peso richiesto da Rossi — vedi AIOS_STATE.md).
 *
 * Pura: nessuna chiamata di rete qui, solo la logica "dato lo storico già scaricato, qual è
 * l'ultimo peso registrato per ogni esercizio". La chiamata vera (`elencoStorico`) resta in
 * `lib/api.ts`; questo file è testabile senza Supabase.
 */

import type { CompletedWorkout } from '../types'

/**
 * `storico` deve essere già ordinato dal più recente (indice 0) al più vecchio — esattamente
 * l'ordine che `elencoStorico` restituisce già (`order('completed_at', {ascending: false})`).
 * Il primo allenamento in cui un esercizio compare CON un peso registrato vince: non fa media,
 * non guarda quanti allenamenti fa, solo l'ultima volta.
 */
export function ultimiPesiPerEsercizio(storico: CompletedWorkout[]): Record<string, number> {
  const pesi: Record<string, number> = {}
  for (const allenamento of storico) {
    for (const blocco of allenamento.blocks) {
      for (const esercizio of blocco.exercises) {
        if (esercizio.logged_weight_kg === undefined) continue
        if (esercizio.exercise_id in pesi) continue // già trovato uno più recente, non sovrascrivere
        pesi[esercizio.exercise_id] = esercizio.logged_weight_kg
      }
    }
  }
  return pesi
}
