import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import type { Area } from '../../shared/schemas/area'
import type { Project } from '../../shared/schemas/project'
import type { Tag } from '../../shared/schemas/tag'

import { Checkbox } from '../components/Checkbox'
import { formatLocalDate, parseLocalDate } from '../lib/dates'

type SidebarAreaContextMenuView = 'root' | 'tags'
type SidebarProjectContextMenuView = 'root' | 'plan' | 'move' | 'due' | 'tags'

type SidebarAreaContextMenuState = {
  area: Area
  anchorX: number
  anchorY: number
  restoreFocusEl: HTMLElement | null
  view: SidebarAreaContextMenuView
}

type SidebarProjectContextMenuState = {
  project: Project
  anchorX: number
  anchorY: number
  restoreFocusEl: HTMLElement | null
  view: SidebarProjectContextMenuView
}

type OpenSidebarAreaContextMenuInput = {
  area: Area
  anchorX: number
  anchorY: number
  restoreFocusEl?: HTMLElement | null
}

type OpenSidebarProjectContextMenuInput = {
  project: Project
  anchorX: number
  anchorY: number
  restoreFocusEl?: HTMLElement | null
}

function getAreaMenuWidth(view: SidebarAreaContextMenuView): number {
  return view === 'root' ? 188 : 220
}

function getProjectMenuWidth(view: SidebarProjectContextMenuView): number {
  if (view === 'root') return 188
  if (view === 'tags') return 220
  return 236
}

function normalizeTagTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function useSidebarAreaContextMenu({
  currentPathname,
  onAfterMutation,
  onNavigate,
  onRename,
}: {
  currentPathname: string
  onAfterMutation: () => Promise<void>
  onNavigate: (to: string) => void
  onRename: (area: Area) => void
}) {
  const { t } = useTranslation()
  const [menuState, setMenuState] = useState<SidebarAreaContextMenuState | null>(null)
  const [actionError, setActionError] = useState<AppError | null>(null)
  const [areaTags, setAreaTags] = useState<Tag[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [tagsError, setTagsError] = useState<AppError | null>(null)
  const [tagCreateTitle, setTagCreateTitle] = useState('')
  const [tagCreateError, setTagCreateError] = useState<AppError | null>(null)
  const [tagPersistError, setTagPersistError] = useState<AppError | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const tagsInputRef = useRef<HTMLInputElement | null>(null)

  const closeMenu = useCallback((opts?: { restoreFocus?: boolean }) => {
    const current = menuState
    setMenuState(null)
    setActionError(null)
    setAreaTags([])
    setAllTags([])
    setTagsError(null)
    setTagCreateTitle('')
    setTagCreateError(null)
    setTagPersistError(null)

    if (!current || !opts?.restoreFocus) return

    window.setTimeout(() => {
      if (current.restoreFocusEl?.isConnected) current.restoreFocusEl.focus()
    }, 0)
  }, [menuState])

  const openSidebarAreaContextMenu = useCallback(
    ({ area, anchorX, anchorY, restoreFocusEl = null }: OpenSidebarAreaContextMenuInput) => {
      setActionError(null)
      setAreaTags([])
      setAllTags([])
      setTagsError(null)
      setTagCreateTitle('')
      setTagCreateError(null)
      setTagPersistError(null)
      setMenuState({
        area,
        anchorX,
        anchorY,
        restoreFocusEl,
        view: 'root',
      })
    },
    []
  )

  useEffect(() => {
    if (!menuState) return

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) return
      if (!(event.target instanceof Node)) return
      if (menuRef.current?.contains(event.target)) return
      closeMenu({ restoreFocus: true })
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
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
  }, [closeMenu, menuState])

  useEffect(() => {
    if (!menuState || menuState.view !== 'tags') return

    let cancelled = false

    void (async () => {
      const [detailRes, tagsRes] = await Promise.all([
        window.api.area.getDetail(menuState.area.id),
        window.api.tag.list(),
      ])
      if (cancelled) return

      if (!detailRes.ok) {
        setTagsError(detailRes.error)
        return
      }
      if (!tagsRes.ok) {
        setTagsError(tagsRes.error)
        return
      }

      setAreaTags(detailRes.data.tags)
      setAllTags(tagsRes.data)
      setTagsError(null)
    })()

    return () => {
      cancelled = true
    }
  }, [menuState])

  useEffect(() => {
    if (menuState?.view !== 'tags') return
    tagsInputRef.current?.focus()
  }, [menuState])

  const persistAreaTags = useCallback(async (nextIds: string[]) => {
    if (!menuState) return false

    setTagPersistError(null)
    const res = await window.api.area.setTags(menuState.area.id, nextIds)
    if (!res.ok) {
      setTagPersistError(res.error)
      return false
    }

    await onAfterMutation()
    const detailRes = await window.api.area.getDetail(menuState.area.id)
    if (detailRes.ok) setAreaTags(detailRes.data.tags)
    return true
  }, [menuState, onAfterMutation])

  const menuNode = useMemo(() => {
    if (!menuState) return null

    const viewportPadding = 12
    const width = getAreaMenuWidth(menuState.view)
    const left = Math.min(
      Math.max(viewportPadding, menuState.anchorX),
      window.innerWidth - width - viewportPadding
    )
    const top = Math.min(
      Math.max(viewportPadding, menuState.anchorY),
      window.innerHeight - viewportPadding
    )

    return createPortal(
      <div
        ref={menuRef}
        className={menuState.view === 'tags' ? 'task-inline-popover task-inline-popover-tags' : 'task-inline-popover'}
        role="dialog"
        aria-label={t('aria.areaActions')}
        style={{ position: 'fixed', top, left, width, zIndex: 60 }}
      >
        <div className="task-inline-popover-body">
          {menuState.view === 'root' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => {
                  onRename(menuState.area)
                  closeMenu({ restoreFocus: false })
                }}
              >
                {t('common.rename')}
              </button>

              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => {
                  setTagCreateError(null)
                  setTagsError(null)
                  setTagPersistError(null)
                  setTagCreateTitle('')
                  setMenuState((current) => (current ? { ...current, view: 'tags' } : current))
                }}
              >
                {t('taskEditor.tagsLabel')}
              </button>

              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => {
                  void (async () => {
                    setActionError(null)

                    const confirmed = confirm(t('area.deleteConfirm'))
                    if (!confirmed) return

                    const res = await window.api.area.delete(menuState.area.id)
                    if (!res.ok) {
                      setActionError(res.error)
                      return
                    }

                    await onAfterMutation()
                    if (currentPathname === `/areas/${menuState.area.id}`) onNavigate('/today')
                    closeMenu({ restoreFocus: false })
                  })()
                }}
              >
                {t('common.delete')}
              </button>
            </div>
          ) : (
            <>
              <div className="row" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    setTagCreateError(null)
                    setTagsError(null)
                    setTagPersistError(null)
                    setMenuState((current) => (current ? { ...current, view: 'root' } : current))
                  }}
                >
                  {t('common.back')}
                </button>
                <div className="task-inline-popover-title">{t('taskEditor.tagsLabel')}</div>
              </div>

              <input
                ref={tagsInputRef}
                className="input"
                placeholder={t('taskEditor.newTagPlaceholder')}
                value={tagCreateTitle}
                onChange={(event) => {
                  setTagCreateTitle(event.target.value)
                  if (tagCreateError) setTagCreateError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  if (event.nativeEvent.isComposing) return
                  event.preventDefault()
                  event.stopPropagation()

                  const title = tagCreateTitle.trim()
                  if (!title) return

                  const normalized = normalizeTagTitle(title)
                  const existing = allTags.find((tag) => normalizeTagTitle(tag.title) === normalized)
                  const selectedIds = areaTags.map((tag) => tag.id)

                  if (existing) {
                    if (!selectedIds.includes(existing.id)) {
                      void persistAreaTags([...selectedIds, existing.id])
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
                    const tagsRes = await window.api.tag.list()
                    if (tagsRes.ok) setAllTags(tagsRes.data)

                    if (!selectedIds.includes(res.data.id)) {
                      await persistAreaTags([...selectedIds, res.data.id])
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
                  const selectedIds = areaTags.map((entry) => entry.id)
                  const checked = selectedIds.includes(tag.id)
                  return (
                    <Checkbox
                      key={tag.id}
                      className="tag-checkbox"
                      style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                      checked={checked}
                      onCheckedChange={(nextChecked) => {
                        const currentIds = areaTags.map((entry) => entry.id)
                        const nextIds = nextChecked
                          ? currentIds.includes(tag.id)
                            ? currentIds
                            : [...currentIds, tag.id]
                          : currentIds.filter((id) => id !== tag.id)

                        void persistAreaTags(nextIds)
                      }}
                    >
                      <span>{tag.title}</span>
                    </Checkbox>
                  )
                })}
              </div>
            </>
          )}

          {actionError ? (
            <div className="error" style={{ margin: '10px 0 0' }}>
              <div className="error-code">{actionError.code}</div>
              <div>{actionError.message}</div>
            </div>
          ) : null}
        </div>
      </div>,
      document.body
    )
  }, [
    actionError,
    allTags,
    areaTags,
    closeMenu,
    currentPathname,
    menuState,
    onAfterMutation,
    onNavigate,
    onRename,
    persistAreaTags,
    t,
    tagCreateError,
    tagCreateTitle,
    tagPersistError,
    tagsError,
  ])

  return { openSidebarAreaContextMenu, menuNode }
}

