import { describe, expect, it } from 'vitest'
import { PROFESSIONAL_WORKOUT_SYSTEM_PROMPT } from './deepseek'

describe('DeepSeek workout prompt', () => {
  it('imposta un coach professionale e regole specifiche per disciplina', () => {
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('professionista esperto')
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('CrossFit: agisci come coach CrossFit')
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('Non trasformarlo in una scheda Bodybuilding')
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('attrezzatura completa')
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('Strength: agisci come strength coach')
  })

  it('spiega gestione del carico, priming sulle carenze e sostituzione senza perdere l\'effort (sez. Lagging Muscle Engine)', () => {
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('local_fatigue')
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('secondary_muscles')
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('priming')
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('focus_portion')
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('non è sostenibile')
  })
})

import { ANALISI_SCHEDA_SYSTEM_PROMPT, sanitizeSchedaAnalysis } from './deepseek'

describe('regole di programmazione di Rossi nei prompt (23/09)', () => {
  it('il prompt di generazione contiene gerarchia, interleave per fase e richiamo antagonista', () => {
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('Interleave secondo la fase')
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('Sul muscolo carente l\'interleave vale SEMPRE')
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('Richiamo antagonista')
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('MAI in fondo')
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('le calorie guidano, il volume segue')
    expect(PROFESSIONAL_WORKOUT_SYSTEM_PROMPT).toContain('dip compreso')
  })
  it('il prompt di analisi chiede di analizzare prima la scheda dell utente e poi l ibrido', () => {
    expect(ANALISI_SCHEDA_SYSTEM_PROMPT).toContain('NON generare subito la tua versione')
    expect(ANALISI_SCHEDA_SYSTEM_PROMPT).toContain('IBRIDA')
  })
  it("sanifica una risposta parziale senza esplodere e rifiuta quella vuota", () => {
    const a = sanitizeSchedaAnalysis({ sequenza: 'Petto → Petto', controlli: { interleave: { ok: false, nota: 'due petto in fila' } }, confronto: [{ utente: 'Panca', proposta: 'Alzate', vincitore: 'x' }], ibrida: [{ esercizio: 'Alzate', rir: 1 }] })
    expect(a.controlli.interleave.ok).toBe(false)
    expect(a.controlli.volume).toEqual({ ok: false, nota: '' })
    expect(a.confronto[0]).toMatchObject({ slot: 1, vincitore: 'pari' })
    expect(a.ibrida[0].rir).toBe('1')
    expect(() => sanitizeSchedaAnalysis({})).toThrow()
    const b = sanitizeSchedaAnalysis({ sequenza: 'x', tua: [{ testo: 'Panca', exercise_id: 'panca_piana', sets: '4', reps: 8 }, { testo: 'Boh', exercise_id: 'null' }] })
    expect(b.tua[0]).toMatchObject({ slot: 1, exercise_id: 'panca_piana', reps: '8' })
    expect(b.tua[1].exercise_id).toBeNull()
    expect(b.proposta).toEqual([])
  })
})

import { leggiRispostaLibera } from './deepseek'

describe('risposta del coach in testo libero (25/09)', () => {
  it('il testo normale diventa il messaggio della chat, non un errore', () => {
    expect(leggiRispostaLibera('Hai ragione: spalle e braccia sono a 8 serie, troppo poche.')).toEqual({ messaggio: 'Hai ragione: spalle e braccia sono a 8 serie, troppo poche.' })
  })
  it('il JSON valido resta com\'è, anche dentro un recinto ```json', () => {
    expect(leggiRispostaLibera('```json\n{"messaggio":"ok","opzioni":["a"]}\n```')).toEqual({ messaggio: 'ok', opzioni: ['a'] })
  })
  it('dal JSON rovinato recupera almeno il messaggio', () => {
    expect(leggiRispostaLibera('{"messaggio":"Ecco il perché","piano": {rotto')).toEqual({ messaggio: 'Ecco il perché' })
  })
  it('toglie il ragionamento <think> dei modelli che lo mostrano', () => {
    expect(leggiRispostaLibera('<think>ragiono</think>Risposta finale')).toEqual({ messaggio: 'Risposta finale' })
  })
})
