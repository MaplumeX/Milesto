import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import type { AppError } from '../../shared/app-error'
import type { Area } from '../../shared/schemas/area'
import type { Project, ProjectSection } from '../../shared/schemas/project'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { TaskList } from '../features/tasks/TaskList'
import { useAppEvents } from '../app/AppEventsContext'

export function ProjectPage() {
  const { revision, bumpRevision } = useAppEvents()
  const { projectId } = useParams<{ projectId: string }>()
  const pid = projectId ?? ''

  const [project, setProject] = useState<Project | null>(null)
  const [areas, setAreas] = useState<Area[]>([])
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [sections, setSections] = useState<ProjectSection[]>([])
  const [error, setError] = useState<AppError | null>(null)

  const refresh = useCallback(async () => {
    if (!pid) return

    const [projectRes, areasRes, tasksRes, sectionsRes] = await Promise.all([
      window.api.project.get(pid),
      window.api.area.list(),
      window.api.task.listProject(pid),
      window.api.project.listSections(pid),
    ])

    if (!projectRes.ok) {
      setError(projectRes.error)
      return
    }
    if (!areasRes.ok) {
      setError(areasRes.error)
      return
    }
    if (!tasksRes.ok) {
      setError(tasksRes.error)
      return
    }
    if (!sectionsRes.ok) {
      setError(sectionsRes.error)
      return
    }

    setError(null)
    setProject(projectRes.data)
    setAreas(areasRes.data)
    setTasks(tasksRes.data)
    setSections(sectionsRes.data)
  }, [pid])

  useEffect(() => {
    void revision
    void refresh()
  }, [refresh, revision])

  const bySection = useMemo(() => {
    const map = new Map<string, TaskListItem[]>()
    const none: TaskListItem[] = []
    for (const t of tasks) {
      if (!t.section_id) {
        none.push(t)
        continue
      }
      const list = map.get(t.section_id) ?? []
      list.push(t)
      map.set(t.section_id, list)
    }
    const sortByRank = (a: TaskListItem, b: TaskListItem) => {
      const ar = a.rank ?? Number.POSITIVE_INFINITY
      const br = b.rank ?? Number.POSITIVE_INFINITY
      if (ar !== br) return ar - br
      return a.created_at.localeCompare(b.created_at)
    }

    none.sort(sortByRank)
    for (const list of map.values()) {
      list.sort(sortByRank)
    }

    return { none, map }
  }, [tasks])

  if (!pid) {
    return (
      <div className="page">
        <h1 className="page-title">Project</h1>
        <div className="error">Missing project id.</div>
      </div>
    )
  }

  const title = project?.title ?? 'Project'

  return (
    <>
      {error ? <ErrorBanner error={error} /> : null}

      {project ? (
        <div className="page" style={{ paddingBottom: 0 }}>
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <label className="tag-pill">
              <span>Area</span>
              <select
                className="input"
                style={{ width: 220, padding: '6px 10px' }}
                value={project.area_id ?? ''}
                onChange={(e) => {
                  const nextAreaId = e.target.value ? e.target.value : null
                  void (async () => {
                    const res = await window.api.project.update({ id: project.id, area_id: nextAreaId })
                    if (!res.ok) {
                      setError(res.error)
                      return
                    }
                    // Keep sidebar grouping in sync.
                    bumpRevision()
                    await refresh()
                  })()
                }}
              >
                <option value="">(none)</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      <TaskList
        title={title}
        tasks={bySection.none}
        onCreate={async (title) => {
          const created = await window.api.task.create({
            title,
            base_list: 'anytime',
            project_id: pid,
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

      <div className="page">
        <div className="sections-header">
          <div className="sections-title">Sections</div>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              const next = prompt('Rename project', title)
              if (!next || !project) return
              void (async () => {
                const res = await window.api.project.update({ id: project.id, title: next })
                if (!res.ok) {
                  alert(`${res.error.code}: ${res.error.message}`)
                  return
                }
                await refresh()
              })()
            }}
          >
            Rename
          </button>

          {project ? (
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                void (async () => {
                  const nextStatus = project.status === 'done' ? 'open' : 'done'
                  const res = await window.api.project.update({ id: project.id, status: nextStatus })
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                })()
              }}
            >
              {project.status === 'done' ? 'Reopen' : 'Mark Done'}
            </button>
          ) : null}
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              const title = prompt('New section title')
              if (!title) return
              void (async () => {
                const res = await window.api.project.createSection(pid, title)
                if (!res.ok) {
                  alert(`${res.error.code}: ${res.error.message}`)
                  return
                }
                await refresh()
              })()
            }}
          >
            + Section
          </button>
        </div>

        {sections.map((s) => {
          const sectionTasks = bySection.map.get(s.id) ?? []
          return (
            <div key={s.id} className="section">
              <div className="section-header">
                <div className="section-title">{s.title}</div>
                <div className="section-actions">
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      const next = prompt('Rename section', s.title)
                      if (!next) return
                      void (async () => {
                        const res = await window.api.project.renameSection(s.id, next)
                        if (!res.ok) {
                          alert(`${res.error.code}: ${res.error.message}`)
                          return
                        }
                        await refresh()
                      })()
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      const confirmed = confirm('Delete section? Tasks will move to previous section.')
                      if (!confirmed) return
                      void (async () => {
                        const res = await window.api.project.deleteSection(s.id)
                        if (!res.ok) {
                          alert(`${res.error.code}: ${res.error.message}`)
                          return
                        }
                        await refresh()
                      })()
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <ul className="task-list">
                {sectionTasks.map((t) => (
                  <li key={t.id} className="task-row">
                    <label className="task-checkbox">
                      <input
                        type="checkbox"
                        checked={t.status === 'done'}
                        onChange={(e) => {
                          void (async () => {
                            const updated = await window.api.task.toggleDone(t.id, e.target.checked)
                            if (!updated.ok) {
                              alert(`${updated.error.code}: ${updated.error.message}`)
                              return
                            }
                            await refresh()
                          })()
                        }}
                      />
                    </label>
                    <div className="task-title">{t.title}</div>
                  </li>
                ))}
                {sectionTasks.length === 0 ? <li className="nav-muted">(empty)</li> : null}
              </ul>
            </div>
          )
        })}
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
