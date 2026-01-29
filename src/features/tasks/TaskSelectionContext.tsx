import { createContext, useContext } from 'react'

export type TaskSelection = {
  selectedTaskId: string | null
  selectTask: (taskId: string | null) => void
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
