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
