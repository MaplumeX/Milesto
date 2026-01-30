import { createContext, useContext } from 'react'

export type OpenEditorHandle = {
  taskId: string
  flushPendingChanges: () => Promise<boolean>
  focusTitle: () => void
  focusLastErrorTarget: () => void
}

export type TaskSelection = {
  selectedTaskId: string | null
  selectTask: (taskId: string | null) => void
  // "Selection" (highlight/navigation) is separate from "open" (editing).
  openTaskId: string | null
  openTask: (taskId: string) => Promise<void>
  closeTask: () => void

  // Allows the shell to flush before switching tasks.
  registerOpenEditor: (handle: OpenEditorHandle | null) => void
}

const TaskSelectionContext = createContext<TaskSelection | null>(null)

export function TaskSelectionProvider({
  value,
  children,
}: {
  value: TaskSelection
  children: React.ReactNode
}) {
  return <TaskSelectionContext.Provider value={value}>{children}</TaskSelectionContext.Provider>
}

export function useTaskSelection(): TaskSelection {
  const ctx = useContext(TaskSelectionContext)
  if (!ctx) throw new Error('useTaskSelection must be used within TaskSelectionProvider')
  return ctx
}
