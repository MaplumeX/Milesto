import { useEffect, useState } from 'react'

import { formatLocalDate } from './dates'

export function getLocalToday(): string {
  return formatLocalDate(new Date())
}

function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  const ms = next.getTime() - now.getTime()
  return ms > 0 ? ms : 0
}

export function useLocalToday(): string {
  const [today, setToday] = useState(() => getLocalToday())

  useEffect(() => {
    let timeoutId: number | null = null
    let isDisposed = false

    const arm = () => {
      const now = new Date()
      const delayMs = msUntilNextLocalMidnight(now) + 250

      timeoutId = window.setTimeout(() => {
        if (isDisposed) return
        setToday(getLocalToday())
        arm()
      }, delayMs)
    }

    arm()

    return () => {
      isDisposed = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [])

  return today
}
