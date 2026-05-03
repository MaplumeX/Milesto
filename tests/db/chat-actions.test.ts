import { afterEach, describe, expect, it } from 'vitest'

import { createChatActions } from '../../electron/workers/db/actions/chat-actions'
import { createTestDb } from './db-test-helper'

describe('chat actions', () => {
  let cleanupDb: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (!cleanupDb) return
    await cleanupDb()
    cleanupDb = null
  })

  async function setup() {
    const { db, cleanup } = await createTestDb()
    cleanupDb = cleanup
    return { db, actions: createChatActions(db) }
  }

  it('creates a session with the default title when none is provided', async () => {
    const { actions } = await setup()

    const res = actions['chat.createSession']({})
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const session = res.data as {
      id: string
      title: string
      created_at: string
      updated_at: string
    }
    expect(session.title).toBe('New chat')
    expect(typeof session.id).toBe('string')
    expect(session.id.length).toBeGreaterThan(0)
    expect(session.created_at).toEqual(session.updated_at)
  })

  it('creates a session with a trimmed custom title', async () => {
    const { actions } = await setup()

    const res = actions['chat.createSession']({ title: '  My session  ' })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const session = res.data as { title: string }
    expect(session.title).toBe('My session')
  })

  it('lists sessions ordered by updated_at descending', async () => {
    const { actions } = await setup()

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const a = actions['chat.createSession']({ title: 'A' })
    await sleep(2)
    const b = actions['chat.createSession']({ title: 'B' })
    await sleep(2)
    const c = actions['chat.createSession']({ title: 'C' })
    expect(a.ok && b.ok && c.ok).toBe(true)
    if (!a.ok || !b.ok || !c.ok) return

    await sleep(2)
    // Bump session B's updated_at by inserting a message.
    const insertB = actions['chat.insertMessage']({
      session_id: (b.data as { id: string }).id,
      role: 'user',
      content: 'hello B',
    })
    expect(insertB.ok).toBe(true)

    const listRes = actions['chat.listSessions']({})
    expect(listRes.ok).toBe(true)
    if (!listRes.ok) return

    const sessions = listRes.data as Array<{ id: string; title: string }>
    expect(sessions.length).toBe(3)
    // After inserting into B, B should float to the top.
    expect(sessions[0]!.title).toBe('B')
  })

  it('renames a session and bumps updated_at', async () => {
    const { actions } = await setup()

    const created = actions['chat.createSession']({ title: 'Old' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const sessionId = (created.data as { id: string }).id

    const renamed = actions['chat.renameSession']({ id: sessionId, title: 'New' })
    expect(renamed.ok).toBe(true)
    if (!renamed.ok) return

    const session = renamed.data as { title: string; created_at: string; updated_at: string }
    expect(session.title).toBe('New')
  })

  it('returns NOT_FOUND when renaming a non-existent session', async () => {
    const { actions } = await setup()

    const res = actions['chat.renameSession']({
      id: '01999999-9999-7999-9999-999999999999',
      title: 'whatever',
    })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('NOT_FOUND')
  })

  it('deletes a session and cascades its messages', async () => {
    const { db, actions } = await setup()

    const created = actions['chat.createSession']({ title: 'Doomed' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const sessionId = (created.data as { id: string }).id

    const insert1 = actions['chat.insertMessage']({
      session_id: sessionId,
      role: 'user',
      content: 'hello',
    })
    const insert2 = actions['chat.insertMessage']({
      session_id: sessionId,
      role: 'assistant',
      content: 'hi back',
    })
    expect(insert1.ok && insert2.ok).toBe(true)

    const before = db
      .prepare('SELECT COUNT(*) as c FROM chat_messages WHERE session_id = ?')
      .get(sessionId) as { c: number }
    expect(before.c).toBe(2)

    const deleted = actions['chat.deleteSession']({ id: sessionId })
    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return
    expect(deleted.data).toEqual({ deleted: true })

    const after = db
      .prepare('SELECT COUNT(*) as c FROM chat_messages WHERE session_id = ?')
      .get(sessionId) as { c: number }
    expect(after.c).toBe(0)

    const sessionRow = db
      .prepare('SELECT id FROM chat_sessions WHERE id = ?')
      .get(sessionId)
    expect(sessionRow).toBeUndefined()
  })

  it('returns NOT_FOUND when deleting a non-existent session', async () => {
    const { actions } = await setup()

    const res = actions['chat.deleteSession']({
      id: '01999999-9999-7999-9999-999999999999',
    })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('NOT_FOUND')
  })

  it('lists messages for a session in chronological order', async () => {
    const { actions } = await setup()

    const created = actions['chat.createSession']({ title: 'Conversation' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const sessionId = (created.data as { id: string }).id

    // Inserts share a single millisecond easily and uuidv7 is not strictly monotonic
    // within a ms in this codebase. Space inserts apart so created_at orders them.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const m1 = actions['chat.insertMessage']({
      session_id: sessionId,
      role: 'user',
      content: 'first',
    })
    await sleep(2)
    const m2 = actions['chat.insertMessage']({
      session_id: sessionId,
      role: 'assistant',
      content: 'second',
      tool_calls: [{ name: 'demo', args: { foo: 'bar' } }],
    })
    await sleep(2)
    const m3 = actions['chat.insertMessage']({
      session_id: sessionId,
      role: 'tool',
      content: 'third',
      tool_call_id: 'tool-1',
    })
    expect(m1.ok && m2.ok && m3.ok).toBe(true)

    const list = actions['chat.listMessages']({ session_id: sessionId })
    expect(list.ok).toBe(true)
    if (!list.ok) return

    const messages = list.data as Array<{
      role: string
      content: string
      tool_calls: unknown
      tool_call_id: string | null
    }>
    expect(messages.length).toBe(3)
    expect(messages.map((m) => m.content)).toEqual(['first', 'second', 'third'])
    expect(messages[0]!.tool_calls).toBeNull()
    expect(messages[1]!.tool_calls).toEqual([{ name: 'demo', args: { foo: 'bar' } }])
    expect(messages[2]!.tool_call_id).toBe('tool-1')
  })

  it('returns NOT_FOUND when listing messages for a missing session', async () => {
    const { actions } = await setup()

    const res = actions['chat.listMessages']({
      session_id: '01999999-9999-7999-9999-999999999999',
    })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('NOT_FOUND')
  })

  it('rejects invalid payloads with VALIDATION_FAILED', async () => {
    const { actions } = await setup()

    const renameRes = actions['chat.renameSession']({ id: 'some-id', title: '' })
    expect(renameRes.ok).toBe(false)
    if (renameRes.ok) return
    expect(renameRes.error.code).toBe('VALIDATION_FAILED')

    // Missing required `role` field — fails zod parse before any DB lookup.
    const insertRes = actions['chat.insertMessage']({
      session_id: 'whatever',
      content: 'hi',
    })
    expect(insertRes.ok).toBe(false)
    if (insertRes.ok) return
    expect(insertRes.error.code).toBe('VALIDATION_FAILED')
  })
})