export function useSidebarProjectContextMenu({
  areas,
  currentPathname,
  onAfterMutation,
  onNavigate,
  onMoveProject,
  onRename,
}: {
  areas: Area[]
  currentPathname: string
  onAfterMutation: () => Promise<void>
  onNavigate: (to: string) => void
  onMoveProject: (projectId: string, targetAreaId: string | null) => Promise<boolean>
  onRename: (project: Project) => void
}) {
  const { t } = useTranslation()
  const [menuState, setMenuState] = useState<SidebarProjectContextMenuState | null>(null)
  const [actionError, setActionError] = useState<AppError | null>(null)
  const [projectTags, setProjectTags] = useState<Tag[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [tagsError, setTagsError] = useState<AppError | null>(null)
  const [tagCreateTitle, setTagCreateTitle] = useState('')
  const [tagCreateError, setTagCreateError] = useState<AppError | null>(null)
  const [tagPersistError, setTagPersistError] = useState<AppError | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const tagsInputRef = useRef<HTMLInputElement | null>(null)
  const today = formatLocalDate(new Date())

  const closeMenu = useCallback((opts?: { restoreFocus?: boolean }) => {
    const current = menuState
    setMenuState(null)
    setActionError(null)
    setProjectTags([])
    setAllTags([])
    setTagsError(null)
    setTagCreateTitle('')
    setTagCreateError(null)
    setTagPersistError(null)

    if (!current || !opts?.restoreFocus) return

    window.setTimeout(() => {
      if (current.restoreFocusEl?.isConnected) current.restoreFocusEl.focus()
    }, 0)
  }, [menuState])

  const openSidebarProjectContextMenu = useCallback(
    ({ project, anchorX, anchorY, restoreFocusEl = null }: OpenSidebarProjectContextMenuInput) => {
      setActionError(null)
      setProjectTags([])
      setAllTags([])
      setTagsError(null)
      setTagCreateTitle('')
      setTagCreateError(null)
      setTagPersistError(null)
      setMenuState({
        project,
        anchorX,
        anchorY,
        restoreFocusEl,
        view: 'root',
      })
    },
    []
  )

  useEffect(() => {
    if (!menuState) return

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) return
      if (!(event.target instanceof Node)) return
      if (menuRef.current?.contains(event.target)) return
      closeMenu({ restoreFocus: true })
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
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
  }, [closeMenu, menuState])

  useEffect(() => {
    if (!menuState || menuState.view !== 'tags') return

    let cancelled = false

    void (async () => {
      const [detailRes, tagsRes] = await Promise.all([
        window.api.project.getDetail(menuState.project.id),
        window.api.tag.list(),
      ])
      if (cancelled) return

      if (!detailRes.ok) {
        setTagsError(detailRes.error)
        return
      }
      if (!tagsRes.ok) {
        setTagsError(tagsRes.error)
        return
      }

      setProjectTags(detailRes.data.tags)
      setAllTags(tagsRes.data)
      setTagsError(null)
    })()

    return () => {
      cancelled = true
    }
  }, [menuState])

  useEffect(() => {
    if (menuState?.view !== 'tags') return
    tagsInputRef.current?.focus()
  }, [menuState])

  const persistProjectUpdate = useCallback(async (patch: Partial<Project>) => {
    if (!menuState) return false

    setActionError(null)
    const res = await window.api.project.update({
      id: menuState.project.id,
      ...(patch as Record<string, unknown>),
    })
    if (!res.ok) {
      setActionError(res.error)
      return false
    }

    await onAfterMutation()
    closeMenu({ restoreFocus: false })
    return true
  }, [closeMenu, menuState, onAfterMutation])

  const persistProjectTags = useCallback(async (nextIds: string[]) => {
    if (!menuState) return false

    setTagPersistError(null)
    const res = await window.api.project.setTags(menuState.project.id, nextIds)
    if (!res.ok) {
      setTagPersistError(res.error)
      return false
    }

    await onAfterMutation()
    const detailRes = await window.api.project.getDetail(menuState.project.id)
    if (detailRes.ok) setProjectTags(detailRes.data.tags)
    return true
  }, [menuState, onAfterMutation])

  const menuNode = useMemo(() => {
    if (!menuState) return null

    const viewportPadding = 12
    const width = getProjectMenuWidth(menuState.view)
    const left = Math.min(
      Math.max(viewportPadding, menuState.anchorX),
      window.innerWidth - width - viewportPadding
    )
    const top = Math.min(
      Math.max(viewportPadding, menuState.anchorY),
      window.innerHeight - viewportPadding
    )
    const isCalendar = menuState.view === 'plan' || menuState.view === 'due'
    const isTags = menuState.view === 'tags'

    return createPortal(
      <div
        ref={menuRef}
        className={
          isCalendar
            ? 'task-inline-popover task-inline-popover-calendar'
            : isTags
              ? 'task-inline-popover task-inline-popover-tags'
              : 'task-inline-popover'
        }
        role="dialog"
        aria-label={t('aria.projectActions')}
        style={{ position: 'fixed', top, left, width, zIndex: 60 }}
      >
        <div className="task-inline-popover-body">
          {menuState.view === 'root' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => setMenuState((current) => (current ? { ...current, view: 'plan' } : current))}
              >
                {t('common.plan')}
              </button>
              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => setMenuState((current) => (current ? { ...current, view: 'move' } : current))}
              >
                {t('common.move')}
              </button>
              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => {
                  setTagCreateError(null)
                  setTagsError(null)
                  setTagPersistError(null)
                  setTagCreateTitle('')
                  setMenuState((current) => (current ? { ...current, view: 'tags' } : current))
                }}
              >
                {t('taskEditor.tagsLabel')}
              </button>
              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => setMenuState((current) => (current ? { ...current, view: 'due' } : current))}
              >
                {t('taskEditor.dueLabel')}
              </button>
              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => {
                  void (async () => {
                    setActionError(null)
                    const res = await window.api.project.complete(menuState.project.id)
                    if (!res.ok) {
                      setActionError(res.error)
                      return
                    }

                    await onAfterMutation()
                    closeMenu({ restoreFocus: false })
                  })()
                }}
              >
                {t('projectPage.markDone')}
              </button>
              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => {
                  void (async () => {
                    setActionError(null)
                    const res = await window.api.project.cancel(menuState.project.id)
                    if (!res.ok) {
                      setActionError(res.error)
                      return
                    }

                    await onAfterMutation()
                    closeMenu({ restoreFocus: false })
                  })()
                }}
              >
                {t('project.cancel')}
              </button>
              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => {
                  onRename(menuState.project)
                  closeMenu({ restoreFocus: false })
                }}
              >
                {t('common.rename')}
              </button>
              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => {
                  void (async () => {
                    setActionError(null)
                    const confirmed = confirm(t('project.deleteConfirm'))
                    if (!confirmed) return

                    const res = await window.api.project.delete(menuState.project.id)
                    if (!res.ok) {
                      setActionError(res.error)
                      return
                    }

                    await onAfterMutation()
                    if (currentPathname === `/projects/${menuState.project.id}`) onNavigate('/today')
                    closeMenu({ restoreFocus: false })
                  })()
                }}
              >
                {t('common.delete')}
              </button>
            </div>
          ) : menuState.view === 'move' ? (
            <>
              <div className="row" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setMenuState((current) => (current ? { ...current, view: 'root' } : current))}
                >
                  {t('common.back')}
                </button>
                <div className="task-inline-popover-title">{t('common.move')}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
                <button
                  type="button"
                  className={`task-inline-popover-item${menuState.project.area_id === null ? ' is-selected' : ''}`}
                  aria-pressed={menuState.project.area_id === null}
                  onClick={() => {
                    void (async () => {
                      if (menuState.project.area_id === null) {
                        closeMenu({ restoreFocus: true })
                        return
                      }

                      const moved = await onMoveProject(menuState.project.id, null)
                      if (!moved) {
                        closeMenu({ restoreFocus: true })
                        return
                      }

                      await onAfterMutation()
                      closeMenu({ restoreFocus: false })
                    })()
                  }}
                >
                  {t('common.noneOption')}
                </button>

                {areas.map((area) => {
                  const isCurrent = area.id === menuState.project.area_id
                  return (
                    <button
                      key={area.id}
                      type="button"
                      className={`task-inline-popover-item${isCurrent ? ' is-selected' : ''}`}
                      aria-pressed={isCurrent}
                      onClick={() => {
                        void (async () => {
                          if (isCurrent) {
                            closeMenu({ restoreFocus: true })
                            return
                          }

                          const moved = await onMoveProject(menuState.project.id, area.id)
                          if (!moved) {
                            closeMenu({ restoreFocus: true })
                            return
                          }

                          await onAfterMutation()
                          closeMenu({ restoreFocus: false })
                        })()
                      }}
                    >
                      {area.title.trim() ? area.title : t('area.untitled')}
                    </button>
                  )
                })}
              </div>
            </>
          ) : menuState.view === 'tags' ? (
            <>
              <div className="row" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    setTagCreateError(null)
                    setTagsError(null)
                    setTagPersistError(null)
                    setMenuState((current) => (current ? { ...current, view: 'root' } : current))
                  }}
                >
                  {t('common.back')}
                </button>
                <div className="task-inline-popover-title">{t('taskEditor.tagsLabel')}</div>
              </div>

              <input
                ref={tagsInputRef}
                className="input"
                placeholder={t('taskEditor.newTagPlaceholder')}
                value={tagCreateTitle}
                onChange={(event) => {
                  setTagCreateTitle(event.target.value)
                  if (tagCreateError) setTagCreateError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  if (event.nativeEvent.isComposing) return
                  event.preventDefault()
                  event.stopPropagation()

                  const title = tagCreateTitle.trim()
                  if (!title) return

                  const normalized = normalizeTagTitle(title)
                  const existing = allTags.find((tag) => normalizeTagTitle(tag.title) === normalized)
                  const selectedIds = projectTags.map((tag) => tag.id)

                  if (existing) {
                    if (!selectedIds.includes(existing.id)) {
                      void persistProjectTags([...selectedIds, existing.id])
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
                    const tagsRes = await window.api.tag.list()
                    if (tagsRes.ok) setAllTags(tagsRes.data)

                    if (!selectedIds.includes(res.data.id)) {
                      await persistProjectTags([...selectedIds, res.data.id])
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
                  const selectedIds = projectTags.map((entry) => entry.id)
                  const checked = selectedIds.includes(tag.id)
                  return (
                    <Checkbox
                      key={tag.id}
                      className="tag-checkbox"
                      style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                      checked={checked}
                      onCheckedChange={(nextChecked) => {
                        const currentIds = projectTags.map((entry) => entry.id)
                        const nextIds = nextChecked
                          ? currentIds.includes(tag.id)
                            ? currentIds
                            : [...currentIds, tag.id]
                          : currentIds.filter((id) => id !== tag.id)

                        void persistProjectTags(nextIds)
                      }}
                    >
                      <span>{tag.title}</span>
                    </Checkbox>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="row" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setMenuState((current) => (current ? { ...current, view: 'root' } : current))}
                >
                  {t('common.back')}
                </button>
                <div className="task-inline-popover-title">
                  {menuState.view === 'plan' ? t('common.plan') : t('taskEditor.dueLabel')}
                </div>
              </div>

              <div className="row" style={{ gap: 8 }}>
                {menuState.view === 'plan' ? (
                  <>
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        void persistProjectUpdate({ scheduled_at: today, is_someday: false })
                      }}
                    >
                      {t('taskEditor.popoverScheduleToday')}
                    </button>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => {
                        void persistProjectUpdate({ scheduled_at: null, is_someday: true })
                      }}
                    >
                      {t('taskEditor.popoverScheduleSomeday')}
                    </button>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => {
                        void persistProjectUpdate({ scheduled_at: null, is_someday: false })
                      }}
                    >
                      {t('common.clear')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        void persistProjectUpdate({ due_at: today })
                      }}
                    >
                      {t('taskEditor.popoverDueToday')}
                    </button>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => {
                        void persistProjectUpdate({ due_at: null })
                      }}
                    >
                      {t('common.clear')}
                    </button>
                  </>
                )}
              </div>

              <DayPicker
                mode="single"
                selected={
                  (() => {
                    const dateValue =
                      menuState.view === 'plan' ? menuState.project.scheduled_at : menuState.project.due_at
                    return dateValue ? (parseLocalDate(dateValue) ?? undefined) : undefined
                  })()
                }
                onSelect={(date) => {
                  if (!date) return

                  const nextDate = formatLocalDate(date)
                  if (menuState.view === 'plan') {
                    void persistProjectUpdate({ scheduled_at: nextDate, is_someday: false })
                    return
                  }

                  void persistProjectUpdate({ due_at: nextDate })
                }}
              />
            </>
          )}

          {actionError ? (
            <div className="error" style={{ margin: '10px 0 0' }}>
              <div className="error-code">{actionError.code}</div>
              <div>{actionError.message}</div>
            </div>
          ) : null}
        </div>
      </div>,
      document.body
    )
  }, [
    actionError,
    allTags,
    areas,
    closeMenu,
    currentPathname,
    menuState,
    onAfterMutation,
    onMoveProject,
    onNavigate,
    onRename,
    persistProjectTags,
    persistProjectUpdate,
    projectTags,
    t,
    tagCreateError,
    tagCreateTitle,
    tagPersistError,
    tagsError,
    today,
  ])

  return { openSidebarProjectContextMenu, menuNode }
}
