import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ok } from '../../shared/result'
import type { ChatMessage, ChatSession } from '../../shared/schemas/chat'
import type { WindowApi } from '../../shared/window-api'
import { useChatStreaming } from '../../src/features/chat/use-chat-streaming'

const SESSION_A = '550e8400-e29b-41d4-a716-4466554400a1'
const SESSION_B = '550e8400-e29b-41d4-a716-4466554400b1'
const RUN_A = 'run-a'
const STALE_RUN_A = 'stale-run-a'
const CONFIRM_A = 'confirm-a'

type ChatEventHandlers = {
  delta?: Parameters<WindowApi['chat']['onMessageDelta']>[0]
  done?: Parameters<WindowApi['chat']['onMessageDone']>[0]
  error?: Parameters<WindowApi['chat']['onMessageError']>[0]
  confirm?: Parameters<WindowApi['chat']['onConfirmRequest']>[0]
}

function api(): WindowApi {
  return (window as unknown as { api: WindowApi }).api
}

function message(sessionId: string, id: string, content: string): ChatMessage {
  return {
    id,
    session_id: sessionId,
    role: 'user',
    content,
    tool_calls: null,
    tool_call_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

function session(id: string, title: string): ChatSession {
  return {
    id,
    title,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

function installChatEventHandlers(): ChatEventHandlers {
  const handlers: ChatEventHandlers = {}
  api().chat.onMessageDelta = vi.fn<WindowApi['chat']['onMessageDelta']>((callback) => {
    handlers.delta = callback
    return () => {
      handlers.delta = undefined
    }
  })
  api().chat.onMessageDone = vi.fn<WindowApi['chat']['onMessageDone']>((callback) => {
    handlers.done = callback
    return () => {
      handlers.done = undefined
    }
  })
  api().chat.onMessageError = vi.fn<WindowApi['chat']['onMessageError']>((callback) => {
    handlers.error = callback
    return () => {
      handlers.error = undefined
    }
  })
  api().chat.onConfirmRequest = vi.fn<WindowApi['chat']['onConfirmRequest']>((callback) => {
    handlers.confirm = callback
    return () => {
      handlers.confirm = undefined
    }
  })
  return handlers
}

describe('useChatStreaming', () => {
  it('ignores stale same-session events before the current message id is known', async () => {
    const handlers = installChatEventHandlers()
    let resolveSend: ((value: Awaited<ReturnType<WindowApi['chat']['send']>>) => void) | undefined
    api().chat.send = vi.fn<WindowApi['chat']['send']>(
      () => new Promise((resolve) => {
        resolveSend = resolve
      })
    )
    api().chat.listMessages = vi.fn<WindowApi['chat']['listMessages']>(async () => ok([]))

    const { result } = renderHook(() => useChatStreaming(SESSION_A))

    void act(() => {
      void result.current.sendMessage('hello')
    })

    act(() => {
      handlers.delta?.({ sessionId: SESSION_A, messageId: STALE_RUN_A, delta: 'stale' })
      handlers.done?.({ sessionId: SESSION_A, messageId: STALE_RUN_A })
    })

    expect(result.current.streaming).toMatchObject({
      sessionId: SESSION_A,
      messageId: null,
      delta: '',
      isLoading: true,
    })

    await act(async () => {
      resolveSend?.(ok({ messageId: RUN_A }))
    })

    expect(result.current.streaming).toMatchObject({
      sessionId: SESSION_A,
      messageId: RUN_A,
      delta: '',
      isLoading: true,
    })
  })

  it('ignores stale send refreshes after switching sessions', async () => {
    installChatEventHandlers()
    api().chat.send = vi.fn<WindowApi['chat']['send']>(async () => ok({ messageId: RUN_A }))
    api().chat.listMessages = vi.fn<WindowApi['chat']['listMessages']>(async (sessionId) =>
      ok(sessionId === SESSION_A
        ? [message(SESSION_A, 'a-message', 'A message')]
        : [message(SESSION_B, 'b-message', 'B message')])
    )

    const { result, rerender } = renderHook(
      ({ activeSessionId }) => useChatStreaming(activeSessionId),
      { initialProps: { activeSessionId: SESSION_A } }
    )

    await waitFor(() => expect(api().chat.listMessages).toHaveBeenCalledWith(SESSION_A))

    await act(async () => {
      const send = result.current.sendMessage('hello')
      rerender({ activeSessionId: SESSION_B })
      await send
    })

    await waitFor(() => {
      expect(result.current.messages).toEqual([message(SESSION_B, 'b-message', 'B message')])
    })
  })

  it('settles a background run without polluting the visible session', async () => {
    const handlers = installChatEventHandlers()
    api().chat.send = vi.fn<WindowApi['chat']['send']>(async () => ok({ messageId: RUN_A }))
    api().chat.listMessages = vi.fn<WindowApi['chat']['listMessages']>(async (sessionId) =>
      ok(sessionId === SESSION_A
        ? [message(SESSION_A, 'a-message', 'A message')]
        : [message(SESSION_B, 'b-message', 'B message')])
    )

    const { result, rerender } = renderHook(
      ({ activeSessionId }) => useChatStreaming(activeSessionId),
      { initialProps: { activeSessionId: SESSION_A } }
    )

    await act(async () => {
      await result.current.sendMessage('hello')
    })
    expect(result.current.streaming).toMatchObject({ sessionId: SESSION_A, messageId: RUN_A, isLoading: true })

    rerender({ activeSessionId: SESSION_B })
    await waitFor(() => {
      expect(result.current.messages).toEqual([message(SESSION_B, 'b-message', 'B message')])
    })

    act(() => {
      handlers.done?.({ sessionId: SESSION_A, messageId: RUN_A })
    })

    await waitFor(() => {
      expect(result.current.streaming).toMatchObject({ sessionId: null, messageId: null, isLoading: false })
      expect(result.current.messages).toEqual([message(SESSION_B, 'b-message', 'B message')])
    })
  })

  it('clears pending confirmation when aborting the run', async () => {
    const handlers = installChatEventHandlers()
    api().chat.send = vi.fn<WindowApi['chat']['send']>(async () => ok({ messageId: RUN_A }))
    api().chat.listMessages = vi.fn<WindowApi['chat']['listMessages']>(async () => ok([]))

    const { result } = renderHook(() => useChatStreaming(SESSION_A))

    await act(async () => {
      await result.current.sendMessage('delete it')
    })

    act(() => {
      handlers.confirm?.({
        messageId: CONFIRM_A,
        sessionId: SESSION_A,
        runMessageId: RUN_A,
        action: 'task.delete',
        summary: '删除任务 A',
      })
    })
    expect(result.current.confirmRequest?.messageId).toBe(CONFIRM_A)

    await act(async () => {
      await result.current.abortMessage(RUN_A)
    })

    expect(api().chat.abort).toHaveBeenCalledWith(RUN_A)
    expect(result.current.confirmRequest).toBeNull()
    expect(result.current.streaming.isLoading).toBe(false)
  })

  it('clears local state after deleting the active session', async () => {
    installChatEventHandlers()
    api().chat.listSessions = vi.fn<WindowApi['chat']['listSessions']>(async () =>
      ok([session(SESSION_A, 'A')])
    )
    api().chat.listMessages = vi.fn<WindowApi['chat']['listMessages']>(async () =>
      ok([message(SESSION_A, 'a-message', 'A message')])
    )
    api().chat.deleteSession = vi.fn<WindowApi['chat']['deleteSession']>(async () => ok({ deleted: true }))

    const { result } = renderHook(() => useChatStreaming(SESSION_A))
    await waitFor(() => {
      expect(result.current.messages).toEqual([message(SESSION_A, 'a-message', 'A message')])
    })

    await act(async () => {
      await expect(result.current.deleteSession(SESSION_A)).resolves.toBe(true)
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.streaming.isLoading).toBe(false)
    expect(result.current.confirmRequest).toBeNull()
    expect(result.current.sessions).toEqual([])
  })
})
