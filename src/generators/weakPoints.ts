/**
 * Weak Point Weekly Programming.
 *
 * Un muscolo carente NON significa "aggiungi un esercizio per quel muscolo
 * in ogni sessione": significa che quel muscolo deve ricevere più frequenza
 * e/o volume nell'arco della settimana rispetto a quanto riceverebbe di
 * default. Questo modulo guarda gli ultimi allenamenti completati (non
 * quelli salvati-ma-mai-fatti) e stima quanto volume settimanale un
 * muscolo ha già ricevuto, direttamente e indirettamente, prima di decidere
 * se la sessione di oggi deve includere un "richiamo".
 *
 * Semplificazione dichiarata: non è una vera periodizzazione multi-settimana,
 * è un contatore mobile sugli ultimi N giorni. Volume indiretto = metà del
 * volume diretto (euristica, non letteratura). Vedi AIOS_STATE.md sez. 8.
 */

import type { CompletedWorkout, Exercise, Muscle } from '../types'

export interface WeeklyTrainingState {
  volume: Record<Muscle, number>
  last_trained_at: Partial<Record<Muscle, string>>
}

/** Serie settimanali "sufficienti" per muscolo, sotto le quali scatta il richiamo. */
export const TARGET_SETTIMANALE: Record<Muscle, number> = {
  chest: 14,
  back: 16,
  front_delts: 10,
  lateral_delts: 12,
  rear_delts: 10,
  biceps: 10,
  triceps: 10,
  forearms: 8,
  quads: 14,
  hamstrings: 12,
  glutes: 10,
  adductors: 8,
  calves: 8,
  core: 8,
}

function vuoto(): Record<Muscle, number> {
  return {
    chest: 0, back: 0, front_delts: 0, lateral_delts: 0, rear_delts: 0,
    biceps: 0, triceps: 0, forearms: 0, quads: 0, hamstrings: 0, glutes: 0, adductors: 0, calves: 0, core: 0,
  }
}

/**
 * Volume settimanale stimato per muscolo dagli allenamenti completati negli
 * ultimi `giorni`. Diretto = serie piene, indiretto (muscoli secondari
 * dell'esercizio) = metà peso. Il riscaldamento non conta.
 */
export function analizzaSettimana(
  completati: CompletedWorkout[],
  catalogo: Exercise[],
  giorni = 7,
  referenceDate: number | Date = Date.now()
): WeeklyTrainingState {
  const refTime = typeof referenceDate === 'number' ? referenceDate : referenceDate.getTime()
  const soglia = refTime - giorni * 24 * 60 * 60 * 1000
  const perId = new Map(catalogo.map((e) => [e.id, e]))
  const volume = vuoto()
  const last_trained_at: Partial<Record<Muscle, string>> = {}

  for (const w of completati) {
    if (new Date(w.completed_at).getTime() < soglia) continue
    for (const blocco of w.blocks.filter((b) => b.kind !== 'warmup')) {
      for (const es of blocco.exercises) {
        const ex = perId.get(es.exercise_id)
        if (!ex) continue
        for (const m of ex.primary_muscles) {
          volume[m] += es.sets
          if (!last_trained_at[m] || w.completed_at > last_trained_at[m]!) last_trained_at[m] = w.completed_at
        }
        for (const m of ex.secondary_muscles) {
          volume[m] += es.sets * 0.5
          if (!last_trained_at[m] || w.completed_at > last_trained_at[m]!) last_trained_at[m] = w.completed_at
        }
      }
    }
  }
  return { volume, last_trained_at }
}

export function volumeSettimanale(
  completati: CompletedWorkout[],
  catalogo: Exercise[],
  giorni = 7,
  referenceDate: number | Date = Date.now()
): Record<Muscle, number> {
  return analizzaSettimana(completati, catalogo, giorni, referenceDate).volume
}

/**
 * Quali muscoli carenti meritano un richiamo esplicito NELLA sessione di
 * oggi, oltre a quanto lo split già dà loro naturalmente. Un muscolo entra
 * in questa lista solo se il suo volume settimanale è sotto la soglia E lo
 * split di oggi non lo tocca già a sufficienza. Al massimo due richiami:
 * la sessione non deve gonfiarsi per inseguire ogni carenza in un colpo solo.
 */
export function decidiRichiami(
  prioritari: Muscle[],
  volumeAttuale: Record<Muscle, number>,
  muscoliGiaCoperti: Muscle[],
  massimo = 2,
  recupero?: {
    last_trained_at?: Partial<Record<Muscle, string>>
    now?: number
    minimum_hours?: number
  }
): Muscle[] {
  const conteggioCoperti = new Map<Muscle, number>()
  muscoliGiaCoperti.forEach((m) => conteggioCoperti.set(m, (conteggioCoperti.get(m) ?? 0) + 1))

  const bisognosi = prioritari.filter((m) => {
    const giaSlotDedicati = conteggioCoperti.get(m) ?? 0
    // Se lo split di oggi gli dà già 2+ slot propri, il volume diretto di
    // oggi probabilmente basta: non serve un richiamo aggiuntivo.
    if (giaSlotDedicati >= 2) return false
    const ultimo = recupero?.last_trained_at?.[m]
    if (ultimo) {
      const ore = ((recupero.now ?? Date.now()) - new Date(ultimo).getTime()) / 3_600_000
      if (ore < (recupero.minimum_hours ?? 48)) return false
    }
    return volumeAttuale[m] < TARGET_SETTIMANALE[m] * 0.6
  })

  // I più indietro in percentuale sul target vengono richiamati per primi.
  bisognosi.sort(
    (a, b) => volumeAttuale[a] / TARGET_SETTIMANALE[a] - volumeAttuale[b] / TARGET_SETTIMANALE[b]
  )
  return bisognosi.slice(0, massimo)
}
