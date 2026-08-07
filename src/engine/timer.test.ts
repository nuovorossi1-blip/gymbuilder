import { describe, expect, it } from 'vitest'
import { completionEvent, elapsedSeconds, remainingSeconds, resumeClock, transitionInterval } from './timer'
import { DEFAULT_AUDIO_SETTINGS, soundForEvent, vibrationForEvent } from './audio'

describe('Unified Timer Engine', () => {
  it('usa timestamp reali e recupera correttamente dopo perdita di focus', () => {
    const clock = { startedAt: 1_000, durationSec: 90, pausedTotalMs: 0 }
    expect(remainingSeconds(clock, 31_400)).toBe(60)
    expect(elapsedSeconds(clock, 31_400)).toBe(30)
  })
  it('set → rest → next set produce segnali distinti', () => {
    const rest = transitionInterval({ round: 1, phase: 'work', remainingSec: 1 }, { workSec: 30, restSec: 10, rounds: 2 }, 1)
    expect(rest.events[0].type).toBe('REST_STARTED')
    const work = transitionInterval({ round: 1, phase: 'rest', remainingSec: 1 }, { workSec: 30, restSec: 10, rounds: 2 }, 2)
    expect(work.events.map((event) => event.type)).toEqual(['ROUND_STARTED', 'WORK_STARTED'])
  })
  it('Tabata work → rest → work', () => {
    const config = { workSec: 20, restSec: 10, rounds: 8 }
    expect(transitionInterval({ round: 1, phase: 'work', remainingSec: 1 }, config).state.phase).toBe('rest')
    expect(transitionInterval({ round: 1, phase: 'rest', remainingSec: 1 }, config).state).toEqual({ round: 2, phase: 'work', remainingSec: 20 })
  })
  it('EMOM minute 1 → minute 2', () => {
    const next = transitionInterval({ round: 1, phase: 'work', remainingSec: 1 }, { workSec: 60, restSec: 0, rounds: 10 })
    expect(next.state.round).toBe(2); expect(next.events.some((event) => event.type === 'ROUND_STARTED')).toBe(true)
  })
  it('AMRAP emette warning e finish', () => {
    const warning = transitionInterval({ round: 1, phase: 'work', remainingSec: 4 }, { workSec: 900, restSec: 0, rounds: 1 })
    expect(warning.events[0].type).toBe('WARNING')
    expect(completionEvent('amrap').type).toBe('TIMER_COMPLETED')
  })
  it('For Time distingue completamento e time cap', () => {
    expect(completionEvent('for_time').type).toBe('TIMER_COMPLETED')
    expect(completionEvent('for_time', true).type).toBe('TIME_CAP_REACHED')
  })
  it('Hybrid strength → metcon usa un segnale di avvio', () => {
    expect(soundForEvent('TIMER_STARTED', DEFAULT_AUDIO_SETTINGS)).toBe('beep')
  })
  it('gli ultimi tre secondi hanno beep e vibrazione distinti', () => {
    expect(soundForEvent('WARNING', DEFAULT_AUDIO_SETTINGS)).toBe('beep')
    expect(vibrationForEvent('WARNING', DEFAULT_AUDIO_SETTINGS)).toBe(70)
    expect(vibrationForEvent('TIMER_COMPLETED', DEFAULT_AUDIO_SETTINGS)).toEqual([140, 80, 180])
  })
  it('pausa non crea drift', () => {
    expect(resumeClock({ startedAt: 0, durationSec: 10, pausedTotalMs: 0, pausedAt: 2_000 }, 7_000).pausedTotalMs).toBe(5_000)
  })
})
