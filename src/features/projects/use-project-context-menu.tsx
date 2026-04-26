import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import type { AppError } from '../../../shared/app-error'
import type { Area } from '../../../shared/schemas/area'
import type { Tag } from '../../../shared/schemas/tag'

import { useAppEvents } from '../../app/AppEventsContext'
import { PopoverMenuGroup } from '../../components/PopoverMenuGroup'
import { PopoverMenuItem } from '../../components/PopoverMenuItem'
import {
  CancelMenuIcon,
  DeleteMenuIcon,
  DoneMenuIcon,
  DueMenuIcon,
  MoveMenuIcon,
  RenameMenuIcon,
  ScheduleMenuIcon,
  TagMenuIcon,
} from '../../components/popover-menu-icons'
import { TagPicker } from '../tags/TagPicker'
import { formatLocalDate, parseLocalDate } from '../../lib/dates'
import type { ProjectRowProject } from './ProjectRow'

type ProjectContextMenuView = 'root' | 'plan' | 'move' | 'due' | 'tags'

type ProjectContextMenuState = {
  project: ProjectRowProject
  anchorX: number
  anchorY: number
  restoreFocusEl: HTMLElement | null
  view: ProjectContextMenuView
}

type OpenProjectContextMenuInput = {
  project: ProjectRowProject
  anchorX: number
  anchorY: number
  restoreFocusEl?: HTMLElement | null
}

function getMenuWidth(view: ProjectContextMenuView): number {
  if (view === 'root') return 188
  if (view === 'tags') return 220
  return 236
}

