import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../../shared/app-error'
import type { EntityScope } from '../../../shared/schemas/common'
import { isClosedTaskStatus } from '../../../shared/schemas/common'
import type { Tag } from '../../../shared/schemas/tag'
import type { TaskListItem } from '../../../shared/schemas/task-list'

import { useAppEvents } from '../../app/AppEventsContext'
import { PopoverMenuItem } from '../../components/PopoverMenuItem'
import {
  BackMenuIcon,
  CancelMenuIcon,
  DoneMenuIcon,
  DueMenuIcon,
  RestoreMenuIcon,
  ScheduleMenuIcon,
  TagMenuIcon,
} from '../../components/popover-menu-icons'
import { TagPicker } from '../tags/TagPicker'
import { formatLocalDate, parseLocalDate } from '../../lib/dates'
import { getLocalToday } from '../../lib/use-local-today'
import { useTaskSelection } from './TaskSelectionContext'

type TaskContextMenuView = 'root' | 'schedule' | 'due' | 'tags'

type TaskContextMenuState = {
  task: TaskListItem
  scope: EntityScope
  anchorX: number
  anchorY: number
  restoreFocusEl: HTMLElement | null
  view: TaskContextMenuView
}

type OpenTaskContextMenuInput = {
  task: TaskListItem
  scope?: EntityScope
  anchorX: number
  anchorY: number
  restoreFocusEl?: HTMLElement | null
}

function getMenuWidth(view: TaskContextMenuView): number {
  if (view === 'root') return 188
  if (view === 'tags') return 220
  return 236
}

