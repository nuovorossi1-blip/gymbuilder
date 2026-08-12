import { type ReactNode } from 'react'
import { useSwipeGesture } from '../hooks/useSwipeGesture'

interface SwipeContainerProps {
  children: ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  direction?: 'left' | 'right' | 'none'
  className?: string
}

export function SwipeContainer({
  children,
  onSwipeLeft,
  onSwipeRight,
  direction = 'none',
  className = '',
}: SwipeContainerProps) {
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft,
    onSwipeRight,
  })

  const animationClass =
    direction === 'left'
      ? 'animate-slide-left'
      : direction === 'right'
      ? 'animate-slide-right'
      : ''

  return (
    <div
      {...swipeHandlers}
      className={`touch-pan-y select-none ${animationClass} ${className}`.trim()}
    >
      {children}
    </div>
  )
}
