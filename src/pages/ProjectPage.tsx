import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ForwardedRef, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import type { Area } from '../../shared/schemas/area'
import type { Project, ProjectSection } from '../../shared/schemas/project'
import type { Tag } from '../../shared/schemas/tag'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { useAppEvents } from '../app/AppEventsContext'
import { ProjectProgressControl } from '../features/projects/ProjectProgressControl'
import { ProjectGroupedList } from '../features/tasks/ProjectGroupedList'
import { formatLocalDate, parseLocalDate } from '../lib/dates'

const PROJECT_CREATE_SECTION_EVENT = 'milesto:project.createSection'

export function ProjectPage() {
  const { t } = useTranslation()
  const { revision, bumpRevision } = useAppEvents()
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const pid = projectId ?? ''

  const [project, setProject] = useState<Project | null>(null)
  const [projectTags, setProjectTags] = useState<Tag[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [openTasks, setOpenTasks] = useState<TaskListItem[]>([])
  const [doneCount, setDoneCount] = useState(0)
  const [doneTasks, setDoneTasks] = useState<TaskListItem[] | null>(null)
  const [sections, setSections] = useState<ProjectSection[]>([])
  const [error, setError] = useState<AppError | null>(null)

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)

  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const titleMeasureRef = useRef<HTMLSpanElement | null>(null)
  const titleButtonRef = useRef<HTMLButtonElement | null>(null)
  const ignoreNextTitleBlurRef = useRef(false)
  const [titleInputWidthPx, setTitleInputWidthPx] = useState<number | null>(null)

  const titlePlaceholder = t('shell.projectTitlePlaceholder')
  const titleMeasureText = titleDraft.length > 0 ? titleDraft : titlePlaceholder

  const hasUserInteractedRef = useRef(false)
  const consumedEditTitleForIdRef = useRef<string | null>(null)

  const [notesDraft, setNotesDraft] = useState('')
  const notesRef = useRef<HTMLTextAreaElement | null>(null)
  const notesSaveDebounceRef = useRef<number | null>(null)
  const notesSyncedRef = useRef<{ projectId: string | null; notes: string }>({ projectId: null, notes: '' })

  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false)
    menuButtonRef.current?.focus()
  }, [])

  const refresh = useCallback(async () => {
    if (!pid) return

    const [projectDetailRes, areasRes, openTasksRes, sectionsRes, doneCountRes] = await Promise.all([
      window.api.project.getDetail(pid),
      window.api.area.list(),
      window.api.task.listProject(pid),
      window.api.project.listSections(pid),
      window.api.task.countProjectDone(pid),
    ])

    if (!projectDetailRes.ok) {
      setError(projectDetailRes.error)
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
    setProject(projectDetailRes.data.project)
    setProjectTags(projectDetailRes.data.tags)
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
    setIsEditingTitle(false)
    hasUserInteractedRef.current = false
    consumedEditTitleForIdRef.current = null
  }, [pid])

  useEffect(() => {
    function markInteracted() {
      hasUserInteractedRef.current = true
    }

    window.addEventListener('pointerdown', markInteracted, true)
    window.addEventListener('keydown', markInteracted, true)
    return () => {
      window.removeEventListener('pointerdown', markInteracted, true)
      window.removeEventListener('keydown', markInteracted, true)
    }
  }, [])

  useEffect(() => {
    if (!project) return

    const params = new URLSearchParams(location.search)
    if (params.get('editTitle') !== '1') return
    if (consumedEditTitleForIdRef.current === project.id) return
    if (hasUserInteractedRef.current) return

    const active = document.activeElement
    if (active instanceof HTMLElement && active !== document.body && active !== document.documentElement) return

    consumedEditTitleForIdRef.current = project.id
    ignoreNextTitleBlurRef.current = false
    setTitleDraft(project.title ?? '')
    setIsEditingTitle(true)

    params.delete('editTitle')
    const nextSearch = params.toString()
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' }, { replace: true })
  }, [location.pathname, location.search, navigate, project])

  useLayoutEffect(() => {
    if (!isEditingTitle) return
    const raf = window.requestAnimationFrame(() => {
      const input = titleInputRef.current
      if (!input) return
      input.focus()
      const caretPos = input.value.length
      input.setSelectionRange(caretPos, caretPos)
    })
    return () => window.cancelAnimationFrame(raf)
  }, [isEditingTitle])

  useLayoutEffect(() => {
    if (!isEditingTitle) return
    const el = titleMeasureRef.current
    if (!el) return
    if (el.textContent !== titleMeasureText) el.textContent = titleMeasureText
    const px = Math.ceil(el.getBoundingClientRect().width) + 2
    setTitleInputWidthPx((prev) => (prev === px ? prev : px))
  }, [isEditingTitle, titleMeasureText])

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

  const mutateAndRefresh = useCallback(async () => {
    bumpRevision()
    await refresh()
  }, [bumpRevision, refresh])

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

    function handlePointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      if (!(e.target instanceof Node)) return
      const pop = menuRef.current
      const btn = menuButtonRef.current
      if (pop?.contains(e.target) || btn?.contains(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      closeMenu()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      closeMenu()
    }

    function handleClose() {
      closeMenu()
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
  }, [closeMenu, isMenuOpen])

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
  const hasProjectTitle = Boolean(project?.title?.trim())
  const displayProjectTitle = project
    ? hasProjectTitle
      ? project.title
      : t('project.untitled')
    : title

  function enterTitleEdit() {
    if (!project) return
    ignoreNextTitleBlurRef.current = false
    setTitleDraft(project.title ?? '')
    setIsEditingTitle(true)
  }

  function cancelTitleEdit() {
    ignoreNextTitleBlurRef.current = true
    setIsEditingTitle(false)
    titleButtonRef.current?.focus()
  }

  async function commitTitleEdit(nextRaw: string) {
    const p = project
    if (!p) return
    const next = nextRaw.trim()
    const prev = p.title ?? ''
    if (next === prev.trim()) {
      cancelTitleEdit()
      return
    }

    const res = await window.api.project.update({ id: p.id, title: next })
    if (!res.ok) {
      setError(res.error)
      return
    }

    bumpRevision()
    ignoreNextTitleBlurRef.current = true
    setIsEditingTitle(false)
    await refresh()
    titleButtonRef.current?.focus()
  }

  return (
    <>
      {error ? <ErrorBanner error={error} /> : null}

        <div className="page">
          <header className="page-header">
            <div className="project-header-left">
              {project ? (
                <ProjectProgressControl
                  status={project.status}
                  doneCount={doneCount}
                  totalCount={openCount + doneCount}
                  size="header"
                  onActivate={async () => {
                    if (!project) return

                    if (project.status === 'done') {
                      const res = await window.api.project.update({ id: project.id, status: 'open' })
                      if (!res.ok) {
                        setError(res.error)
                        return
                      }
                      bumpRevision()
                      await refresh()
                      return
                    }

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
                />
              ) : null}
            <h1 className="page-title">
              {project ? (
                isEditingTitle ? (
                  <>
                    <span ref={titleMeasureRef} className="page-title-measure" aria-hidden="true">
                      {titleMeasureText}
                    </span>
                    <input
                      ref={titleInputRef}
                      className="page-title-input"
                      style={titleInputWidthPx !== null ? { width: titleInputWidthPx } : undefined}
                      value={titleDraft}
                      placeholder={t('shell.projectTitlePlaceholder')}
                      aria-label={t('aria.projectTitle')}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation()

                        if (e.key === 'Enter') {
                          // Don't treat IME composition confirmation as a commit.
                          if (e.nativeEvent.isComposing) return
                          e.preventDefault()
                          void commitTitleEdit(titleDraft)
                          return
                        }

                        if (e.key === 'Escape') {
                          e.preventDefault()
                          cancelTitleEdit()
                        }
                      }}
                      onBlur={() => {
                        if (ignoreNextTitleBlurRef.current) {
                          ignoreNextTitleBlurRef.current = false
                          return
                        }
                        void commitTitleEdit(titleDraft)
                      }}
                    />
                  </>
                ) : (
                  <button
                    ref={titleButtonRef}
                    type="button"
                    className={`page-title-button${hasProjectTitle ? '' : ' is-placeholder'}`}
                    onClick={enterTitleEdit}
                    onDoubleClick={enterTitleEdit}
                  >
                    {displayProjectTitle}
                  </button>
                )
              ) : (
                title
              )}
            </h1>

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
                projectTags={projectTags}
                areas={areas}
                openTaskCount={openCount}
                onClose={closeMenu}
                onMutate={mutateAndRefresh}
                onBumpRevision={bumpRevision}
                onError={setError}
                onNavigate={navigate}
              />,
              document.body
            )
          : null}

        {project ? (
          <ProjectMetaRow
            project={project}
            tags={projectTags}
            onClearPlan={async () => {
              const res = await window.api.project.update({
                id: project.id,
                scheduled_at: null,
                is_someday: false,
              })
              if (!res.ok) {
                setError(res.error)
                return
              }
              bumpRevision()
              await refresh()
            }}
            onClearDue={async () => {
              const res = await window.api.project.update({ id: project.id, due_at: null })
              if (!res.ok) {
                setError(res.error)
                return
              }
              bumpRevision()
              await refresh()
            }}
            onRemoveTag={async (tagId) => {
              const nextIds = projectTags.filter((t) => t.id !== tagId).map((t) => t.id)
              const res = await window.api.project.setTags(project.id, nextIds)
              if (!res.ok) {
                setError(res.error)
                return
              }
              bumpRevision()
              await refresh()
            }}
          />
        ) : null}

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

