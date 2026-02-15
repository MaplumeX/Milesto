import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import { useTranslation } from 'react-i18next'

import type { Area } from '../../shared/schemas/area'
import type { Project } from '../../shared/schemas/project'
import type { TaskUpdateInput } from '../../shared/schemas/task'

import { formatLocalDate } from '../lib/dates'
import { getLocalToday } from '../lib/use-local-today'

const UI_OPEN_SEARCH_PANEL_EVENT = 'milesto:ui.openSearchPanel'

type PopoverKind = 'schedule' | 'move'
type ActivePopover = {
  kind: PopoverKind
  anchorEl: HTMLElement
} | null

export function ContentBottomBarActions({
  taskId,
  variant = 'list',
  onEditModeActionComplete,
  areas,
  openProjects,
  bumpRevision,
}: {
  taskId: string | null
  variant?: 'list' | 'edit'
  onEditModeActionComplete?: () => void
  areas: Area[]
  openProjects: Project[]
  bumpRevision: () => void
}) {
  const { t } = useTranslation()
  const isEditMode = variant === 'edit'
  const [activePopover, setActivePopover] = useState<ActivePopover>(null)
  const activePopoverRef = useRef<ActivePopover>(null)
  useEffect(() => {
    activePopoverRef.current = activePopover
  }, [activePopover])

  const taskIdRef = useRef<string | null>(taskId)
  useEffect(() => {
    taskIdRef.current = taskId
  }, [taskId])

  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const isTaskSelected = taskId !== null

  const closePopover = useCallback((opts?: { restoreFocus?: boolean }) => {
    const cur = activePopoverRef.current
    if (!cur) return
    const anchorEl = cur.anchorEl
    setActivePopover(null)
    setActionError(null)

    if (!opts?.restoreFocus) return
    window.setTimeout(() => {
      if (anchorEl.isConnected) anchorEl.focus()
    }, 0)
  }, [])

  useEffect(() => {
    if (!activePopover) return

    function handlePointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      if (!(e.target instanceof Node)) return

      const pop = popoverRef.current
      const cur = activePopoverRef.current
      if (!cur) return

      if (pop?.contains(e.target) || cur.anchorEl.contains(e.target)) return

      e.preventDefault()
      e.stopPropagation()
      closePopover({ restoreFocus: true })
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      closePopover({ restoreFocus: true })
    }

    function handleClose() {
      // Scroll/resize is not an intentional dismissal; don't steal focus.
      closePopover({ restoreFocus: false })
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
  }, [activePopover, closePopover])

  useEffect(() => {
    // If selection is cleared while a popover is open, dismiss it.
    if (!activePopover) return
    if (taskId !== null) return
    closePopover({ restoreFocus: true })
  }, [activePopover, closePopover, taskId])

  async function updateSelectedTask(patch: Partial<Omit<TaskUpdateInput, 'id'>>) {
    const activeTaskId = taskIdRef.current
    if (!activeTaskId) return

    setActionError(null)
    const res = await window.api.task.update({ id: activeTaskId, ...patch })
    if (!res.ok) {
      setActionError(`${res.error.code}: ${res.error.message}`)
      return
    }

    bumpRevision()
    closePopover({ restoreFocus: !isEditMode })

    // In edit mode, moving the open task should exit the inline editor.
    // This keeps the interaction consistent with the inline editor's own
    // "done"/"close" behaviors after a structural change.
    if (isEditMode) onEditModeActionComplete?.()
  }

  const openSchedule = (anchorEl: HTMLElement) => {
    if (!isTaskSelected || isEditMode) return
    setActionError(null)
    setActivePopover({ kind: 'schedule', anchorEl })
  }

  const openMove = (anchorEl: HTMLElement) => {
    if (!isTaskSelected) return
    setActionError(null)
    setActivePopover({ kind: 'move', anchorEl })
  }

  const openSearch = () => {
    if (isEditMode) return
    closePopover({ restoreFocus: false })
    window.dispatchEvent(new CustomEvent(UI_OPEN_SEARCH_PANEL_EVENT))
  }

  const renderPopover = () => {
    if (!activePopover) return null

    const rect = activePopover.anchorEl.getBoundingClientRect()
    const viewportPadding = 12
    const gap = 8

    const isCalendar = activePopover.kind === 'schedule'
    const maxWidth = isCalendar ? 236 : 320
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - maxWidth - viewportPadding
    )

    const estimatedHeight = isCalendar ? 320 : 360
    const preferredTop = rect.bottom + gap
    const spaceBelow = window.innerHeight - viewportPadding - preferredTop
    const spaceAbove = rect.top - gap - viewportPadding
    const openAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow

    const top = openAbove ? rect.top - gap : preferredTop
    const maxHeight = Math.max(180, openAbove ? spaceAbove : spaceBelow)

    return createPortal(
      <div
        ref={popoverRef}
        data-content-bottom-popover={activePopover.kind}
        className={
          activePopover.kind === 'schedule'
            ? 'task-inline-popover task-inline-popover-calendar'
            : 'task-inline-popover'
        }
        role="dialog"
        style={{
          position: 'fixed',
          top,
          left,
          width: maxWidth,
          maxHeight: activePopover.kind === 'move' ? maxHeight : undefined,
          overflow: activePopover.kind === 'move' ? 'auto' : undefined,
          transform: openAbove ? 'translateY(-100%)' : undefined,
          zIndex: 45,
        }}
      >
        <div className="task-inline-popover-body">
          <div className="task-inline-popover-title">
            {activePopover.kind === 'schedule' ? t('common.schedule') : t('common.move')}
          </div>

          {actionError ? (
            <div className="error" style={{ margin: '10px 0 0' }}>
              <div className="error-code">{t('taskEditor.actionFailedTitle')}</div>
              <div>{actionError}</div>
            </div>
          ) : null}

          {activePopover.kind === 'schedule' ? (
            <>
              <div className="task-inline-calendar" style={{ marginTop: 8 }}>
                <DayPicker
                  mode="single"
                  selected={undefined}
                  onSelect={(date) => {
                    const nextDate = date ? formatLocalDate(date) : null
                    if (!nextDate) return
                    void updateSelectedTask({ scheduled_at: nextDate, is_someday: false, is_inbox: false })
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
                  onClick={() => void updateSelectedTask({ is_someday: true, scheduled_at: null, is_inbox: false })}
                >
                  {t('nav.someday')}
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() =>
                    void updateSelectedTask({ is_someday: false, scheduled_at: getLocalToday(), is_inbox: false })
                  }
                >
                  {t('nav.today')}
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => void updateSelectedTask({ is_someday: false, scheduled_at: null })}
                >
                  {t('common.none')}
                </button>
              </div>
            </>
          ) : (
            <div style={{ marginTop: 10 }}>
              <div className="content-bottom-popover-section">
                <div className="label" style={{ marginBottom: 8 }}>
                  {t('shell.areas')}
                </div>
                <div className="content-bottom-popover-list">
                  {areas.length === 0 ? <div className="nav-muted">{t('shell.empty')}</div> : null}
                  {areas.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`button button-ghost content-bottom-popover-item${
                        a.title.trim() ? '' : ' is-placeholder'
                      }`}
                      onClick={() =>
                        void updateSelectedTask({
                          area_id: a.id,
                          project_id: null,
                          section_id: null,
                          is_inbox: false,
                        })
                      }
                    >
                      {a.title.trim() ? a.title : t('area.untitled')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="content-bottom-popover-section" style={{ marginTop: 10 }}>
                <div className="label" style={{ marginBottom: 8 }}>
                  {t('nav.projects')}
                </div>
                <div className="content-bottom-popover-list">
                  {openProjects.length === 0 ? <div className="nav-muted">{t('shell.empty')}</div> : null}
                  {openProjects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`button button-ghost content-bottom-popover-item${
                        p.title.trim() ? '' : ' is-placeholder'
                      }`}
                      onClick={() =>
                        void updateSelectedTask({
                          project_id: p.id,
                          area_id: null,
                          section_id: null,
                          is_inbox: false,
                        })
                      }
                    >
                      {p.title.trim() ? p.title : t('project.untitled')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>,
      document.body
    )
  }

  return (
    <>
      {!isEditMode ? (
        <button
          type="button"
          className="button button-ghost"
          disabled={!isTaskSelected}
          onClick={(e) => openSchedule(e.currentTarget as HTMLElement)}
        >
          {t('common.schedule')}
        </button>
      ) : null}
      <button
        type="button"
        className="button button-ghost"
        disabled={!isTaskSelected}
        onClick={(e) => openMove(e.currentTarget as HTMLElement)}
        data-content-bottom-edit-action={isEditMode ? 'move' : undefined}
      >
        {t('common.move')}
      </button>
      {!isEditMode ? (
        <button type="button" className="button button-ghost" onClick={openSearch}>
          {t('common.search')}
        </button>
      ) : null}

      {renderPopover()}
    </>
  )
}
