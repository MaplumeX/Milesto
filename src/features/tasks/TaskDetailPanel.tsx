import { useEffect, useMemo, useRef, useState } from 'react'

import type { AppError } from '../../../shared/app-error'
import type { Area } from '../../../shared/schemas/area'
import type { ChecklistItem } from '../../../shared/schemas/checklist'
import type { Project, ProjectSection } from '../../../shared/schemas/project'
import type { Tag } from '../../../shared/schemas/tag'
import type { TaskDetail } from '../../../shared/schemas/task-detail'

import { useAppEvents } from '../../app/AppEventsContext'
import { formatLocalDate } from '../../lib/dates'
import { useTaskSelection } from './TaskSelectionContext'

type Draft = {
  title: string
  notes: string
  base_list: 'inbox' | 'anytime' | 'someday'
  project_id: string | null
  section_id: string | null
  area_id: string | null
  scheduled_at: string | null
  due_at: string | null
}

const TAG_COLOR_PRESETS: Array<{ name: string; value: string | null; hex: string | null }> = [
  { name: 'None', value: null, hex: null },
  { name: 'Red', value: '#d14b2a', hex: '#d14b2a' },
  { name: 'Orange', value: '#d9882a', hex: '#d9882a' },
  { name: 'Yellow', value: '#d1b82a', hex: '#d1b82a' },
  { name: 'Green', value: '#2d8a5f', hex: '#2d8a5f' },
  { name: 'Blue', value: '#2f6fd6', hex: '#2f6fd6' },
  { name: 'Purple', value: '#7a4bd6', hex: '#7a4bd6' },
  { name: 'Gray', value: '#6c6a64', hex: '#6c6a64' },
]

