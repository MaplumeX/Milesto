import { useLayoutEffect, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

import type { TaskListItem } from '../../../shared/schemas/task-list'

import { useTaskSelection } from './TaskSelectionContext'
import { TaskInlineEditorRow } from './TaskInlineEditorRow'
import { useContentScrollRef } from '../../app/ContentScrollContext'

export function TaskList({
  title,
  tasks,
  onToggleDone,
  onRestore,
  headerActions,
}: {
  title: string
  tasks: TaskListItem[]
  onToggleDone?: (taskId: string, done: boolean) => Promise<void>
  onRestore?: (taskId: string) => Promise<void>
  headerActions?: React.ReactNode
}) {
  const { selectedTaskId, selectTask, openTask, openTaskId } = useTaskSelection()

  const contentScrollRef = useContentScrollRef()

  const taskIndexById = useMemo(() => {
    const map = new Map<string, number>()
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]
      if (!t) continue
      map.set(t.id, i)
    }
    return map
  }, [tasks])

  const listboxRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  useLayoutEffect(() => {
    const scrollEl = contentScrollRef.current
    const listboxEl = listboxRef.current
    if (!scrollEl || !listboxEl) return

    const compute = () => {
      const se = contentScrollRef.current
      const le = listboxRef.current
      if (!se || !le) return

      const scrollRect = se.getBoundingClientRect()
      const listRect = le.getBoundingClientRect()
      // listRect.top changes with scroll; adding scrollTop yields a stable margin.
      setScrollMargin(listRect.top - scrollRect.top + se.scrollTop)
    }

    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [contentScrollRef])
  const rowVirtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => contentScrollRef.current,
    estimateSize: (index) => {
      const t = tasks[index]
      if (!t) return 44
      return openTaskId && t.id === openTaskId ? 360 : 44
    },
    scrollMargin,
    overscan: 12,
    getItemKey: (index) => {
      const t = tasks[index]
      if (!t) return index
      return `t:${t.id}`
    },
  })

  const openTasks = useMemo(() => tasks.filter((t) => t.status === 'open'), [tasks])

  const lastSelectedIndexRef = useRef(0)
  useEffect(() => {
    if (!selectedTaskId) return

    const idx = tasks.findIndex((t) => t.id === selectedTaskId)
    if (idx >= 0) {
      lastSelectedIndexRef.current = idx
      return
    }

    // If the selected task disappeared after a refresh (e.g. moved lists), pick a neighbor.
    if (tasks.length === 0) {
      selectTask(null)
      return
    }

    const fallbackIdx = Math.min(lastSelectedIndexRef.current, tasks.length - 1)
    const fallback = tasks[fallbackIdx]
    selectTask(fallback?.id ?? null)
  }, [tasks, selectedTaskId, selectTask])

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{title}</h1>
        <div className="row" style={{ marginTop: 0 }}>
          {headerActions}
          <div className="page-meta">{openTasks.length} open</div>
        </div>
      </header>

      <div
        ref={listboxRef}
        className="task-scroll"
        tabIndex={0}
        role="listbox"
        aria-label="Tasks"
        onKeyDown={(e) => {
          // Keyboard-first list navigation (ArrowUp/Down, Enter to open, Space to toggle).
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== ' ') return

          const idx = selectedTaskId ? taskIndexById.get(selectedTaskId) ?? -1 : -1

          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (tasks.length === 0) return
            const nextIdx = Math.min((idx < 0 ? -1 : idx) + 1, tasks.length - 1)
            const next = tasks[nextIdx]
            if (!next) return
            selectTask(next.id)
            rowVirtualizer.scrollToIndex(nextIdx)
            return
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (tasks.length === 0) return
            const nextIdx = Math.max(idx <= 0 ? 0 : idx - 1, 0)
            const next = tasks[nextIdx]
            if (!next) return
            selectTask(next.id)
            rowVirtualizer.scrollToIndex(nextIdx)
            return
          }

          if (e.key === ' ') {
            e.preventDefault()
            if (!selectedTaskId || !onToggleDone) return
            const current = tasks.find((t) => t.id === selectedTaskId)
            if (!current) return
            void onToggleDone(current.id, current.status !== 'done')
            return
          }

          if (e.key === 'Enter') {
            e.preventDefault()
            if (!selectedTaskId) return
            void openTask(selectedTaskId)
          }
        }}
      >
        <ul className="task-list" style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const t = tasks[virtualRow.index]
            if (!t) return null

            if (openTaskId && t.id === openTaskId) {
              return (
                <li
                  key={t.id}
                  className={`task-row is-open${t.status === 'done' ? ' is-done' : ''}${
                    selectedTaskId === t.id ? ' is-selected' : ''
                  }`}
                  data-task-id={t.id}
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
                 >
                  <TaskInlineEditorRow taskId={t.id} />
                </li>
              )
            }

            return (
              <li
                key={t.id}
                className={`task-row${t.status === 'done' ? ' is-done' : ''}${
                  selectedTaskId === t.id ? ' is-selected' : ''
                }`}
                data-task-id={t.id}
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
               >
                <label className="task-checkbox">
                  <input
                    type="checkbox"
                    checked={t.status === 'done'}
                    onChange={(e) => {
                      if (onToggleDone) void onToggleDone(t.id, e.target.checked)
                    }}
                    disabled={!onToggleDone}
                  />
                </label>

                <button
                  type="button"
                  className="task-title task-title-button"
                  data-task-focus-target="true"
                  data-task-id={t.id}
                  onClick={() => selectTask(t.id)}
                  onDoubleClick={() => void openTask(t.id)}
                >
                  <span className={t.title.trim() ? undefined : 'task-title-placeholder'}>
                    {t.title.trim() ? t.title : '新建任务'}
                  </span>
                </button>

                {t.status === 'done' && onRestore ? (
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => void onRestore(t.id)}
                  >
                    Restore
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
