import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { TaskSearchResultItem } from '../../shared/schemas/search'

import { formatLocalDate } from '../lib/dates'
import { useTaskSelection } from '../features/tasks/TaskSelectionContext'

type Mode = 'commands' | 'search'

const UI_OPEN_COMMAND_PALETTE_EVENT = 'milesto:ui.openCommandPalette'

export function CommandPalette() {
  const navigate = useNavigate()
  const { selectTask } = useTaskSelection()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TaskSearchResultItem[]>([])
  const [highlight, setHighlight] = useState(0)

  const today = useMemo(() => formatLocalDate(new Date()), [])
  const mode: Mode = query.trim() ? 'search' : 'commands'

  function getTaskHint(item: TaskSearchResultItem): string {
    if (item.is_someday) return 'Someday'
    if (item.scheduled_at) return item.scheduled_at === today ? 'Today' : item.scheduled_at
    if (item.is_inbox) return 'Inbox'
    if (item.project_id) return 'Project'
    return 'Anytime'
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && key === 'k') {
        e.preventDefault()
        setIsOpen((v) => !v)
      }

      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    function onOpen(_e: Event) {
      setIsOpen(true)
      // If we're already open, the isOpen-driven focus effect won't re-run.
      window.setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }

    window.addEventListener(UI_OPEN_COMMAND_PALETTE_EVENT, onOpen)
    return () => window.removeEventListener(UI_OPEN_COMMAND_PALETTE_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const id = setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
    return () => clearTimeout(id)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (!query.trim()) {
      setResults([])
      setHighlight(0)
      return
    }

    const handle = setTimeout(() => {
      void (async () => {
        const res = await window.api.task.search(query.trim(), { includeLogbook: false })
        if (!res.ok) {
          setResults([])
          return
        }
        setResults(res.data)
        setHighlight(0)
      })()
    }, 120)

    return () => clearTimeout(handle)
  }, [isOpen, query])

  function close() {
    setIsOpen(false)
    setQuery('')
    setResults([])
    setHighlight(0)
  }

  function jumpToTask(item: TaskSearchResultItem) {
    if (item.status === 'done') {
      navigate('/logbook')
    } else if (item.scheduled_at === today) {
      navigate('/today')
    } else if (item.scheduled_at && item.scheduled_at > today) {
      navigate('/upcoming')
    } else if (item.project_id) {
      navigate(`/projects/${item.project_id}`)
    } else if (item.is_inbox) {
      navigate('/inbox')
    } else if (item.is_someday) {
      navigate('/someday')
    } else {
      navigate('/anytime')
    }

    selectTask(item.id)
    close()
  }

  async function createTaskFromQuery() {
    const title = query.trim()
    if (!title) return
    const res = await window.api.task.create({ title, is_inbox: true })
    if (!res.ok) return

    navigate('/inbox')
    selectTask(res.data.id)
    close()
  }

  if (!isOpen) return null

  return (
    <div className="palette-overlay" role="dialog" aria-modal="true">
      <div className="palette">
        <input
          ref={inputRef}
          className="input palette-input"
          placeholder="Type to search, or type a new task…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              close()
              return
            }

            if (e.key === 'ArrowDown') {
              e.preventDefault()
              const max = mode === 'commands' ? COMMANDS.length - 1 : results.length
              setHighlight((v) => Math.min(v + 1, Math.max(0, max)))
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlight((v) => Math.max(v - 1, 0))
              return
            }

            if (e.key === 'Enter') {
              e.preventDefault()

              if (mode === 'commands') {
                const cmd = COMMANDS[highlight]
                if (cmd) {
                  cmd.run({ navigate })
                  close()
                }
                return
              }

              const item = results[highlight]
              if (item) {
                jumpToTask(item)
                return
              }

              void createTaskFromQuery()
            }
          }}
        />

        <div className="palette-list">
          {mode === 'commands' ? (
            <>
              {COMMANDS.map((cmd, idx) => (
                <button
                  key={cmd.id}
                  type="button"
                  className={`palette-item${idx === highlight ? ' is-active' : ''}`}
                  onClick={() => {
                    cmd.run({ navigate })
                    close()
                  }}
                >
                  <div className="palette-item-title">{cmd.title}</div>
                  <div className="palette-item-hint">{cmd.hint}</div>
                </button>
              ))}
            </>
          ) : (
            <>
              {results.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  className={`palette-item${idx === highlight ? ' is-active' : ''}`}
                  onClick={() => jumpToTask(item)}
                >
                  <div className={item.title.trim() ? 'palette-item-title' : 'palette-item-title palette-item-placeholder'}>
                    {item.title.trim() ? item.title : '新建任务'}
                  </div>
                  <div className="palette-item-hint">{item.snippet ?? getTaskHint(item)}</div>
                </button>
              ))}

              <button
                type="button"
                className={`palette-item${highlight === results.length ? ' is-active' : ''}`}
                onClick={() => void createTaskFromQuery()}
              >
                <div className="palette-item-title">Create task</div>
                <div className="palette-item-hint">{query.trim()}</div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const COMMANDS: Array<{
  id: string
  title: string
  hint: string
  run: (ctx: { navigate: (to: string) => void }) => void
}> = [
  { id: 'go-today', title: 'Go to Today', hint: 'View', run: ({ navigate }) => navigate('/today') },
  { id: 'go-inbox', title: 'Go to Inbox', hint: 'View', run: ({ navigate }) => navigate('/inbox') },
  { id: 'go-upcoming', title: 'Go to Upcoming', hint: 'View', run: ({ navigate }) => navigate('/upcoming') },
  { id: 'go-anytime', title: 'Go to Anytime', hint: 'View', run: ({ navigate }) => navigate('/anytime') },
  { id: 'go-someday', title: 'Go to Someday', hint: 'View', run: ({ navigate }) => navigate('/someday') },
  { id: 'go-logbook', title: 'Go to Logbook', hint: 'View', run: ({ navigate }) => navigate('/logbook') },
  { id: 'go-settings', title: 'Go to Settings', hint: 'App', run: ({ navigate }) => navigate('/settings') },
]
