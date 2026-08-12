import { describe, it, expect } from 'vitest'
import { calculateSwipeGesture } from '../useSwipeGesture'

describe('calculateSwipeGesture', () => {
  it('ritorna "left" quando lo swipe muove il dito da destra a sinistra', () => {
    const start = { x: 200, y: 100 }
    const end = { x: 100, y: 105 } // Delta X = -100px
    expect(calculateSwipeGesture(start, end)).toBe('left')
  })

  it('ritorna "right" quando lo swipe muove il dito da sinistra a destra', () => {
    const start = { x: 100, y: 100 }
    const end = { x: 200, y: 102 } // Delta X = +100px
    expect(calculateSwipeGesture(start, end)).toBe('right')
  })

  it('ritorna null se lo spostamento orizzontale è inferiore a minDistance', () => {
    const start = { x: 100, y: 100 }
    const end = { x: 120, y: 100 } // Delta X = 20px (< 50px)
    expect(calculateSwipeGesture(start, end, { minDistance: 50 })).toBeNull()
  })

  it('ritorna null se lo spostamento verticale è troppo ampio (scroll naturale)', () => {
    const start = { x: 200, y: 100 }
    const end = { x: 100, y: 300 } // Delta Y = 200px (> 80px)
    expect(calculateSwipeGesture(start, end, { maxVerticalDistance: 80 })).toBeNull()
  })

  it('ritorna null per movimenti diagonali dove domina lo scroll verticale', () => {
    const start = { x: 200, y: 100 }
    const end = { x: 120, y: 160 } // Delta X = -80px, Delta Y = 60px (rapporto 1.33 < 2.0)
    expect(calculateSwipeGesture(start, end)).toBeNull()
  })
})
