import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { nowIso, uuidv7 } from './utils'

import {
  ChecklistItemCreateInputSchema,
  ChecklistItemDeleteInputSchema,
  ChecklistItemSchema,
  ChecklistItemUpdateInputSchema,
} from '../../../../shared/schemas/checklist'

const TaskIdSchema = z.object({ task_id: z.string().min(1) })

const ChecklistDbRowSchema = ChecklistItemSchema.extend({
  done: z.preprocess((v) => Boolean(v), z.boolean()),
})

export function createChecklistActions(db: Database.Database): Record<string, DbActionHandler> {
  return {
    'checklist.listByTask': (payload) => {
      const parsed = TaskIdSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid checklist.listByTask payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const rows = db
        .prepare(
          `SELECT id, task_id, title, done, position, created_at, updated_at, deleted_at
           FROM task_checklist_items
           WHERE deleted_at IS NULL AND task_id = @task_id
           ORDER BY position ASC`
        )
        .all({ task_id: parsed.data.task_id }) as unknown[]

      const items = z.array(ChecklistDbRowSchema).parse(rows)
      return { ok: true, data: items }
    },

    'checklist.create': (payload) => {
      const parsed = ChecklistItemCreateInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid checklist.create payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const createdAt = nowIso()
      const id = uuidv7()

      const tx = db.transaction(() => {
        const exists = db.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').get(parsed.data.task_id)
        if (!exists) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Task not found.',
              details: { id: parsed.data.task_id },
            },
          }
        }

        const maxPos = db
          .prepare(
            `SELECT COALESCE(MAX(position), 0) AS max_pos
             FROM task_checklist_items
             WHERE task_id = ? AND deleted_at IS NULL`
          )
          .get(parsed.data.task_id) as { max_pos: number }
        const position = (maxPos?.max_pos ?? 0) + 1000

        db.prepare(
          `INSERT INTO task_checklist_items (
             id, task_id, title, done, position, created_at, updated_at, deleted_at
           ) VALUES (
             @id, @task_id, @title, 0, @position, @created_at, @updated_at, NULL
           )`
        ).run({
          id,
          task_id: parsed.data.task_id,
          title: parsed.data.title,
          position,
          created_at: createdAt,
          updated_at: createdAt,
        })

        db.prepare('UPDATE tasks SET updated_at = @updated_at WHERE id = @id').run({
          id: parsed.data.task_id,
          updated_at: createdAt,
        })

        const row = db
          .prepare(
            `SELECT id, task_id, title, done, position, created_at, updated_at, deleted_at
             FROM task_checklist_items WHERE id = ? LIMIT 1`
          )
          .get(id) as unknown
        const item = ChecklistDbRowSchema.parse(row)
        return { ok: true as const, data: item }
      })

      return tx()
    },

    'checklist.update': (payload) => {
      const parsed = ChecklistItemUpdateInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid checklist.update payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const item = db
          .prepare('SELECT id, task_id FROM task_checklist_items WHERE id = ? AND deleted_at IS NULL')
          .get(parsed.data.id) as { id: string; task_id: string } | undefined
        if (!item) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Checklist item not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        const fields: string[] = []
        const params: Record<string, unknown> = { id: parsed.data.id, updated_at: updatedAt }

        if (parsed.data.title !== undefined) {
          fields.push('title = @title')
          params.title = parsed.data.title
        }
        if (parsed.data.done !== undefined) {
          fields.push('done = @done')
          params.done = parsed.data.done ? 1 : 0
        }

        if (fields.length === 0) {
          db.prepare('UPDATE task_checklist_items SET updated_at = @updated_at WHERE id = @id').run(params)
        } else {
          db.prepare(
            `UPDATE task_checklist_items SET ${fields.join(', ')}, updated_at = @updated_at WHERE id = @id`
          ).run(params)
        }

        db.prepare('UPDATE tasks SET updated_at = @updated_at WHERE id = @id').run({
          id: item.task_id,
          updated_at: updatedAt,
        })

        const row = db
          .prepare(
            `SELECT id, task_id, title, done, position, created_at, updated_at, deleted_at
             FROM task_checklist_items WHERE id = ? LIMIT 1`
          )
          .get(parsed.data.id) as unknown
        const updated = ChecklistDbRowSchema.parse(row)
        return { ok: true as const, data: updated }
      })

      return tx()
    },

    'checklist.delete': (payload) => {
      const parsed = ChecklistItemDeleteInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid checklist.delete payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const deletedAt = nowIso()

      const tx = db.transaction(() => {
        const item = db
          .prepare('SELECT id, task_id FROM task_checklist_items WHERE id = ? AND deleted_at IS NULL')
          .get(parsed.data.id) as { id: string; task_id: string } | undefined
        if (!item) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Checklist item not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        db.prepare(
          `UPDATE task_checklist_items
           SET deleted_at = @deleted_at, updated_at = @updated_at
           WHERE id = @id AND deleted_at IS NULL`
        ).run({ id: parsed.data.id, deleted_at: deletedAt, updated_at: deletedAt })

        db.prepare('UPDATE tasks SET updated_at = @updated_at WHERE id = @id').run({
          id: item.task_id,
          updated_at: deletedAt,
        })

        return { ok: true as const, data: { deleted: true } }
      })

      return tx()
    },
  }
}
