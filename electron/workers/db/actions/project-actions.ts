import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { createLocalSyncRecorder, replaceProjectTags } from './sync-support'
import { nowIso, uuidv7 } from './utils'

import {
  ProjectCancelInputSchema,
  ProjectCancelResultSchema,
  ProjectCompleteInputSchema,
  ProjectCompleteResultSchema,
  ProjectCreateInputSchema,
  ProjectDeleteInputSchema,
  ProjectIdInputSchema,
  ProjectSchema,
  ProjectSectionCreateInputSchema,
  ProjectSectionDeleteInputSchema,
  ProjectSectionListInputSchema,
  ProjectSectionReorderBatchInputSchema,
  ProjectSectionReorderBatchResultSchema,
  ProjectSectionRenameInputSchema,
  ProjectSectionSchema,
  ProjectUpdateInputSchema,
} from '../../../../shared/schemas/project'

import { ProjectDetailSchema } from '../../../../shared/schemas/project-detail'
import { ProjectSetTagsInputSchema } from '../../../../shared/schemas/project-set-tags'
import { TagSchema } from '../../../../shared/schemas/tag'
import { TaskSchema } from '../../../../shared/schemas/task'
import type { EntityScope } from '../../../../shared/schemas/common'

function normalizeEntityScope(scope?: EntityScope): EntityScope {
  return scope === 'trash' ? 'trash' : 'active'
}

function projectScopeWhere(scope: EntityScope, alias?: string): string {
  const prefix = alias ? `${alias}.` : ''
  return scope === 'trash'
    ? `${prefix}deleted_at IS NOT NULL AND ${prefix}purged_at IS NULL`
    : `${prefix}deleted_at IS NULL`
}

function sectionScopeWhere(scope: EntityScope, alias?: string): string {
  const prefix = alias ? `${alias}.` : ''
  return scope === 'trash'
    ? `${prefix}deleted_at IS NOT NULL AND ${prefix}purged_at IS NULL`
    : `${prefix}deleted_at IS NULL`
}

function taskScopeWhere(scope: EntityScope, alias?: string): string {
  const prefix = alias ? `${alias}.` : ''
  return scope === 'trash'
    ? `${prefix}deleted_at IS NOT NULL AND ${prefix}purged_at IS NULL`
    : `${prefix}deleted_at IS NULL`
}

function projectClosedStatusWhere(alias?: string): string {
  const prefix = alias ? `${alias}.` : ''
  return `${prefix}status IN ('done', 'cancelled')`
}