export function TaskDetailPanel() {
  const { selectedTaskId, selectTask } = useTaskSelection()
  const { revision, bumpRevision } = useAppEvents()

  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const lastAutoFocusTaskId = useRef<string | null>(null)

  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<AppError | null>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [sections, setSections] = useState<ProjectSection[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  const [isSaving, setIsSaving] = useState(false)
  const today = useMemo(() => formatLocalDate(new Date()), [])

  useEffect(() => {
    void (async () => {
      const [projectsRes, tagsRes, areasRes] = await Promise.all([
        window.api.project.listOpen(),
        window.api.tag.list(),
        window.api.area.list(),
      ])

      if (projectsRes.ok) setProjects(projectsRes.data)
      if (tagsRes.ok) setTags(tagsRes.data)
      if (areasRes.ok) setAreas(areasRes.data)
    })()
  }, [])

  useEffect(() => {
    // Re-fetch detail after any cross-view mutation.
    void revision

    if (!selectedTaskId) {
      setDetail(null)
      setDraft(null)
      setError(null)
      return
    }

    void (async () => {
      const res = await window.api.task.getDetail(selectedTaskId)
      if (!res.ok) {
        setError(res.error)
        setDetail(null)
        setDraft(null)
        return
      }

      setError(null)
      setDetail(res.data)
      setDraft({
        title: res.data.task.title,
        notes: res.data.task.notes,
        base_list: res.data.task.base_list,
        project_id: res.data.task.project_id,
        section_id: res.data.task.section_id,
        area_id: res.data.task.area_id,
        scheduled_at: res.data.task.scheduled_at,
        due_at: res.data.task.due_at,
      })
    })()
  }, [selectedTaskId, revision])

  useEffect(() => {
    if (!selectedTaskId) return
    if (!draft) return

    // Auto-focus title for newly created tasks (visually empty title).
    if (draft.title.trim() !== '') return
    if (lastAutoFocusTaskId.current === selectedTaskId) return
    lastAutoFocusTaskId.current = selectedTaskId

    const handle = setTimeout(() => {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }, 0)

    return () => clearTimeout(handle)
  }, [selectedTaskId, draft])

  useEffect(() => {
    const projectId = draft?.project_id
    if (!projectId) {
      setSections([])
      return
    }

    void (async () => {
      const res = await window.api.project.listSections(projectId)
      if (!res.ok) {
        setSections([])
        return
      }
      setSections(res.data)
    })()
  }, [draft?.project_id])

  const selectedTagIds = useMemo(() => new Set(detail?.tag_ids ?? []), [detail?.tag_ids])
  const checklist = detail?.checklist_items ?? []

  if (!selectedTaskId || !detail || !draft) return null

  const statusLabel = detail.task.status === 'done' ? 'Done' : 'Open'

  async function handleSave(currentDetail: TaskDetail, currentDraft: Draft) {
    setIsSaving(true)
    setError(null)
    try {
      // PRD rule: Inbox is for unprocessed items. If a task is assigned/scheduled, it should not remain in Inbox.
      const normalizedBaseList =
        currentDraft.base_list === 'inbox' &&
        (currentDraft.project_id !== null || currentDraft.scheduled_at !== null)
          ? 'anytime'
          : currentDraft.base_list

      const res = await window.api.task.update({
        id: currentDetail.task.id,
        title: currentDraft.title,
        notes: currentDraft.notes,
        base_list: normalizedBaseList,
        project_id: currentDraft.project_id,
        section_id: currentDraft.section_id,
        area_id: currentDraft.area_id,
        scheduled_at: currentDraft.scheduled_at,
        due_at: currentDraft.due_at,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }

      bumpRevision()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <aside className="detail" aria-label="Task detail">
      <div className="detail-header">
        <div className="detail-title">Task</div>
        <button type="button" className="button button-ghost" onClick={() => selectTask(null)}>
          Close
        </button>
      </div>

      {error ? (
        <div className="error">
          <div className="error-code">{error.code}</div>
          <div>{error.message}</div>
        </div>
      ) : null}

      <div className="detail-meta">
        <span className={`badge ${detail.task.status === 'done' ? 'badge-done' : 'badge-open'}`}>
          {statusLabel}
        </span>
        {detail.task.scheduled_at ? <span className="badge">Scheduled: {detail.task.scheduled_at}</span> : null}
        {detail.task.due_at ? <span className="badge">Due: {detail.task.due_at}</span> : null}
      </div>

      <div className="detail-field">
        <label className="label" htmlFor="task-title">
          Title
        </label>
        <input
          id="task-title"
          ref={titleInputRef}
          className="input"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </div>

      <div className="detail-field">
        <label className="label" htmlFor="task-notes">
          Notes
        </label>
        <textarea
          id="task-notes"
          className="input"
          rows={6}
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          placeholder="Markdown supported (stored as plain text in v0.1)."
        />
      </div>

      <div className="detail-grid">
        <div className="detail-field">
          <label className="label" htmlFor="task-base-list">
            Base list
          </label>
          <select
            id="task-base-list"
            className="input"
            value={draft.base_list}
            onChange={(e) =>
              setDraft({ ...draft, base_list: e.target.value as Draft['base_list'] })
            }
          >
            <option value="inbox">Inbox</option>
            <option value="anytime">Anytime</option>
            <option value="someday">Someday</option>
          </select>
        </div>

        <div className="detail-field">
          <label className="label" htmlFor="task-project">
            Project
          </label>
          <select
            id="task-project"
            className="input"
            value={draft.project_id ?? ''}
            onChange={(e) => {
              const nextProject = e.target.value ? e.target.value : null
              setDraft({
                ...draft,
                project_id: nextProject,
                section_id: null,
              })
            }}
          >
            <option value="">(none)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              const title = prompt('New project title')
              if (!title) return
              void (async () => {
                const res = await window.api.project.create({ title })
                if (!res.ok) {
                  setError(res.error)
                  return
                }
                const projectsRes = await window.api.project.listOpen()
                if (projectsRes.ok) setProjects(projectsRes.data)
                setDraft({ ...draft, project_id: res.data.id, section_id: null })
                bumpRevision()
              })()
            }}
          >
            +
          </button>
        </div>

        <div className="detail-field">
          <label className="label" htmlFor="task-section">
            Section
          </label>
          <select
            id="task-section"
            className="input"
            value={draft.section_id ?? ''}
            onChange={(e) => setDraft({ ...draft, section_id: e.target.value ? e.target.value : null })}
            disabled={!draft.project_id}
          >
            <option value="">(none)</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        <div className="detail-field">
          <label className="label" htmlFor="task-area">
            Area
          </label>
          <select
            id="task-area"
            className="input"
            value={draft.area_id ?? ''}
            onChange={(e) => setDraft({ ...draft, area_id: e.target.value ? e.target.value : null })}
          >
            <option value="">(none)</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>

        <div className="detail-field">
          <label className="label" htmlFor="task-scheduled">
            Scheduled
          </label>
          <input
            id="task-scheduled"
            className="input"
            type="date"
            value={draft.scheduled_at ?? ''}
            onChange={(e) => setDraft({ ...draft, scheduled_at: e.target.value ? e.target.value : null })}
          />
          <div className="row">
            <button
              type="button"
              className="button button-ghost"
              onClick={() => setDraft({ ...draft, scheduled_at: today })}
            >
              Today
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => setDraft({ ...draft, scheduled_at: null })}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="detail-field">
          <label className="label" htmlFor="task-due">
            Due
          </label>
          <input
            id="task-due"
            className="input"
            type="date"
            value={draft.due_at ?? ''}
            onChange={(e) => setDraft({ ...draft, due_at: e.target.value ? e.target.value : null })}
          />
          <div className="row">
            <button
              type="button"
              className="button button-ghost"
              onClick={() => setDraft({ ...draft, due_at: null })}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="detail-field">
        <div className="label">Tags</div>
        <div className="tag-grid">
          {tags.map((tag) => {
            const checked = selectedTagIds.has(tag.id)
            return (
              <div key={tag.id} className="tag-pill">
                <label className="tag-checkbox">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(selectedTagIds)
                      if (e.target.checked) next.add(tag.id)
                      else next.delete(tag.id)
                      void (async () => {
                        const res = await window.api.task.setTags(detail.task.id, Array.from(next))
                        if (!res.ok) {
                          setError(res.error)
                          return
                        }
                        bumpRevision()
                      })()
                    }}
                  />
                  <span>{tag.title}</span>
                </label>

                <span
                  className="tag-swatch"
                  style={{ background: tag.color ?? 'transparent' }}
                  aria-hidden="true"
                />

                <select
                  className="tag-color"
                  value={tag.color ?? ''}
                  onChange={(e) => {
                    const nextColor = e.target.value ? e.target.value : null
                    void (async () => {
                      const res = await window.api.tag.update({ id: tag.id, color: nextColor })
                      if (!res.ok) {
                        setError(res.error)
                        return
                      }
                      const list = await window.api.tag.list()
                      if (list.ok) setTags(list.data)
                      bumpRevision()
                    })()
                  }}
                >
                  {TAG_COLOR_PRESETS.map((c) => (
                    <option key={c.name} value={c.value ?? ''}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    const next = prompt('Rename tag', tag.title)
                    if (!next) return
                    void (async () => {
                      const res = await window.api.tag.update({ id: tag.id, title: next })
                      if (!res.ok) {
                        setError(res.error)
                        return
                      }
                      const list = await window.api.tag.list()
                      if (list.ok) setTags(list.data)
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
                    const confirmed = confirm('Delete tag?')
                    if (!confirmed) return
                    void (async () => {
                      const res = await window.api.tag.delete(tag.id)
                      if (!res.ok) {
                        setError(res.error)
                        return
                      }
                      const list = await window.api.tag.list()
                      if (list.ok) setTags(list.data)
                      bumpRevision()
                    })()
                  }}
                >
                  Delete
                </button>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          className="button button-ghost"
          onClick={() => {
            const title = prompt('New tag')
            if (!title) return
            void (async () => {
              const res = await window.api.tag.create({ title })
              if (!res.ok) {
                setError(res.error)
                return
              }
              const list = await window.api.tag.list()
              if (list.ok) setTags(list.data)
              bumpRevision()
            })()
          }}
        >
          + Tag
        </button>
      </div>

      <div className="detail-field">
        <div className="label">Checklist</div>
        <Checklist
          items={checklist}
          onAdd={async (title) => {
            const res = await window.api.checklist.create({ task_id: detail.task.id, title })
            if (!res.ok) {
              setError(res.error)
              return
            }
            bumpRevision()
          }}
          onToggle={async (itemId, done) => {
            const res = await window.api.checklist.update({ id: itemId, done })
            if (!res.ok) {
              setError(res.error)
              return
            }
            bumpRevision()
          }}
          onRename={async (itemId, title) => {
            const res = await window.api.checklist.update({ id: itemId, title })
            if (!res.ok) {
              setError(res.error)
              return
            }
            bumpRevision()
          }}
          onDelete={async (itemId) => {
            const res = await window.api.checklist.delete(itemId)
            if (!res.ok) {
              setError(res.error)
              return
            }
            bumpRevision()
          }}
        />
      </div>

      <div className="detail-actions">
        <button
          type="button"
          className="button"
          onClick={() => void handleSave(detail, draft)}
          disabled={isSaving}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>

        {detail.task.scheduled_at === today ? (
          <>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                void (async () => {
                  const list = await window.api.task.listToday(today)
                  if (!list.ok) {
                    setError(list.error)
                    return
                  }
                  const ids = list.data.map((t) => t.id)
                  const idx = ids.indexOf(detail.task.id)
                  if (idx <= 0) return
                  ;[ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]
                  const res = await window.api.task.reorderBatch('today', ids)
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                })()
              }}
            >
              Today Up
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                void (async () => {
                  const list = await window.api.task.listToday(today)
                  if (!list.ok) {
                    setError(list.error)
                    return
                  }
                  const ids = list.data.map((t) => t.id)
                  const idx = ids.indexOf(detail.task.id)
                  if (idx < 0 || idx >= ids.length - 1) return
                  ;[ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]
                  const res = await window.api.task.reorderBatch('today', ids)
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                })()
              }}
            >
              Today Down
            </button>
          </>
        ) : null}

        {detail.task.project_id ? (
          <>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                void (async () => {
                  const pid = detail.task.project_id
                  if (!pid) return
                  const list = await window.api.task.listProject(pid)
                  if (!list.ok) {
                    setError(list.error)
                    return
                  }
                  const sectionId = detail.task.section_id
                  const sameSection = list.data
                    .filter((t) => (sectionId ? t.section_id === sectionId : !t.section_id))
                    .slice()
                    .sort((a, b) => {
                      const ar = a.rank ?? Number.POSITIVE_INFINITY
                      const br = b.rank ?? Number.POSITIVE_INFINITY
                      if (ar !== br) return ar - br
                      return a.created_at.localeCompare(b.created_at)
                    })

                  const ids = sameSection.map((t) => t.id)
                  const idx = ids.indexOf(detail.task.id)
                  if (idx <= 0) return

                  ;[ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]
                  const listId = `project:${pid}:${sectionId ?? 'none'}`
                  const res = await window.api.task.reorderBatch(listId, ids)
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                })()
              }}
            >
              Project Up
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                void (async () => {
                  const pid = detail.task.project_id
                  if (!pid) return
                  const list = await window.api.task.listProject(pid)
                  if (!list.ok) {
                    setError(list.error)
                    return
                  }
                  const sectionId = detail.task.section_id
                  const sameSection = list.data
                    .filter((t) => (sectionId ? t.section_id === sectionId : !t.section_id))
                    .slice()
                    .sort((a, b) => {
                      const ar = a.rank ?? Number.POSITIVE_INFINITY
                      const br = b.rank ?? Number.POSITIVE_INFINITY
                      if (ar !== br) return ar - br
                      return a.created_at.localeCompare(b.created_at)
                    })

                  const ids = sameSection.map((t) => t.id)
                  const idx = ids.indexOf(detail.task.id)
                  if (idx < 0 || idx >= ids.length - 1) return

                  ;[ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]
                  const listId = `project:${pid}:${sectionId ?? 'none'}`
                  const res = await window.api.task.reorderBatch(listId, ids)
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                })()
              }}
            >
              Project Down
            </button>
          </>
        ) : null}

        {detail.task.status === 'done' ? (
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              void (async () => {
                const res = await window.api.task.restore(detail.task.id)
                if (!res.ok) {
                  setError(res.error)
                  return
                }
                bumpRevision()
              })()
            }}
          >
            Restore
          </button>
        ) : (
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              void (async () => {
                const res = await window.api.task.toggleDone(detail.task.id, true)
                if (!res.ok) {
                  setError(res.error)
                  return
                }
                bumpRevision()
              })()
            }}
          >
            Mark Done
          </button>
        )}
      </div>
    </aside>
  )
}

