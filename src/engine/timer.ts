export type TimerPhase = 'countdown' | 'work' | 'rest' | 'round' | 'set' | 'emom' | 'amrap' | 'for_time' | 'tabata' | 'cap' | 'completed'
export type TimerEventType =
  | 'TIMER_STARTED' | 'COUNTDOWN_STARTED' | 'WORK_STARTED' | 'REST_STARTED'
  | 'ROUND_STARTED' | 'SET_STARTED' | 'WARNING' | 'TIMER_COMPLETED' | 'TIME_CAP_REACHED'

export interface TimerEvent { type: TimerEventType; at: number; phase: TimerPhase; round?: number; set?: number }
export interface TimerClock { startedAt: number; durationSec: number; pausedAt?: number; pausedTotalMs: number }

/** Il timestamp è la fonte di verità: setInterval serve solo a ridisegnare la UI. */
export function remainingSeconds(clock: TimerClock, now = Date.now()): number {
  const effectiveNow = clock.pausedAt ?? now
  const elapsed = Math.max(0, effectiveNow - clock.startedAt - clock.pausedTotalMs)
  return Math.max(0, Math.ceil(clock.durationSec - elapsed / 1000))
}

export function elapsedSeconds(clock: TimerClock, now = Date.now()): number {
  const effectiveNow = clock.pausedAt ?? now
  return Math.max(0, Math.floor((effectiveNow - clock.startedAt - clock.pausedTotalMs) / 1000))
}

export function pauseClock(clock: TimerClock, now = Date.now()): TimerClock {
  return clock.pausedAt ? clock : { ...clock, pausedAt: now }
}

export function resumeClock(clock: TimerClock, now = Date.now()): TimerClock {
  if (!clock.pausedAt) return clock
  return { ...clock, pausedTotalMs: clock.pausedTotalMs + now - clock.pausedAt, pausedAt: undefined }
}

export function countdownEvents(previous: number, current: number, phase: TimerPhase, now = Date.now()): TimerEvent[] {
  if (current === previous) return []
  if (current > 0 && current <= 3) return [{ type: 'WARNING', at: now, phase }]
  return []
}

export interface IntervalTimerConfig { workSec: number; restSec: number; rounds: number }
export interface IntervalTimerState { round: number; phase: 'work' | 'rest' | 'complete'; remainingSec: number }

export interface IntervalTransition { state: IntervalTimerState; events: TimerEvent[] }

export function transitionInterval(state: IntervalTimerState, config: IntervalTimerConfig, at = Date.now()): IntervalTransition {
  if (state.phase === 'complete') return { state, events: [] }
  if (state.remainingSec > 1) {
    const next = { ...state, remainingSec: state.remainingSec - 1 }
    return { state: next, events: countdownEvents(state.remainingSec, next.remainingSec, state.phase, at) }
  }
  if (state.phase === 'work' && config.restSec > 0) {
    return { state: { round: state.round, phase: 'rest', remainingSec: config.restSec }, events: [{ type: 'REST_STARTED', at, phase: 'rest', round: state.round }] }
  }
  if (state.round >= config.rounds) {
    return { state: { round: config.rounds, phase: 'complete', remainingSec: 0 }, events: [{ type: 'TIMER_COMPLETED', at, phase: 'completed', round: config.rounds }] }
  }
  return { state: { round: state.round + 1, phase: 'work', remainingSec: config.workSec }, events: [{ type: 'ROUND_STARTED', at, phase: 'work', round: state.round + 1 }, { type: 'WORK_STARTED', at, phase: 'work', round: state.round + 1 }] }
}

/** Compatibilità col vecchio test/API. */
export function nextTimerSecond(state: IntervalTimerState, config: IntervalTimerConfig): IntervalTimerState {
  return transitionInterval(state, config).state
}

export function completionEvent(phase: TimerPhase, capped = false, at = Date.now()): TimerEvent {
  return { type: capped ? 'TIME_CAP_REACHED' : 'TIMER_COMPLETED', at, phase: capped ? 'cap' : phase }
}
