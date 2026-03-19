import { useLayoutEffect, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'

import type { TaskListItem } from '../../../shared/schemas/task-list'

import { Checkbox } from '../../components/Checkbox'
import { useTaskSelection } from './TaskSelectionContext'
import { AnimatedTaskSlot } from './AnimatedTaskSlot'
import { TaskProjectAffiliation } from './TaskProjectAffiliation'
import { TaskInlineEditorRow } from './TaskInlineEditorRow'
import { useContentScrollRef } from '../../app/ContentScrollContext'
import { usePrefersReducedMotion } from './dnd-drop-animation'
import { buildUpcomingRows } from './upcoming-grouping'
import { useOptimisticTaskTitles } from './use-optimistic-task-titles'

export function UpcomingGroupedList({
  tasks,
  onToggleDone,
  today,
}: {
  tasks: TaskListItem[]
  onToggleDone: (taskId: string, done: boolean) => Promise<void>
  today: string
}) {
  const { t, i18n } = useTranslation()
  const { selectedTaskId, selectTask, openTask, openTaskId } = useTaskSelection()
  const contentScrollRef = useContentScrollRef()
  const prefersReducedMotion = usePrefersReducedMotion()
  const tasksWithOptimisticTitles = useOptimisticTaskTitles(tasks)
  const listboxRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  useLayoutEffect(() => {
    let cancelled = false

    const compute = () => {
      if (cancelled) return
      const se = contentScrollRef.current
      const le = listboxRef.current

      // Refs can be temporarily null during initial mount / route switches.
      // Retry next tick to avoid a stuck 0 margin, which breaks scroll alignment.
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

  const { rows, visibleTasks } = useMemo(() => {
    return buildUpcomingRows({ tasks: tasksWithOptimisticTitles, today, locale: i18n.language })
  }, [i18n.language, tasksWithOptimisticTitles, today])

  const lastSelectedIndexRef = useRef(0)
  useEffect(() => {
    if (!selectedTaskId) return

    const idx = visibleTasks.findIndex((t) => t.id === selectedTaskId)
    if (idx >= 0) {
      lastSelectedIndexRef.current = idx
      return
    }

    if (visibleTasks.length === 0) {
      selectTask(null)
      return
    }

    const fallbackIdx = Math.min(lastSelectedIndexRef.current, visibleTasks.length - 1)
    const fallback = visibleTasks[fallbackIdx]
    selectTask(fallback?.id ?? null)
  }, [selectedTaskId, selectTask, visibleTasks])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => contentScrollRef.current,
    estimateSize: (index) => {
      const row = rows[index]
      if (!row) return 44
      if (row.type === 'header') return row.kind === 'day' ? 42 : 48
      if (row.type === 'spacer') return row.kind === 'day' ? 24 : 36
      // Expanded rows are measured, but the estimate should be close to reduce initial jump.
      if (openTaskId && row.type === 'task' && row.task.id === openTaskId) return 400
      return 44
    },
    scrollMargin,
    overscan: 12,
    getItemKey: (index) => {
      const row = rows[index]
      if (!row) return index
      if (row.type === 'header') return `h:${row.kind}:${row.key}`
      if (row.type === 'spacer') return `s:${row.kind}:${row.key}`
      return `t:${row.task.id}`
    },
  })

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{t('nav.upcoming')}</h1>
      </header>

      <div
        ref={listboxRef}
        className="task-scroll"
        tabIndex={0}
        role="listbox"
        aria-label={t('aria.upcomingTasks')}
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
            void openTask(selectedTaskId)
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

            const task = row.task
            const isOpen = openTaskId === task.id
            let liEl: HTMLLIElement | null = null

            return (
              <li
                key={`t:${task.id}`}
                className={`task-row${isOpen ? ' is-open' : ''}${task.status === 'done' ? ' is-done' : ''}${
                  selectedTaskId === task.id ? ' is-selected' : ''
                }`}
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
                  transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                }}
              >
                <AnimatedTaskSlot
                  isOpen={isOpen}
                  rowContent={
                    <>
                      <Checkbox
                        className="task-checkbox"
                        ariaLabel={t('aria.taskDone')}
                        checked={task.status === 'done'}
                        onCheckedChange={(checked) => {
                          void onToggleDone(task.id, checked)
                        }}
                      />

                      <button
                        type="button"
                        className={`task-title task-title-button${row.datePrefix ? ' upcoming-task-title-button' : ''}`}
                        data-task-focus-target="true"
                        data-task-id={task.id}
                        onClick={() => selectTask(task.id)}
                        onDoubleClick={() => void openTask(task.id)}
                      >
                        {row.datePrefix ? (
                          <span className="upcoming-date-prefix" aria-hidden="true">
                            {row.datePrefix}
                          </span>
                        ) : null}
                        <span className="task-title-stack">
                          <span className="upcoming-task-title task-title-text">{task.title}</span>
                          <TaskProjectAffiliation
                            projectId={task.project_id}
                            projectTitle={task.project_title}
                          />
                        </span>
                      </button>
                    </>
                  }
                  editorContent={<TaskInlineEditorRow taskId={task.id} />}
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

      {visibleTasks.length === 0 ? <div className="nav-muted">{t('upcoming.empty')}</div> : null}

      <div className="nav-muted" style={{ marginTop: 10 }}>
        {t('upcoming.showingAfter', { date: today })}
      </div>
    </div>
  )
}
