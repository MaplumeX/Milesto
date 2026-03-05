import { useEffect, useMemo } from 'react'

import { useAppEvents } from '../../app/AppEventsContext'

type TaskTitleCarrier = {
  id: string
  title: string
  updated_at: string
}

export function useOptimisticTaskTitles<T extends TaskTitleCarrier>(items: T[]): T[] {
  const { optimisticTaskTitleById, ackOptimisticTaskTitle } = useAppEvents()

  const { merged, ack } = useMemo(() => {
    const optimisticIds = Object.keys(optimisticTaskTitleById)
    if (items.length === 0 || optimisticIds.length === 0) {
      return { merged: items, ack: [] as Array<{ id: string; updated_at: string }> }
    }

    let didChange = false
    const toAck: Array<{ id: string; updated_at: string }> = []

    const next = items.map((item) => {
      const patch = optimisticTaskTitleById[item.id]
      if (!patch) return item

      const patchMs = Date.parse(patch.updated_at)
      const baseMs = Date.parse(item.updated_at)
      if (Number.isFinite(patchMs) && Number.isFinite(baseMs) && patchMs <= baseMs) {
        toAck.push({ id: item.id, updated_at: item.updated_at })
        return item
      }

      if (patch.title === item.title) return item

      didChange = true
      return { ...item, title: patch.title } as T
    })

    return { merged: didChange ? next : items, ack: toAck }
  }, [items, optimisticTaskTitleById])

  useEffect(() => {
    for (const { id, updated_at } of ack) {
      ackOptimisticTaskTitle(id, updated_at)
    }
  }, [ack, ackOptimisticTaskTitle])

  return merged
}

