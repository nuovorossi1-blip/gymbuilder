export interface IntervalTimerConfig { workSec: number; restSec: number; rounds: number }
export interface IntervalTimerState { round: number; phase: 'work' | 'rest' | 'complete'; remainingSec: number }

export function nextTimerSecond(state: IntervalTimerState, config: IntervalTimerConfig): IntervalTimerState {
  if (state.phase === 'complete') return state
  if (state.remainingSec > 1) return { ...state, remainingSec: state.remainingSec - 1 }
  if (state.phase === 'work') return { round: state.round, phase: 'rest', remainingSec: config.restSec }
  if (state.round >= config.rounds) return { round: config.rounds, phase: 'complete', remainingSec: 0 }
  return { round: state.round + 1, phase: 'work', remainingSec: config.workSec }
}
