import { useRef, type TouchEvent, type MouseEvent } from 'react'

export interface SwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  minDistance?: number
  maxVerticalDistance?: number
}

export interface Point {
  x: number
  y: number
}

export function calculateSwipeGesture(
  start: Point,
  end: Point,
  options: Pick<SwipeOptions, 'minDistance' | 'maxVerticalDistance'> = {}
): 'left' | 'right' | null {
  const minDistance = options.minDistance ?? 75
  const maxVerticalDistance = options.maxVerticalDistance ?? 45

  const deltaX = end.x - start.x
  const deltaY = end.y - start.y

  // Se la componente verticale supera la tolleranza o se la traiettoria non è prevalentemente orizzontale
  // (rapporto |deltaX| / |deltaY| < 2.0), ignoriamo lo swipe per evitare falsi positivi durante lo scroll verticale.
  if (Math.abs(deltaY) > maxVerticalDistance || Math.abs(deltaX) < Math.abs(deltaY) * 2.0) {
    return null
  }

  if (deltaX <= -minDistance) {
    return 'left'
  }
  if (deltaX >= minDistance) {
    return 'right'
  }

  return null
}

export function useSwipeGesture(options: SwipeOptions) {
  const touchStart = useRef<Point | null>(null)
  const touchEnd = useRef<Point | null>(null)
  const isMouseDown = useRef<boolean>(false)

  const handleStart = (x: number, y: number) => {
    touchStart.current = { x, y }
    touchEnd.current = { x, y }
  }

  const handleMove = (x: number, y: number) => {
    touchEnd.current = { x, y }
  }

  const handleFinish = () => {
    if (touchStart.current && touchEnd.current) {
      const gesture = calculateSwipeGesture(touchStart.current, touchEnd.current, options)
      if (gesture === 'left') {
        options.onSwipeLeft?.()
      } else if (gesture === 'right') {
        options.onSwipeRight?.()
      }
    }
    touchStart.current = null
    touchEnd.current = null
    isMouseDown.current = false
  }

  return {
    onTouchStart: (e: TouchEvent) => {
      const touch = e.touches[0]
      if (touch) handleStart(touch.clientX, touch.clientY)
    },
    onTouchMove: (e: TouchEvent) => {
      const touch = e.touches[0]
      if (touch) handleMove(touch.clientX, touch.clientY)
    },
    onTouchEnd: handleFinish,
    onMouseDown: (e: MouseEvent) => {
      isMouseDown.current = true
      handleStart(e.clientX, e.clientY)
    },
    onMouseMove: (e: MouseEvent) => {
      if (isMouseDown.current) handleMove(e.clientX, e.clientY)
    },
    onMouseUp: () => {
      if (isMouseDown.current) handleFinish()
    },
    onMouseLeave: () => {
      if (isMouseDown.current) handleFinish()
    },
  }
}
