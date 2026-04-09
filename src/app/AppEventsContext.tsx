import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type OptimisticTaskTitle = {
  title: string
  updated_at: string
}

type AppEvents = {
  revision: number
  bumpRevision: () => void
  optimisticTaskTitleById: Record<string, OptimisticTaskTitle>
  upsertOptimisticTaskTitle: (input: { id: string; title: string; updated_at: string }) => void
  ackOptimisticTaskTitle: (taskId: string, updatedAt: string) => void
}

const AppEventsContext = createContext<AppEvents | null>(null)

export function AppEventsProvider({ children }: { children: React.ReactNode }) {
  const [revision, setRevision] = useState(0)
  const bumpRevision = useCallback(() => setRevision((v) => v + 1), [])

  const [optimisticTaskTitleById, setOptimisticTaskTitleById] = useState<Record<string, OptimisticTaskTitle>>({})

  const upsertOptimisticTaskTitle = useCallback(
    ({ id, title, updated_at }: { id: string; title: string; updated_at: string }) => {
      setOptimisticTaskTitleById((prev) => {
        const existing = prev[id]
        if (existing && existing.title === title) return prev
        return { ...prev, [id]: { title, updated_at } }
      })
    },
    []
  )

  const ackOptimisticTaskTitle = useCallback((taskId: string, updatedAt: string) => {
    setOptimisticTaskTitleById((prev) => {
      const existing = prev[taskId]
      if (!existing) return prev

      const existingMs = Date.parse(existing.updated_at)
      const baseMs = Date.parse(updatedAt)
      if (Number.isFinite(existingMs) && Number.isFinite(baseMs) && existingMs > baseMs) return prev

      const next = { ...prev }
      delete next[taskId]
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      revision,
      bumpRevision,
      optimisticTaskTitleById,
      upsertOptimisticTaskTitle,
      ackOptimisticTaskTitle,
    }),
    [ackOptimisticTaskTitle, bumpRevision, optimisticTaskTitleById, revision, upsertOptimisticTaskTitle]
  )
  return <AppEventsContext.Provider value={value}>{children}</AppEventsContext.Provider>
}

export function useAppEvents(): AppEvents {
  const ctx = useContext(AppEventsContext)
  if (!ctx) throw new Error('useAppEvents must be used within AppEventsProvider')
  return ctx
}
