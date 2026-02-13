import { useCallback, useEffect, useState } from 'react'

import type { AppError } from '../../shared/app-error'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { formatLocalDate } from '../lib/dates'
import { useAppEvents } from '../app/AppEventsContext'
import { UpcomingGroupedList } from '../features/tasks/UpcomingGroupedList'

export function UpcomingPage() {
  const { revision } = useAppEvents()
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [error, setError] = useState<AppError | null>(null)

  const today = formatLocalDate(new Date())

  const refresh = useCallback(async () => {
    const today = formatLocalDate(new Date())
    const res = await window.api.task.listUpcoming(today)
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
      <UpcomingGroupedList
        tasks={tasks}
        today={today}
        onToggleDone={async (taskId, done) => {
          const updated = await window.api.task.toggleDone(taskId, done)
          if (!updated.ok) {
            setError(updated.error)
            return
          }
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