export function useTaskContextMenu({
  scope = 'active',
  enabled = true,
}: {
  scope?: EntityScope
  enabled?: boolean
}) {
  const { t } = useTranslation()
  const { bumpRevision } = useAppEvents()
  const { requestCloseTask, selectTask } = useTaskSelection()

  const [menuState, setMenuState] = useState<TaskContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const [actionError, setActionError] = useState<AppError | null>(null)
  const [selectedTagIds, setSelectedTagIds] = useState<string[] | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [tagsError, setTagsError] = useState<AppError | null>(null)

  const closeMenu = useCallback((opts?: { restoreFocus?: boolean }) => {
    const current = menuState
    setMenuState(null)
    setActionError(null)
    setSelectedTagIds(null)
    setTags([])
    setTagsError(null)

    if (!current || !opts?.restoreFocus) return

    window.setTimeout(() => {
      if (current.restoreFocusEl?.isConnected) current.restoreFocusEl.focus()
    }, 0)
  }, [menuState])

  const openTaskContextMenu = useCallback(
    async ({
      task,
      scope: nextScope,
      anchorX,
      anchorY,
      restoreFocusEl = null,
    }: OpenTaskContextMenuInput) => {
      if (!enabled) return

      const canOpen = await requestCloseTask()
      if (!canOpen) return

      selectTask(task.id)
      setActionError(null)
      setSelectedTagIds(null)
      setTags([])
      setTagsError(null)
      setMenuState({
        task,
        scope: nextScope ?? scope,
        anchorX,
        anchorY,
        restoreFocusEl,
        view: 'root',
      })
    },
    [enabled, requestCloseTask, scope, selectTask]
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
    setTagsError(null)

    void (async () => {
      const [detailRes, tagsRes] = await Promise.all([
        window.api.task.getDetail(menuState.task.id, menuState.scope),
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

      setSelectedTagIds(detailRes.data.tag_ids)
      setTags(tagsRes.data)
    })()

    return () => {
      cancelled = true
    }
  }, [menuState])

  const persistTaskUpdate = useCallback(async (patch: Record<string, unknown>) => {
    if (!menuState) return
    const res = await window.api.task.update({
      id: menuState.task.id,
      ...patch,
      scope: menuState.scope,
    })
    if (!res.ok) {
      setActionError(res.error)
      return
    }

    bumpRevision()
    closeMenu({ restoreFocus: true })
  }, [bumpRevision, closeMenu, menuState])

  const persistTaskToggleDone = useCallback(async (done: boolean) => {
    if (!menuState) return
    const res = await window.api.task.toggleDone(menuState.task.id, done, menuState.scope)
    if (!res.ok) {
      setActionError(res.error)
      return
    }

    bumpRevision()
    closeMenu({ restoreFocus: true })
  }, [bumpRevision, closeMenu, menuState])

  const persistTaskCancel = useCallback(async () => {
    if (!menuState) return
    const res = await window.api.task.cancel(menuState.task.id, menuState.scope)
    if (!res.ok) {
      setActionError(res.error)
      return
    }

    bumpRevision()
    closeMenu({ restoreFocus: true })
  }, [bumpRevision, closeMenu, menuState])

  const persistTaskRestore = useCallback(async () => {
    if (!menuState) return
    const res = await window.api.task.restore(menuState.task.id, menuState.scope)
    if (!res.ok) {
      setActionError(res.error)
      return
    }

    bumpRevision()
    closeMenu({ restoreFocus: true })
  }, [bumpRevision, closeMenu, menuState])

  const persistTagIds = useCallback(async (nextTagIds: string[]) => {
    if (!menuState || selectedTagIds === null) return

    const prev = selectedTagIds
    setSelectedTagIds(nextTagIds)
    const res = await window.api.task.setTags(menuState.task.id, nextTagIds, menuState.scope)
    if (!res.ok) {
      setSelectedTagIds(prev)
      setTagsError(res.error)
      return
    }

    setTagsError(null)
    bumpRevision()
  }, [bumpRevision, menuState, selectedTagIds])

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
    const isCalendar = menuState.view === 'schedule' || menuState.view === 'due'
    const isTags = menuState.view === 'tags'
    const isClosed = isClosedTaskStatus(menuState.task.status)
    const today = getLocalToday()

    return createPortal(
      <div
        ref={menuRef}
        className={isCalendar ? 'task-inline-popover task-inline-popover-calendar' : isTags ? 'task-inline-popover task-inline-popover-tags' : 'task-inline-popover'}
        role="dialog"
        style={{
          position: 'fixed',
          top,
          left,
          width,
          zIndex: 50,
        }}
      >
        <div className="task-inline-popover-body">
          {menuState.view === 'root' ? (
            <>
              <PopoverMenuItem
                icon={<ScheduleMenuIcon />}
                onClick={() => setMenuState((current) => (current ? { ...current, view: 'schedule' } : current))}
              >
                {t('common.schedule')}
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
              <PopoverMenuItem
                icon={isClosed ? <RestoreMenuIcon /> : <DoneMenuIcon />}
                onClick={() => {
                  if (isClosed) {
                    void persistTaskRestore()
                    return
                  }

                  void persistTaskToggleDone(true)
                }}
              >
                {isClosed ? t('task.restore') : t('taskEditor.markDone')}
              </PopoverMenuItem>
              {!isClosed ? (
                <PopoverMenuItem
                  icon={<CancelMenuIcon />}
                  onClick={() => void persistTaskCancel()}
                >
                  {t('task.cancel')}
                </PopoverMenuItem>
              ) : null}
            </>
          ) : (
            <>
              <div className="task-inline-popover-title">{menuState.view === 'schedule' ? t('taskEditor.popoverScheduleTitle') : menuState.view === 'due' ? t('taskEditor.popoverDueTitle') : t('taskEditor.tagsLabel')}</div>
              <PopoverMenuItem
                icon={<BackMenuIcon />}
                onClick={() => setMenuState((current) => (current ? { ...current, view: 'root' } : current))}
              >
                {t('common.back')}
              </PopoverMenuItem>

              {menuState.view === 'schedule' ? (
                <>
                  <div className="task-inline-calendar" style={{ marginTop: 8 }}>
                    <DayPicker
                      mode="single"
                      selected={
                        !menuState.task.is_someday && menuState.task.scheduled_at
                          ? parseLocalDate(menuState.task.scheduled_at) ?? undefined
                          : undefined
                      }
                      onSelect={(date) => {
                        if (!date) return
                        void persistTaskUpdate({
                          scheduled_at: formatLocalDate(date),
                          is_someday: false,
                          is_inbox: false,
                        })
                      }}
                      weekStartsOn={1}
                      showOutsideDays
                      fixedWeeks
                      autoFocus
                    />
                  </div>
                  <div className="row" style={{ justifyContent: 'flex-start' }}>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => void persistTaskUpdate({ is_someday: true, scheduled_at: null, is_inbox: false })}
                    >
                      {t('nav.someday')}
                    </button>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => void persistTaskUpdate({ scheduled_at: today, is_someday: false, is_inbox: false })}
                    >
                      {t('nav.today')}
                    </button>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => void persistTaskUpdate({ scheduled_at: null, is_someday: false })}
                    >
                      {t('common.clear')}
                    </button>
                  </div>
                </>
              ) : null}

              {menuState.view === 'due' ? (
                <>
                  <div className="task-inline-calendar" style={{ marginTop: 8 }}>
                    <DayPicker
                      mode="single"
                      selected={menuState.task.due_at ? parseLocalDate(menuState.task.due_at) ?? undefined : undefined}
                      onSelect={(date) => {
                        if (!date) return
                        void persistTaskUpdate({ due_at: formatLocalDate(date) })
                      }}
                      weekStartsOn={1}
                      showOutsideDays
                      fixedWeeks
                      autoFocus
                    />
                  </div>
                  <div className="row" style={{ justifyContent: 'flex-start' }}>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => void persistTaskUpdate({ due_at: null })}
                    >
                      {t('common.clear')}
                    </button>
                  </div>
                </>
              ) : null}

              {menuState.view === 'tags' ? (
                <TagPicker
                  tags={tags}
                  selectedTagIds={selectedTagIds ?? []}
                  onToggle={(tagId, selected) => {
                    const current = selectedTagIds ?? []
                    const next = selected
                      ? Array.from(new Set([...current, tagId]))
                      : current.filter((id) => id !== tagId)
                    void persistTagIds(next)
                  }}
                  onCreate={async (title) => {
                    const res = await window.api.tag.create({ title })
                    if (!res.ok) return { ok: false, error: res.error }
                    const list = await window.api.tag.list()
                    if (list.ok) setTags(list.data)
                    return { ok: true, tag: res.data }
                  }}
                  onRefresh={async () => {
                    const list = await window.api.tag.list()
                    if (list.ok) setTags(list.data)
                  }}
                  persistError={tagsError}
                />
              ) : null}
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
    menuState,
    persistTagIds,
    persistTaskCancel,
    persistTaskRestore,
    persistTaskToggleDone,
    persistTaskUpdate,
    selectedTagIds,
    t,
    tags,
    tagsError,
  ])

  return {
    openTaskContextMenu,
    menuNode,
  }
}
