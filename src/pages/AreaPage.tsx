import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ForwardedRef, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import type { Area } from '../../shared/schemas/area'
import type { Project } from '../../shared/schemas/project'
import type { Tag } from '../../shared/schemas/tag'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { taskListIdArea } from '../../shared/task-list-ids'

import { useAppEvents } from '../app/AppEventsContext'
import { ProjectProgressControl } from '../features/projects/ProjectProgressControl'
import { TaskList } from '../features/tasks/TaskList'

export function AreaPage() {
  const { t } = useTranslation()
  const { revision, bumpRevision } = useAppEvents()
  const { areaId } = useParams<{ areaId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const aid = areaId ?? ''

  const [area, setArea] = useState<Area | null>(null)
  const [areaTags, setAreaTags] = useState<Tag[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectProgress, setProjectProgress] = useState<Record<string, { done_count: number; total_count: number }>>({})
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [error, setError] = useState<AppError | null>(null)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const closeMenu = useCallback((opts?: { restoreFocus?: boolean }) => {
    setIsMenuOpen(false)
    if (!opts?.restoreFocus) return

    const btn = menuButtonRef.current
    window.setTimeout(() => {
      if (btn?.isConnected) btn.focus()
    }, 0)
  }, [])

  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const titleMeasureRef = useRef<HTMLSpanElement | null>(null)
  const titleButtonRef = useRef<HTMLButtonElement | null>(null)
  const ignoreNextTitleBlurRef = useRef(false)
  const isCommittingTitleRef = useRef(false)
  const [titleInputWidthPx, setTitleInputWidthPx] = useState<number | null>(null)

  const titlePlaceholder = t('shell.areaTitlePlaceholder')
  const titleMeasureText = titleDraft.length > 0 ? titleDraft : titlePlaceholder

  const hasUserInteractedRef = useRef(false)
  const consumedEditTitleForIdRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    if (!aid) return

    const [areaRes, projectsRes, tasksRes] = await Promise.all([
      window.api.area.getDetail(aid),
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

    const projectIds = projectsRes.data.map((p) => p.id)
    const progressRes = projectIds.length > 0 ? await window.api.task.countProjectsProgress(projectIds) : null
    if (progressRes && !progressRes.ok) {
      setError(progressRes.error)
      return
    }

    setError(null)
    setArea(areaRes.data.area)
    setAreaTags(areaRes.data.tags)
    setProjects(projectsRes.data)
    const nextProgress: Record<string, { done_count: number; total_count: number }> = {}
    for (const row of progressRes?.data ?? []) {
      nextProgress[row.project_id] = { done_count: row.done_count, total_count: row.total_count }
    }
    setProjectProgress(nextProgress)
    setTasks(tasksRes.data)
  }, [aid])

  useEffect(() => {
    void revision
    void refresh()
  }, [refresh, revision])

  const mutateAndRefresh = useCallback(async () => {
    bumpRevision()
    await refresh()
  }, [bumpRevision, refresh])

  // Title edit state should reset on navigation.
  useEffect(() => {
    void aid
    setIsEditingTitle(false)
    setIsMenuOpen(false)
    ignoreNextTitleBlurRef.current = false
    hasUserInteractedRef.current = false
    consumedEditTitleForIdRef.current = null
  }, [aid])

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
      closeMenu({ restoreFocus: true })
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      closeMenu({ restoreFocus: true })
    }

    function handleClose() {
      closeMenu({ restoreFocus: false })
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
    if (!area) return

    const params = new URLSearchParams(location.search)
    if (params.get('editTitle') !== '1') return
    if (consumedEditTitleForIdRef.current === area.id) return
    if (hasUserInteractedRef.current) return

    const active = document.activeElement
    if (active instanceof HTMLElement && active !== document.body && active !== document.documentElement) return

    consumedEditTitleForIdRef.current = area.id
    ignoreNextTitleBlurRef.current = false
    setTitleDraft(area.title ?? '')
    setIsEditingTitle(true)

    params.delete('editTitle')
    const nextSearch = params.toString()
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' }, { replace: true })
  }, [area, location.pathname, location.search, navigate])

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

  const hasAreaTitle = Boolean(area?.title?.trim())
  const displayAreaTitle = area
    ? hasAreaTitle
      ? area.title
      : t('area.untitled')
    : t('shell.area')

  const projectUntitled = t('project.untitled')
  const sortedProjects = useMemo(() => {
    const displayTitle = (p: Project) => (p.title.trim() ? p.title : projectUntitled)
    return [...projects].sort((a, b) =>
      displayTitle(a).toLocaleLowerCase().localeCompare(displayTitle(b).toLocaleLowerCase())
    )
  }, [projects, projectUntitled])

  function enterTitleEdit() {
    if (!area) return
    ignoreNextTitleBlurRef.current = false
    setTitleDraft(area.title ?? '')
    setIsEditingTitle(true)
  }

  function cancelTitleEdit() {
    ignoreNextTitleBlurRef.current = true
    setIsEditingTitle(false)
    titleButtonRef.current?.focus()
  }

  async function commitTitleEdit(nextRaw: string) {
    if (isCommittingTitleRef.current) return

    const a = area
    if (!a) return
    const next = nextRaw.trim()
    const prev = a.title ?? ''

    if (next === prev.trim()) {
      cancelTitleEdit()
      return
    }

    isCommittingTitleRef.current = true
    try {
      const res = await window.api.area.update({ id: a.id, title: next })
      if (!res.ok) {
        setError(res.error)
        return
      }

      bumpRevision()
      ignoreNextTitleBlurRef.current = true
      setIsEditingTitle(false)
      await refresh()
      titleButtonRef.current?.focus()
    } finally {
      isCommittingTitleRef.current = false
    }
  }

  if (!aid) {
    return (
      <div className="page">
        <h1 className="page-title">{t('shell.area')}</h1>
        <div className="error">{t('errors.missingAreaId')}</div>
      </div>
    )
  }

  return (
    <>
      {error ? <ErrorBanner error={error} /> : null}

      <TaskList
        title={
          area ? (
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
                  placeholder={titlePlaceholder}
                  aria-label={titlePlaceholder}
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
                className={`page-title-button${hasAreaTitle ? '' : ' is-placeholder'}`}
                onClick={enterTitleEdit}
                onDoubleClick={enterTitleEdit}
              >
                {displayAreaTitle}
              </button>
            )
          ) : (
            displayAreaTitle
          )
        }
        listId={taskListIdArea(aid)}
        tasks={tasks}
        onAfterReorder={refresh}
        headerActions={
          <>
            <button
              ref={menuButtonRef}
              type="button"
              className="button button-ghost"
              aria-haspopup="dialog"
              aria-expanded={isMenuOpen}
              aria-label={t('aria.areaActions')}
              onClick={() => setIsMenuOpen((v) => !v)}
            >
              ...
            </button>

            {isMenuOpen && area && menuButtonRef.current
              ? createPortal(
                  <AreaMenu
                    ref={menuRef}
                    anchorEl={menuButtonRef.current}
                    areaId={aid}
                    areaTags={areaTags}
                    onClose={() => closeMenu({ restoreFocus: true })}
                    onBumpRevision={bumpRevision}
                    onMutate={mutateAndRefresh}
                    onNavigate={navigate}
                    onSetPageError={setError}
                  />,
                  document.body
                )
              : null}
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
          <div className="sections-title">{t('nav.projects')}</div>
        </div>
        <ul className="task-list">
          {sortedProjects.map((p) => (
            <li key={p.id} className="task-row">
              <ProjectProgressControl
                status={p.status}
                doneCount={projectProgress[p.id]?.done_count ?? 0}
                totalCount={projectProgress[p.id]?.total_count ?? 0}
                size="list"
                disabled={!projectProgress[p.id]}
                onActivate={async () => {
                  if (!area) return
                  const counts = projectProgress[p.id]
                  if (!counts) return

                  if (p.status === 'done') {
                    const res = await window.api.project.update({ id: p.id, status: 'open' })
                    if (!res.ok) {
                      setError(res.error)
                      return
                    }
                    await mutateAndRefresh()
                    return
                  }

                  const openCount = Math.max(0, counts.total_count - counts.done_count)
                  const confirmed = confirm(t('project.completeConfirm', { count: openCount }))
                  if (!confirmed) return

                  const res = await window.api.project.complete(p.id)
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  await mutateAndRefresh()
                }}
              />
              <NavLink className={`nav-item${p.title.trim() ? '' : ' is-placeholder'}`} to={`/projects/${p.id}`}>
                {p.title.trim() ? p.title : t('project.untitled')}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

const AreaMenu = forwardRef(function AreaMenu(
  {
    anchorEl,
    areaId,
    areaTags,
    onClose,
    onBumpRevision,
    onMutate,
    onNavigate,
    onSetPageError,
  }: {
    anchorEl: HTMLElement
    areaId: string
    areaTags: Tag[]
    onClose: () => void
    onBumpRevision: () => void
    onMutate: () => Promise<void>
    onNavigate: (to: string) => void
    onSetPageError: (error: AppError | null) => void
  },
  ref: ForwardedRef<HTMLDivElement>
) {
  const { t } = useTranslation()
  type View = 'root' | 'tags'
  type RootKey = 'tags' | 'delete'

  const [view, setView] = useState<View>('root')
  const lastRootFocusRef = useRef<RootKey>('tags')

  const backButtonRef = useRef<HTMLButtonElement | null>(null)
  const tagsInputRef = useRef<HTMLInputElement | null>(null)

  const tagsBtnRef = useRef<HTMLButtonElement | null>(null)
  const deleteBtnRef = useRef<HTMLButtonElement | null>(null)

  const [allTags, setAllTags] = useState<Tag[]>([])
  const [tagsError, setTagsError] = useState<AppError | null>(null)
  const [tagCreateTitle, setTagCreateTitle] = useState('')
  const [tagCreateError, setTagCreateError] = useState<AppError | null>(null)
  const [tagPersistError, setTagPersistError] = useState<AppError | null>(null)

  const rootRefs: Record<RootKey, RefObject<HTMLButtonElement | null>> = {
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

  const goTags = () => {
    lastRootFocusRef.current = 'tags'
    setTagCreateError(null)
    setTagsError(null)
    setTagPersistError(null)
    setTagCreateTitle('')
    setView('tags')
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
  const viewportPadding = 12
  const gap = 8
  const maxWidth = 320
  const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - maxWidth - viewportPadding)
  const top = Math.min(rect.bottom + gap, window.innerHeight - viewportPadding)

  return (
    <div
      ref={ref}
      className={view === 'tags' ? 'task-inline-popover task-inline-popover-tags' : 'task-inline-popover'}
      role="dialog"
      aria-label={t('aria.areaActions')}
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
            <div className="task-inline-popover-title">{t('areaPage.menuTitle')}</div>
            <div
              className="row"
              style={{ justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}
            >
              <button ref={tagsBtnRef} type="button" className="button button-ghost" onClick={goTags}>
                {t('taskEditor.tagsLabel')}
              </button>
              <button
                ref={deleteBtnRef}
                type="button"
                className="button button-ghost"
                onClick={() => {
                  void (async () => {
                    onSetPageError(null)

                    const confirmed = confirm(t('area.deleteConfirm'))
                    if (!confirmed) return

                    const res = await window.api.area.delete(areaId)
                    if (!res.ok) {
                      onSetPageError(res.error)
                      return
                    }

                    onBumpRevision()
                    onNavigate('/today')
                    onClose()
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
              <button ref={backButtonRef} type="button" className="button button-ghost" onClick={() => goRoot()}>
                {t('common.back')}
              </button>
              <div className="task-inline-popover-title">{t('taskEditor.tagsLabel')}</div>
            </div>

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
                // Don't treat IME composition confirmation as a commit.
                if (e.nativeEvent.isComposing) return
                e.preventDefault()
                e.stopPropagation()

                const title = tagCreateTitle.trim()
                if (!title) return

                const normalized = normalizeTagTitle(title)
                const existing = allTags.find((t) => normalizeTagTitle(t.title) === normalized)

                const selectedIds = areaTags.map((t) => t.id)
                const persist = async (nextIds: string[]) => {
                  setTagPersistError(null)
                  const res = await window.api.area.setTags(areaId, nextIds)
                  if (!res.ok) {
                    setTagPersistError(res.error)
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

            {tagPersistError ? (
              <div className="error" style={{ margin: '10px 0 0' }}>
                <div className="error-code">{tagPersistError.code}</div>
                <div>{tagPersistError.message}</div>
              </div>
            ) : null}

            <div className="tag-grid" style={{ marginTop: 8 }}>
              {allTags.map((tag) => {
                const selectedIds = areaTags.map((t) => t.id)
                const checked = selectedIds.includes(tag.id)
                return (
                  <label key={tag.id} className="tag-checkbox" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const current = areaTags.map((t) => t.id)
                        const next = e.target.checked
                          ? current.includes(tag.id)
                            ? current
                            : [...current, tag.id]
                          : current.filter((id) => id !== tag.id)

                        void (async () => {
                          setTagPersistError(null)
                          const res = await window.api.area.setTags(areaId, next)
                          if (!res.ok) {
                            setTagPersistError(res.error)
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
