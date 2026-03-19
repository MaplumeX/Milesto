import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { createLocalSyncRecorder, replaceTaskTags } from './sync-support'
import { nowIso, uuidv7 } from './utils'

import { TagCreateInputSchema, TagDeleteInputSchema, TagSchema, TagUpdateInputSchema, TaskSetTagsInputSchema } from '../../../../shared/schemas/tag'
import { TaskSchema } from '../../../../shared/schemas/task'
import type { EntityScope } from '../../../../shared/schemas/common'

function normalizeEntityScope(scope?: EntityScope): EntityScope {
  return scope === 'trash' ? 'trash' : 'active'
}

function taskScopeWhere(scope: EntityScope): string {
  return scope === 'trash' ? 'deleted_at IS NOT NULL AND purged_at IS NULL' : 'deleted_at IS NULL'
}

export function createTagActions(db: Database.Database): Record<string, DbActionHandler> {
  return {
    'tag.create': (payload) => {
      const parsed = TagCreateInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid tag.create payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const createdAt = nowIso()
      const id = uuidv7()

      const tx = db.transaction(() => {
        const sync = createLocalSyncRecorder(db, createdAt)
        db.prepare(
          `INSERT INTO tags (id, title, color, created_at, updated_at, deleted_at)
           VALUES (@id, @title, @color, @created_at, @updated_at, NULL)`
        ).run({
          id,
          title: parsed.data.title,
          color: parsed.data.color ?? null,
          created_at: createdAt,
          updated_at: createdAt,
        })

        sync.recordEntity(
          'tag',
          TagSchema.parse({
            id,
            title: parsed.data.title,
            color: parsed.data.color ?? null,
            created_at: createdAt,
            updated_at: createdAt,
            deleted_at: null,
          }),
          ['title', 'color', 'created_at', 'updated_at', 'deleted_at']
        )
        sync.finalize()
      })
      tx()

      const tag = TagSchema.parse({
        id,
        title: parsed.data.title,
        color: parsed.data.color ?? null,
        created_at: createdAt,
        updated_at: createdAt,
        deleted_at: null,
      })

      return { ok: true, data: tag }
    },

    'tag.update': (payload) => {
      const parsed = TagUpdateInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid tag.update payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const input = parsed.data
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const sync = createLocalSyncRecorder(db, updatedAt)
        const exists = db.prepare('SELECT id FROM tags WHERE id = ? AND deleted_at IS NULL').get(input.id)
        if (!exists) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Tag not found.',
              details: { id: input.id },
            },
          }
        }

        const fields: string[] = []
        const changedFields: string[] = []
        const params: Record<string, unknown> = { id: input.id, updated_at: updatedAt }

        if (input.title !== undefined) {
          fields.push('title = @title')
          changedFields.push('title')
          params.title = input.title
        }
        if (input.color !== undefined) {
          fields.push('color = @color')
          changedFields.push('color')
          params.color = input.color
        }

        if (fields.length === 0) {
          db.prepare('UPDATE tags SET updated_at = @updated_at WHERE id = @id').run(params)
        } else {
          db.prepare(`UPDATE tags SET ${fields.join(', ')}, updated_at = @updated_at WHERE id = @id`).run(
            params
          )
        }

        const row = db
          .prepare(
            `SELECT id, title, color, created_at, updated_at, deleted_at
             FROM tags WHERE id = ? AND deleted_at IS NULL LIMIT 1`
          )
          .get(input.id)
        const tag = TagSchema.parse(row)
        sync.recordEntity('tag', tag, [...changedFields, 'updated_at'])
        sync.finalize()
        return { ok: true as const, data: tag }
      })

      return tx()
    },

    'tag.list': () => {
      const rows = db
        .prepare(
          `SELECT id, title, color, created_at, updated_at, deleted_at
           FROM tags
           WHERE deleted_at IS NULL
           ORDER BY title COLLATE NOCASE ASC`
        )
        .all()
      const tags = z.array(TagSchema).parse(rows)
      return { ok: true, data: tags }
    },

    'tag.delete': (payload) => {
      const parsed = TagDeleteInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid tag.delete payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const deletedAt = nowIso()

      const tx = db.transaction(() => {
        const sync = createLocalSyncRecorder(db, deletedAt)
        const res = db
          .prepare(
            `UPDATE tags
             SET deleted_at = @deleted_at, updated_at = @updated_at
             WHERE id = @id AND deleted_at IS NULL`
          )
          .run({ id: parsed.data.id, deleted_at: deletedAt, updated_at: deletedAt })
        if (res.changes === 0) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Tag not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        const row = db
          .prepare(
            `SELECT id, title, color, created_at, updated_at, deleted_at
             FROM tags
             WHERE id = ?
             LIMIT 1`
          )
          .get(parsed.data.id)
        const tag = TagSchema.parse(row)
        sync.recordEntity('tag', tag, ['deleted_at', 'updated_at'])
        sync.finalize()

        return { ok: true as const, data: { deleted: true } }
      })

      return tx()
    },

    'task.setTags': (payload) => {
      const parsed = TaskSetTagsInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.setTags payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const scope = normalizeEntityScope(parsed.data.scope)
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const sync = createLocalSyncRecorder(db, updatedAt)
        const exists = db
          .prepare(`SELECT id FROM tasks WHERE id = ? AND ${taskScopeWhere(scope)}`)
          .get(parsed.data.task_id)
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

        replaceTaskTags(db, sync, parsed.data.task_id, parsed.data.tag_ids, updatedAt)

        db.prepare('UPDATE tasks SET updated_at = @updated_at WHERE id = @id').run({
          id: parsed.data.task_id,
          updated_at: updatedAt,
        })

        const row = db
          .prepare(
            `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id, scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
             FROM tasks
             WHERE id = ?
             LIMIT 1`
          )
          .get(parsed.data.task_id)
        sync.recordEntity('task', TaskSchema.parse(row), ['updated_at'])
        sync.finalize()

        return { ok: true as const, data: { updated: true } }
      })

      return tx()
    },
  }
}
