import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ForwardedRef, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import { isClosedProjectStatus } from '../../shared/schemas/common'
import type { Area } from '../../shared/schemas/area'
import type { Tag } from '../../shared/schemas/tag'
import type { TaskListItem } from '../../shared/schemas/task-list'
import type { ViewListProjectItem } from '../../shared/schemas/view-list'
import { taskListIdArea } from '../../shared/task-list-ids'

const MAX_VISIBLE_AREA_META_TAGS = 4

import { useAppEvents } from '../app/AppEventsContext'
import { useConfirm } from '../contexts/ConfirmDialogContext'
import { Button } from '../components/Button'
import { PopoverMenuItem } from '../components/PopoverMenuItem'
import { DeleteMenuIcon, TagMenuIcon } from '../components/popover-menu-icons'
import { ProjectViewRow } from '../features/view-list/ProjectViewRow'
import { useProjectContextMenu } from '../features/projects/use-project-context-menu'
import { TagPicker } from '../features/tags/TagPicker'
import { TaskList } from '../features/tasks/TaskList'
import { TagFilter } from '../features/tasks/TagFilter'
import { useTaskSelection } from '../features/tasks/TaskSelectionContext'
import { useTaskTagFilter } from '../features/tasks/use-task-tag-filter'

type AreaMenuView = 'root' | 'tags'

type AreaMenuState = {
  anchorEl: HTMLElement
  focusReturnEl: HTMLElement
  initialView: AreaMenuView
} | null

