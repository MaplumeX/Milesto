import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'

import type { EntityScope } from '../../../shared/schemas/common'
import { isClosedTaskStatus } from '../../../shared/schemas/common'
import type { ProjectSection } from '../../../shared/schemas/project'
import type { TaskListItem } from '../../../shared/schemas/task-list'

import { Button } from '../../components/Button'
import { useContentScrollRef } from '../../app/ContentScrollContext'
import { AnimatedTaskSlot } from './AnimatedTaskSlot'
import { TaskInlineEditorRow } from './TaskInlineEditorRow'
import { TaskRow } from './TaskRow'
import { useTaskSelection } from './TaskSelectionContext'
import { useTaskContextMenu } from './use-task-context-menu'
import { useProjectSectionContextMenu } from './use-project-section-context-menu'
import { usePrefersReducedMotion } from './dnd-drop-animation'
import { useOptimisticTaskTitles } from './use-optimistic-task-titles'
import { buildProjectDoneTaskRows } from './project-done-task-rows'
import { formatMonthDay } from '../../lib/dates'

export type DoneAreaRow =
  | { type: 'header'; section: ProjectSection }
  | { type: 'task'; task: TaskListItem; affiliationLabel: string | null }

type SelectedRow =
  | { type: 'task'; taskId: string }
  | { type: 'header'; sectionId: string }
  | null

function buildDoneAreaRows(
  doneRows: ReturnType<typeof buildProjectDoneTaskRows>,
  sections: ProjectSection[]
): DoneAreaRow[] {
  const result: DoneAreaRow[] = []
  const sectionById = new Map(sections.map((section) => [section.id, section]))
  const rowsBySectionId = new Map<string, typeof doneRows>()
  const unsectionedRows: typeof doneRows = []

  for (const row of doneRows) {
    const sectionId = row.task.section_id
    if (!sectionId || !sectionById.has(sectionId)) {
      unsectionedRows.push(row)
      continue
    }

    const sectionRows = rowsBySectionId.get(sectionId) ?? []
    sectionRows.push(row)
    rowsBySectionId.set(sectionId, sectionRows)
  }

  for (const row of unsectionedRows) {
    result.push({ type: 'task', task: row.task, affiliationLabel: row.affiliationLabel })
  }

  for (const section of sections) {
    const sectionRows = rowsBySectionId.get(section.id) ?? []
    if (section.status === 'done') {
      result.push({ type: 'header', section })
    }

    for (const row of sectionRows) {
      result.push({ type: 'task', task: row.task, affiliationLabel: row.affiliationLabel })
    }
  }

  return result
}

function getDoneDatePrefix(task: TaskListItem): string | null {
  const iso = task.completed_at ?? task.updated_at
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms) || ms <= 0) return null
  return formatMonthDay(new Date(ms))
}

