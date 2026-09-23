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
  })
})
