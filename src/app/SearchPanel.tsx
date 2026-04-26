import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { isClosedTaskStatus } from '../../shared/schemas/common'
import type {
  TaskSearchResultItem,
  ProjectSearchResultItem,
  AreaSearchResultItem,
  TaskSearchScope,
} from '../../shared/schemas/search'

import { getLocalToday, useLocalToday } from '../lib/use-local-today'
import { useTaskSelection } from '../features/tasks/TaskSelectionContext'
import { useOptimisticTaskTitles } from '../features/tasks/use-optimistic-task-titles'

const UI_OPEN_SEARCH_PANEL_EVENT = 'milesto:ui.openSearchPanel'

const SCOPES: TaskSearchScope[] = [
  'anywhere',
  'inbox',
  'today',
  'upcoming',
  'anytime',
  'someday',
  'logbook',
  'trash',
]

type SearchResultItem =
  | { kind: 'task'; data: TaskSearchResultItem }
  | { kind: 'project'; data: ProjectSearchResultItem }
  | { kind: 'area'; data: AreaSearchResultItem }

export function SearchPanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { selectTask } = useTaskSelection()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<TaskSearchScope>('anywhere')
  const [taskResults, setTaskResults] = useState<TaskSearchResultItem[]>([])
  const [projectResults, setProjectResults] = useState<ProjectSearchResultItem[]>([])
  const [areaResults, setAreaResults] = useState<AreaSearchResultItem[]>([])
  const [highlight, setHighlight] = useState(0)

  const today = useLocalToday()

  const resultsWithOptimisticTitles = useOptimisticTaskTitles(taskResults)

  const allResults: SearchResultItem[] = [
    ...resultsWithOptimisticTitles.map((r) => ({ kind: 'task' as const, data: r })),
    ...projectResults.map((r) => ({ kind: 'project' as const, data: r })),
    ...areaResults.map((r) => ({ kind: 'area' as const, data: r })),
  ]

  function close() {
    setIsOpen(false)
    setQuery('')
    setScope('anywhere')
    setTaskResults([])
    setProjectResults([])
    setAreaResults([])
    setHighlight(0)
  }

  function jumpToResult(item: SearchResultItem) {
    if (item.kind === 'task') {
      jumpToTask(item.data)
      return
    }
    if (item.kind === 'project') {
      navigate(`/projects/${item.data.id}`)
      close()
      return
    }
    navigate(`/areas/${item.data.id}`)
    close()
  }

  function jumpToTask(item: TaskSearchResultItem) {
    const todayNow = getLocalToday()
    const to = (() => {
      if (isClosedTaskStatus(item.status)) return '/logbook'
      if (item.scheduled_at === todayNow) return '/today'
      if (item.scheduled_at && item.scheduled_at > todayNow) return '/upcoming'
      if (item.project_id) return `/projects/${item.project_id}`
      if (item.is_inbox) return '/inbox'
      if (item.is_someday) return '/someday'
      return '/anytime'
    })()

    navigate(to)
    close()

    // Some list pages fetch tasks asynchronously and may briefly render an empty list,
    // which clears selection. Retry selection until the target task row is mounted.
    const start = Date.now()
    const maxMs = 2_000
    const taskId = item.id
    const tick = () => {
      if (Date.now() - start > maxMs) {
        window.clearInterval(handle)
        return
      }

      // Wait for navigation + list mount before selecting, otherwise the previous
      // list may "correct" the selection to a neighbor during unmount.
      if (!window.location.hash.includes(to)) return

      if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        const el = document.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`)
        if (!el) return
        selectTask(taskId)
        const row = el.closest<HTMLElement>('.task-row')
        if (row?.classList.contains('is-selected')) {
          window.clearInterval(handle)
        }
        return
      }

      // Fallback: no CSS.escape. Still attempt selection once navigation is active.
      selectTask(taskId)
      window.clearInterval(handle)
    }
    const handle = window.setInterval(tick, 80)
    tick()
  }

  function handleContinueSearch() {
    const q = query.trim()
    if (!q) return
    navigate(`/search?q=${encodeURIComponent(q)}&scope=${scope}`)
    close()
  }

  useEffect(() => {
    function onOpen() {
      setIsOpen(true)
      // If we're already open, the isOpen-driven focus effect won't re-run.
      window.setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }

    window.addEventListener(UI_OPEN_SEARCH_PANEL_EVENT, onOpen)
    return () => window.removeEventListener(UI_OPEN_SEARCH_PANEL_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const id = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const q = query.trim()
    if (!q) {
      setTaskResults([])
      setProjectResults([])
      setAreaResults([])
      setHighlight(0)
      return
    }

    const handle = window.setTimeout(() => {
      void (async () => {
        const options: { includeLogbook?: boolean; scope?: TaskSearchScope; date?: string } =
          { includeLogbook: false }
        if (scope !== 'anywhere') {
          options.scope = scope
          if (scope === 'today' || scope === 'upcoming') {
            options.date = today
          }
        }

        const [taskRes, projectRes, areaRes] = await Promise.all([
          window.api.task.search(q, options),
          window.api.project.search(q),
          window.api.area.search(q),
        ])

        if (!taskRes.ok) {
          setTaskResults([])
        } else {
          setTaskResults(taskRes.data)
        }

        if (!projectRes.ok) {
          setProjectResults([])
        } else {
          setProjectResults(projectRes.data)
        }

        if (!areaRes.ok) {
          setAreaResults([])
        } else {
          setAreaResults(areaRes.data)
        }

        setHighlight(0)
      })()
    }, 120)

    return () => window.clearTimeout(handle)
  }, [isOpen, query, scope, today])

  function getResultLabel(item: SearchResultItem): string {
    if (item.kind === 'task') {
      return item.data.title.trim() ? item.data.title : t('task.untitled')
    }
    if (item.kind === 'project') {
      return item.data.title.trim() ? item.data.title : t('project.untitled')
    }
    return item.data.title.trim() ? item.data.title : t('area.untitled')
  }

  function getResultHint(item: SearchResultItem): string {
    if (item.kind === 'task') {
      const data = item.data
      if (data.snippet) return data.snippet
      if (data.is_someday) return t('nav.someday')
      if (data.scheduled_at) return data.scheduled_at === today ? t('nav.today') : data.scheduled_at
      if (data.is_inbox) return t('nav.inbox')
      if (data.project_id) return t('shell.project')
      return t('nav.anytime')
    }
    if (item.kind === 'project') {
      return t('shell.project')
    }
    return t('shell.area')
  }

  function getResultPlaceholder(item: SearchResultItem): boolean {
    return !getResultLabel(item).trim()
  }

  if (!isOpen) return null

  const hasQuery = query.trim().length > 0

  return createPortal(
    <div
      className="palette-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('search.title')}
      onPointerDown={(e) => {
        // Outside click: only close when the scrim itself is clicked.
        if (e.target !== e.currentTarget) return
        e.preventDefault()
        close()
      }}
    >
      <div className="palette search-panel">
        <input
          ref={inputRef}
          className="input palette-input"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              close()
              return
            }

            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (allResults.length === 0) return
              setHighlight((v) => Math.min(v + 1, allResults.length - 1 + (hasQuery ? 1 : 0)))
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlight((v) => Math.max(v - 1, 0))
              return
            }

            if (e.key === 'Enter') {
              e.preventDefault()

              if (highlight < allResults.length) {
                const item = allResults[highlight]
                if (item) {
                  jumpToResult(item)
                }
              } else if (hasQuery) {
                handleContinueSearch()
              }
            }
          }}
        />

        <div className="search-scope-bar" role="radiogroup" aria-label={t('search.scope')}>
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scope === s}
              className={`search-scope-pill${scope === s ? ' is-active' : ''}`}
              onClick={() => {
                setScope(s)
                inputRef.current?.focus()
              }}
            >
              {t(`search.scope.${s}`)}
            </button>
          ))}
        </div>

        <div className="palette-list">
          {allResults.map((item, idx) => (
            <button
              key={`${item.kind}-${item.data.id}`}
              type="button"
              className={`palette-item${idx === highlight ? ' is-active' : ''}`}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => jumpToResult(item)}
            >
              <div
                className={
                  getResultPlaceholder(item)
                    ? 'palette-item-title palette-item-placeholder'
                    : 'palette-item-title'
                }
              >
                {getResultLabel(item)}
              </div>
              <div className="palette-item-hint">{getResultHint(item)}</div>
            </button>
          ))}

          {hasQuery && (
            <button
              type="button"
              className={`palette-item palette-item-continue${highlight === allResults.length ? ' is-active' : ''}`}
              onMouseEnter={() => setHighlight(allResults.length)}
              onClick={handleContinueSearch}
            >
              <div className="palette-item-title">{t('search.continue')}</div>
              <div className="palette-item-hint">{t('search.continueHint')}</div>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
