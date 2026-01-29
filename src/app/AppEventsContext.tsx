import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type AppEvents = {
  revision: number
  bumpRevision: () => void
}

const AppEventsContext = createContext<AppEvents | null>(null)

export function AppEventsProvider({ children }: { children: React.ReactNode }) {
  const [revision, setRevision] = useState(0)
  const bumpRevision = useCallback(() => setRevision((v) => v + 1), [])
  const value = useMemo(() => ({ revision, bumpRevision }), [revision, bumpRevision])
  return <AppEventsContext.Provider value={value}>{children}</AppEventsContext.Provider>
}

export function useAppEvents(): AppEvents {
  const ctx = useContext(AppEventsContext)
  if (!ctx) throw new Error('useAppEvents must be used within AppEventsProvider')
  return ctx
}
