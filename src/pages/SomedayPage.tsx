import { useCallback, useEffect, useState } from 'react'

import type { AppError } from '../../shared/app-error'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { TaskList } from '../features/tasks/TaskList'
import { useAppEvents } from '../app/AppEventsContext'

export function SomedayPage() {
  const { revision } = useAppEvents()
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [error, setError] = useState<AppError | null>(null)

  const refresh = useCallback(async () => {
    const res = await window.api.task.listBase('someday')
    if (!res.ok) {
      setError(res.error)
      return
    }
    setError(null)
    setTasks(res.data)
  }, [])

  useEffect(() => {
    void revision
    void refresh()
  }, [refresh, revision])

  return (
    <>
      {error ? <ErrorBanner error={error} /> : null}
      <TaskList
        title="Someday"
        tasks={tasks}
        onCreate={async (title) => {
          const created = await window.api.task.create({ title, base_list: 'someday' })
          if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`)
          await refresh()
        }}
        onToggleDone={async (taskId, done) => {
          const updated = await window.api.task.toggleDone(taskId, done)
          if (!updated.ok) throw new Error(`${updated.error.code}: ${updated.error.message}`)
          await refresh()
        }}
      />
    </>
  )
}

function ErrorBanner({ error }: { error: AppError }) {
  return (
    <div className="error">
      <div className="error-code">{error.code}</div>
      <div>{error.message}</div>
    </div>
  )
}