function Checklist({
  items,
  onAdd,
  onToggle,
  onRename,
  onDelete,
}: {
  items: ChecklistItem[]
  onAdd: (title: string) => Promise<void>
  onToggle: (id: string, done: boolean) => Promise<void>
  onRename: (id: string, title: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')

  return (
    <div>
      <div className="checklist-create">
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add checklist item…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const title = draft.trim()
              if (!title) return
              void (async () => {
                await onAdd(title)
                setDraft('')
              })()
            }
          }}
        />
        <button
          type="button"
          className="button"
          onClick={() => {
            const title = draft.trim()
            if (!title) return
            void (async () => {
              await onAdd(title)
              setDraft('')
            })()
          }}
        >
          Add
        </button>
      </div>

      <ul className="checklist">
        {items.map((item) => (
          <li key={item.id} className={`checklist-row${item.done ? ' is-done' : ''}`}>
            <label className="task-checkbox">
              <input
                type="checkbox"
                checked={item.done}
                onChange={(e) => void onToggle(item.id, e.target.checked)}
              />
            </label>
            <button
              type="button"
              className="checklist-title"
              onClick={() => {
                const next = prompt('Edit item', item.title)
                if (!next) return
                void onRename(item.id, next)
              }}
            >
              {item.title}
            </button>
            <button type="button" className="button button-ghost" onClick={() => void onDelete(item.id)}>
              Delete
            </button>
          </li>
        ))}
        {items.length === 0 ? <li className="nav-muted">(empty)</li> : null}
      </ul>
    </div>
  )
}