export function createProjectActions(db: Database.Database): Record<string, DbActionHandler> {
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

      const scope = normalizeEntityScope(parsed.data.scope)
      const row = db
        .prepare(
          `SELECT id, title, notes, area_id, status, scheduled_at, is_someday, due_at, created_at, updated_at, completed_at, deleted_at
           FROM projects
           WHERE id = ? AND ${projectScopeWhere(scope)}
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

    'project.getDetail': (payload) => {
      const parsed = ProjectIdInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid project.getDetail payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const scope = normalizeEntityScope(parsed.data.scope)
      const row = db
        .prepare(
          `SELECT id, title, notes, area_id, status, scheduled_at, is_someday, due_at, created_at, updated_at, completed_at, deleted_at
           FROM projects
           WHERE id = ? AND ${projectScopeWhere(scope)}
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

      const project = ProjectSchema.parse(row)

      const tagRows = db
        .prepare(
          `SELECT t.id, t.title, t.color, t.created_at, t.updated_at, t.deleted_at
           FROM project_tags pt
           JOIN tags t ON t.id = pt.tag_id AND t.deleted_at IS NULL
           WHERE pt.project_id = ? AND pt.deleted_at IS NULL
           ORDER BY pt.position ASC`
        )
        .all(parsed.data.id)

      const tags = z.array(TagSchema).parse(tagRows)

      return {
        ok: true,
        data: ProjectDetailSchema.parse({ project, tags }),
      }
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

      const isSomeday = input.is_someday ?? false
      const scheduledAt = isSomeday ? null : (input.scheduled_at ?? null)
      const project = ProjectSchema.parse({
        id,
        title: input.title,
        notes: input.notes ?? '',
        area_id: input.area_id ?? null,
        status: 'open',
        position: null,
        scheduled_at: scheduledAt,
        is_someday: isSomeday,
        due_at: input.due_at ?? null,
        created_at: createdAt,
        updated_at: createdAt,
        completed_at: null,
        deleted_at: null,
      })

      const tx = db.transaction(() => {
        const sync = createLocalSyncRecorder(db, createdAt)
        db.prepare(
          `INSERT INTO projects (
             id, title, notes, area_id, status, scheduled_at, is_someday, due_at,
             created_at, updated_at, completed_at, deleted_at
           ) VALUES (
             @id, @title, @notes, @area_id, 'open', @scheduled_at, @is_someday, @due_at,
             @created_at, @updated_at, NULL, NULL
           )`
        ).run({
          id,
          title: input.title,
          notes: input.notes ?? '',
          area_id: input.area_id ?? null,
          scheduled_at: scheduledAt,
          is_someday: isSomeday ? 1 : 0,
          due_at: input.due_at ?? null,
          created_at: createdAt,
          updated_at: createdAt,
        })
        sync.recordEntity(
          'project',
          project,
          [
            'title',
            'notes',
            'area_id',
            'status',
            'position',
            'scheduled_at',
            'is_someday',
            'due_at',
            'created_at',
            'updated_at',
            'completed_at',
            'deleted_at',
          ]
        )
        sync.finalize()
      })
      tx()

      return { ok: true, data: project }
    },

    'project.setTags': (payload) => {
      const parsed = ProjectSetTagsInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid project.setTags payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const scope = normalizeEntityScope(parsed.data.scope)
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const sync = createLocalSyncRecorder(db, updatedAt)
        const exists = db
          .prepare(`SELECT id FROM projects WHERE id = ? AND ${projectScopeWhere(scope)}`)
          .get(parsed.data.project_id)
        if (!exists) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Project not found.',
              details: { id: parsed.data.project_id },
            },
          }
        }

        replaceProjectTags(db, sync, parsed.data.project_id, parsed.data.tag_ids, updatedAt)

        db.prepare('UPDATE projects SET updated_at = @updated_at WHERE id = @id').run({
          id: parsed.data.project_id,
          updated_at: updatedAt,
        })

        const row = db
          .prepare(
            `SELECT id, title, notes, area_id, status, position, scheduled_at, is_someday, due_at,
                    created_at, updated_at, completed_at, deleted_at
             FROM projects
             WHERE id = ?
             LIMIT 1`
          )
          .get(parsed.data.project_id)
        sync.recordEntity('project', ProjectSchema.parse(row), ['updated_at'])
        sync.finalize()

        return { ok: true as const, data: { updated: true } }
      })

      return tx()
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
      const scope = normalizeEntityScope(input.scope)
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const exists = db
          .prepare(
            `SELECT id, title, notes, area_id, status, position, scheduled_at, is_someday, due_at,
                    created_at, updated_at, completed_at, deleted_at
             FROM projects
             WHERE id = ? AND ${projectScopeWhere(scope)}`
          )
          .get(input.id) as z.infer<typeof ProjectSchema> | undefined
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
        if (input.area_id !== undefined) {
          fields.push('area_id = @area_id')
          changedFields.push('area_id')
          params.area_id = input.area_id
        }
        if (input.scheduled_at !== undefined) {
          fields.push('scheduled_at = @scheduled_at')
          changedFields.push('scheduled_at')
          params.scheduled_at = input.scheduled_at

          // Invariant: scheduled_at non-null implies is_someday=false.
          if (input.scheduled_at !== null && input.is_someday === undefined) {
            fields.push('is_someday = 0')
            changedFields.push('is_someday')
          }
        }
        if (input.is_someday !== undefined) {
          fields.push('is_someday = @is_someday')
          changedFields.push('is_someday')
          params.is_someday = input.is_someday ? 1 : 0

          // Invariant: is_someday=true implies scheduled_at=null.
          if (input.is_someday && input.scheduled_at === undefined) {
            fields.push('scheduled_at = NULL')
            changedFields.push('scheduled_at')
          }
        }
        if (input.due_at !== undefined) {
          fields.push('due_at = @due_at')
          changedFields.push('due_at')
          params.due_at = input.due_at
        }

        if (input.status !== undefined) {
          if (
            input.status !== exists.status &&
            input.status !== 'open' &&
            exists.status !== 'open'
          ) {
            return {
              ok: false as const,
              error: {
                code: 'INVALID_STATE_TRANSITION',
                message: 'Closed projects must be reopened before changing terminal status.',
                details: { id: input.id, from: exists.status, to: input.status },
              },
            }
          }

          fields.push('status = @status')
          changedFields.push('status')
          params.status = input.status

          if (input.status !== 'open' && exists.status !== input.status) {
            fields.push('completed_at = @completed_at')
            changedFields.push('completed_at')
            params.completed_at = updatedAt
          }
          if (input.status === 'open' && exists.status !== 'open') {
            fields.push('completed_at = NULL')
            changedFields.push('completed_at')
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
            `SELECT id, title, notes, area_id, status, position, scheduled_at, is_someday, due_at,
                    created_at, updated_at, completed_at, deleted_at
             FROM projects WHERE id = ? AND ${projectScopeWhere(scope)} LIMIT 1`
          )
          .get(input.id)
        const project = ProjectSchema.parse(row)
        const sync = createLocalSyncRecorder(db, updatedAt)
        sync.recordEntity('project', project, [...new Set([...changedFields, 'updated_at'])])
        sync.finalize()
        return { ok: true as const, data: project }
      })

      return tx()
    },

    'project.delete': (payload) => {
      const parsed = ProjectDeleteInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid project.delete payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const deletedAt = nowIso()

      const tx = db.transaction(() => {
        const sync = createLocalSyncRecorder(db, deletedAt)
        const res = db
          .prepare(
            `UPDATE projects
             SET deleted_at = @deleted_at, updated_at = @updated_at
             WHERE id = @id AND deleted_at IS NULL`
          )
          .run({ id: parsed.data.id, deleted_at: deletedAt, updated_at: deletedAt })

        if (res.changes === 0) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Project not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        db.prepare(
          `UPDATE tasks
           SET deleted_at = @deleted_at, updated_at = @updated_at
           WHERE deleted_at IS NULL AND project_id = @project_id`
        ).run({ project_id: parsed.data.id, deleted_at: deletedAt, updated_at: deletedAt })

        db.prepare(
          `UPDATE project_sections
           SET deleted_at = @deleted_at, updated_at = @updated_at
           WHERE deleted_at IS NULL AND project_id = @project_id`
        ).run({ project_id: parsed.data.id, deleted_at: deletedAt, updated_at: deletedAt })

        const projectRow = db
          .prepare(
            `SELECT id, title, notes, area_id, status, position, scheduled_at, is_someday, due_at,
                    created_at, updated_at, completed_at, deleted_at
             FROM projects
             WHERE id = ?
             LIMIT 1`
          )
          .get(parsed.data.id)
        const taskRows = db
          .prepare(
            `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id,
                    scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
             FROM tasks
             WHERE project_id = @project_id AND deleted_at = @deleted_at`
          )
          .all({ project_id: parsed.data.id, deleted_at: deletedAt })
        const sectionRows = db
          .prepare(
            `SELECT id, project_id, title, position, created_at, updated_at, deleted_at
             FROM project_sections
             WHERE project_id = @project_id AND deleted_at = @deleted_at`
          )
          .all({ project_id: parsed.data.id, deleted_at: deletedAt })

        sync.recordEntity('project', ProjectSchema.parse(projectRow), ['deleted_at', 'updated_at'])
        for (const row of taskRows) {
          sync.recordEntity('task', TaskSchema.parse(row), ['deleted_at', 'updated_at'])
        }
        for (const row of sectionRows) {
          sync.recordEntity('project_section', ProjectSectionSchema.parse(row), ['deleted_at', 'updated_at'])
        }
        sync.finalize()

        return { ok: true as const, data: { deleted: true } }
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

      const scope = normalizeEntityScope(parsed.data.scope)
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const sync = createLocalSyncRecorder(db, updatedAt)
        const existing = db
          .prepare(
            `SELECT id, status
             FROM projects
             WHERE id = ? AND ${projectScopeWhere(scope)}
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

        if (existing.status === 'cancelled') {
          return {
            ok: false as const,
            error: {
              code: 'INVALID_STATE_TRANSITION',
              message: 'Cancelled projects must be reopened before completing.',
              details: { id: parsed.data.id, status: existing.status },
            },
          }
        }

        if (existing.status !== 'done') {
          db.prepare(
            `UPDATE projects
             SET status = 'done',
                 completed_at = @completed_at,
                 updated_at = @updated_at
             WHERE id = @id AND ${projectScopeWhere(scope)}`
          ).run({ id: parsed.data.id, completed_at: updatedAt, updated_at: updatedAt })
        }

        const taskRes = db
          .prepare(
            `UPDATE tasks
             SET status = 'done',
                 completed_at = @completed_at,
                 updated_at = @updated_at
             WHERE ${taskScopeWhere(scope)}
               AND project_id = @project_id
               AND status = 'open'`
          )
          .run({ project_id: parsed.data.id, completed_at: updatedAt, updated_at: updatedAt })

        const row = db
          .prepare(
            `SELECT id, title, notes, area_id, status, scheduled_at, is_someday, due_at, created_at, updated_at, completed_at, deleted_at
             FROM projects WHERE id = ? AND ${projectScopeWhere(scope)} LIMIT 1`
          )
          .get(parsed.data.id)

        const result = ProjectCompleteResultSchema.parse({
          project: ProjectSchema.parse(row),
          tasks_completed: taskRes.changes,
        })

        if (existing.status !== 'done') {
          sync.recordEntity('project', result.project, ['status', 'completed_at', 'updated_at'])
        }

        const completedTaskRows = db
          .prepare(
            `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id,
                    scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
             FROM tasks
             WHERE project_id = @project_id
               AND ${taskScopeWhere(scope)}
               AND updated_at = @updated_at`
          )
          .all({ project_id: parsed.data.id, updated_at: updatedAt })
        for (const taskRow of completedTaskRows) {
          sync.recordEntity('task', TaskSchema.parse(taskRow), ['status', 'completed_at', 'updated_at'])
        }
        sync.finalize()

        return { ok: true as const, data: result }
      })

      return tx()
    },

    'project.cancel': (payload) => {
      const parsed = ProjectCancelInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid project.cancel payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const scope = normalizeEntityScope(parsed.data.scope)
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const sync = createLocalSyncRecorder(db, updatedAt)
        const existing = db
          .prepare(
            `SELECT id, status
             FROM projects
             WHERE id = ? AND ${projectScopeWhere(scope)}
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

        if (existing.status !== 'open') {
          return {
            ok: false as const,
            error: {
              code: 'INVALID_STATE_TRANSITION',
              message: 'Only open projects can be cancelled.',
              details: { id: parsed.data.id, status: existing.status },
            },
          }
        }

        db.prepare(
          `UPDATE projects
           SET status = 'cancelled',
               completed_at = @completed_at,
               updated_at = @updated_at
           WHERE id = @id AND ${projectScopeWhere(scope)}`
        ).run({ id: parsed.data.id, completed_at: updatedAt, updated_at: updatedAt })

        const taskRes = db
          .prepare(
            `UPDATE tasks
             SET status = 'cancelled',
                 completed_at = @completed_at,
                 updated_at = @updated_at
             WHERE ${taskScopeWhere(scope)}
               AND project_id = @project_id
               AND status = 'open'`
          )
          .run({ project_id: parsed.data.id, completed_at: updatedAt, updated_at: updatedAt })

        const row = db
          .prepare(
            `SELECT id, title, notes, area_id, status, scheduled_at, is_someday, due_at, created_at, updated_at, completed_at, deleted_at
             FROM projects WHERE id = ? AND ${projectScopeWhere(scope)} LIMIT 1`
          )
          .get(parsed.data.id)

        const result = ProjectCancelResultSchema.parse({
          project: ProjectSchema.parse(row),
          tasks_completed: taskRes.changes,
        })

        sync.recordEntity('project', result.project, ['status', 'completed_at', 'updated_at'])

        const cancelledTaskRows = db
          .prepare(
            `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id,
                    scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
             FROM tasks
             WHERE project_id = @project_id
               AND ${taskScopeWhere(scope)}
               AND updated_at = @updated_at`
          )
          .all({ project_id: parsed.data.id, updated_at: updatedAt })
        for (const taskRow of cancelledTaskRows) {
          sync.recordEntity('task', TaskSchema.parse(taskRow), ['status', 'completed_at', 'updated_at'])
        }
        sync.finalize()

        return { ok: true as const, data: result }
      })

      return tx()
    },

    'project.listOpen': () => {
      const rows = db
        .prepare(
          `SELECT id, title, notes, area_id, status, scheduled_at, is_someday, due_at, created_at, updated_at, completed_at, deleted_at
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
          `SELECT id, title, notes, area_id, status, scheduled_at, is_someday, due_at, created_at, updated_at, completed_at, deleted_at
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
          `SELECT id, title, notes, area_id, status, scheduled_at, is_someday, due_at, created_at, updated_at, completed_at, deleted_at
           FROM projects
           WHERE deleted_at IS NULL AND ${projectClosedStatusWhere()}
           ORDER BY COALESCE(completed_at, updated_at) DESC, updated_at DESC`
         )
         .all()
      const projects = z.array(ProjectSchema).parse(rows)
      return { ok: true, data: projects }
    },

    'project.section.list': (payload) => {
      const parsed = ProjectSectionListInputSchema.safeParse(payload)
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

      const scope = normalizeEntityScope(parsed.data.scope)
      const rows = db
        .prepare(
          `SELECT id, project_id, title, position, created_at, updated_at, deleted_at
           FROM project_sections
           WHERE ${sectionScopeWhere(scope)}
             AND project_id = @project_id
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
      const scope = normalizeEntityScope(input.scope)
      const createdAt = nowIso()
      const id = uuidv7()

      const tx = db.transaction(() => {
        if (scope === 'trash') {
          const deletedProject = db
            .prepare(
              `SELECT id
               FROM projects
               WHERE id = ?
                 AND deleted_at IS NOT NULL
                 AND purged_at IS NULL
               LIMIT 1`
            )
            .get(input.project_id)
          if (!deletedProject) {
            return {
              ok: false as const,
              error: {
                code: 'NOT_FOUND',
                message: 'Deleted project not found.',
                details: { id: input.project_id },
              },
            }
          }
        }

        const sync = createLocalSyncRecorder(db, createdAt)
        const maxPos = db
          .prepare(
            `SELECT COALESCE(MAX(position), 0) AS max_pos
             FROM project_sections
             WHERE project_id = ? AND ${sectionScopeWhere(scope)}`
          )
          .get(input.project_id) as { max_pos: number }
        const position = (maxPos?.max_pos ?? 0) + 1000
        const deletedAt = scope === 'trash' ? createdAt : null

        db.prepare(
          `INSERT INTO project_sections (
             id, project_id, title, position, created_at, updated_at, deleted_at
           ) VALUES (
             @id, @project_id, @title, @position, @created_at, @updated_at, @deleted_at
           )`
        ).run({
          id,
          project_id: input.project_id,
          title: input.title,
          position,
          created_at: createdAt,
          updated_at: createdAt,
          deleted_at: deletedAt,
        })

        const row = db
          .prepare(
            `SELECT id, project_id, title, position, created_at, updated_at, deleted_at
             FROM project_sections WHERE id = ? LIMIT 1`
          )
          .get(id)
        const section = ProjectSectionSchema.parse(row)
        const orderedSectionIds = db
          .prepare(
            `SELECT id
             FROM project_sections
             WHERE project_id = @project_id AND ${sectionScopeWhere(scope)}
             ORDER BY position ASC`
          )
          .all({ project_id: input.project_id }) as Array<{ id: string }>

        sync.recordEntity(
          'project_section',
          section,
          ['project_id', 'title', 'position', 'created_at', 'updated_at', 'deleted_at']
        )
        sync.recordList(
          `project-sections:${input.project_id}`,
          orderedSectionIds.map((sectionRow) => sectionRow.id),
          createdAt
        )
        sync.finalize()

        return { ok: true as const, data: section }
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
        const scope = normalizeEntityScope(parsed.data.scope)
        const sync = createLocalSyncRecorder(db, updatedAt)
        const res = db
          .prepare(
            `UPDATE project_sections
             SET title = @title, updated_at = @updated_at
             WHERE id = @id AND ${sectionScopeWhere(scope)}`
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
        const section = ProjectSectionSchema.parse(row)
        sync.recordEntity('project_section', section, ['title', 'updated_at'])
        sync.finalize()
        return { ok: true as const, data: section }
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
      const scope = normalizeEntityScope(input.scope)
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
             WHERE id = @project_id AND ${projectScopeWhere(scope)}
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
               AND ${sectionScopeWhere(scope)}
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
               AND ${sectionScopeWhere(scope)}`
        )

        for (let i = 0; i < input.ordered_section_ids.length; i++) {
          updateSection.run({
            id: input.ordered_section_ids[i],
            project_id: input.project_id,
            position: (i + 1) * 1000,
            updated_at: updatedAt,
          })
        }

        const sync = createLocalSyncRecorder(db, updatedAt)
        sync.recordList(`project-sections:${input.project_id}`, input.ordered_section_ids, updatedAt)
        sync.finalize()

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
        const sync = createLocalSyncRecorder(db, deletedAt)
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

        const movedTaskIds = db
          .prepare(
            `SELECT id
             FROM tasks
             WHERE deleted_at IS NULL AND section_id = @section_id`
          )
          .all({ section_id: section.id }) as Array<{ id: string }>

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

        const deletedSectionRow = db
          .prepare(
            `SELECT id, project_id, title, position, created_at, updated_at, deleted_at
             FROM project_sections
             WHERE id = ?
             LIMIT 1`
          )
          .get(section.id)
        const movedTaskRows =
          movedTaskIds.length === 0
            ? []
            : db
                .prepare(
                  `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id,
                          scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
                   FROM tasks
                   WHERE id IN (${movedTaskIds.map(() => '?').join(', ')})`
                )
                .all(...movedTaskIds.map((task) => task.id))
        const remainingSectionIds = db
          .prepare(
            `SELECT id
             FROM project_sections
             WHERE project_id = @project_id AND deleted_at IS NULL
             ORDER BY position ASC`
          )
          .all({ project_id: section.project_id }) as Array<{ id: string }>

        for (const row of movedTaskRows) {
          sync.recordEntity('task', TaskSchema.parse(row), ['section_id', 'updated_at'])
        }
        sync.recordEntity('project_section', ProjectSectionSchema.parse(deletedSectionRow), ['deleted_at', 'updated_at'])
        sync.recordList(
          `project-sections:${section.project_id}`,
          remainingSectionIds.map((sectionRow) => sectionRow.id),
          deletedAt
        )
        sync.finalize()

        return {
          ok: true as const,
          data: { deleted: true, moved_to_section_id: prev?.id ?? null },
        }
      })

      return tx()
    },
  }
}
