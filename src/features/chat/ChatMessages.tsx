import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'

import type { ChatMessage } from '../../../shared/schemas/chat'

type ChatMessagesProps = {
  messages: ChatMessage[]
  streamingDelta: string
  isLoading: boolean
}

export function ChatMessages({ messages, streamingDelta, isLoading }: ChatMessagesProps) {
  const { t } = useTranslation()
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingDelta])

  const allMessages = [...messages]
  // If streaming, append a pending assistant message
  if (isLoading) {
    allMessages.push({
      id: 'streaming',
      session_id: '',
      role: 'assistant',
      content: streamingDelta,
      tool_calls: null,
      tool_call_id: null,
      created_at: new Date().toISOString(),
    })
  }

  return (
    <div ref={containerRef} className="chat-messages">
      {allMessages.length === 0 ? (
        <div className="chat-empty">{t('chat.empty')}</div>
      ) : (
        allMessages.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isTool = message.role === 'tool'

  return (
    <div
      className={`chat-message${isUser ? ' is-user' : ''}${isAssistant ? ' is-assistant' : ''}${isTool ? ' is-tool' : ''}`}
      data-chat-role={message.role}
    >
      <div className="chat-message-bubble">
        {isTool ? (
          <ToolMessageContent message={message} />
        ) : isAssistant ? (
          <div className="markdown-body">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <div className="chat-message-text">{message.content}</div>
        )}
      </div>
    </div>
  )
}

function ToolMessageContent({ message }: { message: ChatMessage }) {
  const [isExpanded, setIsExpanded] = useState(false)
  return (
    <div className="chat-tool-message">
      <button
        type="button"
        className="chat-tool-toggle"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
      >
        <span className="chat-tool-name">{message.tool_call_id || 'tool'}</span>
        <span className="chat-tool-chevron" aria-hidden="true">
          {isExpanded ? '▾' : '▸'}
        </span>
      </button>
      {isExpanded ? (
        <pre className="chat-tool-body">{message.content}</pre>
      ) : null}
    </div>
  )
}
