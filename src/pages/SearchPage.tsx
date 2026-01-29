import { useEffect, useState } from 'react'

import type { AppError } from '../../shared/app-error'
import type { TaskSearchResultItem } from '../../shared/schemas/search'

import { useTaskSelection } from '../features/tasks/TaskSelectionContext'

export function SearchPage() {
  const { selectedTaskId, selectTask, openTask } = useTaskSelection()
  const [query, setQuery] = useState('')
  const [includeLogbook, setIncludeLogbook] = useState(false)
  const [results, setResults] = useState<TaskSearchResultItem[]>([])
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
        <h1 className="page-title">Search</h1>
      </header>

      <div className="task-create">
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title + notes…"
        />
        <label className="tag-pill" style={{ marginLeft: 'auto' }}>
          <input
            type="checkbox"
            checked={includeLogbook}
            onChange={(e) => setIncludeLogbook(e.target.checked)}
          />
          <span>Include Logbook</span>
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
        aria-label="Search results"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return

          const idx = selectedTaskId ? results.findIndex((r) => r.id === selectedTaskId) : -1

          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (results.length === 0) return
            const nextIdx = Math.min(idx + 1, results.length - 1)
            const next = results[nextIdx]
            if (!next) return
            selectTask(next.id)
            return
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (results.length === 0) return
            const nextIdx = Math.max(idx <= 0 ? 0 : idx - 1, 0)
            const next = results[nextIdx]
            if (!next) return
            selectTask(next.id)
            return
          }

          if (e.key === 'Enter') {
            e.preventDefault()
            if (!selectedTaskId) return
            openTask(selectedTaskId)
          }
        }}
      >
        <ul className="task-list">
          {results.map((r) => (
            <li key={r.id} className={`task-row${selectedTaskId === r.id ? ' is-selected' : ''}`}>
              <button
                type="button"
                className="task-title task-title-button"
                data-task-focus-target="true"
                data-task-id={r.id}
                onClick={() => selectTask(r.id)}
                onDoubleClick={() => openTask(r.id)}
              >
                <span className={r.title.trim() ? undefined : 'task-title-placeholder'}>
                  {r.title.trim() ? r.title : '新建任务'}
                </span>
              </button>
              <div className="mono">{r.snippet ?? ''}</div>
            </li>
          ))}
          {results.length === 0 && query.trim() ? <li className="nav-muted">No results</li> : null}
        </ul>
      </div>
    </div>
  )
}
