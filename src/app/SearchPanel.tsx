import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { TaskSearchResultItem } from '../../shared/schemas/search'

import { getLocalToday, useLocalToday } from '../lib/use-local-today'
import { useTaskSelection } from '../features/tasks/TaskSelectionContext'

const UI_OPEN_SEARCH_PANEL_EVENT = 'milesto:ui.openSearchPanel'

export function SearchPanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { selectTask } = useTaskSelection()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TaskSearchResultItem[]>([])
  const [highlight, setHighlight] = useState(0)

  const today = useLocalToday()

  function getTaskHint(item: TaskSearchResultItem): string {
    if (item.is_someday) return t('nav.someday')
    if (item.scheduled_at) return item.scheduled_at === today ? t('nav.today') : item.scheduled_at
    if (item.is_inbox) return t('nav.inbox')
    if (item.project_id) return t('shell.project')
    return t('nav.anytime')
  }

  function close() {
    setIsOpen(false)
    setQuery('')
    setResults([])
    setHighlight(0)
  }

  function jumpToTask(item: TaskSearchResultItem) {
    const todayNow = getLocalToday()
    const to = (() => {
      if (item.status === 'done') return '/logbook'
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

  useEffect(() => {
    function onOpen(_e: Event) {
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
      setResults([])
      setHighlight(0)
      return
    }

    const handle = window.setTimeout(() => {
      void (async () => {
        const res = await window.api.task.search(q, { includeLogbook: false })
        if (!res.ok) {
          setResults([])
          setHighlight(0)
          return
        }
        setResults(res.data)
        setHighlight(0)
      })()
    }, 120)

    return () => window.clearTimeout(handle)
  }, [isOpen, query])

  if (!isOpen) return null

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
              if (results.length === 0) return
              setHighlight((v) => Math.min(v + 1, results.length - 1))
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              if (results.length === 0) return
              setHighlight((v) => Math.max(v - 1, 0))
              return
            }

            if (e.key === 'Enter') {
              e.preventDefault()

              const item = results[highlight]
              if (item) {
                jumpToTask(item)
              }
            }
          }}
        />

        <div className="palette-list">
          {results.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={`palette-item${idx === highlight ? ' is-active' : ''}`}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => jumpToTask(item)}
            >
              <div className={item.title.trim() ? 'palette-item-title' : 'palette-item-title palette-item-placeholder'}>
                {item.title.trim() ? item.title : t('task.untitled')}
              </div>
              <div className="palette-item-hint">{item.snippet ?? getTaskHint(item)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
