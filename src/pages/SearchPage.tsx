import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import type { TaskSearchResultItem } from '../../shared/schemas/search'

import { useTaskSelection } from '../features/tasks/TaskSelectionContext'
import { AnimatedTaskSlot } from '../features/tasks/AnimatedTaskSlot'
import { TaskInlineEditorRow } from '../features/tasks/TaskInlineEditorRow'
import { usePrefersReducedMotion } from '../features/tasks/dnd-drop-animation'
import { useOptimisticTaskTitles } from '../features/tasks/use-optimistic-task-titles'

export function SearchPage() {
  const { t } = useTranslation()
  const { selectedTaskId, selectTask, openTask, openTaskId } = useTaskSelection()
  const prefersReducedMotion = usePrefersReducedMotion()
  const [query, setQuery] = useState('')
  const [includeLogbook, setIncludeLogbook] = useState(false)
  const [results, setResults] = useState<TaskSearchResultItem[]>([])
  const resultsWithOptimisticTitles = useOptimisticTaskTitles(results)
  const [error, setError] = useState<AppError | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setError(null)
      return
    }

    const handle = setTimeout(() => {
      void (async () => {
        const res = await window.api.task.search(q, { includeLogbook })
        if (!res.ok) {
          setError(res.error)
          setResults([])
          return
        }
        setError(null)
        setResults(res.data)
      })()
    }, 150)

    return () => clearTimeout(handle)
  }, [query, includeLogbook])

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{t('search.title')}</h1>
      </header>

      <div className="task-create">
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
        />
        <label className="tag-pill" style={{ marginLeft: 'auto' }}>
          <input
            type="checkbox"
            checked={includeLogbook}
            onChange={(e) => setIncludeLogbook(e.target.checked)}
          />
          <span>{t('search.includeLogbook')}</span>
        </label>
      </div>

      {error ? (
        <div className="error">
          <div className="error-code">{error.code}</div>
          <div>{error.message}</div>
        </div>
      ) : null}

      <div
        tabIndex={0}
        role="listbox"
        aria-label={t('search.resultsAriaLabel')}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return

          const idx = selectedTaskId ? resultsWithOptimisticTitles.findIndex((r) => r.id === selectedTaskId) : -1

          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (resultsWithOptimisticTitles.length === 0) return
            const nextIdx = Math.min(idx + 1, resultsWithOptimisticTitles.length - 1)
            const next = resultsWithOptimisticTitles[nextIdx]
            if (!next) return
            selectTask(next.id)
            return
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (resultsWithOptimisticTitles.length === 0) return
            const nextIdx = Math.max(idx <= 0 ? 0 : idx - 1, 0)
            const next = resultsWithOptimisticTitles[nextIdx]
            if (!next) return
            selectTask(next.id)
            return
          }

          if (e.key === 'Enter') {
            e.preventDefault()
            if (!selectedTaskId) return
            void openTask(selectedTaskId)
          }
        }}
      >
        <ul className="task-list">
          {resultsWithOptimisticTitles.map((r) => {
            const isOpen = openTaskId === r.id

            return (
              <li
                key={r.id}
                className={`task-row${isOpen ? ' is-open' : ''}${selectedTaskId === r.id ? ' is-selected' : ''}`}
                data-task-id={r.id}
              >
                <AnimatedTaskSlot
                  isOpen={isOpen}
                  rowContent={
                    <>
                      <button
                        type="button"
                        className="task-title task-title-button"
                        data-task-focus-target="true"
                        data-task-id={r.id}
                        onClick={() => selectTask(r.id)}
                        onDoubleClick={() => void openTask(r.id)}
                      >
                        <span className={r.title.trim() ? undefined : 'task-title-placeholder'}>
                          {r.title.trim() ? r.title : t('task.untitled')}
                        </span>
                      </button>
                      <div className="mono">{r.snippet ?? ''}</div>
                    </>
                  }
                  editorContent={<TaskInlineEditorRow taskId={r.id} />}
                  onHeightChange={() => {}}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </li>
            )
          })}
          {resultsWithOptimisticTitles.length === 0 && query.trim() ? (
            <li className="nav-muted">{t('search.noResults')}</li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}