export function useProjectContextMenu({
  onRename,
}: {
  onRename?: (projectId: string) => void
} = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { bumpRevision } = useAppEvents()

  const [menuState, setMenuState] = useState<ProjectContextMenuState | null>(null)
  const [actionError, setActionError] = useState<AppError | null>(null)
  const [projectTags, setProjectTags] = useState<Tag[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [tagsError, setTagsError] = useState<AppError | null>(null)
  const [areas, setAreas] = useState<Area[]>([])
  const menuRef = useRef<HTMLDivElement | null>(null)
  const today = formatLocalDate(new Date())

  // Load areas once on mount.
  useEffect(() => {
    void (async () => {
      const res = await window.api.area.list()
      if (res.ok) setAreas(res.data)
    })()
  }, [])

  const closeMenu = useCallback((opts?: { restoreFocus?: boolean }) => {
    const current = menuState
    setMenuState(null)
    setActionError(null)
    setProjectTags([])
    setAllTags([])
    setTagsError(null)

    if (!current || !opts?.restoreFocus) return

    window.setTimeout(() => {
      if (current.restoreFocusEl?.isConnected) current.restoreFocusEl.focus()
    }, 0)
  }, [menuState])

  const openProjectContextMenu = useCallback(
    ({ project, anchorX, anchorY, restoreFocusEl = null }: OpenProjectContextMenuInput) => {
      setActionError(null)
      setProjectTags([])
      setAllTags([])
      setTagsError(null)
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

  const persistProjectUpdate = useCallback(async (patch: Partial<ProjectRowProject>) => {
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

    bumpRevision()
    closeMenu({ restoreFocus: false })
    return true
  }, [bumpRevision, closeMenu, menuState])

  const persistProjectTags = useCallback(async (nextIds: string[]) => {
    if (!menuState) return false

    const res = await window.api.project.setTags(menuState.project.id, nextIds)
    if (!res.ok) {
      return false
    }

    bumpRevision()
    const detailRes = await window.api.project.getDetail(menuState.project.id)
    if (detailRes.ok) setProjectTags(detailRes.data.tags)
    return true
  }, [bumpRevision, menuState])

  const menuNode = useMemo(() => {
    if (!menuState) return null

    const viewportPadding = 12
    const width = getMenuWidth(menuState.view)
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
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <PopoverMenuGroup>
                <PopoverMenuItem
                  icon={<ScheduleMenuIcon />}
                  onClick={() => setMenuState((current) => (current ? { ...current, view: 'plan' } : current))}
                >
                  {t('common.plan')}
                </PopoverMenuItem>
                <PopoverMenuItem
                  icon={<MoveMenuIcon />}
                  onClick={() => setMenuState((current) => (current ? { ...current, view: 'move' } : current))}
                >
                  {t('common.move')}
                </PopoverMenuItem>
                <PopoverMenuItem
                  icon={<TagMenuIcon />}
                  onClick={() => setMenuState((current) => (current ? { ...current, view: 'tags' } : current))}
                >
                  {t('taskEditor.tagsLabel')}
                </PopoverMenuItem>
                <PopoverMenuItem
                  icon={<DueMenuIcon />}
                  onClick={() => setMenuState((current) => (current ? { ...current, view: 'due' } : current))}
                >
                  {t('taskEditor.dueLabel')}
                </PopoverMenuItem>
              </PopoverMenuGroup>
              <PopoverMenuGroup>
                <PopoverMenuItem
                  icon={<DoneMenuIcon />}
                  onClick={() => {
                    void (async () => {
                      setActionError(null)
                      const res = await window.api.project.complete(menuState.project.id)
                      if (!res.ok) {
                        setActionError(res.error)
                        return
                      }

                      bumpRevision()
                      closeMenu({ restoreFocus: false })
                    })()
                  }}
                >
                  {t('projectPage.markDone')}
                </PopoverMenuItem>
                <PopoverMenuItem
                  icon={<CancelMenuIcon />}
                  onClick={() => {
                    void (async () => {
                      setActionError(null)
                      const res = await window.api.project.cancel(menuState.project.id)
                      if (!res.ok) {
                        setActionError(res.error)
                        return
                      }

                      bumpRevision()
                      closeMenu({ restoreFocus: false })
                    })()
                  }}
                >
                  {t('project.cancel')}
                </PopoverMenuItem>
              </PopoverMenuGroup>
              <PopoverMenuGroup>
                <PopoverMenuItem
                  icon={<RenameMenuIcon />}
                  onClick={() => {
                    if (onRename) {
                      onRename(menuState.project.id)
                    } else {
                      navigate(`/projects/${menuState.project.id}`)
                    }
                    closeMenu({ restoreFocus: false })
                  }}
                >
                  {t('common.rename')}
                </PopoverMenuItem>
              </PopoverMenuGroup>
              <PopoverMenuGroup>
                <PopoverMenuItem
                  icon={<DeleteMenuIcon />}
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

                      bumpRevision()
                      if (location.pathname === `/projects/${menuState.project.id}`) {
                        navigate('/today')
                      }
                      closeMenu({ restoreFocus: false })
                  })()
                }}
              >
                {t('common.delete')}
              </PopoverMenuItem>
              </PopoverMenuGroup>
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
                <PopoverMenuItem
                  className={menuState.project.area_id === null || menuState.project.area_id === undefined ? 'is-selected' : ''}
                  aria-pressed={menuState.project.area_id === null || menuState.project.area_id === undefined}
                  onClick={() => {
                    void (async () => {
                      if (menuState.project.area_id === null || menuState.project.area_id === undefined) {
                        closeMenu({ restoreFocus: true })
                        return
                      }

                      const res = await window.api.project.update({
                        id: menuState.project.id,
                        area_id: null,
                      })
                      if (!res.ok) {
                        closeMenu({ restoreFocus: true })
                        return
                      }

                      bumpRevision()
                      closeMenu({ restoreFocus: false })
                    })()
                  }}
                >
                  {t('common.noneOption')}
                </PopoverMenuItem>

                {areas.map((area) => {
                  const isCurrent = area.id === menuState.project.area_id
                  return (
                    <PopoverMenuItem
                      key={area.id}
                      className={isCurrent ? 'is-selected' : ''}
                      aria-pressed={isCurrent}
                      onClick={() => {
                        void (async () => {
                          if (isCurrent) {
                            closeMenu({ restoreFocus: true })
                            return
                          }

                          const res = await window.api.project.update({
                            id: menuState.project.id,
                            area_id: area.id,
                          })
                          if (!res.ok) {
                            closeMenu({ restoreFocus: true })
                            return
                          }

                          bumpRevision()
                          closeMenu({ restoreFocus: false })
                        })()
                      }}
                    >
                      {area.title.trim() ? area.title : t('area.untitled')}
                    </PopoverMenuItem>
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
                  onClick={() => setMenuState((current) => (current ? { ...current, view: 'root' } : current))}
                >
                  {t('common.back')}
                </button>
                <div className="task-inline-popover-title">{t('taskEditor.tagsLabel')}</div>
              </div>

              <TagPicker
                tags={allTags}
                selectedTagIds={projectTags.map((t) => t.id)}
                onToggle={(tagId, selected) => {
                  const current = projectTags.map((t) => t.id)
                  const next = selected
                    ? [...current, tagId]
                    : current.filter((id) => id !== tagId)
                  void persistProjectTags(next)
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
                weekStartsOn={1}
                showOutsideDays
                fixedWeeks
                autoFocus
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
    bumpRevision,
    closeMenu,
    location.pathname,
    menuState,
    navigate,
    onRename,
    persistProjectTags,
    persistProjectUpdate,
    projectTags,
    t,
    tagsError,
    today,
  ])

  return { openProjectContextMenu, menuNode }
}
