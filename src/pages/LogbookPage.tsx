import { useCallback, useEffect, useState } from 'react'

import type { AppError } from '../../shared/app-error'
import type { Project } from '../../shared/schemas/project'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { LogbookGroupedList } from '../features/logbook/LogbookGroupedList'
import { useAppEvents } from '../app/AppEventsContext'

export function LogbookPage() {
  const { revision, bumpRevision } = useAppEvents()
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState<AppError | null>(null)

  const refresh = useCallback(async () => {
    const [tasksRes, projectsRes] = await Promise.all([
      window.api.task.listLogbook(),
      window.api.project.listDone(),
    ])

    if (!tasksRes.ok) {
      setError(tasksRes.error)
      return
    }
    if (!projectsRes.ok) {
      setError(projectsRes.error)
      return
    }

    setError(null)
    setTasks(tasksRes.data)
    setProjects(projectsRes.data)
  }, [])

  useEffect(() => {
    void revision
    void refresh()
  }, [refresh, revision])

  return (
    <>
      {error ? <ErrorBanner error={error} /> : null}

      <LogbookGroupedList
        tasks={tasks}
        projects={projects}
        onRestoreTask={async (taskId) => {
          const updated = await window.api.task.toggleDone(taskId, false)
          if (!updated.ok) {
            setError(updated.error)
            return
          }
          await refresh()
        }}
        onReopenProject={async (projectId) => {
          const res = await window.api.project.update({ id: projectId, status: 'open' })
          if (!res.ok) {
            setError(res.error)
            return
          }
          bumpRevision()
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