function ProjectMetaRow({
  project,
  tags,
  onClearPlan,
  onClearDue,
  onRemoveTag,
}: {
  project: Project
  tags: Tag[]
  onClearPlan: () => Promise<void>
  onClearDue: () => Promise<void>
  onRemoveTag: (tagId: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const today = formatLocalDate(new Date())

  const hasPlan = Boolean(project.is_someday || project.scheduled_at)
  const hasDue = Boolean(project.due_at)
  const hasTags = tags.length > 0

  if (!hasPlan && !hasDue && !hasTags) return null

  return (
    <div style={{ marginTop: 10 }}>
      <div className="task-inline-action-bar-left">
        {hasPlan ? (
          <div className="task-inline-chip">
            <span className="task-inline-chip-main" style={{ cursor: 'default' }}>
              {t('taskEditor.scheduledPrefix')}{' '}
              {project.is_someday
                ? t('nav.someday')
                : project.scheduled_at === today
                  ? t('nav.today')
                  : project.scheduled_at}
            </span>
            <button
              type="button"
              className="task-inline-chip-close"
              aria-label={t('taskEditor.clearScheduledAria')}
              onClick={(e) => {
                e.preventDefault()
                void onClearPlan()
              }}
            >
              ×
            </button>
          </div>
        ) : null}

        {hasDue ? (
          <div className="task-inline-chip">
            <span className="task-inline-chip-main" style={{ cursor: 'default' }}>
              {t('taskEditor.duePrefix')} {project.due_at}
            </span>
            <button
              type="button"
              className="task-inline-chip-close"
              aria-label={t('taskEditor.clearDueAria')}
              onClick={(e) => {
                e.preventDefault()
                void onClearDue()
              }}
            >
              ×
            </button>
          </div>
        ) : null}

        {tags.map((tag) => (
          <div key={tag.id} className="task-inline-chip">
            <span className="task-inline-chip-main" style={{ cursor: 'default' }}>
              {tag.title}
            </span>
            <button
              type="button"
              className="task-inline-chip-close"
              aria-label={t('aria.removeTag', { title: tag.title })}
              onClick={(e) => {
                e.preventDefault()
                void onRemoveTag(tag.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
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
    projectTags,
    areas,
    openTaskCount,
    onClose,
    onMutate,
    onBumpRevision,
    onError,
    onNavigate,
  }: {
    anchorEl: HTMLElement
    project: Project
    projectTags: Tag[]
    areas: Area[]
    onClose: () => void
    openTaskCount: number
    onMutate: () => Promise<void>
    onBumpRevision: () => void
    onError: (error: AppError | null) => void
    onNavigate: (to: string) => void
  },
  ref: ForwardedRef<HTMLDivElement>
) {
  const { t } = useTranslation()
  type View = 'root' | 'plan' | 'due' | 'move' | 'tags'
  type RootKey = 'complete' | 'plan' | 'due' | 'move' | 'tags' | 'delete'

  const [view, setView] = useState<View>('root')

  const lastRootFocusRef = useRef<RootKey>('complete')
  const backButtonRef = useRef<HTMLButtonElement | null>(null)
  const tagsInputRef = useRef<HTMLInputElement | null>(null)

  const completeBtnRef = useRef<HTMLButtonElement | null>(null)
  const planBtnRef = useRef<HTMLButtonElement | null>(null)
  const dueBtnRef = useRef<HTMLButtonElement | null>(null)
  const moveBtnRef = useRef<HTMLButtonElement | null>(null)
  const tagsBtnRef = useRef<HTMLButtonElement | null>(null)
  const deleteBtnRef = useRef<HTMLButtonElement | null>(null)

  const [allTags, setAllTags] = useState<Tag[]>([])
  const [tagsError, setTagsError] = useState<AppError | null>(null)
  const [tagCreateTitle, setTagCreateTitle] = useState('')
  const [tagCreateError, setTagCreateError] = useState<AppError | null>(null)

  const today = formatLocalDate(new Date())

  const rootRefs: Record<RootKey, RefObject<HTMLButtonElement | null>> = {
    complete: completeBtnRef,
    plan: planBtnRef,
    due: dueBtnRef,
    move: moveBtnRef,
    tags: tagsBtnRef,
    delete: deleteBtnRef,
  }

  const focusRoot = (key: RootKey) => {
    rootRefs[key].current?.focus()
  }

  const goRoot = (focusKey?: RootKey) => {
    setView('root')
    const key = focusKey ?? lastRootFocusRef.current
    window.setTimeout(() => focusRoot(key), 0)
  }

  const goSubview = (nextView: View, returnFocus: RootKey) => {
    lastRootFocusRef.current = returnFocus
    setView(nextView)
  }

  useLayoutEffect(() => {
    if (view === 'root') return
    if (view === 'tags') {
      tagsInputRef.current?.focus()
      return
    }
    backButtonRef.current?.focus()
  }, [view])

  useEffect(() => {
    if (view !== 'tags') return

    void (async () => {
      const res = await window.api.tag.list()
      if (!res.ok) {
        setTagsError(res.error)
        return
      }
      setTagsError(null)
      setAllTags(res.data)
    })()
  }, [view])

  function normalizeTagTitle(title: string): string {
    return title.trim().replace(/\s+/g, ' ').toLowerCase()
  }
  const rect = anchorEl.getBoundingClientRect()
  const maxWidth = 320
  const left = Math.min(Math.max(12, rect.left), window.innerWidth - maxWidth - 12)
  const top = Math.min(rect.bottom + 8, window.innerHeight - 12)

  const isCalendar = view === 'plan' || view === 'due'
  const isTags = view === 'tags'

  return (
    <div
      ref={ref}
      className={
        isCalendar
          ? 'task-inline-popover task-inline-popover-calendar'
          : isTags
            ? 'task-inline-popover task-inline-popover-tags'
            : 'task-inline-popover'
      }
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
        {view === 'root' ? (
          <>
            <div className="task-inline-popover-title">{t('projectPage.menuTitle')}</div>
            <div className="row" style={{ justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <button
                ref={completeBtnRef}
                type="button"
                className="button button-ghost"
                onClick={() => {
                  void (async () => {
                    onError(null)

                    if (project.status === 'done') {
                      const res = await window.api.project.update({ id: project.id, status: 'open' })
                      if (!res.ok) {
                        onError(res.error)
                        return
                      }
                      await onMutate()
                      onClose()
                      return
                    }

                    const confirmed = confirm(t('project.completeConfirm', { count: openTaskCount }))
                    if (!confirmed) return
                    const res = await window.api.project.complete(project.id)
                    if (!res.ok) {
                      onError(res.error)
                      return
                    }
                    await onMutate()
                    onClose()
                  })()
                }}
              >
                {project.status === 'done' ? t('projectPage.reopen') : t('projectPage.markDone')}
              </button>

              <button
                ref={planBtnRef}
                type="button"
                className="button button-ghost"
                onClick={() => goSubview('plan', 'plan')}
              >
                {t('common.schedule')}
              </button>

              <button
                ref={dueBtnRef}
                type="button"
                className="button button-ghost"
                onClick={() => goSubview('due', 'due')}
              >
                {t('taskEditor.dueLabel')}
              </button>

              <button
                ref={moveBtnRef}
                type="button"
                className="button button-ghost"
                onClick={() => goSubview('move', 'move')}
              >
                {t('common.move')}
              </button>

              <button
                ref={tagsBtnRef}
                type="button"
                className="button button-ghost"
                onClick={() => {
                  setTagCreateError(null)
                  setTagsError(null)
                  setTagCreateTitle('')
                  goSubview('tags', 'tags')
                }}
              >
                {t('taskEditor.tagsLabel')}
              </button>

              <button
                ref={deleteBtnRef}
                type="button"
                className="button button-ghost"
                onClick={() => {
                  void (async () => {
                    onError(null)

                    const confirmed = confirm(t('project.deleteConfirm'))
                    if (!confirmed) return

                    const res = await window.api.project.delete(project.id)
                    if (!res.ok) {
                      onError(res.error)
                      return
                    }

                    onBumpRevision()
                    onClose()
                    onNavigate('/today')
                  })()
                }}
              >
                {t('common.delete')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
              <button
                ref={backButtonRef}
                type="button"
                className="button button-ghost"
                onClick={() => goRoot()}
              >
                {t('common.back')}
              </button>
              <div className="task-inline-popover-title">
                {view === 'plan'
                  ? t('taskEditor.popoverScheduleTitle')
                  : view === 'due'
                    ? t('taskEditor.dueLabel')
                    : view === 'move'
                      ? t('common.move')
                      : t('taskEditor.tagsLabel')}
              </div>
            </div>

            {view === 'plan' ? (
              <>
                <div className="task-inline-calendar" style={{ marginTop: 8 }}>
                  <DayPicker
                    mode="single"
                    selected={!project.is_someday && project.scheduled_at ? parseLocalDate(project.scheduled_at) ?? undefined : undefined}
                    onSelect={(date) => {
                      const nextDate = date ? formatLocalDate(date) : null
                      void (async () => {
                        onError(null)
                        const res = await window.api.project.update({
                          id: project.id,
                          scheduled_at: nextDate,
                          is_someday: false,
                        })
                        if (!res.ok) {
                          onError(res.error)
                          return
                        }
                        await onMutate()
                        goRoot('plan')
                      })()
                    }}
                    weekStartsOn={1}
                    showOutsideDays
                    fixedWeeks
                  />
                </div>
                <div className="row" style={{ justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      void (async () => {
                        onError(null)
                        const res = await window.api.project.update({
                          id: project.id,
                          is_someday: true,
                          scheduled_at: null,
                        })
                        if (!res.ok) {
                          onError(res.error)
                          return
                        }
                        await onMutate()
                        goRoot('plan')
                      })()
                    }}
                  >
                    {t('nav.someday')}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      void (async () => {
                        onError(null)
                        const res = await window.api.project.update({
                          id: project.id,
                          scheduled_at: today,
                          is_someday: false,
                        })
                        if (!res.ok) {
                          onError(res.error)
                          return
                        }
                        await onMutate()
                        goRoot('plan')
                      })()
                    }}
                  >
                    {t('nav.today')}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      void (async () => {
                        onError(null)
                        const res = await window.api.project.update({
                          id: project.id,
                          scheduled_at: null,
                          is_someday: false,
                        })
                        if (!res.ok) {
                          onError(res.error)
                          return
                        }
                        await onMutate()
                        goRoot('plan')
                      })()
                    }}
                  >
                    {t('common.clear')}
                  </button>
                </div>
              </>
            ) : view === 'due' ? (
              <>
                <div className="task-inline-calendar" style={{ marginTop: 8 }}>
                  <DayPicker
                    mode="single"
                    selected={project.due_at ? parseLocalDate(project.due_at) ?? undefined : undefined}
                    onSelect={(date) => {
                      const nextDate = date ? formatLocalDate(date) : null
                      void (async () => {
                        onError(null)
                        const res = await window.api.project.update({ id: project.id, due_at: nextDate })
                        if (!res.ok) {
                          onError(res.error)
                          return
                        }
                        await onMutate()
                        goRoot('due')
                      })()
                    }}
                    weekStartsOn={1}
                    showOutsideDays
                    fixedWeeks
                  />
                </div>
                <div className="row" style={{ justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      void (async () => {
                        onError(null)
                        const res = await window.api.project.update({ id: project.id, due_at: today })
                        if (!res.ok) {
                          onError(res.error)
                          return
                        }
                        await onMutate()
                        goRoot('due')
                      })()
                    }}
                  >
                    {t('nav.today')}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      void (async () => {
                        onError(null)
                        const res = await window.api.project.update({ id: project.id, due_at: null })
                        if (!res.ok) {
                          onError(res.error)
                          return
                        }
                        await onMutate()
                        goRoot('due')
                      })()
                    }}
                  >
                    {t('common.clear')}
                  </button>
                </div>
              </>
            ) : view === 'move' ? (
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
                      onError(null)
                      const res = await window.api.project.update({ id: project.id, area_id: next })
                      if (!res.ok) {
                        onError(res.error)
                        return
                      }
                      await onMutate()
                      goRoot('move')
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
            ) : (
              <>
                <input
                  ref={tagsInputRef}
                  className="input"
                  placeholder={t('taskEditor.newTagPlaceholder')}
                  value={tagCreateTitle}
                  onChange={(e) => {
                    setTagCreateTitle(e.target.value)
                    if (tagCreateError) setTagCreateError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    e.stopPropagation()

                    const title = tagCreateTitle.trim()
                    if (!title) return

                    const normalized = normalizeTagTitle(title)
                    const existing = allTags.find((t) => normalizeTagTitle(t.title) === normalized)

                    const selectedIds = projectTags.map((t) => t.id)
                    const persist = async (nextIds: string[]) => {
                      onError(null)
                      const res = await window.api.project.setTags(project.id, nextIds)
                      if (!res.ok) {
                        onError(res.error)
                        return false
                      }
                      await onMutate()
                      return true
                    }

                    if (existing) {
                      if (!selectedIds.includes(existing.id)) {
                        void persist([...selectedIds, existing.id])
                      }
                      setTagCreateTitle('')
                      setTagCreateError(null)
                      return
                    }

                    void (async () => {
                      setTagCreateError(null)
                      const res = await window.api.tag.create({ title })
                      if (!res.ok) {
                        setTagCreateError(res.error)
                        return
                      }

                      setTagCreateTitle('')
                      const list = await window.api.tag.list()
                      if (list.ok) setAllTags(list.data)

                      if (!selectedIds.includes(res.data.id)) {
                        await persist([...selectedIds, res.data.id])
                      }
                    })()
                  }}
                  style={{ marginTop: 6 }}
                />

                {tagCreateError ? (
                  <div className="error" style={{ margin: '10px 0 0' }}>
                    <div className="error-code">{tagCreateError.code}</div>
                    <div>{tagCreateError.message}</div>
                  </div>
                ) : null}

                {tagsError ? (
                  <div className="error" style={{ margin: '10px 0 0' }}>
                    <div className="error-code">{tagsError.code}</div>
                    <div>{tagsError.message}</div>
                  </div>
                ) : null}

                <div className="tag-grid" style={{ marginTop: 8 }}>
                  {allTags.map((tag) => {
                    const selectedIds = projectTags.map((t) => t.id)
                    const checked = selectedIds.includes(tag.id)
                    return (
                      <label
                        key={tag.id}
                        className="tag-checkbox"
                        style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const current = projectTags.map((t) => t.id)
                            const next = e.target.checked
                              ? current.includes(tag.id)
                                ? current
                                : [...current, tag.id]
                              : current.filter((id) => id !== tag.id)

                            void (async () => {
                              onError(null)
                              const res = await window.api.project.setTags(project.id, next)
                              if (!res.ok) {
                                onError(res.error)
                                return
                              }
                              await onMutate()
                            })()
                          }}
                        />
                        <span>{tag.title}</span>
                        <span
                          className="tag-swatch"
                          style={{ marginLeft: 'auto', background: tag.color ?? 'transparent' }}
                          aria-hidden="true"
                        />
                      </label>
                    )
                  })}
                </div>
              </>
            )}
          </>
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