export function ProjectDoneTaskList({
  doneTasks,
  sections,
  scope,
  onToggleDone,
  onMutate,
  focusRegion,
  focusRegionSource,
  initialFocusIndex,
  onNavigateOut,
  onEscCollapse,
  onFocusRegionChange,
}: {
  doneTasks: TaskListItem[]
  sections: ProjectSection[]
  scope: EntityScope
  onToggleDone: (taskId: string, done: boolean) => Promise<void>
  onMutate?: () => Promise<void>
  focusRegion?: 'active' | 'toggle' | 'done'
  focusRegionSource?: 'keyboard' | 'mouse'
  initialFocusIndex?: number | null
  onNavigateOut?: (direction: 'up' | 'down') => void
  onEscCollapse?: () => void
  onFocusRegionChange?: (region: 'active' | 'toggle' | 'done', source: 'keyboard' | 'mouse') => void
}) {
  const { t } = useTranslation()
  const { selectedTaskId, selectTask, openTask, openTaskId, requestCloseTask } = useTaskSelection()
  const contentScrollRef = useContentScrollRef()
  const doneTasksWithOptimisticTitles = useOptimisticTaskTitles(doneTasks)
  const prefersReducedMotion = usePrefersReducedMotion()
  const { openTaskContextMenu, menuNode } = useTaskContextMenu({ scope })
  const { openProjectSectionContextMenu, menuNode: sectionContextMenuNode } = useProjectSectionContextMenu({
    scope,
    onMutate: onMutate ?? (async () => {}),
  })

  const listboxRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  const [selectedRow, setSelectedRow] = useState<SelectedRow>(null)

  const { rows, visibleTasks, taskRowIndexById, headerRowIndexBySectionId } = useMemo(() => {
    const doneRows = buildProjectDoneTaskRows({
      doneTasks: doneTasksWithOptimisticTitles,
      sections,
    })

    const areaRows = buildDoneAreaRows(doneRows, sections)

    const rows: DoneAreaRow[] = areaRows
    const visibleTasks: TaskListItem[] = []
    const taskRowIndexById = new Map<string, number>()
    const headerRowIndexBySectionId = new Map<string, number>()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue
      if (row.type === 'task') {
        taskRowIndexById.set(row.task.id, i)
        visibleTasks.push(row.task)
      } else if (row.type === 'header') {
        headerRowIndexBySectionId.set(row.section.id, i)
      }
    }

    return { rows, visibleTasks, taskRowIndexById, headerRowIndexBySectionId }
  }, [doneTasksWithOptimisticTitles, sections])

  const selectedRowIndex = useMemo(() => {
    if (!selectedRow) return null
    if (selectedRow.type === 'task') return taskRowIndexById.get(selectedRow.taskId) ?? null
    return headerRowIndexBySectionId.get(selectedRow.sectionId) ?? null
  }, [headerRowIndexBySectionId, selectedRow, taskRowIndexById])

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedRow(null)
    }
  }, [rows.length])

  useEffect(() => {
    if (!selectedTaskId) return
    setSelectedRow({ type: 'task', taskId: selectedTaskId })
  }, [selectedTaskId])

  const lastSelectedIndexRef = useRef(0)
  useEffect(() => {
    if (!selectedTaskId) return
    // Only run fallback when this list owns the focus; otherwise the active
    // list or toggle button owns the selection.
    if (focusRegion !== undefined && focusRegion !== 'done') return

    const idx = visibleTasks.findIndex((task) => task.id === selectedTaskId)
    if (idx >= 0) {
      lastSelectedIndexRef.current = idx
      const rowIdx = taskRowIndexById.get(selectedTaskId) ?? null
      setSelectedRow((prev) => {
        if (prev?.type === 'task' && prev.taskId === selectedTaskId) return prev
        return rowIdx !== null ? { type: 'task', taskId: selectedTaskId } : null
      })
      return
    }

    if (visibleTasks.length === 0) {
      selectTask(null)
      setSelectedRow(null)
      return
    }

    const fallbackIdx = Math.min(lastSelectedIndexRef.current, visibleTasks.length - 1)
    const fallback = visibleTasks[fallbackIdx]
    selectTask(fallback?.id ?? null)
  }, [focusRegion, selectedTaskId, selectTask, taskRowIndexById, visibleTasks])

  useLayoutEffect(() => {
    let cancelled = false

    const compute = () => {
      if (cancelled) return
      const se = contentScrollRef.current
      const le = listboxRef.current
      if (!se || !le) {
        window.setTimeout(compute, 0)
        return
      }

      const scrollRect = se.getBoundingClientRect()
      const listRect = le.getBoundingClientRect()
      setScrollMargin(listRect.top - scrollRect.top + se.scrollTop)
    }

    compute()
    window.addEventListener('resize', compute)
    return () => {
      cancelled = true
      window.removeEventListener('resize', compute)
    }
  }, [contentScrollRef])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => contentScrollRef.current,
    estimateSize: (index) => {
      const row = rows[index]
      if (!row) return 44
      if (row.type === 'header') return 34
      if (openTaskId && row.type === 'task' && row.task.id === openTaskId) return 400
      return 44
    },
    scrollMargin,
    overscan: 12,
    getItemKey: (index) => {
      const row = rows[index]
      if (!row) return index
      if (row.type === 'header') return `h:${row.section.id}`
      return `t:${row.task.id}`
    },
  })

  const handleTaskContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, task: TaskListItem) => {
      event.preventDefault()
      event.stopPropagation()

      const eventTarget = event.target
      const restoreFocusEl =
        eventTarget instanceof HTMLElement
          ? eventTarget.closest<HTMLElement>('[data-task-focus-target="true"]') ??
            event.currentTarget.querySelector<HTMLElement>('[data-task-focus-target="true"]') ??
            event.currentTarget
          : event.currentTarget.querySelector<HTMLElement>('[data-task-focus-target="true"]') ??
            event.currentTarget

      void openTaskContextMenu({
        task,
        scope,
        anchorX: event.clientX,
        anchorY: event.clientY,
        restoreFocusEl,
      })
    },
    [openTaskContextMenu, scope]
  )

  const selectRowByIndex = useCallback(
    (index: number) => {
      const row = rows[index]
      if (!row) return

      if (row.type === 'task') {
        setSelectedRow({ type: 'task', taskId: row.task.id })
        selectTask(row.task.id)
        rowVirtualizer.scrollToIndex(index)
        return
      }

      if (row.type === 'header') {
        setSelectedRow({ type: 'header', sectionId: row.section.id })
        selectTask(null)
        rowVirtualizer.scrollToIndex(index)
      }
    },
    [rowVirtualizer, rows, selectTask]
  )

  // Respond to parent focus handoff (only on region transition, not on data changes)
  const prevFocusRegionRef = useRef(focusRegion)
  const focusRegionSourceRef = useRef(focusRegionSource)
  focusRegionSourceRef.current = focusRegionSource
  useEffect(() => {
    const prev = prevFocusRegionRef.current
    prevFocusRegionRef.current = focusRegion

    // Clear selectedRow when leaving the done region to avoid visual conflict
    if (prev === 'done' && focusRegion !== 'done') {
      setSelectedRow(null)
    }

    if (focusRegion !== 'done') return
    if (prev === 'done') return
    if (rows.length === 0) return

    if (initialFocusIndex != null && initialFocusIndex >= 0) {
      // initialFocusIndex refers to task index in the visible-tasks array
      const targetTask = visibleTasks[initialFocusIndex]
      if (targetTask) {
        const rowIdx = taskRowIndexById.get(targetTask.id)
        if (rowIdx != null) {
          selectRowByIndex(rowIdx)
          // When source is 'mouse', the click already placed focus on the element — skip focus steal
          if (focusRegionSourceRef.current !== 'mouse') {
            listboxRef.current?.focus()
          }
          return
        }
      }
    }

    // Default: focus first task row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row?.type === 'task') {
        selectRowByIndex(i)
        // When source is 'mouse', the click already placed focus on the element — skip focus steal
        if (focusRegionSourceRef.current !== 'mouse') {
          listboxRef.current?.focus()
        }
        return
      }
    }
  }, [focusRegion]) // eslint-disable-line react-hooks/exhaustive-deps

  // When all tasks are restored, notify parent to return focus
  useEffect(() => {
    if (doneTasks.length === 0 && focusRegion === 'done') {
      onNavigateOut?.('up')
    }
  }, [doneTasks.length, focusRegion, onNavigateOut])

  return (
    <>
      <div
        ref={listboxRef}
        className="task-scroll"
        tabIndex={0}
        role="listbox"
        aria-label={t('projectPage.completed')}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Escape') return

          if (e.key === 'Escape') {
            e.preventDefault()
            if (openTaskId) {
              void requestCloseTask()
              return
            }
            onEscCollapse?.()
            return
          }

          if (e.key === 'ArrowDown') {
            e.preventDefault()

            // Find next navigable row (task or header)
            const fromIndex = selectedRowIndex ?? -1
            for (let i = fromIndex + 1; i < rows.length; i++) {
              const row = rows[i]
              if (!row) continue
              // Both task and header rows are navigable
              selectRowByIndex(i)
              return
            }

            // Reached the bottom boundary
            onNavigateOut?.('down')
            return
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault()

            const fromIndex = selectedRowIndex != null ? selectedRowIndex : rows.length
            for (let i = fromIndex - 1; i >= 0; i--) {
              const row = rows[i]
              if (!row) continue
              selectRowByIndex(i)
              return
            }

            // Reached the top boundary
            onNavigateOut?.('up')
            return
          }

          if (e.key === ' ') {
            e.preventDefault()
            if (!selectedRow || selectedRow.type !== 'task') return
            const row = selectedRow
            const taskRowIdx = taskRowIndexById.get(row.taskId)
            const areaRow = taskRowIdx != null ? rows[taskRowIdx] : null
            if (!areaRow || areaRow.type !== 'task') return
            // Restore task: mark as not done
            if (isClosedTaskStatus(areaRow.task.status)) {
              void onToggleDone(areaRow.task.id, false)
            }
            return
          }

          if (e.key === 'Enter') {
            e.preventDefault()
            if (!selectedRow) return

            if (selectedRow.type === 'task') {
              void openTask(selectedRow.taskId)
              return
            }

            // Section header: Enter is a no-op
          }
        }}
      >
        <ul className="task-list" style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null

            const translateY = virtualRow.start - rowVirtualizer.options.scrollMargin

            if (row.type === 'header') {
              const section = row.section
              const isSelected = selectedRowIndex === virtualRow.index && focusRegion === 'done'

              return (
                <li
                  key={`h:${section.id}`}
                  className={`project-group-header done-section-header${isSelected ? ' is-selected' : ''}`}
                  ref={(el) => {
                    if (!el) return
                    rowVirtualizer.measureElement(el)
                  }}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${translateY}px)`,
                  }}
                >
                  <div className="project-group-left">
                    <div className={`project-group-title${section.title.trim() ? '' : ' is-placeholder'}`}>
                      {section.title.trim() ? section.title : t('section.untitled')}
                    </div>
                  </div>
                  <div className="project-group-actions">
                    <Button
                      variant="ghost"
                      className="project-group-menu-button"
                      aria-label={t('aria.sectionActions')}
                      onClick={(e) => {
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        openProjectSectionContextMenu({
                          section,
                          projectId: section.project_id,
                          scope,
                          anchorX: rect.left,
                          anchorY: rect.bottom + 4,
                          restoreFocusEl: e.currentTarget,
                        })
                      }}
                    >
                      ...
                    </Button>
                  </div>
                </li>
              )
            }

            const task = row.task
            const isOpen = openTaskId === task.id
            const titlePrefix = getDoneDatePrefix(task)
            const isSelected = selectedTaskId === task.id && focusRegion === 'done'

            let liEl: HTMLLIElement | null = null

            return (
              <li
                key={`t:${task.id}`}
                className={`task-row${isOpen ? ' is-open' : ' task-row-virtual'}${
                  task.status === 'done' ? ' is-done' : task.status === 'cancelled' ? ' is-cancelled' : ''
                }${isSelected ? ' is-selected' : ''}`}
                data-task-id={task.id}
                ref={(el) => {
                  liEl = el
                  if (!el) return
                  rowVirtualizer.measureElement(el)
                }}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${translateY}px)`,
                }}
              >
                <AnimatedTaskSlot
                  isOpen={isOpen}
                  rowContent={
                    <TaskRow
                      task={task}
                      titlePrefix={titlePrefix}
                      projectAffiliationLabel={row.affiliationLabel}
                      onSelect={(taskId) => {
                        selectTask(taskId)
                        onFocusRegionChange?.('done', 'mouse')
                      }}
                      onOpen={(taskId) => void openTask(taskId)}
                      onToggleDone={(taskId, done) => {
                        if (done) return
                        void onToggleDone(taskId, done)
                      }}
                      onContextMenu={(event) => handleTaskContextMenu(event, task)}
                    />
                  }
                  editorContent={
                    <TaskInlineEditorRow
                      taskId={task.id}
                      scope={scope}
                      projectScope={scope}
                      showProjectActions={false}
                    />
                  }
                  onHeightChange={() => {
                    if (liEl) rowVirtualizer.measureElement(liEl)
                  }}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </li>
            )
          })}
        </ul>
      </div>

      {menuNode}
      {sectionContextMenuNode}
    </>
  )
}
