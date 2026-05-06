import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'

import type { ChatMessage } from '../../../shared/schemas/chat'
import type { StreamingToolCall } from './use-chat-streaming'

type ChatMessagesProps = {
  messages: ChatMessage[]
  streamingDelta: string
  isLoading: boolean
  streamingToolCalls?: StreamingToolCall[]
  onRollbackMessage?: (message: ChatMessage) => void
}

export function ChatMessages({
  messages,
  streamingDelta,
  isLoading,
  streamingToolCalls = [],
  onRollbackMessage,
}: ChatMessagesProps) {
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
  }, [messages, streamingDelta, streamingToolCalls])

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

  const showStreamingToolCalls = isLoading && streamingToolCalls.length > 0

  return (
    <div ref={containerRef} className="chat-messages">
      {allMessages.length === 0 ? (
        <div className="chat-empty">
          <div className="chat-welcome-title">{t('chat.welcomeTitle')}</div>
          <div className="chat-welcome-hint">{t('chat.welcomeHint')}</div>
        </div>
      ) : (
        allMessages.map((msg) => (
          <ChatMessageBubble
            key={msg.id}
            message={msg}
            onRollbackMessage={msg.role === 'user' ? onRollbackMessage : undefined}
          />
        ))
      )}
      {showStreamingToolCalls ? (
        <div className="chat-message is-tool">
          <div className="chat-message-bubble">
            <div className="chat-streaming-tool-calls">
              {streamingToolCalls.map((tc, i) => (
                <StreamingToolCallCard key={`${tc.name}-${i}`} toolCall={tc} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <div ref={bottomRef} />
    </div>
  )
}

function ChatMessageBubble({
  message,
  onRollbackMessage,
}: {
  message: ChatMessage
  onRollbackMessage?: (message: ChatMessage) => void
}) {
  const { t } = useTranslation()
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isTool = message.role === 'tool'

  return (
    <div
      className={`chat-message${isUser ? ' is-user' : ''}${isAssistant ? ' is-assistant' : ''}${isTool ? ' is-tool' : ''}`}
      data-chat-role={message.role}
    >
      <div className="chat-message-bubble">
        {isUser && onRollbackMessage ? (
          <button
            type="button"
            className="chat-message-rollback"
            onClick={() => onRollbackMessage(message)}
            aria-label={t('chat.rollbackMessageAria', { content: message.content.slice(0, 40) })}
            title={t('chat.rollbackMessage')}
          >
            <RollbackIcon aria-hidden="true" />
          </button>
        ) : null}
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

function RollbackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 4H2v4" />
      <path d="M2.5 7A5.5 5.5 0 1 0 4 3.2L2 5" />
    </svg>
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

function StreamingToolCallCard({ toolCall }: { toolCall: StreamingToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { t } = useTranslation()

  const statusIcon =
    toolCall.status === 'pending' ? (
      <span className="chat-tool-status-icon chat-tool-status-pending" aria-hidden="true">
        <Spinner />
      </span>
    ) : toolCall.status === 'error' ? (
      <span className="chat-tool-status-icon chat-tool-status-error" aria-hidden="true">
        ⚠
      </span>
    ) : (
      <span className="chat-tool-status-icon chat-tool-status-completed" aria-hidden="true">
        ✓
      </span>
    )

  const statusLabel =
    toolCall.status === 'pending'
      ? t('chat.toolStatusPending')
      : toolCall.status === 'error'
        ? t('chat.toolStatusError')
        : t('chat.toolStatusCompleted')

  return (
    <div className={`chat-tool-message${toolCall.status === 'error' ? ' is-error' : ''}`}>
      <button
        type="button"
        className="chat-tool-toggle"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
      >
        <span className="chat-tool-toggle-left">
          {statusIcon}
          <span className="chat-tool-name">{toolCall.name}</span>
          <span className="chat-tool-status-label">{statusLabel}</span>
        </span>
        <span className="chat-tool-chevron" aria-hidden="true">
          {isExpanded ? '▾' : '▸'}
        </span>
      </button>
      {isExpanded ? (
        <div className="chat-tool-body">
          <div className="chat-tool-section">
            <div className="chat-tool-section-title">{t('chat.toolArgs')}</div>
            <pre>{JSON.stringify(toolCall.args, null, 2)}</pre>
          </div>
          {toolCall.result !== undefined ? (
            <div className="chat-tool-section">
              <div className="chat-tool-section-title">{t('chat.toolResult')}</div>
              <pre>{toolCall.result}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="chat-tool-spinner" viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="28"
        strokeDashoffset="8"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 8 8"
          to="360 8 8"
          dur="1s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  )
}
