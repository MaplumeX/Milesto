import { useCallback, useEffect, useState } from 'react'

import type { AppError } from '../../shared/app-error'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { formatLocalDate } from '../lib/dates'
import { TaskList } from '../features/tasks/TaskList'
import { useAppEvents } from '../app/AppEventsContext'
import { useTaskSelection } from '../features/tasks/TaskSelectionContext'

export function TodayPage() {
  const { revision } = useAppEvents()
  const { selectedTaskId, selectTask } = useTaskSelection()
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [error, setError] = useState<AppError | null>(null)

  const refresh = useCallback(async () => {
    const today = formatLocalDate(new Date())
    const res = await window.api.task.listToday(today)
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
        title="Today"
        tasks={tasks}
        headerActions={
          <>
            <button
              type="button"
              className="button button-ghost"
              disabled={!selectedTaskId}
              onClick={() => {
                const idx = tasks.findIndex((t) => t.id === selectedTaskId)
                if (idx <= 0) return
                const next = [...tasks]
                const tmp = next[idx - 1]!
                next[idx - 1] = next[idx]!
                next[idx] = tmp
                void (async () => {
                  setTasks(next)
                  const res = await window.api.task.reorderBatch('today', next.map((t) => t.id))
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  selectTask(selectedTaskId)
                  await refresh()
                })()
              }}
            >
              Move Up
            </button>
            <button
              type="button"
              className="button button-ghost"
              disabled={!selectedTaskId}
              onClick={() => {
                const idx = tasks.findIndex((t) => t.id === selectedTaskId)
                if (idx < 0 || idx >= tasks.length - 1) return
                const next = [...tasks]
                const tmp = next[idx + 1]!
                next[idx + 1] = next[idx]!
                next[idx] = tmp
                void (async () => {
                  setTasks(next)
                  const res = await window.api.task.reorderBatch('today', next.map((t) => t.id))
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  selectTask(selectedTaskId)
                  await refresh()
                })()
              }}
            >
              Move Down
            </button>
          </>
        }
        onCreate={async (title) => {
          const today = formatLocalDate(new Date())
          const created = await window.api.task.create({
            title,
            base_list: 'anytime',
            scheduled_at: today,
          })
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
