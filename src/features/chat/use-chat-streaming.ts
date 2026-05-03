import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, ChatSession } from '../../../shared/schemas/chat'

export type StreamingState = {
  sessionId: string | null
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
  sessionId: string
  runMessageId: string
  action: string
  summary: string
}

export type StreamingToolCall = {
  name: string
  args: unknown
  result?: string
  status: 'pending' | 'completed' | 'error'
}

type DeltaBuffer = {
  sessionId: string
  messageId: string
  delta: string
}

const IDLE_STREAMING: StreamingState = {
  sessionId: null,
  messageId: null,
  delta: '',
  isLoading: false,
}

function isSameRun(
  streaming: StreamingState,
  event: { sessionId: string; messageId: string }
): boolean {
  return (
    streaming.isLoading &&
    streaming.sessionId === event.sessionId &&
    streaming.messageId === event.messageId
  )
}

function isSameRunByMessageId(
  streaming: StreamingState,
  event: { messageId: string }
): boolean {
  return streaming.isLoading && streaming.messageId === event.messageId
}

export function useChatStreaming(activeSessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [streaming, setStreaming] = useState<StreamingState>(IDLE_STREAMING)
  const [error, setError] = useState<ChatError | null>(null)
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)
  const [streamingToolCalls, setStreamingToolCalls] = useState<StreamingToolCall[]>([])

  // RAF-batched delta buffer
  const deltaBufferRef = useRef<DeltaBuffer | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const activeSessionIdRef = useRef(activeSessionId)
  const streamingRef = useRef(streaming)
  activeSessionIdRef.current = activeSessionId

  const setStreamingState = useCallback((
    next: StreamingState | ((prev: StreamingState) => StreamingState)
  ) => {
    setStreaming((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      streamingRef.current = value
      return value
    })
  }, [])

  const clearDeltaBuffer = useCallback((event?: { sessionId: string; messageId: string }) => {
    if (!event) {
      deltaBufferRef.current = null
      return
    }
    const buffered = deltaBufferRef.current
    if (buffered?.sessionId === event.sessionId && buffered.messageId === event.messageId) {
      deltaBufferRef.current = null
    }
  }, [])

  const flushDeltaBuffer = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    const buffered = deltaBufferRef.current
    if (!buffered || buffered.delta.length === 0) return
    deltaBufferRef.current = null

    setStreamingState((prev) => {
      if (!isSameRun(prev, buffered)) return prev
      return {
        ...prev,
        messageId: buffered.messageId,
        delta: prev.delta + buffered.delta,
      }
    })
  }, [setStreamingState])

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
      } else {
        setError({ code: res.error.code, message: res.error.message })
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
      } else {
        setError({ code: res.error.code, message: res.error.message })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeSessionId])

  // Subscribe to streaming events
  useEffect(() => {
    const unsubDelta = window.api.chat.onMessageDelta((event) => {
      if (!isSameRun(streamingRef.current, event)) return

      const buffered = deltaBufferRef.current
      deltaBufferRef.current =
        buffered?.sessionId === event.sessionId && buffered.messageId === event.messageId
          ? { ...buffered, delta: buffered.delta + event.delta }
          : { sessionId: event.sessionId, messageId: event.messageId, delta: event.delta }
      scheduleFlush()
    })

    const unsubToolCall = window.api.chat.onToolCall((event) => {
      if (!isSameRunByMessageId(streamingRef.current, event)) return
      setStreamingToolCalls((prev) => [...prev, { name: event.name, args: event.args, status: 'pending' }])
    })

    const unsubToolResult = window.api.chat.onToolResult((event) => {
      if (!isSameRunByMessageId(streamingRef.current, event)) return
      setStreamingToolCalls((prev) => {
        const idx = prev.findIndex((tc) => tc.status === 'pending')
        if (idx === -1) return prev
        const next = [...prev]
        next[idx] = {
          ...next[idx]!,
          result: event.result,
          status: event.isError ? 'error' : 'completed',
        }
        return next
      })
    })

    const unsubDone = window.api.chat.onMessageDone((event) => {
      if (!isSameRun(streamingRef.current, event)) return
      flushDeltaBuffer()
      clearDeltaBuffer(event)
      setStreamingState((prev) => (isSameRun(prev, event) ? IDLE_STREAMING : prev))
      setStreamingToolCalls([])
      setConfirmRequest((prev) =>
        prev?.sessionId === event.sessionId && prev.runMessageId === event.messageId ? null : prev
      )

      // Refresh only if the completed run still belongs to the visible session.
      void (async () => {
        if (activeSessionIdRef.current !== event.sessionId) return
        const res = await window.api.chat.listMessages(event.sessionId)
        if (activeSessionIdRef.current === event.sessionId && res.ok) {
          setMessages(res.data)
        }
      })()
    })

    const unsubError = window.api.chat.onMessageError((event) => {
      if (!isSameRun(streamingRef.current, event)) return
      flushDeltaBuffer()
      clearDeltaBuffer(event)
      setStreamingState((prev) => (isSameRun(prev, event) ? IDLE_STREAMING : prev))
      setStreamingToolCalls([])
      setConfirmRequest((prev) =>
        prev?.sessionId === event.sessionId && prev.runMessageId === event.messageId ? null : prev
      )
      if (activeSessionIdRef.current === event.sessionId) {
        setError({ code: event.code, message: event.message })
      }
    })

    const unsubConfirm = window.api.chat.onConfirmRequest((event) => {
      const current = streamingRef.current
      if (
        !current.isLoading ||
        current.sessionId !== event.sessionId ||
        current.messageId !== event.runMessageId
      ) {
        return
      }
      setConfirmRequest({
        messageId: event.messageId,
        sessionId: event.sessionId,
        runMessageId: event.runMessageId,
        action: event.action,
        summary: event.summary,
      })
    })

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      unsubDelta()
      unsubToolCall()
      unsubToolResult()
      unsubDone()
      unsubError()
      unsubConfirm()
    }
  }, [clearDeltaBuffer, flushDeltaBuffer, scheduleFlush, setStreamingState])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeSessionId) return ''

      const sessionId = activeSessionId
      setError(null)
      setConfirmRequest(null)
      setStreamingToolCalls([])
      clearDeltaBuffer()
      setStreamingState({ sessionId, messageId: null, delta: '', isLoading: true })

      const res = await window.api.chat.send(sessionId, content)
      if (!res.ok) {
        setStreamingState((prev) =>
          prev.sessionId === sessionId && prev.messageId === null ? IDLE_STREAMING : prev
        )
        if (activeSessionIdRef.current === sessionId) {
          setError({ code: res.error.code, message: res.error.message })
        }
        return ''
      }

      setStreamingState((prev) =>
        prev.sessionId === sessionId && (prev.messageId === null || prev.messageId === res.data.messageId)
          ? { ...prev, messageId: res.data.messageId }
          : prev
      )

      // Refresh messages immediately so the user message appears right away.
      const messagesRes = await window.api.chat.listMessages(sessionId)
      if (activeSessionIdRef.current === sessionId && messagesRes.ok) {
        setMessages(messagesRes.data)
      }
      return res.data.messageId
    },
    [activeSessionId, clearDeltaBuffer, setStreamingState]
  )

  const abortMessage = useCallback(async (messageId: string) => {
    await window.api.chat.abort(messageId)
    clearDeltaBuffer()
    setStreamingState((prev) => (prev.messageId === messageId ? IDLE_STREAMING : prev))
    setStreamingToolCalls([])
    setConfirmRequest((prev) => (prev?.runMessageId === messageId ? null : prev))
  }, [clearDeltaBuffer, setStreamingState])

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

  const deleteSession = useCallback(async (id: string): Promise<boolean> => {
    const deletingActive = id === activeSessionIdRef.current
    const running = streamingRef.current

    if (deletingActive && running.sessionId === id && running.messageId) {
      await window.api.chat.abort(running.messageId)
    }

    const res = await window.api.chat.deleteSession(id)
    if (!res.ok) {
      setError({ code: res.error.code, message: res.error.message })
      return false
    }

    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (deletingActive) {
      clearDeltaBuffer()
      setMessages([])
      setStreamingState(IDLE_STREAMING)
      setStreamingToolCalls([])
      setConfirmRequest(null)
      setError(null)
    }
    return true
  }, [clearDeltaBuffer, setStreamingState])

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
    dismissConfirm,
  }
}
