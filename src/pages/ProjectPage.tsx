import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ForwardedRef, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import type { Area } from '../../shared/schemas/area'
import type { Project, ProjectSection } from '../../shared/schemas/project'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { useAppEvents } from '../app/AppEventsContext'
import { ProjectGroupedList } from '../features/tasks/ProjectGroupedList'

const PROJECT_CREATE_SECTION_EVENT = 'milesto:project.createSection'

export function ProjectPage() {
  const { t } = useTranslation()
  const { revision, bumpRevision } = useAppEvents()
  const { projectId } = useParams<{ projectId: string }>()
  const pid = projectId ?? ''

  const [project, setProject] = useState<Project | null>(null)
  const [areas, setAreas] = useState<Area[]>([])
  const [openTasks, setOpenTasks] = useState<TaskListItem[]>([])
  const [doneCount, setDoneCount] = useState(0)
  const [doneTasks, setDoneTasks] = useState<TaskListItem[] | null>(null)
  const [sections, setSections] = useState<ProjectSection[]>([])
  const [error, setError] = useState<AppError | null>(null)

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)

  const [notesDraft, setNotesDraft] = useState('')
  const notesRef = useRef<HTMLTextAreaElement | null>(null)
  const notesSaveDebounceRef = useRef<number | null>(null)
  const notesSyncedRef = useRef<{ projectId: string | null; notes: string }>({ projectId: null, notes: '' })

  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const refresh = useCallback(async () => {
    if (!pid) return

    const [projectRes, areasRes, openTasksRes, sectionsRes, doneCountRes] = await Promise.all([
      window.api.project.get(pid),
      window.api.area.list(),
      window.api.task.listProject(pid),
      window.api.project.listSections(pid),
      window.api.task.countProjectDone(pid),
    ])

    if (!projectRes.ok) {
      setError(projectRes.error)
      return
    }
    if (!areasRes.ok) {
      setError(areasRes.error)
      return
    }
    if (!openTasksRes.ok) {
      setError(openTasksRes.error)
      return
    }
    if (!sectionsRes.ok) {
      setError(sectionsRes.error)
      return
    }
    if (!doneCountRes.ok) {
      setError(doneCountRes.error)
      return
    }

    setError(null)
    setProject(projectRes.data)
    setAreas(areasRes.data)
    setOpenTasks(openTasksRes.data)
    setSections(sectionsRes.data)
    setDoneCount(doneCountRes.data.count)
  }, [pid])

  useEffect(() => {
    void revision
    void refresh()
  }, [refresh, revision])

  // Completed toggle state is not persisted and should reset on navigation.
  useEffect(() => {
    void pid
    setIsCompletedExpanded(false)
    setDoneTasks(null)
    setEditingSectionId(null)
  }, [pid])

  useEffect(() => {
    function handleCreateSection(e: Event) {
      const ce = e as CustomEvent<{ projectId?: string }>
      const requestedProjectId = ce.detail?.projectId
      if (!requestedProjectId) return
      if (requestedProjectId !== pid) return

      void (async () => {
        const res = await window.api.project.createSection(pid, '')
        if (!res.ok) {
          setError(res.error)
          return
        }

        await refresh()
        setEditingSectionId(res.data.id)
      })()
    }

    window.addEventListener(PROJECT_CREATE_SECTION_EVENT, handleCreateSection)
    return () => window.removeEventListener(PROJECT_CREATE_SECTION_EVENT, handleCreateSection)
  }, [pid, refresh])

  // Keep notes draft in sync when switching projects.
  useEffect(() => {
    const nextProjectId = project?.id ?? null
    const nextNotes = project?.notes ?? ''

    // Always reset when switching projects.
    if (notesSyncedRef.current.projectId !== nextProjectId) {
      notesSyncedRef.current = { projectId: nextProjectId, notes: nextNotes }
      setNotesDraft(nextNotes)
      return
    }

    // If the user has not edited since last sync, keep draft aligned with refreshed project notes.
    if (notesDraft === notesSyncedRef.current.notes && notesSyncedRef.current.notes !== nextNotes) {
      notesSyncedRef.current = { projectId: nextProjectId, notes: nextNotes }
      setNotesDraft(nextNotes)
    }
  }, [notesDraft, project?.id, project?.notes])

  const openCount = openTasks.length

  useEffect(() => {
    if (!isCompletedExpanded) return
    if (!pid) return

    // doneTasks is cached across collapses. If the done count changed (e.g. project.complete
    // bulk-completes open tasks), refresh the expanded list so it matches the count.
    if (doneTasks && doneTasks.length === doneCount) return

    void (async () => {
      const res = await window.api.task.listProjectDone(pid)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setDoneTasks(res.data)
    })()
  }, [doneCount, doneTasks, isCompletedExpanded, pid])

  useEffect(() => {
    if (!isMenuOpen) return

    function close() {
      setIsMenuOpen(false)
      menuButtonRef.current?.focus()
    }

    function handlePointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      if (!(e.target instanceof Node)) return
      const pop = menuRef.current
      const btn = menuButtonRef.current
      if (pop?.contains(e.target) || btn?.contains(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      close()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      close()
    }

    function handleClose() {
      close()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('resize', handleClose)
    window.addEventListener('scroll', handleClose, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('resize', handleClose)
      window.removeEventListener('scroll', handleClose, true)
    }
  }, [isMenuOpen])

  const completedLabel = t('projectPage.completed')

  if (!pid) {
    return (
      <div className="page">
        <h1 className="page-title">{t('shell.project')}</h1>
        <div className="error">{t('errors.missingProjectId')}</div>
      </div>
    )
  }

  const title = project?.title ?? t('shell.project')

  return (
    <>
      {error ? <ErrorBanner error={error} /> : null}

      <div className="page">
        <header className="page-header">
          <div className="project-header-left">
            {project ? (
              <label className="task-checkbox" aria-label={t('aria.markProjectDone')}>
                <input
                  type="checkbox"
                  checked={project.status === 'done'}
                  disabled={project.status === 'done'}
                  onChange={() => {
                    if (!project) return
                    const confirmed = confirm(t('project.completeConfirm', { count: openCount }))
                    if (!confirmed) return

                    void (async () => {
                      const res = await window.api.project.complete(project.id)
                      if (!res.ok) {
                        setError(res.error)
                        return
                      }
                      bumpRevision()
                      await refresh()
                    })()
                  }}
                />
              </label>
            ) : null}
            <h1 className="page-title">{title}</h1>
          </div>

          <div className="row" style={{ marginTop: 0 }}>
            <button
              ref={menuButtonRef}
              type="button"
              className="button button-ghost"
              aria-haspopup="dialog"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((v) => !v)}
            >
              ...
            </button>
          </div>
        </header>

        {isMenuOpen && project && menuButtonRef.current
          ? createPortal(
              <ProjectMenu
                ref={menuRef}
                anchorEl={menuButtonRef.current}
                project={project}
                areas={areas}
                onClose={() => setIsMenuOpen(false)}
                onChangeArea={async (nextAreaId) => {
                  const res = await window.api.project.update({ id: project.id, area_id: nextAreaId })
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                  await refresh()
                }}
                onRename={async () => {
                  const next = prompt(t('project.renamePromptTitle'), project.title)
                  if (!next) return
                  const res = await window.api.project.update({ id: project.id, title: next })
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                  await refresh()
                }}
                onMarkDone={async () => {
                  const confirmed = confirm(t('project.completeConfirm', { count: openCount }))
                  if (!confirmed) return
                  const res = await window.api.project.complete(project.id)
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                  await refresh()
                }}
                onReopen={async () => {
                  const res = await window.api.project.update({ id: project.id, status: 'open' })
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                  await refresh()
                }}
              />,
              document.body
            )
          : null}

        <div className="project-notes" style={{ marginTop: 12 }}>
          <ProjectNotes
            textareaRef={notesRef}
            value={notesDraft}
            onChange={(next) => {
              setNotesDraft(next)
              const p = project
              if (!p) return

              if (notesSaveDebounceRef.current) window.clearTimeout(notesSaveDebounceRef.current)
              notesSaveDebounceRef.current = window.setTimeout(() => {
                void (async () => {
                  const res = await window.api.project.update({ id: p.id, notes: next })
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  notesSyncedRef.current = { projectId: res.data.id, notes: res.data.notes }
                  setProject(res.data)
                })()
              }, 500)
            }}
            onBlur={() => {
              const p = project
              if (!p) return
              if (!notesSaveDebounceRef.current) return
              window.clearTimeout(notesSaveDebounceRef.current)
              notesSaveDebounceRef.current = null
              const next = notesDraft
              void (async () => {
                const res = await window.api.project.update({ id: p.id, notes: next })
                if (!res.ok) {
                  setError(res.error)
                  return
                }
                notesSyncedRef.current = { projectId: res.data.id, notes: res.data.notes }
                setProject(res.data)
              })()
            }}
          />
        </div>

        <ProjectGroupedList
          projectId={pid}
          sections={sections}
          openTasks={openTasks}
          doneTasks={isCompletedExpanded ? doneTasks : null}
          editingSectionId={editingSectionId}
          onStartSectionTitleEdit={(sectionId) => setEditingSectionId(sectionId)}
          onCancelSectionTitleEdit={() => setEditingSectionId(null)}
          onCommitSectionTitle={async (sectionId, title) => {
            const res = await window.api.project.renameSection(sectionId, title)
            if (!res.ok) {
              setError(res.error)
              return
            }
            setEditingSectionId(null)
            await refresh()
          }}
          onToggleDone={async (taskId, done) => {
            const updated = await window.api.task.toggleDone(taskId, done)
            if (!updated.ok) {
              setError(updated.error)
              return
            }
            await refresh()
            if (isCompletedExpanded) {
              setDoneTasks(null)
              const res = await window.api.task.listProjectDone(pid)
              if (res.ok) setDoneTasks(res.data)
            }
          }}
          onAfterReorder={refresh}
        />

        <div className="sections-header">
          <button
            type="button"
            className="button button-ghost"
            disabled={doneCount === 0}
            aria-expanded={isCompletedExpanded}
            onClick={() => {
              const next = !isCompletedExpanded
              setIsCompletedExpanded(next)
            }}
          >
            {completedLabel} {isCompletedExpanded ? '▾' : '▸'}
          </button>
        </div>

        {openCount === 0 && (!isCompletedExpanded || doneCount === 0) ? (
          <div className="nav-muted" style={{ marginTop: 10 }}>
            {t('projectPage.noOpenTasks')}
          </div>
        ) : null}
      </div>
    </>
  )
}

