import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'

import type { Project } from '../../../shared/schemas/project'
import type { TaskListItem } from '../../../shared/schemas/task-list'

import { useContentScrollRef } from '../../app/ContentScrollContext'
import { ProjectProgressControl } from '../projects/ProjectProgressControl'
import { TaskInlineEditorRow } from '../tasks/TaskInlineEditorRow'
import { useTaskSelection } from '../tasks/TaskSelectionContext'
import { buildLogbookRows } from './logbook-rows'

export function LogbookGroupedList({
  tasks,
  projects,
  onRestoreTask,
  onReopenProject,
  now,
}: {
  tasks: TaskListItem[]
  projects: Project[]
  onRestoreTask: (taskId: string) => Promise<void>
  onReopenProject: (projectId: string) => Promise<void>
  now?: Date
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { selectedTaskId, selectTask, openTask, openTaskId } = useTaskSelection()
  const contentScrollRef = useContentScrollRef()
  const listboxRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)

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

  const { rows, visibleTasks } = useMemo(() => {
    return buildLogbookRows({ tasks, projects, locale: i18n.language, now: now ?? new Date() })
  }, [i18n.language, now, projects, tasks])

  const taskRowIndexById = useMemo(() => {
    const out = new Map<string, number>()
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (r?.type === 'task') out.set(r.entry.id, i)
    }
    return out
  }, [rows])

  const lastSelectedIndexRef = useRef(0)
  useEffect(() => {
    if (!selectedTaskId) return

    const idx = visibleTasks.findIndex((task) => task.id === selectedTaskId)
    if (idx >= 0) {
      lastSelectedIndexRef.current = idx
      const rowIdx = taskRowIndexById.get(selectedTaskId) ?? null
      setSelectedRowIndex((prev) => (prev === rowIdx ? prev : rowIdx))
      return
    }

    if (visibleTasks.length === 0) {
      selectTask(null)
      return
    }

    const fallbackIdx = Math.min(lastSelectedIndexRef.current, visibleTasks.length - 1)
    const fallback = visibleTasks[fallbackIdx]
    selectTask(fallback?.id ?? null)
  }, [selectedTaskId, selectTask, taskRowIndexById, visibleTasks])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => contentScrollRef.current,
    estimateSize: (index) => {
      const row = rows[index]
      if (!row) return 44
      if (row.type === 'month') return 48
      if (openTaskId && row.type === 'task' && row.entry.id === openTaskId) return 400
      return 44
    },
    scrollMargin,
    overscan: 12,
    getItemKey: (index) => {
      const row = rows[index]
      if (!row) return index
      if (row.type === 'month') return `m:${row.monthKey}`
      if (row.type === 'task') return `t:${row.entry.id}`
      return `p:${row.entry.id}`
    },
  })

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{t('nav.logbook')}</h1>
      </header>

      <div
        ref={listboxRef}
        className="task-scroll"
        tabIndex={0}
        role="listbox"
        aria-label={t('aria.tasks')}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return

          const rowIndex =
            selectedRowIndex ?? (selectedTaskId ? taskRowIndexById.get(selectedTaskId) ?? -1 : -1)

          if (e.key === 'ArrowDown') {
            e.preventDefault()
            for (let i = rowIndex + 1; i < rows.length; i++) {
              const r = rows[i]
              if (r?.type !== 'task') continue
              setSelectedProjectId(null)
              selectTask(r.entry.id)
              setSelectedRowIndex(i)
              rowVirtualizer.scrollToIndex(i)
              return
            }
            return
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault()
            const from = rowIndex < 0 ? rows.length : rowIndex
            for (let i = from - 1; i >= 0; i--) {
              const r = rows[i]
              if (r?.type !== 'task') continue
              setSelectedProjectId(null)
              selectTask(r.entry.id)
              setSelectedRowIndex(i)
              rowVirtualizer.scrollToIndex(i)
              return
            }
            return
          }

          if (e.key === 'Enter') {
            e.preventDefault()
            if (selectedTaskId) {
              setSelectedProjectId(null)
              void openTask(selectedTaskId)
              return
            }

            if (selectedProjectId) {
              navigate(`/projects/${selectedProjectId}`)
            }
          }
        }}
      >
        <ul className="task-list" style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null

            if (row.type === 'month') {
              return (
                <li
                  key={`m:${row.monthKey}`}
                  className="upcoming-header"
                  data-upcoming-header-kind="month"
                  aria-hidden="true"
                  role="presentation"
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
                  {row.label}
                </li>
              )
            }

            if (row.type === 'project') {
              const p = row.entry.project
              const hasTitle = p.title.trim().length > 0
              const displayTitle = hasTitle ? p.title : t('project.untitled')

              return (
                <li
                  key={`p:${p.id}`}
                  className={`task-row${selectedProjectId === p.id ? ' is-selected' : ''}`}
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
                  <ProjectProgressControl
                    status={p.status}
                    doneCount={0}
                    totalCount={0}
                    size="list"
                    onActivate={() => {
                      void onReopenProject(p.id)
                    }}
                  />

                  <button
                    type="button"
                    className="task-title task-title-button upcoming-task-title-button"
                    data-logbook-project-id={p.id}
                    onClick={() => {
                      setSelectedProjectId(p.id)
                      selectTask(null)
                      setSelectedRowIndex(virtualRow.index)
                    }}
                    onDoubleClick={() => {
                      setSelectedProjectId(p.id)
                      selectTask(null)
                      setSelectedRowIndex(virtualRow.index)
                      navigate(`/projects/${p.id}`)
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      e.stopPropagation()
                      setSelectedProjectId(p.id)
                      selectTask(null)
                      setSelectedRowIndex(virtualRow.index)
                      navigate(`/projects/${p.id}`)
                    }}
                  >
                    <span className="upcoming-date-prefix" aria-hidden="true">
                      {row.entry.datePrefix}
                    </span>
                    <span className={hasTitle ? undefined : 'task-title-placeholder'}>{displayTitle}</span>
                  </button>
                </li>
              )
            }

            const task = row.entry.task
            const hasTitle = task.title.trim().length > 0
            const displayTitle = hasTitle ? task.title : t('task.untitled')

            if (openTaskId && task.id === openTaskId) {
              return (
                <li
                  key={`t:${task.id}`}
                  className={`task-row is-open${selectedTaskId === task.id ? ' is-selected' : ''}`}
                  data-task-id={task.id}
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
                  <TaskInlineEditorRow taskId={task.id} />
                </li>
              )
            }

            return (
              <li
                key={`t:${task.id}`}
                className={`task-row${selectedTaskId === task.id ? ' is-selected' : ''}`}
                data-task-id={task.id}
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
                    checked={task.status === 'done'}
                    onChange={(e) => {
                      if (e.target.checked) return
                      void onRestoreTask(task.id)
                    }}
                  />
                </label>

                <button
                  type="button"
                  className="task-title task-title-button upcoming-task-title-button"
                  data-task-focus-target="true"
                  data-task-id={task.id}
                  onClick={() => {
                    setSelectedProjectId(null)
                    selectTask(task.id)
                    setSelectedRowIndex(virtualRow.index)
                  }}
                  onDoubleClick={() => {
                    setSelectedProjectId(null)
                    void openTask(task.id)
                    setSelectedRowIndex(virtualRow.index)
                  }}
                >
                  <span className="upcoming-date-prefix" aria-hidden="true">
                    {row.entry.datePrefix}
                  </span>
                  <span className={hasTitle ? undefined : 'task-title-placeholder'}>{displayTitle}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {rows.length === 0 ? <div className="nav-muted">{t('shell.empty')}</div> : null}
    </div>
  )
}
