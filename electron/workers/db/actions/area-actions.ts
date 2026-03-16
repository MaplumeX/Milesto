import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { createLocalSyncRecorder, replaceAreaTags } from './sync-support'
import { nowIso, uuidv7 } from './utils'

import { AreaCreateInputSchema, AreaDeleteInputSchema, AreaSchema, AreaUpdateInputSchema } from '../../../../shared/schemas/area'

import { AreaDetailSchema } from '../../../../shared/schemas/area-detail'
import { AreaSetTagsInputSchema } from '../../../../shared/schemas/area-set-tags'
import { ProjectSchema, ProjectSectionSchema } from '../../../../shared/schemas/project'
import { TagSchema } from '../../../../shared/schemas/tag'
import { TaskSchema } from '../../../../shared/schemas/task'

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

    'area.getDetail': (payload) => {
      const parsed = AreaDeleteInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid area.getDetail payload.',
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

      const area = AreaSchema.parse(row)

      const tagRows = db
        .prepare(
          `SELECT t.id, t.title, t.color, t.created_at, t.updated_at, t.deleted_at
           FROM area_tags at
           JOIN tags t ON t.id = at.tag_id AND t.deleted_at IS NULL
           WHERE at.area_id = ? AND at.deleted_at IS NULL
           ORDER BY at.position ASC`
        )
        .all(parsed.data.id)

      const tags = z.array(TagSchema).parse(tagRows)

      return {
        ok: true,
        data: AreaDetailSchema.parse({ area, tags }),
      }
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
        const sync = createLocalSyncRecorder(db, createdAt)
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

        sync.recordEntity(
          'area',
          AreaSchema.parse({
            id,
            title: parsed.data.title,
            notes: parsed.data.notes ?? '',
            position: null,
            created_at: createdAt,
            updated_at: createdAt,
            deleted_at: null,
          }),
          ['title', 'notes', 'position', 'created_at', 'updated_at', 'deleted_at']
        )
        sync.finalize()
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

    'area.setTags': (payload) => {
      const parsed = AreaSetTagsInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid area.setTags payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const sync = createLocalSyncRecorder(db, updatedAt)
        const exists = db.prepare('SELECT id FROM areas WHERE id = ? AND deleted_at IS NULL').get(parsed.data.area_id)
        if (!exists) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Area not found.',
              details: { id: parsed.data.area_id },
            },
          }
        }

        replaceAreaTags(db, sync, parsed.data.area_id, parsed.data.tag_ids, updatedAt)

        db.prepare('UPDATE areas SET updated_at = @updated_at WHERE id = @id').run({
          id: parsed.data.area_id,
          updated_at: updatedAt,
        })

        const row = db
          .prepare(
            `SELECT id, title, notes, position, created_at, updated_at, deleted_at
             FROM areas
             WHERE id = ?
             LIMIT 1`
          )
          .get(parsed.data.area_id)
        sync.recordEntity('area', AreaSchema.parse(row), ['updated_at'])
        sync.finalize()

        return { ok: true as const, data: { updated: true } }
      })

      return tx()
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
        const sync = createLocalSyncRecorder(db, updatedAt)
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
        const changedFields: string[] = []
        const params: Record<string, unknown> = { id: input.id, updated_at: updatedAt }

        if (input.title !== undefined) {
          fields.push('title = @title')
          changedFields.push('title')
          params.title = input.title
        }
        if (input.notes !== undefined) {
          fields.push('notes = @notes')
          changedFields.push('notes')
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
            `SELECT id, title, notes, position, created_at, updated_at, deleted_at
             FROM areas WHERE id = ? AND deleted_at IS NULL LIMIT 1`
          )
          .get(input.id)
        const area = AreaSchema.parse(row)
        sync.recordEntity('area', area, [...new Set([...changedFields, 'updated_at'])])
        sync.finalize()
        return { ok: true as const, data: area }
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
        const sync = createLocalSyncRecorder(db, deletedAt)
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

        db.prepare(
          `UPDATE project_sections
           SET deleted_at = @deleted_at, updated_at = @updated_at
           WHERE deleted_at IS NULL
             AND project_id IN (
               SELECT id FROM projects WHERE area_id = @area_id
             )`
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

        const areaRow = db
          .prepare(
            `SELECT id, title, notes, position, created_at, updated_at, deleted_at
             FROM areas
             WHERE id = ?
             LIMIT 1`
          )
          .get(parsed.data.id)
        const projectRows = db
          .prepare(
            `SELECT id, title, notes, area_id, status, position, scheduled_at, is_someday, due_at,
                    created_at, updated_at, completed_at, deleted_at
             FROM projects
             WHERE area_id = @area_id AND deleted_at = @deleted_at`
          )
          .all({ area_id: parsed.data.id, deleted_at: deletedAt })
        const sectionRows = db
          .prepare(
            `SELECT id, project_id, title, position, created_at, updated_at, deleted_at
             FROM project_sections
             WHERE deleted_at = @deleted_at
               AND project_id IN (
                 SELECT id FROM projects WHERE area_id = @area_id
               )`
          )
          .all({ area_id: parsed.data.id, deleted_at: deletedAt })
        const taskRows = db
          .prepare(
            `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id,
                    scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
             FROM tasks
             WHERE deleted_at = @deleted_at
               AND (
                 area_id = @area_id
                 OR project_id IN (
                   SELECT id FROM projects WHERE area_id = @area_id
                 )
               )`
          )
          .all({ area_id: parsed.data.id, deleted_at: deletedAt })

        sync.recordEntity('area', AreaSchema.parse(areaRow), ['deleted_at', 'updated_at'])
        for (const row of projectRows) {
          sync.recordEntity('project', ProjectSchema.parse(row), ['deleted_at', 'updated_at'])
        }
        for (const row of sectionRows) {
          sync.recordEntity('project_section', ProjectSectionSchema.parse(row), ['deleted_at', 'updated_at'])
        }
        for (const row of taskRows) {
          sync.recordEntity('task', TaskSchema.parse(row), ['deleted_at', 'updated_at'])
        }
        sync.finalize()

        return { ok: true as const, data: { deleted: true } }
      })

      return tx()
    },
  }
}
