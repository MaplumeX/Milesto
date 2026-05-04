import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { err, ok } from '../../shared/result'
import type { ChatMessage, ChatSession } from '../../shared/schemas/chat'
import type { WindowApi } from '../../shared/window-api'
import { ChatPanel } from '../../src/features/chat/ChatPanel'

const RECENT_SESSION = '550e8400-e29b-41d4-a716-4466554400b1'
const OLDER_SESSION = '550e8400-e29b-41d4-a716-4466554400a1'
const NEW_SESSION = '550e8400-e29b-41d4-a716-4466554400c1'

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
    document.body.innerHTML = ''
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

  it('creates a new session and sends the first message when no sessions exist', async () => {
    api().settings.getAiConfig = vi.fn<WindowApi['settings']['getAiConfig']>(async () =>
      ok({ baseUrl: '', apiKey: '', model: '', enabled: true })
    )
    api().chat.listSessions = vi.fn<WindowApi['chat']['listSessions']>(async () => ok([]))
    api().chat.createSession = vi.fn<WindowApi['chat']['createSession']>(async () =>
      ok(session(NEW_SESSION, 'chat.newSessionDefault', '2026-01-01T00:00:00.000Z'))
    )
    api().chat.send = vi.fn<WindowApi['chat']['send']>(async () => ok({ messageId: 'run-1' }))
    api().chat.listMessages = vi.fn<WindowApi['chat']['listMessages']>(async () => ok([]))

    render(<ChatPanel isOpen onToggle={vi.fn()} />)

    const input = await screen.findByRole('textbox')
    await userEvent.type(input, 'hello ai')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(api().chat.createSession).toHaveBeenCalledWith('chat.newSessionDefault')
    })
    await waitFor(() => {
      expect(api().chat.send).toHaveBeenCalledWith(NEW_SESSION, 'hello ai')
    })

    expect(screen.getByText('chat.newSessionDefault')).toBeInTheDocument()
  })

  it('can send after deleting the last session (returns to zero state)', async () => {
    api().settings.getAiConfig = vi.fn<WindowApi['settings']['getAiConfig']>(async () =>
      ok({ baseUrl: '', apiKey: '', model: '', enabled: true })
    )
    api().chat.listSessions = vi.fn<WindowApi['chat']['listSessions']>(async () =>
      ok([session(RECENT_SESSION, 'Only chat', '2026-01-03T00:00:00.000Z')])
    )
    api().chat.listMessages = vi.fn<WindowApi['chat']['listMessages']>(async () =>
      ok([message(RECENT_SESSION, 'old message')])
    )
    api().chat.deleteSession = vi.fn<WindowApi['chat']['deleteSession']>(async () =>
      ok({ deleted: true })
    )
    api().chat.createSession = vi.fn<WindowApi['chat']['createSession']>(async () =>
      ok(session(NEW_SESSION, 'chat.newSessionDefault', '2026-01-01T00:00:00.000Z'))
    )
    api().chat.send = vi.fn<WindowApi['chat']['send']>(async () => ok({ messageId: 'run-2' }))

    render(<ChatPanel isOpen onToggle={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Only chat')).toBeInTheDocument()
    })

    // Delete the only session
    const deleteBtns = screen.getAllByLabelText('common.delete')
    await userEvent.click(deleteBtns[0]!)

    await waitFor(() => {
      expect(screen.queryByText('Only chat')).not.toBeInTheDocument()
    })

    // Send a new message in zero-session state
    const input = screen.getByPlaceholderText('chat.placeholder')
    await userEvent.type(input, 'new start')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(api().chat.createSession).toHaveBeenCalledWith('chat.newSessionDefault')
    })
    await waitFor(() => {
      expect(api().chat.send).toHaveBeenCalledWith(NEW_SESSION, 'new start')
    })
  })

  it('rolls back empty session when send fails after auto-creation', async () => {
    api().settings.getAiConfig = vi.fn<WindowApi['settings']['getAiConfig']>(async () =>
      ok({ baseUrl: '', apiKey: '', model: '', enabled: true })
    )
    api().chat.listSessions = vi.fn<WindowApi['chat']['listSessions']>(async () => ok([]))
    api().chat.createSession = vi.fn<WindowApi['chat']['createSession']>(async () =>
      ok(session(NEW_SESSION, 'chat.newSessionDefault', '2026-01-01T00:00:00.000Z'))
    )
    api().chat.send = vi.fn<WindowApi['chat']['send']>(async () =>
      err({ code: 'AI_DISABLED', message: 'AI is disabled' })
    )
    api().chat.listMessages = vi.fn<WindowApi['chat']['listMessages']>(async () => ok([]))
    api().chat.deleteSession = vi.fn<WindowApi['chat']['deleteSession']>(async () =>
      ok({ deleted: true })
    )

    render(<ChatPanel isOpen onToggle={vi.fn()} />)

    const input = await screen.findByRole('textbox')
    await userEvent.type(input, 'hello ai')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(api().chat.deleteSession).toHaveBeenCalledWith(NEW_SESSION)
    })

    expect(screen.queryByText('chat.newSessionDefault')).not.toBeInTheDocument()
    expect(input).toHaveValue('hello ai')
  })

  it('keeps disabled state when AI is not enabled and no sessions exist', async () => {
    api().settings.getAiConfig = vi.fn<WindowApi['settings']['getAiConfig']>(async () =>
      ok({ baseUrl: '', apiKey: '', model: '', enabled: false })
    )
    api().chat.listSessions = vi.fn<WindowApi['chat']['listSessions']>(async () => ok([]))

    render(<ChatPanel isOpen onToggle={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('chat.errorDisabled')).toBeInTheDocument()
    })
  })
})
