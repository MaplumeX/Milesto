import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, X } from 'lucide-react'

import type { ChatSession } from '../../../shared/schemas/chat'

type ChatSessionListProps = {
  sessions: ChatSession[]
  activeSessionId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

export function ChatSessionList({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ChatSessionListProps) {
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const startRename = useCallback((session: ChatSession) => {
    setEditingId(session.id)
    setEditValue(session.title)
    window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }, [])

  const commitRename = useCallback(
    (id: string) => {
      const trimmed = editValue.trim()
      if (trimmed.length > 0) {
        onRename(id, trimmed)
      }
      setEditingId(null)
      setEditValue('')
    },
    [editValue, onRename]
  )

  return (
    <div className="chat-session-list">
      <button
        type="button"
        className="chat-session-new"
        onClick={onCreate}
        aria-label={t('chat.newSession')}
      >
        <Plus size={14} aria-hidden="true" /> {t('chat.newSession')}
      </button>

      <div className="chat-session-items" role="listbox" aria-label={t('chat.sessions')}>
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId
          const isEditing = session.id === editingId

          return (
            <div
              key={session.id}
              className={`chat-session-item${isActive ? ' is-active' : ''}`}
              role="option"
              aria-selected={isActive}
              onClick={() => {
                if (!isEditing) onSelect(session.id)
              }}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  className="chat-session-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitRename(session.id)
                    } else if (e.key === 'Escape') {
                      setEditingId(null)
                      setEditValue('')
                    }
                  }}
                  onBlur={() => commitRename(session.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="chat-session-title">{session.title || t('common.untitled')}</span>
                  <div className="chat-session-actions">
                    <button
                      type="button"
                      className="chat-session-action"
                      onClick={(e) => {
                        e.stopPropagation()
                        startRename(session)
                      }}
                      aria-label={t('common.rename')}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="chat-session-action"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(session.id)
                      }}
                      aria-label={t('common.delete')}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
