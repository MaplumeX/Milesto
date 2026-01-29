import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { nowIso, uuidv7 } from './utils'

import { AreaCreateInputSchema, AreaDeleteInputSchema, AreaSchema, AreaUpdateInputSchema } from '../../../../shared/schemas/area'

export function createAreaActions(db: Database.Database): Record<string, DbActionHandler> {
  return {
    'area.get': (payload) => {
      const parsed = AreaDeleteInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid area.get payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const row = db
        .prepare(
          `SELECT id, title, notes, created_at, updated_at, deleted_at
           FROM areas
           WHERE id = ? AND deleted_at IS NULL
           LIMIT 1`
        )
        .get(parsed.data.id)

      if (!row) {
        return {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Area not found.',
            details: { id: parsed.data.id },
          },
        }
      }

      return { ok: true, data: AreaSchema.parse(row) }
    },

    'area.create': (payload) => {
      const parsed = AreaCreateInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid area.create payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const createdAt = nowIso()
      const id = uuidv7()

      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO areas (id, title, notes, created_at, updated_at, deleted_at)
           VALUES (@id, @title, @notes, @created_at, @updated_at, NULL)`
        ).run({
          id,
          title: parsed.data.title,
          notes: parsed.data.notes ?? '',
          created_at: createdAt,
          updated_at: createdAt,
        })
      })
      tx()

      const area = AreaSchema.parse({
        id,
        title: parsed.data.title,
        notes: parsed.data.notes ?? '',
        created_at: createdAt,
        updated_at: createdAt,
        deleted_at: null,
      })

      return { ok: true, data: area }
    },

    'area.update': (payload) => {
      const parsed = AreaUpdateInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid area.update payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const input = parsed.data
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const exists = db
          .prepare('SELECT id FROM areas WHERE id = ? AND deleted_at IS NULL')
          .get(input.id)
        if (!exists) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Area not found.',
              details: { id: input.id },
            },
          }
        }

        const fields: string[] = []
        const params: Record<string, unknown> = { id: input.id, updated_at: updatedAt }

        if (input.title !== undefined) {
          fields.push('title = @title')
          params.title = input.title
        }
        if (input.notes !== undefined) {
          fields.push('notes = @notes')
          params.notes = input.notes
        }

        if (fields.length === 0) {
          db.prepare('UPDATE areas SET updated_at = @updated_at WHERE id = @id').run(params)
        } else {
          db.prepare(`UPDATE areas SET ${fields.join(', ')}, updated_at = @updated_at WHERE id = @id`).run(
            params
          )
        }

        const row = db
          .prepare(
            `SELECT id, title, notes, created_at, updated_at, deleted_at
             FROM areas WHERE id = ? AND deleted_at IS NULL LIMIT 1`
          )
          .get(input.id)
        return { ok: true as const, data: AreaSchema.parse(row) }
      })

      return tx()
    },

    'area.list': () => {
      const rows = db
        .prepare(
          `SELECT id, title, notes, created_at, updated_at, deleted_at
           FROM areas
           WHERE deleted_at IS NULL
           ORDER BY title COLLATE NOCASE ASC`
        )
        .all()
      const areas = z.array(AreaSchema).parse(rows)
      return { ok: true, data: areas }
    },

    'area.delete': (payload) => {
      const parsed = AreaDeleteInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid area.delete payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const deletedAt = nowIso()

      const tx = db.transaction(() => {
        const res = db
          .prepare(
            `UPDATE areas
             SET deleted_at = @deleted_at, updated_at = @updated_at
             WHERE id = @id AND deleted_at IS NULL`
          )
          .run({ id: parsed.data.id, deleted_at: deletedAt, updated_at: deletedAt })
        if (res.changes === 0) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Area not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        // Soft-delete projects under this area.
        db.prepare(
          `UPDATE projects
           SET deleted_at = @deleted_at, updated_at = @updated_at
           WHERE deleted_at IS NULL AND area_id = @area_id`
        ).run({ area_id: parsed.data.id, deleted_at: deletedAt, updated_at: deletedAt })

        // Soft-delete tasks under this area and tasks under those projects.
        db.prepare(
          `UPDATE tasks
           SET deleted_at = @deleted_at, updated_at = @updated_at
           WHERE deleted_at IS NULL AND (
             area_id = @area_id
             OR project_id IN (
               SELECT id FROM projects WHERE area_id = @area_id
             )
           )`
        ).run({ area_id: parsed.data.id, deleted_at: deletedAt, updated_at: deletedAt })

        return { ok: true as const, data: { deleted: true } }
      })

      return tx()
    },
  }
}
