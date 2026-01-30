import { createContext, useContext } from 'react'

// Exposes the single main content scroller element (.content-scroll).
// Consumers (e.g., virtualized lists) can use this as the scroll host.
const ContentScrollContext = createContext<React.RefObject<HTMLDivElement | null> | null>(null)

export function ContentScrollProvider({
  scrollRef,
  children,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>
  children: React.ReactNode
}) {
  return <ContentScrollContext.Provider value={scrollRef}>{children}</ContentScrollContext.Provider>
}

export function useContentScrollElement(): HTMLDivElement | null {
  const ref = useContext(ContentScrollContext)
  if (!ref) throw new Error('useContentScrollElement must be used within ContentScrollProvider')
  return ref.current
}

export function useContentScrollRef(): React.RefObject<HTMLDivElement | null> {
  const ref = useContext(ContentScrollContext)
  if (!ref) throw new Error('useContentScrollRef must be used within ContentScrollProvider')
  return ref
}