function ProjectNotes({
  textareaRef,
  value,
  onChange,
  onBlur,
}: {
  textareaRef: RefObject<HTMLTextAreaElement>
  value: string
  onChange: (next: string) => void
  onBlur: () => void
}) {
  const { t } = useTranslation()

  useLayoutEffect(() => {
    void value
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [textareaRef, value])

  return (
    <textarea
      ref={textareaRef}
      className="task-inline-notes project-notes-textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={t('projectPage.notesPlaceholder')}
    />
  )
}

const ProjectMenu = forwardRef(function ProjectMenu(
  {
    anchorEl,
    project,
    areas,
    onClose,
    onChangeArea,
    onRename,
    onMarkDone,
    onReopen,
  }: {
    anchorEl: HTMLElement
    project: Project
    areas: Area[]
    onClose: () => void
    onChangeArea: (nextAreaId: string | null) => Promise<void>
    onRename: () => Promise<void>
    onMarkDone: () => Promise<void>
    onReopen: () => Promise<void>
  },
  ref: ForwardedRef<HTMLDivElement>
) {
  const { t } = useTranslation()
  const rect = anchorEl.getBoundingClientRect()
  const maxWidth = 320
  const left = Math.min(Math.max(12, rect.left), window.innerWidth - maxWidth - 12)
  const top = Math.min(rect.bottom + 8, window.innerHeight - 12)

  return (
    <div
      ref={ref}
      className="task-inline-popover"
      role="dialog"
      aria-label={t('aria.projectActions')}
      style={{ position: 'fixed', top, left, width: maxWidth, zIndex: 45 }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="task-inline-popover-body">
        <div className="task-inline-popover-title">{t('projectPage.menuTitle')}</div>

        <div className="detail-field" style={{ marginTop: 10 }}>
          <label className="label" htmlFor="project-area">
            {t('projectPage.areaLabel')}
          </label>
          <select
            id="project-area"
            className="input"
            value={project.area_id ?? ''}
            onChange={(e) => {
              const next = e.target.value ? e.target.value : null
              void (async () => {
                await onChangeArea(next)
                onClose()
              })()
            }}
          >
            <option value="">{t('common.noneOption')}</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>

        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              void (async () => {
                await onRename()
                onClose()
              })()
            }}
          >
            {t('common.rename')}
          </button>
        </div>

        {project.status === 'done' ? (
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                void (async () => {
                  await onReopen()
                  onClose()
                })()
              }}
            >
              {t('projectPage.reopen')}
            </button>
          </div>
        ) : (
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                void (async () => {
                  await onMarkDone()
                  onClose()
                })()
              }}
            >
              {t('projectPage.markDone')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

function ErrorBanner({ error }: { error: AppError }) {
  return (
    <div className="error">
      <div className="error-code">{error.code}</div>
      <div>{error.message}</div>
    </div>
  )
}
