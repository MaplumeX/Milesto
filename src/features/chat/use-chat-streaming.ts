import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, ChatSession } from '../../../shared/schemas/chat'

export type StreamingState = {
  messageId: string | null
  delta: string
  isLoading: boolean
}

export type ChatError = {
  code: string
  message: string
}

export type ConfirmRequest = {
  messageId: string
  action: string
  summary: string
}

export function useChatStreaming(activeSessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [streaming, setStreaming] = useState<StreamingState>({
    messageId: null,
    delta: '',
    isLoading: false,
  })
  const [error, setError] = useState<ChatError | null>(null)
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)

  // RAF-batched delta buffer
  const deltaBufferRef = useRef('')
  const rafIdRef = useRef<number | null>(null)
  const activeSessionIdRef = useRef(activeSessionId)
  activeSessionIdRef.current = activeSessionId

  const flushDeltaBuffer = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    const buffered = deltaBufferRef.current
    if (buffered.length === 0) return
    deltaBufferRef.current = ''
    setStreaming((prev) =>
      prev.isLoading
        ? { ...prev, delta: prev.delta + buffered }
        : prev
    )
  }, [])

  const scheduleFlush = useCallback(() => {
    if (rafIdRef.current !== null) return
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      flushDeltaBuffer()
    })
  }, [flushDeltaBuffer])

  // Load sessions on mount
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await window.api.chat.listSessions()
      if (cancelled) return
      if (res.ok) {
        setSessions(res.data)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([])
      return
    }
    let cancelled = false
    void (async () => {
      const res = await window.api.chat.listMessages(activeSessionId)
      if (cancelled) return
      if (res.ok) {
        setMessages(res.data)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeSessionId])

  // Subscribe to streaming events
  useEffect(() => {
    const unsubDelta = window.api.chat.onMessageDelta((event) => {
      if (event.sessionId !== activeSessionIdRef.current) return
      deltaBufferRef.current += event.delta
      scheduleFlush()
    })

    const unsubToolCall = window.api.chat.onToolCall(() => {
      // Tool calls are visualized in the message list; no immediate state change needed here.
    })

    const unsubToolResult = window.api.chat.onToolResult(() => {
      // Tool results are visualized in the message list.
    })

    const unsubDone = window.api.chat.onMessageDone((event) => {
      if (event.sessionId !== activeSessionIdRef.current) return
      flushDeltaBuffer()
      setStreaming({ messageId: null, delta: '', isLoading: false })
      // Refresh messages to get the persisted assistant message
      void (async () => {
        if (!activeSessionIdRef.current) return
        const res = await window.api.chat.listMessages(activeSessionIdRef.current)
        if (res.ok) {
          setMessages(res.data)
        }
      })()
    })

    const unsubError = window.api.chat.onMessageError((event) => {
      if (event.sessionId !== activeSessionIdRef.current) return
      flushDeltaBuffer()
      setStreaming({ messageId: null, delta: '', isLoading: false })
      setError({ code: event.code, message: event.message })
    })

    const unsubConfirm = window.api.chat.onConfirmRequest((event) => {
      setConfirmRequest({
        messageId: event.messageId,
        action: event.action,
        summary: event.summary,
      })
    })

    return () => {
      unsubDelta()
      unsubToolCall()
      unsubToolResult()
      unsubDone()
      unsubError()
      unsubConfirm()
    }
  }, [flushDeltaBuffer, scheduleFlush])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeSessionId) return ''
      setError(null)
      setStreaming({ messageId: null, delta: '', isLoading: true })
      const res = await window.api.chat.send(activeSessionId, content)
      if (!res.ok) {
        setStreaming({ messageId: null, delta: '', isLoading: false })
        setError({ code: res.error.code, message: res.error.message })
        return ''
      }
      // Refresh messages immediately so the user message appears right away
      const messagesRes = await window.api.chat.listMessages(activeSessionId)
      if (messagesRes.ok) {
        setMessages(messagesRes.data)
      }
      return res.data.messageId
    },
    [activeSessionId]
  )

  const abortMessage = useCallback(async (messageId: string) => {
    await window.api.chat.abort(messageId)
    setStreaming({ messageId: null, delta: '', isLoading: false })
  }, [])

  const respondConfirm = useCallback(async (messageId: string, approve: boolean) => {
    const res = await window.api.chat.confirmRespond(messageId, approve)
    if (!res.ok) {
      setError({ code: res.error.code, message: res.error.message })
    }
    setConfirmRequest(null)
  }, [])

  const createSession = useCallback(async (title?: string) => {
    const res = await window.api.chat.createSession(title)
    if (!res.ok) {
      setError({ code: res.error.code, message: res.error.message })
      return null
    }
    setSessions((prev) => [res.data, ...prev])
    return res.data
  }, [])

  const renameSession = useCallback(async (id: string, title: string) => {
    const res = await window.api.chat.renameSession(id, title)
    if (!res.ok) {
      setError({ code: res.error.code, message: res.error.message })
      return
    }
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: res.data.title } : s))
    )
  }, [])

  const deleteSession = useCallback(async (id: string) => {
    const res = await window.api.chat.deleteSession(id)
    if (!res.ok) {
      setError({ code: res.error.code, message: res.error.message })
      return
    }
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const dismissError = useCallback(() => {
    setError(null)
  }, [])

  const dismissConfirm = useCallback(() => {
    if (confirmRequest) {
      void respondConfirm(confirmRequest.messageId, false)
    }
    setConfirmRequest(null)
  }, [confirmRequest, respondConfirm])

  return {
    messages,
    sessions,
    streaming,
    error,
    confirmRequest,
    sendMessage,
    abortMessage,
    respondConfirm,
    createSession,
    renameSession,
    deleteSession,
    dismissError,
    dismissConfirm,
  }
}
