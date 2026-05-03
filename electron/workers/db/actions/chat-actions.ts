import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { nowIso, uuidv7 } from './utils'

import {
  ChatMessageInsertInputSchema,
  ChatMessageListInputSchema,
  ChatMessageSchema,
  ChatSessionCreateInputSchema,
  ChatSessionIdInputSchema,
  ChatSessionRenameInputSchema,
  ChatSessionSchema,
} from '../../../../shared/schemas/chat'

const ChatSessionListInputSchema = z.object({})

// SQLite stores tool_calls as a JSON-encoded TEXT.
// Helper to (de)serialize for the row<->schema boundary.
type ChatMessageRow = {
  id: unknown
  session_id: unknown
  role: unknown
  content: unknown
  tool_calls: unknown
  tool_call_id: unknown
  created_at: unknown
}

function rowToChatMessage(row: ChatMessageRow) {
  let toolCalls: unknown = null
  if (typeof row.tool_calls === 'string' && row.tool_calls.length > 0) {
    try {
      toolCalls = JSON.parse(row.tool_calls)
    } catch {
      toolCalls = null
    }
  }

  return ChatMessageSchema.parse({
    id: row.id,
    session_id: row.session_id,
    role: row.role,
    content: row.content,
    tool_calls: Array.isArray(toolCalls) ? toolCalls : null,
    tool_call_id: row.tool_call_id ?? null,
    created_at: row.created_at,
  })
}

export function createChatActions(db: Database.Database): Record<string, DbActionHandler> {
  return {
    'chat.listSessions': (payload) => {
      const parsed = ChatSessionListInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid chat.listSessions payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const rows = db
        .prepare(
          `SELECT id, title, created_at, updated_at
           FROM chat_sessions
           ORDER BY updated_at DESC`
        )
        .all()

      const sessions = z.array(ChatSessionSchema).parse(rows)
      return { ok: true, data: sessions }
    },

    'chat.createSession': (payload) => {
      const parsed = ChatSessionCreateInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid chat.createSession payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const id = uuidv7()
      const createdAt = nowIso()
      const title = (parsed.data.title ?? '').trim() || 'New chat'

      db.prepare(
        `INSERT INTO chat_sessions (id, title, created_at, updated_at)
         VALUES (@id, @title, @created_at, @updated_at)`
      ).run({ id, title, created_at: createdAt, updated_at: createdAt })

      const session = ChatSessionSchema.parse({
        id,
        title,
        created_at: createdAt,
        updated_at: createdAt,
      })
      return { ok: true, data: session }
    },

    'chat.renameSession': (payload) => {
      const parsed = ChatSessionRenameInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid chat.renameSession payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const exists = db
          .prepare('SELECT id FROM chat_sessions WHERE id = ?')
          .get(parsed.data.id)
        if (!exists) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Chat session not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        db.prepare(
          `UPDATE chat_sessions
           SET title = @title, updated_at = @updated_at
           WHERE id = @id`
        ).run({
          id: parsed.data.id,
          title: parsed.data.title,
          updated_at: updatedAt,
        })

        const row = db
          .prepare(
            `SELECT id, title, created_at, updated_at
             FROM chat_sessions
             WHERE id = ?
             LIMIT 1`
          )
          .get(parsed.data.id)

        return { ok: true as const, data: ChatSessionSchema.parse(row) }
      })

      return tx()
    },

    'chat.deleteSession': (payload) => {
      const parsed = ChatSessionIdInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid chat.deleteSession payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const tx = db.transaction(() => {
        // Manual cascade: PRAGMA foreign_keys is ON, but we still delete messages
        // explicitly so the row count check on chat_sessions is unambiguous.
        db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(parsed.data.id)
        const res = db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(parsed.data.id)
        if (res.changes === 0) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Chat session not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        return { ok: true as const, data: { deleted: true } }
      })

      return tx()
    },

    'chat.listMessages': (payload) => {
      const parsed = ChatMessageListInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid chat.listMessages payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const sessionExists = db
        .prepare('SELECT id FROM chat_sessions WHERE id = ?')
        .get(parsed.data.session_id)
      if (!sessionExists) {
        return {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Chat session not found.',
            details: { id: parsed.data.session_id },
          },
        }
      }

      const rows = db
        .prepare(
          `SELECT id, session_id, role, content, tool_calls, tool_call_id, created_at
           FROM chat_messages
           WHERE session_id = ?
           ORDER BY created_at ASC, id ASC`
        )
        .all(parsed.data.session_id) as ChatMessageRow[]

      const messages = rows.map(rowToChatMessage)
      return { ok: true, data: messages }
    },

    // PR2 will call this from the agent runtime to persist user/assistant/tool
    // messages. PR1 only exposes the action; no IPC binding yet (intentional).
    'chat.insertMessage': (payload) => {
      const parsed = ChatMessageInsertInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid chat.insertMessage payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const tx = db.transaction(() => {
        const sessionExists = db
          .prepare('SELECT id FROM chat_sessions WHERE id = ?')
          .get(parsed.data.session_id)
        if (!sessionExists) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Chat session not found.',
              details: { id: parsed.data.session_id },
            },
          }
        }

        const id = uuidv7()
        const createdAt = nowIso()
        const toolCalls = parsed.data.tool_calls ?? null
        const toolCallId = parsed.data.tool_call_id ?? null

        db.prepare(
          `INSERT INTO chat_messages (id, session_id, role, content, tool_calls, tool_call_id, created_at)
           VALUES (@id, @session_id, @role, @content, @tool_calls, @tool_call_id, @created_at)`
        ).run({
          id,
          session_id: parsed.data.session_id,
          role: parsed.data.role,
          content: parsed.data.content,
          tool_calls: toolCalls === null ? null : JSON.stringify(toolCalls),
          tool_call_id: toolCallId,
          created_at: createdAt,
        })

        // Bump the session's updated_at so it floats to the top of the list.
        db.prepare(
          `UPDATE chat_sessions SET updated_at = @updated_at WHERE id = @id`
        ).run({ id: parsed.data.session_id, updated_at: createdAt })

        const message = ChatMessageSchema.parse({
          id,
          session_id: parsed.data.session_id,
          role: parsed.data.role,
          content: parsed.data.content,
          tool_calls: toolCalls,
          tool_call_id: toolCallId,
          created_at: createdAt,
        })
        return { ok: true as const, data: message }
      })

      return tx()
    },
  }
}
