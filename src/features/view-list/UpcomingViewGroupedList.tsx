import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'

import type { ViewListItem, ViewListProjectItem, ViewListTaskItem } from '../../../shared/schemas/view-list'

import { useContentScrollRef } from '../../app/ContentScrollContext'
import { AnimatedTaskSlot } from '../tasks/AnimatedTaskSlot'
import { usePrefersReducedMotion } from '../tasks/dnd-drop-animation'
import { TaskInlineEditorRow } from '../tasks/TaskInlineEditorRow'
import { TaskRow } from '../tasks/TaskRow'
import { useOptimisticTaskTitles } from '../tasks/use-optimistic-task-titles'
import { useTaskContextMenu } from '../tasks/use-task-context-menu'
import { useTaskSelection } from '../tasks/TaskSelectionContext'
import { ProjectViewRow } from './ProjectViewRow'
import { buildUpcomingViewRows } from './upcoming-view-grouping'

function itemKey(item: Pick<ViewListItem, 'kind' | 'id'>): string {
  return `${item.kind}:${item.id}`
}

export function UpcomingViewGroupedList({
  items,
  onToggleTaskDone,
  onCompleteProject,
  today,
  topContent,
  emptyState,
}: {
  items: ViewListItem[]
  onToggleTaskDone: (taskId: string, done: boolean) => Promise<void>
  onCompleteProject: (project: ViewListProjectItem) => Promise<void>
  today: string
  topContent?: ReactNode
  emptyState?: ReactNode
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { selectedTaskId, selectTask, openTask, openTaskId } = useTaskSelection()
  const contentScrollRef = useContentScrollRef()
  const prefersReducedMotion = usePrefersReducedMotion()
  const { openTaskContextMenu, menuNode } = useTaskContextMenu({ scope: 'active' })
  const preListRef = useRef<HTMLDivElement | null>(null)
  const computeScrollMarginRef = useRef<(() => void) | null>(null)
  const listboxRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const taskItems = useMemo(() => items.filter((item): item is ViewListTaskItem => item.kind === 'task'), [items])
  const optimisticTasks = useOptimisticTaskTitles(taskItems)
  const itemsWithOptimisticTitles = useMemo(() => {
    const tasksById = new Map(optimisticTasks.map((task) => [task.id, task]))
    return items.map((item) => {
      if (item.kind === 'project') return item
      return { ...item, ...tasksById.get(item.id), kind: 'task' as const }
    })
  }, [items, optimisticTasks])

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

    computeScrollMarginRef.current = compute
    compute()
    window.addEventListener('resize', compute)
    return () => {
      cancelled = true
      computeScrollMarginRef.current = null
      window.removeEventListener('resize', compute)
    }
  }, [contentScrollRef])

  useLayoutEffect(() => {
    const el = preListRef.current
    if (!el) return
    if (typeof ResizeObserver === 'undefined') return

    const ro = new ResizeObserver(() => {
      computeScrollMarginRef.current?.()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { rows, visibleItems } = useMemo(() => {
    return buildUpcomingViewRows({ items: itemsWithOptimisticTitles, today, locale: i18n.language })
  }, [i18n.language, itemsWithOptimisticTitles, today])

  const selectedItemKey = selectedProjectId ? `project:${selectedProjectId}` : selectedTaskId ? `task:${selectedTaskId}` : null

  const selectItem = useCallback(
    (item: Pick<ViewListItem, 'kind' | 'id'> | null) => {
      if (!item) {
        setSelectedProjectId(null)
        selectTask(null)
        return
      }

      if (item.kind === 'task') {
        setSelectedProjectId(null)
        selectTask(item.id)
        return
      }

      selectTask(null)
      setSelectedProjectId(item.id)
    },
    [selectTask]
  )

  const openItem = useCallback(
    (item: ViewListItem) => {
      if (item.kind === 'task') {
        void openTask(item.id)
        return
      }
      navigate(`/projects/${item.id}`)
    },
    [navigate, openTask]
  )

  const itemRowIndexByKey = useMemo(() => {
    const out = new Map<string, number>()
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row?.type === 'item') out.set(itemKey(row.item), i)
    }
    return out
  }, [rows])

  const lastSelectedIndexRef = useRef(0)
  useEffect(() => {
    if (!selectedItemKey) return

    const idx = visibleItems.findIndex((item) => itemKey(item) === selectedItemKey)
    if (idx >= 0) {
      lastSelectedIndexRef.current = idx
      return
    }

    if (visibleItems.length === 0) {
      selectItem(null)
      return
    }

    const fallbackIdx = Math.min(lastSelectedIndexRef.current, visibleItems.length - 1)
    selectItem(visibleItems[fallbackIdx] ?? null)
  }, [selectItem, selectedItemKey, visibleItems])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => contentScrollRef.current,
    estimateSize: (index) => {
      const row = rows[index]
      if (!row) return 44
      if (row.type === 'header') return row.kind === 'day' ? 42 : 48
      if (row.type === 'spacer') return row.kind === 'day' ? 24 : 36
      if (openTaskId && row.item.kind === 'task' && row.item.id === openTaskId) return 400
      return 44
    },
    scrollMargin,
    overscan: 12,
    getItemKey: (index) => {
      const row = rows[index]
      if (!row) return index
      if (row.type === 'header') return `h:${row.kind}:${row.key}`
      if (row.type === 'spacer') return `s:${row.kind}:${row.key}`
      return itemKey(row.item)
    },
  })

  const handleTaskContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, task: ViewListTaskItem) => {
      event.preventDefault()
      event.stopPropagation()
      selectItem(task)

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
        anchorX: event.clientX,
        anchorY: event.clientY,
        restoreFocusEl,
      })
    },
    [openTaskContextMenu, selectItem]
  )

  return (
    <div className="page">
      <div ref={preListRef}>
        <header className="page-header">
          <h1 className="page-title">{t('nav.upcoming')}</h1>
        </header>

        {topContent ? <div className="task-list-top-content">{topContent}</div> : null}
      </div>

      <div
        ref={listboxRef}
        className="task-scroll"
        tabIndex={0}
        role="listbox"
        aria-label={t('aria.upcomingTasks')}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return

          const rowIndex = selectedItemKey ? itemRowIndexByKey.get(selectedItemKey) ?? -1 : -1

          if (e.key === 'ArrowDown') {
            e.preventDefault()
            for (let i = rowIndex + 1; i < rows.length; i++) {
              const row = rows[i]
              if (row?.type !== 'item') continue
              selectItem(row.item)
              rowVirtualizer.scrollToIndex(i)
              return
            }
            return
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault()
            const from = rowIndex < 0 ? rows.length : rowIndex
            for (let i = from - 1; i >= 0; i--) {
              const row = rows[i]
              if (row?.type !== 'item') continue
              selectItem(row.item)
              rowVirtualizer.scrollToIndex(i)
              return
            }
            return
          }

          if (e.key === 'Enter') {
            e.preventDefault()
            if (!selectedItemKey) return
            const rowIndexForSelection = itemRowIndexByKey.get(selectedItemKey)
            const row = rowIndexForSelection === undefined ? null : rows[rowIndexForSelection]
            if (!row || row.type !== 'item') return
            openItem(row.item)
          }
        }}
      >
        {items.length === 0 && emptyState ? (
          <div className="task-list-empty">{emptyState}</div>
        ) : (
        <ul className="task-list" style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null

            if (row.type === 'header') {
              return (
                <li
                  key={`h:${row.kind}:${row.key}`}
                  className="upcoming-header"
                  ref={(el) => {
                    if (!el) return
                    rowVirtualizer.measureElement(el)
                  }}
                  data-upcoming-header-kind={row.kind}
                  data-upcoming-header-key={row.key}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                  }}
                >
                  {row.kind === 'day' ? (
                    <>
                      <span className="upcoming-day-number">{row.label.day}</span>
                      <span className="upcoming-day-weekday">{row.label.weekday}</span>
                    </>
                  ) : (
                    row.label
                  )}
                </li>
              )
            }

            if (row.type === 'spacer') {
              return (
                <li
                  key={`s:${row.kind}:${row.key}`}
                  className="upcoming-spacer"
                  aria-hidden="true"
                  role="presentation"
                  data-upcoming-header-kind={row.kind}
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
                    transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                  }}
                />
              )
            }

            const item = row.item
            const key = itemKey(item)
            const isTask = item.kind === 'task'
            const isOpen = isTask && openTaskId === item.id
            let liEl: HTMLLIElement | null = null

            return (
              <li
                key={key}
                className={`task-row${isOpen ? ' is-open' : ' task-row-virtual'}${
                  item.status === 'done' ? ' is-done' : item.status === 'cancelled' ? ' is-cancelled' : ''
                }${selectedItemKey === key ? ' is-selected' : ''}`}
                data-task-id={isTask ? item.id : undefined}
                data-project-id={item.kind === 'project' ? item.id : undefined}
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
                  transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                }}
              >
                {item.kind === 'task' ? (
                  <AnimatedTaskSlot
                    isOpen={isOpen}
                    rowContent={
                      <TaskRow
                        task={item}
                        titlePrefix={row.datePrefix}
                        onSelect={(taskId) => selectItem({ kind: 'task', id: taskId })}
                        onOpen={(taskId) => openItem({ ...item, id: taskId })}
                        onToggleDone={(taskId, done) => {
                          void onToggleTaskDone(taskId, done)
                        }}
                        onContextMenu={(event) => handleTaskContextMenu(event, item)}
                      />
                    }
                    editorContent={<TaskInlineEditorRow taskId={item.id} />}
                    onHeightChange={() => {
                      if (liEl) rowVirtualizer.measureElement(liEl)
                    }}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                ) : (
                  <ProjectViewRow
                    project={item}
                    titlePrefix={row.datePrefix}
                    onSelect={(projectId) => selectItem({ kind: 'project', id: projectId })}
                    onOpen={() => openItem(item)}
                    onComplete={(project) => {
                      void onCompleteProject(project)
                    }}
                  />
                )}
              </li>
            )
          })}
        </ul>
        )}
      </div>

      {menuNode}
    </div>
  )
}
