/**
 * Motore di transizione di stato per l'esecuzione dal vivo del protocollo Density Tri-Set
 * 3-6-9 (Fase 2, 21/08 — isolato di proposito da Runner.tsx, vedi AIOS_STATE.md per il perché).
 *
 * Puro: nessun React, nessun timer reale, nessun servizio nativo. Riceve lo stato attuale e
 * dice qual è lo stato dopo un evento ("ho finito la stazione", "il riposo è arrivato a
 * zero"). Chi lo usa (DensityRunner.tsx) si occupa di orologio reale, salvataggio, audio.
 *
 * Una sessione è: per ogni blocco (A poi B), per ogni giro (1..rounds), tre stazioni DI FILA
 * senza pausa fra loro — l'utente tocca "Fatto" e passa subito alla stazione successiva, come
 * il formato AMRAP già esistente nell'app (corretto il 21/08 su indicazione di Rossi: prima
 * c'era un conto alla rovescia di 10-15s fra una stazione e l'altra, tolto perché non è così
 * che deve funzionare — nessun timer finché non sono fatte tutte e tre). Solo DOPO la terza
 * stazione del giro parte un vero riposo cronometrato: round_rest_sec del blocco, o — se è
 * anche l'ultimo giro del Blocco A — la transizione fra i blocchi
 * (block_transition_rest_sec del workout, non del blocco).
 */

import type { Density369Workout } from '../generators/density369'

export type DensityRunnerPhase = 'lavoro' | 'riposo_giro' | 'riposo_blocco' | 'completato'

export interface DensityRunnerPosition {
  blockIndex: 0 | 1
  /** 1-based, coerente con DensityBlock.rounds. */
  round: number
  stationIndex: 0 | 1 | 2
}

export interface DensityRunnerState {
  position: DensityRunnerPosition
  phase: DensityRunnerPhase
}

export function statoIniziale(): DensityRunnerState {
  return { position: { blockIndex: 0, round: 1, stationIndex: 0 }, phase: 'lavoro' }
}

/** Quanti secondi dura la fase di riposo ATTUALE (0 per 'lavoro'/'completato': non sono a
 *  tempo, servono un tocco dell'utente o non c'è più nulla da fare). */
export function durataFaseSec(state: DensityRunnerState, workout: Density369Workout): number {
  const blocco = workout.blocks[state.position.blockIndex]
  if (state.phase === 'riposo_giro') return blocco.round_rest_sec
  if (state.phase === 'riposo_blocco') return workout.block_transition_rest_sec
  return 0
}

/**
 * Stato successivo dato l'evento "questa fase è finita" — per 'lavoro' è l'utente che
 * conferma di aver fatto le ripetizioni della stazione, per le fasi di riposo è il timer
 * arrivato a zero. Non fa nulla se lo stato è già 'completato'.
 */
export function avanza(state: DensityRunnerState, workout: Density369Workout): DensityRunnerState {
  const { position, phase } = state
  const blocco = workout.blocks[position.blockIndex]
  const ultimaStazione = position.stationIndex === blocco.stations.length - 1
  const ultimoGiro = position.round >= blocco.rounds
  const ultimoBlocco = position.blockIndex === workout.blocks.length - 1

  if (phase === 'completato') return state

  if (phase === 'lavoro') {
    // Dentro lo stesso giro si passa dritti alla stazione successiva, nessuna pausa — solo
    // dopo la terza stazione (fine giro) parte un vero riposo cronometrato.
    if (!ultimaStazione) {
      return { position: { ...position, stationIndex: (position.stationIndex + 1) as 0 | 1 | 2 }, phase: 'lavoro' }
    }
    if (!ultimoGiro) return { position, phase: 'riposo_giro' }
    if (!ultimoBlocco) return { position, phase: 'riposo_blocco' }
    return { position, phase: 'completato' }
  }

  if (phase === 'riposo_giro') {
    return { position: { ...position, round: position.round + 1, stationIndex: 0 }, phase: 'lavoro' }
  }

  // riposo_blocco: si passa sempre al blocco successivo, giro 1, prima stazione.
  return { position: { blockIndex: (position.blockIndex + 1) as 0 | 1, round: 1, stationIndex: 0 }, phase: 'lavoro' }
}

export interface DensityStazioneCorrente {
  exercise_id: string
  name: string
  reps: string
  role: 1 | 2 | 3
  alternatives: { exercise_id: string; name: string }[]
}

/** Info per la UI: la stazione a cui si riferisce lo stato attuale — durante 'lavoro' è la
 *  stazione da eseguire ora; durante 'riposo_giro'/'riposo_blocco' è quella che partirà dopo
 *  (sempre la prima, indice 0, del giro o blocco successivo) — per quei due casi la funzione
 *  guarda avanti e la calcola. */
export function stazioneCorrente(state: DensityRunnerState, workout: Density369Workout): DensityStazioneCorrente {
  const { position, phase } = state
  const bloccoAttuale = workout.blocks[position.blockIndex]
  if (phase === 'riposo_giro' || phase === 'riposo_blocco') {
    const prossimoBlocco = phase === 'riposo_blocco' ? workout.blocks[position.blockIndex + 1] : bloccoAttuale
    const s = prossimoBlocco.stations[0]
    return { exercise_id: s.exercise_id, name: s.name, reps: s.reps, role: s.role, alternatives: s.alternatives }
  }
  const s = bloccoAttuale.stations[position.stationIndex]
  return { exercise_id: s.exercise_id, name: s.name, reps: s.reps, role: s.role, alternatives: s.alternatives }
}

export function progressoTesto(state: DensityRunnerState, workout: Density369Workout): string {
  const blocco = workout.blocks[state.position.blockIndex]
  return `Blocco ${blocco.label} · Giro ${state.position.round}/${blocco.rounds} · Stazione ${state.position.stationIndex + 1}/3`
}
