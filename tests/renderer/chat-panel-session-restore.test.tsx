import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ok } from '../../shared/result'
import type { ChatMessage, ChatSession } from '../../shared/schemas/chat'
import type { WindowApi } from '../../shared/window-api'
import { ChatPanel } from '../../src/features/chat/ChatPanel'

const RECENT_SESSION = '550e8400-e29b-41d4-a716-4466554400b1'
const OLDER_SESSION = '550e8400-e29b-41d4-a716-4466554400a1'

function api(): WindowApi {
  return (window as unknown as { api: WindowApi }).api
}

function session(id: string, title: string, updatedAt: string): ChatSession {
  return {
    id,
    title,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: updatedAt,
  }
}

function message(sessionId: string, content: string): ChatMessage {
  return {
    id: `${sessionId}-message`,
    session_id: sessionId,
    role: 'user',
    content,
    tool_calls: null,
    tool_call_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

describe('ChatPanel session restoration', () => {
  beforeEach(() => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
  })

  it('auto-selects the most recent loaded session when no active session exists', async () => {
    api().chat.listSessions = vi.fn<WindowApi['chat']['listSessions']>(async () =>
      ok([
        session(RECENT_SESSION, 'Recent chat', '2026-01-03T00:00:00.000Z'),
        session(OLDER_SESSION, 'Older chat', '2026-01-02T00:00:00.000Z'),
      ])
    )
    api().chat.listMessages = vi.fn<WindowApi['chat']['listMessages']>(async (sessionId) =>
      ok(sessionId === RECENT_SESSION ? [message(RECENT_SESSION, 'restored history')] : [])
    )

    render(<ChatPanel isOpen onToggle={vi.fn()} />)

    await waitFor(() => {
      expect(api().chat.listMessages).toHaveBeenCalledWith(RECENT_SESSION)
    })

    expect(screen.getByText('Recent chat').closest('[role="option"]')).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByText('restored history')).toBeInTheDocument()
  })
})
