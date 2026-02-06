import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { nowIso, uuidv7 } from './utils'

import {
  ProjectCompleteInputSchema,
  ProjectCompleteResultSchema,
  ProjectCreateInputSchema,
  ProjectIdInputSchema,
  ProjectSchema,
  ProjectSectionCreateInputSchema,
  ProjectSectionDeleteInputSchema,
  ProjectSectionReorderBatchInputSchema,
  ProjectSectionReorderBatchResultSchema,
  ProjectSectionRenameInputSchema,
  ProjectSectionSchema,
  ProjectUpdateInputSchema,
} from '../../../../shared/schemas/project'

export function createProjectActions(db: Database.Database): Record<string, DbActionHandler> {
  const ProjectIdSchema = z.object({ project_id: z.string().min(1) })
  const AreaIdSchema = z.object({ area_id: z.string().min(1) })

  return {
    'project.get': (payload) => {
      const parsed = ProjectIdInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid project.get payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const row = db
        .prepare(
          `SELECT id, title, notes, area_id, status, scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
           FROM projects
           WHERE id = ? AND deleted_at IS NULL
           LIMIT 1`
        )
        .get(parsed.data.id)
      if (!row) {
        return {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found.',
            details: { id: parsed.data.id },
          },
        }
      }

      return { ok: true, data: ProjectSchema.parse(row) }
    },
    'project.create': (payload) => {
      const parsed = ProjectCreateInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid project.create payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const input = parsed.data
      const createdAt = nowIso()
      const id = uuidv7()

      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO projects (
             id, title, notes, area_id, status, scheduled_at, due_at,
             created_at, updated_at, completed_at, deleted_at
           ) VALUES (
             @id, @title, @notes, @area_id, 'open', @scheduled_at, @due_at,
             @created_at, @updated_at, NULL, NULL
           )`
        ).run({
          id,
          title: input.title,
          notes: input.notes ?? '',
          area_id: input.area_id ?? null,
          scheduled_at: input.scheduled_at ?? null,
          due_at: input.due_at ?? null,
          created_at: createdAt,
          updated_at: createdAt,
        })
      })
      tx()

      const project = ProjectSchema.parse({
        id,
        title: input.title,
        notes: input.notes ?? '',
        area_id: input.area_id ?? null,
        status: 'open',
        scheduled_at: input.scheduled_at ?? null,
        due_at: input.due_at ?? null,
        created_at: createdAt,
        updated_at: createdAt,
        completed_at: null,
        deleted_at: null,
      })

      return { ok: true, data: project }
    },

    'project.update': (payload) => {
      const parsed = ProjectUpdateInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid project.update payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const input = parsed.data
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const exists = db
          .prepare('SELECT id, status FROM projects WHERE id = ? AND deleted_at IS NULL')
          .get(input.id) as { id: string; status: string } | undefined
        if (!exists) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Project not found.',
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
        if (input.area_id !== undefined) {
          fields.push('area_id = @area_id')
          params.area_id = input.area_id
        }
        if (input.scheduled_at !== undefined) {
          fields.push('scheduled_at = @scheduled_at')
          params.scheduled_at = input.scheduled_at
        }
        if (input.due_at !== undefined) {
          fields.push('due_at = @due_at')
          params.due_at = input.due_at
        }

        if (input.status !== undefined) {
          fields.push('status = @status')
          params.status = input.status

          if (input.status === 'done' && exists.status !== 'done') {
            fields.push('completed_at = @completed_at')
            params.completed_at = updatedAt
          }
          if (input.status === 'open' && exists.status !== 'open') {
            fields.push('completed_at = NULL')
          }
        }

        if (fields.length === 0) {
          db.prepare('UPDATE projects SET updated_at = @updated_at WHERE id = @id').run(params)
        } else {
          db.prepare(
            `UPDATE projects SET ${fields.join(', ')}, updated_at = @updated_at WHERE id = @id`
          ).run(params)
        }

        const row = db
          .prepare(
            `SELECT id, title, notes, area_id, status, scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
             FROM projects WHERE id = ? AND deleted_at IS NULL LIMIT 1`
          )
          .get(input.id)
        return { ok: true as const, data: ProjectSchema.parse(row) }
      })

      return tx()
    },

    'project.complete': (payload) => {
      const parsed = ProjectCompleteInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid project.complete payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const existing = db
          .prepare(
            `SELECT id, status
             FROM projects
             WHERE id = ? AND deleted_at IS NULL
             LIMIT 1`
          )
          .get(parsed.data.id) as { id: string; status: string } | undefined

        if (!existing) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Project not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        if (existing.status !== 'done') {
          db.prepare(
            `UPDATE projects
             SET status = 'done',
                 completed_at = @completed_at,
                 updated_at = @updated_at
             WHERE id = @id AND deleted_at IS NULL`
          ).run({ id: parsed.data.id, completed_at: updatedAt, updated_at: updatedAt })
        }

        const taskRes = db
          .prepare(
            `UPDATE tasks
             SET status = 'done',
                 completed_at = @completed_at,
                 updated_at = @updated_at
             WHERE deleted_at IS NULL
               AND project_id = @project_id
               AND status = 'open'`
          )
          .run({ project_id: parsed.data.id, completed_at: updatedAt, updated_at: updatedAt })

        const row = db
          .prepare(
            `SELECT id, title, notes, area_id, status, scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
             FROM projects WHERE id = ? AND deleted_at IS NULL LIMIT 1`
          )
          .get(parsed.data.id)

        const result = ProjectCompleteResultSchema.parse({
          project: ProjectSchema.parse(row),
          tasks_completed: taskRes.changes,
        })
        return { ok: true as const, data: result }
      })

      return tx()
    },

    'project.listOpen': () => {
      const rows = db
        .prepare(
          `SELECT id, title, notes, area_id, status, scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
           FROM projects
           WHERE deleted_at IS NULL AND status = 'open'
           ORDER BY title COLLATE NOCASE ASC`
        )
        .all()
      const projects = z.array(ProjectSchema).parse(rows)
      return { ok: true, data: projects }
    },

    'project.listOpenByArea': (payload) => {
      const parsed = AreaIdSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid project.listOpenByArea payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const rows = db
        .prepare(
          `SELECT id, title, notes, area_id, status, scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
           FROM projects
           WHERE deleted_at IS NULL AND status = 'open' AND area_id = @area_id
           ORDER BY title COLLATE NOCASE ASC`
        )
        .all({ area_id: parsed.data.area_id })
      const projects = z.array(ProjectSchema).parse(rows)
      return { ok: true, data: projects }
    },

    'project.listDone': () => {
      const rows = db
        .prepare(
          `SELECT id, title, notes, area_id, status, scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
           FROM projects
           WHERE deleted_at IS NULL AND status = 'done'
           ORDER BY completed_at DESC, updated_at DESC`
        )
        .all()
      const projects = z.array(ProjectSchema).parse(rows)
      return { ok: true, data: projects }
    },

    'project.section.list': (payload) => {
      const parsed = ProjectIdSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid project.section.list payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const rows = db
        .prepare(
          `SELECT id, project_id, title, position, created_at, updated_at, deleted_at
           FROM project_sections
           WHERE deleted_at IS NULL AND project_id = @project_id
           ORDER BY position ASC`
        )
        .all({ project_id: parsed.data.project_id })

      const sections = z.array(ProjectSectionSchema).parse(rows)
      return { ok: true, data: sections }
    },

    'project.section.create': (payload) => {
      const parsed = ProjectSectionCreateInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid project.section.create payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const input = parsed.data
      const createdAt = nowIso()
      const id = uuidv7()

      const tx = db.transaction(() => {
        const maxPos = db
          .prepare(
            `SELECT COALESCE(MAX(position), 0) AS max_pos
             FROM project_sections
             WHERE project_id = ? AND deleted_at IS NULL`
          )
          .get(input.project_id) as { max_pos: number }
        const position = (maxPos?.max_pos ?? 0) + 1000

        db.prepare(
          `INSERT INTO project_sections (
             id, project_id, title, position, created_at, updated_at, deleted_at
           ) VALUES (
             @id, @project_id, @title, @position, @created_at, @updated_at, NULL
           )`
        ).run({
          id,
          project_id: input.project_id,
          title: input.title,
          position,
          created_at: createdAt,
          updated_at: createdAt,
        })

        const row = db
          .prepare(
            `SELECT id, project_id, title, position, created_at, updated_at, deleted_at
             FROM project_sections WHERE id = ? LIMIT 1`
          )
          .get(id)
        return { ok: true as const, data: ProjectSectionSchema.parse(row) }
      })

      return tx()
    },

    'project.section.rename': (payload) => {
      const parsed = ProjectSectionRenameInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid project.section.rename payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const res = db
          .prepare(
            `UPDATE project_sections
             SET title = @title, updated_at = @updated_at
             WHERE id = @id AND deleted_at IS NULL`
          )
          .run({ id: parsed.data.id, title: parsed.data.title, updated_at: updatedAt })
        if (res.changes === 0) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Project section not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        const row = db
          .prepare(
            `SELECT id, project_id, title, position, created_at, updated_at, deleted_at
             FROM project_sections WHERE id = ? LIMIT 1`
          )
          .get(parsed.data.id)
        return { ok: true as const, data: ProjectSectionSchema.parse(row) }
      })

      return tx()
    },

    'project.section.reorderBatch': (payload) => {
      const parsed = ProjectSectionReorderBatchInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid project.section.reorderBatch payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const input = parsed.data
      const duplicateSectionIds = new Set<string>()
      const seenSectionIds = new Set<string>()
      for (const sectionId of input.ordered_section_ids) {
        if (seenSectionIds.has(sectionId)) duplicateSectionIds.add(sectionId)
        seenSectionIds.add(sectionId)
      }

      if (duplicateSectionIds.size > 0) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'ordered_section_ids contains duplicates.',
            details: { duplicate_section_ids: Array.from(duplicateSectionIds) },
          },
        }
      }

      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const project = db
          .prepare(
            `SELECT id
             FROM projects
             WHERE id = @project_id AND deleted_at IS NULL
             LIMIT 1`
          )
          .get({ project_id: input.project_id }) as { id: string } | undefined

        if (!project) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Project not found.',
              details: { id: input.project_id },
            },
          }
        }

        const sectionRows = db
          .prepare(
            `SELECT id
             FROM project_sections
             WHERE project_id = @project_id
               AND deleted_at IS NULL
             ORDER BY position ASC`
          )
          .all({ project_id: input.project_id }) as { id: string }[]

        const existingSectionIds = sectionRows.map((row) => row.id)
        const existingSectionIdSet = new Set(existingSectionIds)

        const invalidSectionIds = input.ordered_section_ids.filter((sectionId) => !existingSectionIdSet.has(sectionId))
        if (invalidSectionIds.length > 0) {
          return {
            ok: false as const,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'ordered_section_ids must reference active sections in the project.',
              details: { invalid_section_ids: invalidSectionIds, project_id: input.project_id },
            },
          }
        }

        if (input.ordered_section_ids.length !== existingSectionIds.length) {
          const providedSectionIdSet = new Set(input.ordered_section_ids)
          const missingSectionIds = existingSectionIds.filter((sectionId) => !providedSectionIdSet.has(sectionId))
          return {
            ok: false as const,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'ordered_section_ids must include every active section exactly once.',
              details: { missing_section_ids: missingSectionIds, project_id: input.project_id },
            },
          }
        }

        const updateSection = db.prepare(
          `UPDATE project_sections
           SET position = @position,
               updated_at = @updated_at
           WHERE id = @id
             AND project_id = @project_id
             AND deleted_at IS NULL`
        )

        for (let i = 0; i < input.ordered_section_ids.length; i++) {
          updateSection.run({
            id: input.ordered_section_ids[i],
            project_id: input.project_id,
            position: (i + 1) * 1000,
            updated_at: updatedAt,
          })
        }

        return {
          ok: true as const,
          data: ProjectSectionReorderBatchResultSchema.parse({ reordered: true }),
        }
      })

      return tx()
    },

    'project.section.delete': (payload) => {
      const parsed = ProjectSectionDeleteInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid project.section.delete payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const deletedAt = nowIso()

      const tx = db.transaction(() => {
        const section = db
          .prepare(
            `SELECT id, project_id, position
             FROM project_sections
             WHERE id = ? AND deleted_at IS NULL`
          )
          .get(parsed.data.id) as { id: string; project_id: string; position: number } | undefined

        if (!section) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Project section not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        const prev = db
          .prepare(
            `SELECT id
             FROM project_sections
             WHERE project_id = @project_id
               AND deleted_at IS NULL
               AND position < @position
             ORDER BY position DESC
             LIMIT 1`
          )
          .get({ project_id: section.project_id, position: section.position }) as
          | { id: string }
          | undefined

        db.prepare(
          `UPDATE tasks
           SET section_id = @new_section_id,
               updated_at = @updated_at
           WHERE deleted_at IS NULL AND section_id = @old_section_id`
        ).run({
          old_section_id: section.id,
          new_section_id: prev?.id ?? null,
          updated_at: deletedAt,
        })

        db.prepare(
          `UPDATE project_sections
           SET deleted_at = @deleted_at,
               updated_at = @updated_at
           WHERE id = @id AND deleted_at IS NULL`
        ).run({ id: section.id, deleted_at: deletedAt, updated_at: deletedAt })

        return {
          ok: true as const,
          data: { deleted: true, moved_to_section_id: prev?.id ?? null },
        }
      })

      return tx()
    },
  }
}
