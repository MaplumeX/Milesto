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
import { Checkbox } from '../../components/Checkbox'
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
  const [tagsLoading, setTagsLoading] = useState(false)
  const [tagsError, setTagsError] = useState<AppError | null>(null)

  const closeMenu = useCallback((opts?: { restoreFocus?: boolean }) => {
    const current = menuState
    setMenuState(null)
    setActionError(null)
    setSelectedTagIds(null)
    setTags([])
    setTagsLoading(false)
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
      setTagsLoading(false)
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
    setTagsLoading(true)
    setTagsError(null)

    void (async () => {
      const [detailRes, tagsRes] = await Promise.all([
        window.api.task.getDetail(menuState.task.id, menuState.scope),
        window.api.tag.list(),
      ])
      if (cancelled) return

      if (!detailRes.ok) {
        setTagsError(detailRes.error)
        setTagsLoading(false)
        return
      }
      if (!tagsRes.ok) {
        setTagsError(tagsRes.error)
        setTagsLoading(false)
        return
      }

      setSelectedTagIds(detailRes.data.tag_ids)
      setTags(tagsRes.data)
      setTagsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [menuState])

  async function persistTaskUpdate(patch: Record<string, unknown>) {
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
  }

  async function persistTaskToggleDone(done: boolean) {
    if (!menuState) return
    const res = await window.api.task.toggleDone(menuState.task.id, done, menuState.scope)
    if (!res.ok) {
      setActionError(res.error)
      return
    }

    bumpRevision()
    closeMenu({ restoreFocus: true })
  }

  async function persistTaskCancel() {
    if (!menuState) return
    const res = await window.api.task.cancel(menuState.task.id, menuState.scope)
    if (!res.ok) {
      setActionError(res.error)
      return
    }

    bumpRevision()
    closeMenu({ restoreFocus: true })
  }

  async function persistTaskRestore() {
    if (!menuState) return
    const res = await window.api.task.restore(menuState.task.id, menuState.scope)
    if (!res.ok) {
      setActionError(res.error)
      return
    }

    bumpRevision()
    closeMenu({ restoreFocus: true })
  }

  async function persistTagIds(nextTagIds: string[]) {
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
  }

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
              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => setMenuState((current) => (current ? { ...current, view: 'schedule' } : current))}
              >
                {t('common.schedule')}
              </button>
              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => setMenuState((current) => (current ? { ...current, view: 'tags' } : current))}
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
                  if (isClosed) {
                    void persistTaskRestore()
                    return
                  }

                  void persistTaskToggleDone(true)
                }}
              >
                {isClosed ? t('task.restore') : t('taskEditor.markDone')}
              </button>
              {!isClosed ? (
                <button
                  type="button"
                  className="task-inline-popover-item"
                  onClick={() => void persistTaskCancel()}
                >
                  {t('task.cancel')}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <div className="task-inline-popover-title">{menuState.view === 'schedule' ? t('taskEditor.popoverScheduleTitle') : menuState.view === 'due' ? t('taskEditor.popoverDueTitle') : t('taskEditor.tagsLabel')}</div>
              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => setMenuState((current) => (current ? { ...current, view: 'root' } : current))}
              >
                {t('common.back')}
              </button>

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
                <>
                  {tagsLoading ? <div className="nav-muted" style={{ marginTop: 8 }}>{t('common.loading')}</div> : null}
                  {tagsError ? (
                    <div className="error" style={{ margin: '10px 0 0' }}>
                      <div className="error-code">{tagsError.code}</div>
                      <div>{tagsError.message}</div>
                    </div>
                  ) : null}
                  {selectedTagIds !== null ? (
                    <div className="tag-grid" style={{ marginTop: 8 }}>
                      {tags.map((tag) => {
                        const checked = selectedTagIds.includes(tag.id)
                        return (
                          <Checkbox
                            key={tag.id}
                            className="tag-checkbox"
                            style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                              const next = nextChecked
                                ? Array.from(new Set([...selectedTagIds, tag.id]))
                                : selectedTagIds.filter((id) => id !== tag.id)
                              void persistTagIds(next)
                            }}
                          >
                            <span>{tag.title}</span>
                            <span
                              className="tag-swatch"
                              style={{ marginLeft: 'auto', background: tag.color ?? 'transparent' }}
                              aria-hidden="true"
                            />
                          </Checkbox>
                        )
                      })}
                    </div>
                  ) : null}
                </>
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
  }, [actionError, bumpRevision, closeMenu, menuState, selectedTagIds, t, tags, tagsError, tagsLoading])

  return {
    openTaskContextMenu,
    menuNode,
  }
}
