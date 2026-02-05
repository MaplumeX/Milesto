import { useEffect, useState } from 'react'

import { defaultDropAnimationSideEffects, type DropAnimation } from '@dnd-kit/core'

export const TASK_DND_DROP_ANIMATION_DURATION_MS = 160
export const TASK_DND_DROP_ANIMATION_EASING = 'ease-out'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function isSelfTestReducedMotionEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const url = new URL(window.location.href)
    return url.searchParams.get('selfTest') === '1' && url.searchParams.get('reducedMotion') === '1'
  } catch {
    return false
  }
}

export function usePrefersReducedMotion(): boolean {
  const forcedSelfTestReducedMotion = isSelfTestReducedMotionEnabled()
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (forcedSelfTestReducedMotion) return true
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(REDUCED_MOTION_QUERY).matches
  })

  useEffect(() => {
    if (forcedSelfTestReducedMotion) {
      setPrefersReducedMotion(true)
      return
    }
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mql = window.matchMedia(REDUCED_MOTION_QUERY)
    const update = () => setPrefersReducedMotion(mql.matches)

    update()

    // Some older runtimes only support addListener/removeListener.
    type LegacyMediaQueryList = MediaQueryList & {
      addListener: (listener: () => void) => void
      removeListener: (listener: () => void) => void
    }

    try {
      mql.addEventListener('change', update)
      return () => mql.removeEventListener('change', update)
    } catch {
      const legacy = mql as LegacyMediaQueryList
      legacy.addListener(update)
      return () => legacy.removeListener(update)
    }
  }, [forcedSelfTestReducedMotion])

  return prefersReducedMotion
}

export function getTaskDropAnimationDurationMs(prefersReducedMotion: boolean): number {
  return prefersReducedMotion ? 0 : TASK_DND_DROP_ANIMATION_DURATION_MS
}

export function getTaskDropAnimationConfig(prefersReducedMotion: boolean): DropAnimation | null {
  if (prefersReducedMotion) return null

  return {
    duration: TASK_DND_DROP_ANIMATION_DURATION_MS,
    easing: TASK_DND_DROP_ANIMATION_EASING,
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        // Keep the in-list node visually suppressed while the overlay animates to rest.
        active: {
          opacity: '0',
        },
      },
    }),
  }
}
