import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'

import type { AppError } from '../../shared/app-error'
import type { Area } from '../../shared/schemas/area'
import type { Project } from '../../shared/schemas/project'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { taskListIdArea } from '../../shared/task-list-ids'

import { useAppEvents } from '../app/AppEventsContext'
import { TaskList } from '../features/tasks/TaskList'

export function AreaPage() {
  const { revision, bumpRevision } = useAppEvents()
  const { areaId } = useParams<{ areaId: string }>()
  const aid = areaId ?? ''

  const [area, setArea] = useState<Area | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [error, setError] = useState<AppError | null>(null)

  const refresh = useCallback(async () => {
    if (!aid) return

    const [areaRes, projectsRes, tasksRes] = await Promise.all([
      window.api.area.get(aid),
      window.api.project.listOpenByArea(aid),
      window.api.task.listArea(aid),
    ])

    if (!areaRes.ok) {
      setError(areaRes.error)
      return
    }
    if (!projectsRes.ok) {
      setError(projectsRes.error)
      return
    }
    if (!tasksRes.ok) {
      setError(tasksRes.error)
      return
    }

    setError(null)
    setArea(areaRes.data)
    setProjects(projectsRes.data)
    setTasks(tasksRes.data)
  }, [aid])

  useEffect(() => {
    void revision
    void refresh()
  }, [refresh, revision])

  const title = area?.title ?? 'Area'
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.title.localeCompare(b.title)),
    [projects]
  )

  if (!aid) {
    return (
      <div className="page">
        <h1 className="page-title">Area</h1>
        <div className="error">Missing area id.</div>
      </div>
    )
  }

  return (
    <>
      {error ? <ErrorBanner error={error} /> : null}

      <TaskList
        title={title}
        listId={taskListIdArea(aid)}
        tasks={tasks}
        onAfterReorder={refresh}
        headerActions={
          <>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                if (!area) return
                const next = prompt('Rename area', area.title)
                if (!next) return
                void (async () => {
                  const res = await window.api.area.update({ id: area.id, title: next })
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                })()
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                const confirmed = confirm('Delete this area? Projects and tasks under it will be soft-deleted.')
                if (!confirmed) return
                void (async () => {
                  const res = await window.api.area.delete(aid)
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                })()
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                const title = prompt('New project title')
                if (!title) return
                void (async () => {
                  const res = await window.api.project.create({ title, area_id: aid })
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                })()
              }}
            >
              + Project
            </button>
          </>
        }
        onToggleDone={async (taskId, done) => {
          const updated = await window.api.task.toggleDone(taskId, done)
          if (!updated.ok) throw new Error(`${updated.error.code}: ${updated.error.message}`)
          await refresh()
        }}
      />

      <div className="page">
        <div className="sections-header">
          <div className="sections-title">Projects</div>
        </div>
        <ul className="task-list">
          {sortedProjects.map((p) => (
            <li key={p.id} className="task-row">
              <NavLink className="nav-item" to={`/projects/${p.id}`}>
                {p.title}
              </NavLink>
            </li>
          ))}
          {sortedProjects.length === 0 ? <li className="nav-muted">(empty)</li> : null}
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
