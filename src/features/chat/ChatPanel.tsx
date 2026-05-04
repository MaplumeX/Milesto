import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChatComposer } from './ChatComposer'
import { ChatMessages } from './ChatMessages'
import { ChatSessionList } from './ChatSessionList'
import { ConfirmDialog } from './ConfirmDialog'
import { useChatStreaming } from './use-chat-streaming'

type ChatPanelProps = {
  isOpen: boolean
  onToggle: () => void
}

export function ChatPanel({ isOpen, onToggle }: ChatPanelProps) {
  const { t } = useTranslation()
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null)
  const lastMessageIdRef = useRef<string | null>(null)

  const {
    messages,
    sessions,
    streaming,
    streamingToolCalls,
    error,
    confirmRequest,
    sendMessage,
    abortMessage,
    respondConfirm,
    createSession,
    renameSession,
    deleteSession,
    dismissError,
  } = useChatStreaming(activeSessionId)

  // Load AI config to determine if enabled
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await window.api.settings.getAiConfig()
      if (cancelled) return
      if (res.ok) {
        setAiEnabled(res.data.enabled)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (activeSessionId !== null) return
    if (sessions.length === 0) return
    setActiveSessionId(sessions[0]!.id)
  }, [activeSessionId, sessions])

  const handleCreateSession = useCallback(async () => {
    const session = await createSession(t('chat.newSessionDefault'))
    if (session) {
      setActiveSessionId(session.id)
    }
  }, [createSession, t])

  const handleSend = useCallback(
    async (content: string) => {
      let sessionId = activeSessionId
      let createdSessionId: string | null = null
      if (!sessionId) {
        const session = await createSession(t('chat.newSessionDefault'))
        if (!session) {
          throw new Error('CREATE_SESSION_FAILED')
        }
        sessionId = session.id
        createdSessionId = session.id
        setActiveSessionId(sessionId)
      }
      lastMessageIdRef.current = null
      const messageId = await sendMessage(content, sessionId)
      if (messageId) {
        lastMessageIdRef.current = messageId
      } else if (createdSessionId) {
        const msgRes = await window.api.chat.listMessages(createdSessionId)
        if (msgRes.ok && msgRes.data.length === 0) {
          await deleteSession(createdSessionId)
          setActiveSessionId(null)
        }
        throw new Error('SEND_FAILED')
      }
    },
    [activeSessionId, createSession, deleteSession, sendMessage, t]
  )

  const handleAbort = useCallback(() => {
    const messageId = streaming.sessionId === activeSessionId ? streaming.messageId : lastMessageIdRef.current
    if (messageId) {
      void abortMessage(messageId)
    }
  }, [abortMessage, activeSessionId, streaming.messageId, streaming.sessionId])

  const handleDeleteSession = useCallback(
    async (id: string) => {
      const deleted = await deleteSession(id)
      if (deleted && id === activeSessionId) {
        setActiveSessionId(null)
        lastMessageIdRef.current = null
      }
    },
    [activeSessionId, deleteSession]
  )

  const handleApproveConfirm = useCallback(() => {
    if (confirmRequest) {
      void respondConfirm(confirmRequest.messageId, true)
    }
  }, [confirmRequest, respondConfirm])

  const handleRejectConfirm = useCallback(() => {
    if (confirmRequest) {
      void respondConfirm(confirmRequest.messageId, false)
    }
  }, [confirmRequest, respondConfirm])

  const isActiveSessionStreaming = streaming.sessionId === activeSessionId
  const isLoading = isActiveSessionStreaming && streaming.isLoading
  const streamingDelta = isActiveSessionStreaming ? streaming.delta : ''
  const visibleConfirmRequest = confirmRequest?.sessionId === activeSessionId ? confirmRequest : null

  const disabled = aiEnabled !== true
  const disabledHint = aiEnabled === false
    ? t('chat.errorDisabled')
    : aiEnabled === null
      ? t('chat.errorLoading')
      : undefined

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        className={`chat-toggle${isOpen ? ' is-active' : ''}`}
        onClick={onToggle}
        aria-label={t('chat.panelTitle')}
        aria-expanded={isOpen}
        title={t('chat.panelTitle')}
      >
        <ChatIcon aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="chat-panel">
          <div className="chat-panel-inner">
            <div className="chat-panel-header">
              <span className="chat-panel-title">{t('chat.panelTitle')}</span>
            </div>

            <div className="chat-panel-body">
              <ChatSessionList
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelect={setActiveSessionId}
                onCreate={handleCreateSession}
                onRename={renameSession}
                onDelete={handleDeleteSession}
              />

              <div className="chat-panel-main">
                {error ? (
                  <div className="chat-error">
                    <div className="chat-error-message">{getFriendlyErrorMessage(error.code, t)}</div>
                    <button
                      type="button"
                      className="chat-error-dismiss"
                      onClick={dismissError}
                      aria-label={t('common.close')}
                    >
                      ×
                    </button>
                  </div>
                ) : null}

                <ChatMessages
                  messages={messages}
                  streamingDelta={streamingDelta}
                  isLoading={isLoading}
                  streamingToolCalls={streamingToolCalls}
                />

                <ChatComposer
                  onSend={handleSend}
                  isLoading={isLoading}
                  onAbort={handleAbort}
                  disabled={disabled}
                  disabledHint={disabledHint}
                />
              </div>
            </div>
          </div>

          {visibleConfirmRequest ? (
            <ConfirmDialog
              action={visibleConfirmRequest.action}
              summary={visibleConfirmRequest.summary}
              onApprove={handleApproveConfirm}
              onReject={handleRejectConfirm}
            />
          ) : null}
        </div>
      ) : null}
    </>
  )
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function getFriendlyErrorMessage(code: string, t: (key: string) => string): string {
  switch (code) {
    case 'AI_DISABLED':
      return t('chat.errorDisabled')
    case 'AI_INVALID_KEY':
    case 'UNAUTHORIZED':
      return t('chat.errorInvalidKey')
    case 'NETWORK_ERROR':
    case 'FETCH_FAILED':
      return t('chat.errorNetwork')
    case 'MODEL_NOT_FOUND':
      return t('chat.errorModelNotFound')
    case 'RATE_LIMIT':
      return t('chat.errorRateLimit')
    default:
      return t('chat.errorGeneric')
  }
}
