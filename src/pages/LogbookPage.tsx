import { useCallback, useEffect, useState } from 'react'

import type { AppError } from '../../shared/app-error'
import type { Project } from '../../shared/schemas/project'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { TaskList } from '../features/tasks/TaskList'
import { useAppEvents } from '../app/AppEventsContext'
import { NavLink } from 'react-router-dom'

export function LogbookPage() {
  const { revision } = useAppEvents()
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
      <TaskList
        title="Logbook"
        tasks={tasks}
        showCreate={false}
        onToggleDone={undefined}
        onRestore={async (taskId) => {
          const restored = await window.api.task.restore(taskId)
          if (!restored.ok) throw new Error(`${restored.error.code}: ${restored.error.message}`)
          await refresh()
        }}
      />

      <div className="page">
        <div className="sections-header">
          <div className="sections-title">Completed Projects</div>
        </div>
        <ul className="task-list">
          {projects.map((p) => (
            <li key={p.id} className="task-row">
              <NavLink className="nav-item" to={`/projects/${p.id}`}>
                {p.title}
              </NavLink>
            </li>
          ))}
          {projects.length === 0 ? <li className="nav-muted">(empty)</li> : null}
        </ul>
      </div>
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
