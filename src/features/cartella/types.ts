/**
 * Cartella del cliente (Fase 2, 25/09): la "cartella clinica" del file unico di Rossi, una per
 * utente. Contiene solo ciò che l'app non sa già: sesso, età, peso, calorie, sonno, stress,
 * fastidi, storico calorie e peso restano nel Profilo e nei diari, e nel file .md vengono
 * letti da lì. Il Coach LLM (Fase 3-4) legge e aggiorna questa struttura.
 */
import type { Muscle } from '../../types'

export interface VincoloTassativo {
  zona: string
  problema: string
  /** Esercizi vietati: nomi o id del catalogo. Quelli riconosciuti vengono esclusi dal motore. */
  vietati: string[]
  strategia: string
}

export interface NotaMuscolo { muscolo: Muscle; note: string }

export interface EsercizioNota {
  nome: string
  /** Id del catalogo, se l'esercizio è riconosciuto. */
  exercise_id?: string
  nota?: string
}

export interface EsercizioObbligatorio extends EsercizioNota {
  seduta?: string
  slot?: number
}

export interface Controllo {
  data: string
  peso?: number
  girovita?: number
  specchio?: string
  energia?: string
  recupero?: string
  sonno?: string
  fame?: string
  fastidi?: string
  carichi?: { esercizio: string; carico: string; reps: string }[]
  decisioni?: string
}

export interface CartellaCliente {
  versione: 1
  livello_note: string
  obiettivo: { primario: string; secondario: string; indiretto: string }
  vincoli: VincoloTassativo[]
  carenze: NotaMuscolo[]
  punti_forti: NotaMuscolo[]
  esercizi_ok: EsercizioNota[]
  esercizi_perdita_tensione: EsercizioNota[]
  obbligatori: EsercizioObbligatorio[]
  attrezzatura: string[]
  riscaldamento: { descrizione: string; minuti: number }
  macro: { proteine_g: number | null; grassi_g: number | null; carboidrati_g: number | null }
  note_coach: string
  controlli: Controllo[]
}

export const CARTELLA_VUOTA: CartellaCliente = {
  versione: 1,
  livello_note: '',
  obiettivo: { primario: '', secondario: '', indiretto: '' },
  vincoli: [],
  carenze: [],
  punti_forti: [],
  esercizi_ok: [],
  esercizi_perdita_tensione: [],
  obbligatori: [],
  attrezzatura: [],
  riscaldamento: { descrizione: '2 giri addome (alti + bassi) + 3 giri rotazioni spalle', minuti: 8 },
  macro: { proteine_g: null, grassi_g: null, carboidrati_g: null },
  note_coach: '',
  controlli: [],
}
