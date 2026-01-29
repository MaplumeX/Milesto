import { useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

import type { TaskListItem } from '../../../shared/schemas/task-list'

import { useTaskSelection } from './TaskSelectionContext'

type Row =
  | { type: 'header'; date: string; label: string }
  | { type: 'task'; task: TaskListItem }

export function UpcomingGroupedList({
  tasks,
  onToggleDone,
  today,
  nextWeekStart,
  nextMonthStart,
}: {
  tasks: TaskListItem[]
  onToggleDone: (taskId: string, done: boolean) => Promise<void>
  today: string
  nextWeekStart: string
  nextMonthStart: string
}) {
  const { selectedTaskId, selectTask, openTask } = useTaskSelection()
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const lastSelectedIndexRef = useRef(0)
  useEffect(() => {
    if (!selectedTaskId) return

    const idx = tasks.findIndex((t) => t.id === selectedTaskId)
    if (idx >= 0) {
      lastSelectedIndexRef.current = idx
      return
    }

    if (tasks.length === 0) {
      selectTask(null)
      return
    }

    const fallbackIdx = Math.min(lastSelectedIndexRef.current, tasks.length - 1)
    const fallback = tasks[fallbackIdx]
    selectTask(fallback?.id ?? null)
  }, [tasks, selectedTaskId, selectTask])

  const { rows, headerIndexByDate } = useMemo(() => {
    const rows: Row[] = []
    const headerIndexByDate = new Map<string, number>()

    const byDate = new Map<string, TaskListItem[]>()
    for (const t of tasks) {
      if (!t.scheduled_at) continue
      const list = byDate.get(t.scheduled_at) ?? []
      list.push(t)
      byDate.set(t.scheduled_at, list)
    }

    const dates = Array.from(byDate.keys()).sort()
    for (const date of dates) {
      const label = date
      headerIndexByDate.set(date, rows.length)
      rows.push({ type: 'header', date, label })

      const list = byDate.get(date) ?? []
      for (const task of list) rows.push({ type: 'task', task })
    }

    return { rows, headerIndexByDate }
  }, [tasks])

  const { nextWeekIndex, nextMonthIndex } = useMemo(() => {
    const dates = Array.from(headerIndexByDate.keys()).sort()
    const nextWeekDate = dates.find((d) => d >= nextWeekStart) ?? null
    const nextMonthDate = dates.find((d) => d >= nextMonthStart) ?? null

    return {
      nextWeekIndex: nextWeekDate ? headerIndexByDate.get(nextWeekDate) ?? null : null,
      nextMonthIndex: nextMonthDate ? headerIndexByDate.get(nextMonthDate) ?? null : null,
    }
  }, [headerIndexByDate, nextWeekStart, nextMonthStart])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (rows[index]?.type === 'header' ? 34 : 44),
    overscan: 12,
    getItemKey: (index) => {
      const row = rows[index]
      if (!row) return index
      return row.type === 'header' ? `h:${row.date}` : `t:${row.task.id}`
    },
  })

  function scrollTo(index: number) {
    rowVirtualizer.scrollToIndex(index, { align: 'start' })
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Upcoming</h1>
        <div className="row" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => scrollTo(0)}
          >
            Today
          </button>
          <button
            type="button"
            className="button button-ghost"
            disabled={nextWeekIndex === null}
            onClick={() => {
              if (nextWeekIndex === null) return
              scrollTo(nextWeekIndex)
            }}
          >
            Next Week
          </button>
          <button
            type="button"
            className="button button-ghost"
            disabled={nextMonthIndex === null}
            onClick={() => {
              if (nextMonthIndex === null) return
              scrollTo(nextMonthIndex)
            }}
          >
            Next Month
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="task-scroll"
        tabIndex={0}
        role="listbox"
        aria-label="Upcoming tasks"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return

          const rowIndex = selectedTaskId
            ? rows.findIndex((r) => r.type === 'task' && r.task.id === selectedTaskId)
            : -1

          if (e.key === 'ArrowDown') {
            e.preventDefault()
            for (let i = rowIndex + 1; i < rows.length; i++) {
              const r = rows[i]
              if (r?.type !== 'task') continue
              selectTask(r.task.id)
              rowVirtualizer.scrollToIndex(i)
              return
            }
            return
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault()
            for (let i = rowIndex <= 0 ? rows.length : rowIndex; i >= 0; i--) {
              const r = rows[i]
              if (r?.type !== 'task') continue
              selectTask(r.task.id)
              rowVirtualizer.scrollToIndex(i)
              return
            }
            return
          }

          if (e.key === 'Enter') {
            e.preventDefault()
            if (!selectedTaskId) return
            openTask(selectedTaskId)
          }
        }}
      >
        <ul className="task-list" style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null

            if (row.type === 'header') {
              return (
                <li
                  key={`h:${row.date}`}
                  className="upcoming-header"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.label}
                </li>
              )
            }

            const t = row.task
            return (
              <li
                key={t.id}
                className={`task-row${t.status === 'done' ? ' is-done' : ''}${
                  selectedTaskId === t.id ? ' is-selected' : ''
                }`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <label className="task-checkbox">
                  <input
                    type="checkbox"
                    checked={t.status === 'done'}
                    onChange={(e) => {
                      void onToggleDone(t.id, e.target.checked)
                    }}
                  />
                </label>

                <button
                  type="button"
                  className="task-title task-title-button"
                  data-task-focus-target="true"
                  data-task-id={t.id}
                  onClick={() => selectTask(t.id)}
                  onDoubleClick={() => openTask(t.id)}
                >
                  {t.title}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {rows.length === 0 ? <div className="nav-muted">No upcoming tasks</div> : null}

      <div className="nav-muted" style={{ marginTop: 10 }}>
        Showing tasks scheduled after {today}
      </div>
    </div>
  )
}