export function AreaPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const { revision, bumpRevision } = useAppEvents()
  const { areaId } = useParams<{ areaId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const aid = areaId ?? ''

  const [area, setArea] = useState<Area | null>(null)
  const [areaTags, setAreaTags] = useState<Tag[]>([])
  const [projects, setProjects] = useState<ViewListProjectItem[]>([])
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [error, setError] = useState<AppError | null>(null)

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const { selectedTaskId, selectTask } = useTaskSelection()

  // Mutual exclusion: selecting a project clears task selection and vice versa.
  const selectProject = useCallback(
    (projectId: string | null) => {
      setSelectedProjectId(projectId)
      if (projectId) selectTask(null)
    },
    [selectTask],
  )

  useEffect(() => {
    if (selectedTaskId) setSelectedProjectId(null)
  }, [selectedTaskId])

  const { openProjectContextMenu, menuNode: projectMenuNode } = useProjectContextMenu()

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    filteredTasks,
    hasFilter,
  } = useTaskTagFilter(tasks)

  const [menuState, setMenuState] = useState<AreaMenuState>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const closeMenu = useCallback(() => {
    setMenuState((current) => {
      current?.focusReturnEl.focus()
      return null
    })
  }, [])

  const openMenu = useCallback((anchorEl: HTMLElement, initialView: AreaMenuView = 'root') => {
    setMenuState((current) => {
      if (current && current.focusReturnEl === anchorEl && current.initialView === initialView) {
        return null
      }

      return {
        anchorEl,
        focusReturnEl: anchorEl,
        initialView,
      }
    })
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

  const consumedEditTitleRouteRef = useRef<string | null>(null)
  const didInteractWithPageDuringEditTitleIntentRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!aid) return

    const [areaRes, projectsRes, tasksRes] = await Promise.all([
      window.api.area.getDetail(aid),
      window.api.view.listByArea(aid),
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
    setArea(areaRes.data.area)
    setAreaTags(areaRes.data.tags)
    setProjects(projectsRes.data.filter((item): item is ViewListProjectItem => item.kind === 'project'))
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
    setMenuState(null)
    selectProject(null)
    ignoreNextTitleBlurRef.current = false
    consumedEditTitleRouteRef.current = null
    didInteractWithPageDuringEditTitleIntentRef.current = false
  }, [aid])

  useEffect(() => {
    if (!menuState) return
    const launcher = menuState.focusReturnEl

    function handlePointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      if (!(e.target instanceof Node)) return
      const pop = menuRef.current
      if (pop?.contains(e.target) || launcher.contains(e.target)) return
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
  }, [closeMenu, menuState])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('editTitle') !== '1') return

    didInteractWithPageDuringEditTitleIntentRef.current = false

    function markPageInteraction(e: PointerEvent | KeyboardEvent) {
      if (!(e.target instanceof Element)) return
      if (!e.target.closest('.page')) return
      didInteractWithPageDuringEditTitleIntentRef.current = true
    }

    document.addEventListener('pointerdown', markPageInteraction, true)
    document.addEventListener('keydown', markPageInteraction, true)
    return () => {
      document.removeEventListener('pointerdown', markPageInteraction, true)
      document.removeEventListener('keydown', markPageInteraction, true)
    }
  }, [location.key, location.search])

  useEffect(() => {
    if (!area) return
    if (area.id !== aid) return

    const params = new URLSearchParams(location.search)
    if (params.get('editTitle') !== '1') return
    const editTitleRouteKey = `${area.id}:${location.key}`
    if (consumedEditTitleRouteRef.current === editTitleRouteKey) return

    consumedEditTitleRouteRef.current = editTitleRouteKey
    params.delete('editTitle')
    const nextSearch = params.toString()

    if (didInteractWithPageDuringEditTitleIntentRef.current) {
      navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' }, { replace: true })
      return
    }

    ignoreNextTitleBlurRef.current = false
    setTitleDraft(area.title ?? '')
    setIsEditingTitle(true)
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' }, { replace: true })
  }, [aid, area, location.key, location.pathname, location.search, navigate])

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
    const displayTitle = (p: ViewListProjectItem) => (p.title.trim() ? p.title : projectUntitled)
    return [...projects].sort((a, b) =>
      displayTitle(a).toLocaleLowerCase().localeCompare(displayTitle(b).toLocaleLowerCase())
    )
  }, [projects, projectUntitled])

  const handleCompleteProject = useCallback(
    async (project: ViewListProjectItem) => {
      const p = projects.find((proj) => proj.id === project.id)
      if (!p) return

      if (isClosedProjectStatus(p.status)) {
        const res = await window.api.project.update({ id: p.id, status: 'open' })
        if (!res.ok) {
          setError(res.error)
          return
        }
        await mutateAndRefresh()
        return
      }

      const openCount = Math.max(0, p.total_count - p.done_count)
      const confirmed = await confirm({ message: t('project.completeConfirm', { count: openCount }), variant: 'default' })
      if (!confirmed) return

      const res = await window.api.project.complete(p.id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      await mutateAndRefresh()
    },
    [projects, mutateAndRefresh, t, confirm]
  )

  const handleProjectContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, project: ViewListProjectItem) => {
      event.preventDefault()
      event.stopPropagation()
      selectProject(project.id)

      const eventTarget = event.target
      const restoreFocusEl =
        eventTarget instanceof HTMLElement
          ? eventTarget.closest<HTMLElement>('[data-project-focus-target="true"]') ??
            event.currentTarget.querySelector<HTMLElement>('[data-project-focus-target="true"]') ??
            event.currentTarget
          : event.currentTarget.querySelector<HTMLElement>('[data-project-focus-target="true"]') ??
            event.currentTarget

      void openProjectContextMenu({
        project: {
          id: project.id,
          title: project.title,
          notes: project.notes,
          status: project.status,
          done_count: project.done_count,
          total_count: project.total_count,
          area_id: project.area_id,
          scheduled_at: project.scheduled_at,
          due_at: project.due_at,
          is_someday: project.is_someday,
          tag_preview: project.tag_preview ?? [],
          tag_count: project.tag_count ?? 0,
        },
        anchorX: event.clientX,
        anchorY: event.clientY,
        restoreFocusEl,
      })
    },
    [openProjectContextMenu]
  )

  const projectsTopContent =
    sortedProjects.length > 0 ? (
      <div data-area-projects="true">
        <ul className="task-list">
          {sortedProjects.map((p) => (
            <li
              key={p.id}
              className={`task-row${selectedProjectId === p.id ? ' is-selected' : ''}`}
              data-area-project-row="true"
            >
              <ProjectViewRow
                project={p}
                onSelect={(projectId) => selectProject(projectId)}
                onOpen={(projectId) => navigate(`/projects/${projectId}`)}
                onComplete={handleCompleteProject}
                onContextMenu={(event) => handleProjectContextMenu(event, p)}
              />
            </li>
          ))}
        </ul>
      </div>
    ) : null

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

      setArea(res.data)
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
          <span className="area-title">
            <AreaTitleIcon className="area-title-icon" />
            <span className="area-title-main">
              {area ? (
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
              )}
            </span>
          </span>
        }
        listId={taskListIdArea(aid)}
        tasks={filteredTasks}
        topContent={
          <>
            {area ? (
              <AreaMetaRow
                tags={areaTags}
                onRemoveTag={async (tagId) => {
                  const nextIds = areaTags.filter((tag) => tag.id !== tagId).map((tag) => tag.id)
                  const res = await window.api.area.setTags(aid, nextIds)
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                  await refresh()
                }}
                onManageTags={(triggerEl) => openMenu(triggerEl, 'tags')}
              />
            ) : null}
            <TagFilter
              tags={availableTags}
              selectedTagIds={selectedTagIds}
              onChange={setSelectedTagIds}
            />
            {projectsTopContent}
          </>
        }
        emptyState={hasFilter ? t('taskEditor.noTagsMatch') : undefined}
        onAfterReorder={refresh}
        headerActions={
          <>
            <Button
              ref={menuButtonRef}
              variant="ghost"
              aria-haspopup="dialog"
              aria-expanded={menuState !== null}
              aria-label={t('aria.areaActions')}
              onClick={(e) => openMenu(e.currentTarget, 'root')}
            >
              ...
            </Button>

            {menuState && area
              ? createPortal(
                  <AreaMenu
                    ref={menuRef}
                    anchorEl={menuState.anchorEl}
                    initialView={menuState.initialView}
                    areaId={aid}
                    areaTags={areaTags}
                    onClose={closeMenu}
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
      {projectMenuNode}
    </>
  )
}

function AreaMetaRow({
  tags,
  onRemoveTag,
  onManageTags,
}: {
  tags: Tag[]
  onRemoveTag: (tagId: string) => Promise<void>
  onManageTags: (triggerEl: HTMLElement) => void
}) {
  const { t } = useTranslation()

  if (tags.length === 0) return null

  const visibleTags = tags.slice(0, MAX_VISIBLE_AREA_META_TAGS)
  const overflowCount = Math.max(tags.length - visibleTags.length, 0)

  return (
    <div className="project-meta" style={{ marginTop: 10 }}>
      <div className="project-meta-row project-meta-tags-row">
        {visibleTags.map((tag) => (
          <span key={tag.id} className="project-meta-tag-chip">
            <span className="project-meta-tag-text">{tag.title}</span>
            <button
              type="button"
              className="project-meta-tag-clear"
              aria-label={t('aria.removeTag', { title: tag.title })}
              onClick={(e) => {
                e.preventDefault()
                void onRemoveTag(tag.id)
              }}
            >
              ×
            </button>
          </span>
        ))}

        {overflowCount > 0 ? (
          <button
            type="button"
            className="project-meta-tag-chip project-meta-tag-chip--overflow"
            aria-label={t('aria.manageMoreAreaTags', { count: overflowCount })}
            onClick={(e) => {
              e.preventDefault()
              onManageTags(e.currentTarget)
            }}
          >
            <span className="project-meta-tag-text">+{overflowCount}</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}

function AreaTitleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7.5c0-1.1.9-2 2-2h5l2 2h7c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-11z" />
    </svg>
  )
}

const AreaMenu = forwardRef(function AreaMenu(
  {
    anchorEl,
    initialView,
    areaId,
    areaTags,
    onClose,
    onBumpRevision,
    onMutate,
    onNavigate,
    onSetPageError,
  }: {
    anchorEl: HTMLElement
    initialView: AreaMenuView
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
  const confirm = useConfirm()
  type View = 'root' | 'tags'
  type RootKey = 'tags' | 'delete'

  const [view, setView] = useState<View>(initialView)
  const lastRootFocusRef = useRef<RootKey>('tags')

  const backButtonRef = useRef<HTMLButtonElement | null>(null)

  const tagsBtnRef = useRef<HTMLButtonElement | null>(null)
  const deleteBtnRef = useRef<HTMLButtonElement | null>(null)

  const [allTags, setAllTags] = useState<Tag[]>([])
  const [tagsError, setTagsError] = useState<AppError | null>(null)

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
    setView('tags')
  }

  useLayoutEffect(() => {
    if (view === 'root') return
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
      style={{ position: 'fixed', top, left, maxWidth, zIndex: 45 }}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <PopoverMenuItem ref={tagsBtnRef} icon={<TagMenuIcon />} onClick={goTags}>
                {t('taskEditor.tagsLabel')}
              </PopoverMenuItem>
              <PopoverMenuItem
                ref={deleteBtnRef}
                icon={<DeleteMenuIcon />}
                onClick={() => {
                  void (async () => {
                    onSetPageError(null)

                    const confirmed = await confirm({ message: t('area.deleteConfirm'), variant: 'danger', confirmText: t('common.delete') })
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
              </PopoverMenuItem>
            </div>
          </>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
              <Button ref={backButtonRef} variant="ghost" onClick={() => goRoot()}>
                {t('common.back')}
              </Button>
              <div className="task-inline-popover-title">{t('taskEditor.tagsLabel')}</div>
            </div>

            <TagPicker
              tags={allTags}
              selectedTagIds={areaTags.map((t) => t.id)}
              onToggle={(tagId, selected) => {
                const current = areaTags.map((t) => t.id)
                const next = selected
                  ? [...current, tagId]
                  : current.filter((id) => id !== tagId)

                void (async () => {
                  const res = await window.api.area.setTags(areaId, next)
                  if (!res.ok) {
                    return
                  }
                  await onMutate()
                })()
              }}
              onCreate={async (title) => {
                const res = await window.api.tag.create({ title })
                if (!res.ok) return { ok: false, error: res.error }
                const list = await window.api.tag.list()
                if (list.ok) setAllTags(list.data)
                return { ok: true, tag: res.data }
              }}
              onRefresh={async () => {
                const list = await window.api.tag.list()
                if (list.ok) setAllTags(list.data)
              }}
              persistError={tagsError}
            />
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
