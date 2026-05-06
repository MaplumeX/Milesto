import { afterEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { initDb } from '../../electron/workers/db/db-bootstrap'
import { createChatActions } from '../../electron/workers/db/actions/chat-actions'
import { buildDbHandlers } from '../../electron/workers/db/db-handlers'
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

  async function setupHandlers() {
    const { db, cleanup } = await createTestDb()
    cleanupDb = cleanup
    return { db, actions: buildDbHandlers(db) }
  }

  it('keeps sessions and messages after reopening the same database file', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'milesto-chat-persistence-test-'))
    const dbPath = path.join(dir, 'test.sqlite3')
    let db: Database.Database | null = initDb(dbPath)
    cleanupDb = async () => {
      if (db?.open) db.close()
      await rm(dir, { recursive: true, force: true })
    }

    let actions = createChatActions(db)
    const created = actions['chat.createSession']({ title: 'Restarted chat' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const sessionId = (created.data as { id: string }).id

    const inserted = actions['chat.insertMessage']({
      session_id: sessionId,
      role: 'user',
      content: 'still here',
    })
    expect(inserted.ok).toBe(true)

    db.close()
    db = initDb(dbPath)
    actions = createChatActions(db)

    const sessions = actions['chat.listSessions']({})
    expect(sessions.ok).toBe(true)
    if (!sessions.ok) return
    expect((sessions.data as Array<{ id: string; title: string }>)).toEqual([
      expect.objectContaining({ id: sessionId, title: 'Restarted chat' }),
    ])

    const messages = actions['chat.listMessages']({ session_id: sessionId })
    expect(messages.ok).toBe(true)
    if (!messages.ok) return
    expect((messages.data as Array<{ content: string }>).map((m) => m.content)).toEqual(['still here'])
  })

  it('repairs missing chat tables when user_version is already at least 12', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'milesto-chat-schema-test-'))
    const dbPath = path.join(dir, 'test.sqlite3')
    let db: Database.Database | null = initDb(dbPath)
    cleanupDb = async () => {
      if (db?.open) db.close()
      await rm(dir, { recursive: true, force: true })
    }

    db.exec(`
      DROP TABLE ai_chat_effect_rows;
      DROP TABLE ai_chat_effect_batches;
      DROP TABLE chat_messages;
      DROP TABLE chat_sessions;
      PRAGMA user_version = 12;
    `)
    db.close()

    db = initDb(dbPath)

    const chatSessionsTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chat_sessions'")
      .get()
    const chatMessagesTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chat_messages'")
      .get()
    const sessionIndex = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_chat_sessions_updated'")
      .get()
    const messageIndex = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_chat_messages_session_created'")
      .get()

    expect(chatSessionsTable).toBeTruthy()
    expect(chatMessagesTable).toBeTruthy()
    expect(sessionIndex).toBeTruthy()
    expect(messageIndex).toBeTruthy()

    const actions = createChatActions(db)
    const created = actions['chat.createSession']({ title: 'Repaired' })
    expect(created.ok).toBe(true)
  })

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

  it('rolls back a session-scoped message tail and returns the restored prompt', async () => {
    const { actions } = await setup()
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const a = actions['chat.createSession']({ title: 'A' })
    const b = actions['chat.createSession']({ title: 'B' })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    const sessionA = (a.data as { id: string }).id
    const sessionB = (b.data as { id: string }).id

    const a1 = actions['chat.insertMessage']({ session_id: sessionA, role: 'user', content: 'keep' })
    await sleep(2)
    const a2 = actions['chat.insertMessage']({ session_id: sessionA, role: 'assistant', content: 'kept answer' })
    await sleep(2)
    const a3 = actions['chat.insertMessage']({ session_id: sessionA, role: 'user', content: 'revise me' })
    await sleep(2)
    const a4 = actions['chat.insertMessage']({ session_id: sessionA, role: 'assistant', content: 'remove me' })
    const b1 = actions['chat.insertMessage']({ session_id: sessionB, role: 'user', content: 'other session' })
    expect(a1.ok && a2.ok && a3.ok && a4.ok && b1.ok).toBe(true)
    if (!a3.ok) return

    const rollback = actions['chat.rollbackToMessage']({
      session_id: sessionA,
      message_id: (a3.data as { id: string }).id,
    })
    expect(rollback.ok).toBe(true)
    if (!rollback.ok) return
    expect(rollback.data).toEqual(expect.objectContaining({
      restored_prompt: 'revise me',
      deleted_message_count: 2,
      conflict_count: 0,
    }))

    const listA = actions['chat.listMessages']({ session_id: sessionA })
    const listB = actions['chat.listMessages']({ session_id: sessionB })
    expect(listA.ok && listB.ok).toBe(true)
    if (!listA.ok || !listB.ok) return
    expect((listA.data as Array<{ content: string }>).map((m) => m.content)).toEqual(['keep', 'kept answer'])
    expect((listB.data as Array<{ content: string }>).map((m) => m.content)).toEqual(['other session'])
  })

  it('rolls back same-timestamp messages by insertion order instead of id order', async () => {
    const { actions, db } = await setup()

    const created = actions['chat.createSession']({ title: 'Same timestamp' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const sessionId = (created.data as { id: string }).id
    const sameTimestamp = '2026-01-01T00:00:00.000Z'

    db.prepare(
      `INSERT INTO chat_messages (id, session_id, role, content, tool_calls, tool_call_id, created_at)
       VALUES (?, ?, ?, ?, NULL, NULL, ?)`
    ).run('01999999-9999-7999-9000-000000000000', sessionId, 'user', 'keep', sameTimestamp)
    db.prepare(
      `INSERT INTO chat_messages (id, session_id, role, content, tool_calls, tool_call_id, created_at)
       VALUES (?, ?, ?, ?, NULL, NULL, ?)`
    ).run('01999999-9999-7999-ffff-000000000000', sessionId, 'user', 'revise me', sameTimestamp)
    db.prepare(
      `INSERT INTO chat_messages (id, session_id, role, content, tool_calls, tool_call_id, created_at)
       VALUES (?, ?, ?, ?, NULL, NULL, ?)`
    ).run('01999999-9999-7999-1000-000000000000', sessionId, 'assistant', 'remove me', sameTimestamp)

    const rollback = actions['chat.rollbackToMessage']({
      session_id: sessionId,
      message_id: '01999999-9999-7999-ffff-000000000000',
    })
    expect(rollback.ok).toBe(true)
    if (!rollback.ok) return
    expect(rollback.data).toEqual(expect.objectContaining({
      restored_prompt: 'revise me',
      deleted_message_count: 2,
    }))

    const list = actions['chat.listMessages']({ session_id: sessionId })
    expect(list.ok).toBe(true)
    if (!list.ok) return
    expect((list.data as Array<{ content: string }>).map((m) => m.content)).toEqual(['keep'])
  })

  it('returns typed errors for missing rollback session and message', async () => {
    const { actions } = await setup()
    const missingSession = actions['chat.rollbackToMessage']({
      session_id: '01999999-9999-7999-9999-999999999991',
      message_id: '01999999-9999-7999-9999-999999999992',
    })
    expect(missingSession.ok).toBe(false)
    if (missingSession.ok) return
    expect(missingSession.error.code).toBe('NOT_FOUND')

    const created = actions['chat.createSession']({ title: 'A' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const missingMessage = actions['chat.rollbackToMessage']({
      session_id: (created.data as { id: string }).id,
      message_id: '01999999-9999-7999-9999-999999999993',
    })
    expect(missingMessage.ok).toBe(false)
    if (missingMessage.ok) return
    expect(missingMessage.error.code).toBe('NOT_FOUND')
  })

  it('journals AI-created task effects and soft-deletes them on chat rollback', async () => {
    const { db, actions } = await setupHandlers()

    const created = actions['chat.createSession']({ title: 'AI' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const sessionId = (created.data as { id: string }).id
    const user = actions['chat.insertMessage']({ session_id: sessionId, role: 'user', content: 'create a task' })
    expect(user.ok).toBe(true)
    if (!user.ok) return
    const userMessageId = (user.data as { id: string }).id

    const mutation = actions['aiChat.runMutation']({
      context: {
        session_id: sessionId,
        user_message_id: userMessageId,
        run_message_id: 'run-1',
        tool_name: 'task_create',
      },
      action: 'task.create',
      payload: { title: 'AI task', notes: '', is_inbox: true },
    })
    expect(mutation.ok).toBe(true)
    if (!mutation.ok) return
    const taskId = (mutation.data as { id: string }).id

    const journalCount = db
      .prepare('SELECT COUNT(*) AS c FROM ai_chat_effect_rows')
      .get() as { c: number }
    expect(journalCount.c).toBeGreaterThan(0)

    const rollback = actions['chat.rollbackToMessage']({ session_id: sessionId, message_id: userMessageId })
    expect(rollback.ok).toBe(true)
    if (!rollback.ok) return
    expect(rollback.data).toEqual(expect.objectContaining({
      reverted_effect_count: 1,
      conflict_count: 0,
    }))

    const taskRow = db
      .prepare('SELECT deleted_at FROM tasks WHERE id = ?')
      .get(taskId) as { deleted_at: string | null }
    expect(taskRow.deleted_at).toEqual(expect.any(String))
  })

  it('partially rolls back non-conflicting AI effects and reports later-edit conflicts', async () => {
    const { db, actions } = await setupHandlers()

    const created = actions['chat.createSession']({ title: 'AI' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const sessionId = (created.data as { id: string }).id
    const user = actions['chat.insertMessage']({ session_id: sessionId, role: 'user', content: 'create tasks' })
    expect(user.ok).toBe(true)
    if (!user.ok) return
    const userMessageId = (user.data as { id: string }).id

    const createOne = actions['aiChat.runMutation']({
      context: { session_id: sessionId, user_message_id: userMessageId, run_message_id: 'run-1', tool_name: 'task_create' },
      action: 'task.create',
      payload: { title: 'Rollback me', notes: '', is_inbox: true },
    })
    const createTwo = actions['aiChat.runMutation']({
      context: { session_id: sessionId, user_message_id: userMessageId, run_message_id: 'run-1', tool_name: 'task_create' },
      action: 'task.create',
      payload: { title: 'Keep my edit', notes: '', is_inbox: true },
    })
    expect(createOne.ok && createTwo.ok).toBe(true)
    if (!createOne.ok || !createTwo.ok) return
    const rollbackTaskId = (createOne.data as { id: string }).id
    const conflictTaskId = (createTwo.data as { id: string }).id

    db.prepare(
      `UPDATE tasks
       SET title = 'Manual edit', updated_at = '2999-01-01T00:00:00.000Z'
       WHERE id = ?`
    ).run(conflictTaskId)

    const rollback = actions['chat.rollbackToMessage']({ session_id: sessionId, message_id: userMessageId })
    expect(rollback.ok).toBe(true)
    if (!rollback.ok) return
    expect(rollback.data).toEqual(expect.objectContaining({
      reverted_effect_count: 1,
      conflict_count: 1,
    }))

    const reverted = db
      .prepare('SELECT deleted_at FROM tasks WHERE id = ?')
      .get(rollbackTaskId) as { deleted_at: string | null }
    const conflicted = db
      .prepare('SELECT title, deleted_at FROM tasks WHERE id = ?')
      .get(conflictTaskId) as { title: string; deleted_at: string | null }
    expect(reverted.deleted_at).toEqual(expect.any(String))
    expect(conflicted).toEqual({ title: 'Manual edit', deleted_at: null })
  })

  it('rolls back multiple AI effects on the same row without treating rollback timestamps as conflicts', async () => {
    const { db, actions } = await setupHandlers()

    const created = actions['chat.createSession']({ title: 'AI' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const sessionId = (created.data as { id: string }).id
    const user = actions['chat.insertMessage']({ session_id: sessionId, role: 'user', content: 'create then edit' })
    expect(user.ok).toBe(true)
    if (!user.ok) return
    const userMessageId = (user.data as { id: string }).id

    const create = actions['aiChat.runMutation']({
      context: { session_id: sessionId, user_message_id: userMessageId, run_message_id: 'run-1', tool_name: 'task_create' },
      action: 'task.create',
      payload: { title: 'First title', notes: '', is_inbox: true },
    })
    expect(create.ok).toBe(true)
    if (!create.ok) return
    const taskId = (create.data as { id: string }).id

    const update = actions['aiChat.runMutation']({
      context: { session_id: sessionId, user_message_id: userMessageId, run_message_id: 'run-1', tool_name: 'task_update' },
      action: 'task.update',
      payload: { id: taskId, title: 'Second title' },
    })
    expect(update.ok).toBe(true)

    const rollback = actions['chat.rollbackToMessage']({ session_id: sessionId, message_id: userMessageId })
    expect(rollback.ok).toBe(true)
    if (!rollback.ok) return
    expect(rollback.data).toEqual(expect.objectContaining({
      reverted_effect_count: 2,
      conflict_count: 0,
    }))

    const taskRow = db
      .prepare('SELECT title, deleted_at FROM tasks WHERE id = ?')
      .get(taskId) as { title: string; deleted_at: string | null }
    expect(taskRow.title).toBe('First title')
    expect(taskRow.deleted_at).toEqual(expect.any(String))
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
