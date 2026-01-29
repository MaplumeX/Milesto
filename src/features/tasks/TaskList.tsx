import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

import type { TaskListItem } from '../../../shared/schemas/task-list'
import type { AppError } from '../../../shared/app-error'

import { useTaskSelection } from './TaskSelectionContext'

export function TaskList({
  title,
  tasks,
  onCreate,
  onToggleDone,
  onRestore,
  showCreate,
  headerActions,
}: {
  title: string
  tasks: TaskListItem[]
  onCreate?: (title: string) => Promise<void>
  onToggleDone?: (taskId: string, done: boolean) => Promise<void>
  onRestore?: (taskId: string) => Promise<void>
  showCreate?: boolean
  headerActions?: React.ReactNode
}) {
  const { selectedTaskId, selectTask } = useTaskSelection()
  const [draftTitle, setDraftTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState<AppError | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const rowVirtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 12,
  })

  const openTasks = useMemo(() => tasks.filter((t) => t.status === 'open'), [tasks])

  async function handleSubmit() {
    if (!onCreate) return
    const title = draftTitle.trim()
    if (!title) return

    setIsSubmitting(true)
    setActionError(null)
    try {
      await onCreate(title)
      setDraftTitle('')
    } catch (e) {
      setActionError({ code: 'UI_ACTION_FAILED', message: String(e) })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{title}</h1>
        <div className="row" style={{ marginTop: 0 }}>
          {headerActions}
          <div className="page-meta">{openTasks.length} open</div>
        </div>
      </header>

      {showCreate !== false && onCreate ? (
        <div className="task-create">
          <input
            className="input"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSubmit()
            }}
            placeholder="Add a task…"
            disabled={isSubmitting}
          />
          <button type="button" className="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            Add
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div className="error">
          <div className="error-code">{actionError.code}</div>
          <div>{actionError.message}</div>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="task-scroll"
        tabIndex={0}
        role="listbox"
        aria-label="Tasks"
        onKeyDown={(e) => {
          // Keyboard-first list navigation (ArrowUp/Down, Enter to open, Space to toggle).
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== ' ') return

          const idx = selectedTaskId ? tasks.findIndex((t) => t.id === selectedTaskId) : -1

          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (tasks.length === 0) return
            const nextIdx = Math.min(idx + 1, tasks.length - 1)
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
            // Selection already opens detail panel.
            return
          }
        }}
      >
        <ul className="task-list" style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const t = tasks[virtualRow.index]
            if (!t) return null

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
                      if (onToggleDone) void onToggleDone(t.id, e.target.checked)
                    }}
                    disabled={!onToggleDone}
                  />
                </label>

                <button
                  type="button"
                  className="task-title task-title-button"
                  onClick={() => selectTask(t.id)}
                >
                  {t.title}
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
