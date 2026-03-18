import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { createLocalSyncRecorder } from './sync-support'
import { nowIso } from './utils'

import {
  TrashEmptyResultSchema,
  TrashEntrySchema,
  TrashListInputSchema,
  TrashProjectEntrySchema,
  TrashPurgeResultSchema,
  TrashRestoreResultSchema,
  TrashRootIdInputSchema,
  TrashTaskEntrySchema,
} from '../../../../shared/schemas/trash'
import { ProjectSchema, ProjectSectionSchema } from '../../../../shared/schemas/project'
import { TaskSchema } from '../../../../shared/schemas/task'

type SyncRecorder = ReturnType<typeof createLocalSyncRecorder>

type TrashListRow = {
  kind: 'task' | 'project'
  id: string
  title: string
  deleted_at: string
  open_task_count: number | null
}

function listTrashEntries(db: Database.Database) {
  const rows = db
    .prepare(
      `SELECT kind, id, title, deleted_at, open_task_count
       FROM (
         SELECT
           'project' AS kind,
           p.id,
           p.title,
           p.deleted_at,
           CAST((
             SELECT COUNT(1)
             FROM tasks t
             WHERE t.project_id = p.id
               AND t.deleted_at IS NOT NULL
               AND t.purged_at IS NULL
               AND t.status = 'open'
           ) AS INTEGER) AS open_task_count
         FROM projects p
         WHERE p.deleted_at IS NOT NULL
           AND p.purged_at IS NULL

         UNION ALL

         SELECT
           'task' AS kind,
           t.id,
           t.title,
           t.deleted_at,
           NULL AS open_task_count
         FROM tasks t
         WHERE t.deleted_at IS NOT NULL
           AND t.purged_at IS NULL
           AND NOT EXISTS (
             SELECT 1
             FROM projects p
             WHERE p.id = t.project_id
               AND p.deleted_at IS NOT NULL
               AND p.purged_at IS NULL
           )
       )
       ORDER BY deleted_at DESC, title COLLATE NOCASE ASC, id ASC`
    )
    .all() as TrashListRow[]

  return rows.map((row) =>
    row.kind === 'project'
      ? TrashProjectEntrySchema.parse({
          kind: 'project',
          id: row.id,
          title: row.title,
          deleted_at: row.deleted_at,
          open_task_count: row.open_task_count ?? 0,
        })
      : TrashTaskEntrySchema.parse({
          kind: 'task',
          id: row.id,
          title: row.title,
          deleted_at: row.deleted_at,
        })
  )
}

function isTaskAbsorbedByDeletedProject(db: Database.Database, projectId: string | null | undefined): boolean {
  if (!projectId) return false

  return Boolean(
    db
      .prepare(
        `SELECT 1
         FROM projects
         WHERE id = ?
           AND deleted_at IS NOT NULL
           AND purged_at IS NULL
         LIMIT 1`
      )
      .get(projectId)
  )
}

function getTaskRootRow(db: Database.Database, id: string) {
  const row = db
    .prepare(
      `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id,
              scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at, purged_at
       FROM tasks
       WHERE id = ?
         AND deleted_at IS NOT NULL
         AND purged_at IS NULL
       LIMIT 1`
    )
    .get(id)

  if (!row) return null
  const task = TaskSchema.parse(row)
  if (isTaskAbsorbedByDeletedProject(db, task.project_id)) return null
  return task
}

function getProjectRootRow(db: Database.Database, id: string) {
  const row = db
    .prepare(
      `SELECT id, title, notes, area_id, status, position, scheduled_at, is_someday, due_at,
              created_at, updated_at, completed_at, deleted_at, purged_at
       FROM projects
       WHERE id = ?
         AND deleted_at IS NOT NULL
         AND purged_at IS NULL
       LIMIT 1`
    )
    .get(id)

  return row ? ProjectSchema.parse(row) : null
}

function isProjectActive(db: Database.Database, id: string | null | undefined): boolean {
  if (!id) return false
  return Boolean(
    db
      .prepare(
        `SELECT 1
         FROM projects
         WHERE id = ?
           AND deleted_at IS NULL
           AND COALESCE(purged_at, NULL) IS NULL
         LIMIT 1`
      )
      .get(id)
  )
}

function isSectionActive(db: Database.Database, id: string | null | undefined, projectId: string): boolean {
  if (!id) return false
  return Boolean(
    db
      .prepare(
        `SELECT 1
         FROM project_sections
         WHERE id = ?
           AND project_id = ?
           AND deleted_at IS NULL
           AND COALESCE(purged_at, NULL) IS NULL
         LIMIT 1`
      )
      .get(id, projectId)
  )
}

function isAreaActive(db: Database.Database, id: string | null | undefined): boolean {
  if (!id) return false
  return Boolean(
    db
      .prepare(
        `SELECT 1
         FROM areas
         WHERE id = ?
           AND deleted_at IS NULL
         LIMIT 1`
      )
      .get(id)
  )
}

function purgeTaskRoot(
  db: Database.Database,
  sync: SyncRecorder,
  id: string,
  timestamp: string
): boolean {
  const task = getTaskRootRow(db, id)
  if (!task) return false

  db.prepare(
    `UPDATE tasks
     SET purged_at = @purged_at,
         updated_at = @updated_at
     WHERE id = @id
       AND deleted_at IS NOT NULL
       AND purged_at IS NULL`
  ).run({
    id,
    purged_at: timestamp,
    updated_at: timestamp,
  })

  const row = db
    .prepare(
      `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id,
              scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at, purged_at
       FROM tasks
       WHERE id = ?
       LIMIT 1`
    )
    .get(id)

  sync.recordEntity('task', TaskSchema.parse(row), ['purged_at', 'updated_at'])
  return true
}

function purgeProjectRoot(
  db: Database.Database,
  sync: SyncRecorder,
  id: string,
  timestamp: string
): boolean {
  const project = getProjectRootRow(db, id)
  if (!project) return false

  db.prepare(
    `UPDATE projects
     SET purged_at = @purged_at,
         updated_at = @updated_at
     WHERE id = @id
       AND deleted_at IS NOT NULL
       AND purged_at IS NULL`
  ).run({
    id,
    purged_at: timestamp,
    updated_at: timestamp,
  })

  db.prepare(
    `UPDATE project_sections
     SET purged_at = @purged_at,
         updated_at = @updated_at
     WHERE project_id = @project_id
       AND deleted_at IS NOT NULL
       AND purged_at IS NULL`
  ).run({
    project_id: id,
    purged_at: timestamp,
    updated_at: timestamp,
  })

  db.prepare(
    `UPDATE tasks
     SET purged_at = @purged_at,
         updated_at = @updated_at
     WHERE project_id = @project_id
       AND deleted_at IS NOT NULL
       AND purged_at IS NULL`
  ).run({
    project_id: id,
    purged_at: timestamp,
    updated_at: timestamp,
  })

  const projectRow = db
    .prepare(
      `SELECT id, title, notes, area_id, status, position, scheduled_at, is_someday, due_at,
              created_at, updated_at, completed_at, deleted_at, purged_at
       FROM projects
       WHERE id = ?
       LIMIT 1`
    )
    .get(id)
  const sectionRows = db
    .prepare(
      `SELECT id, project_id, title, position, created_at, updated_at, deleted_at, purged_at
       FROM project_sections
       WHERE project_id = ?
         AND purged_at = ?`
    )
    .all(id, timestamp)
  const taskRows = db
    .prepare(
      `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id,
              scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at, purged_at
       FROM tasks
       WHERE project_id = ?
         AND purged_at = ?`
    )
    .all(id, timestamp)

  sync.recordEntity('project', ProjectSchema.parse(projectRow), ['purged_at', 'updated_at'])
  for (const row of sectionRows) {
    sync.recordEntity('project_section', ProjectSectionSchema.parse(row), ['purged_at', 'updated_at'])
  }
  for (const row of taskRows) {
    sync.recordEntity('task', TaskSchema.parse(row), ['purged_at', 'updated_at'])
  }

  return true
}

export function createTrashActions(db: Database.Database): Record<string, DbActionHandler> {
  return {
    'trash.list': (payload) => {
      const parsed = TrashListInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid trash.list payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const entries = z.array(TrashEntrySchema).parse(listTrashEntries(db))
      return { ok: true, data: entries }
    },

    'trash.restoreTask': (payload) => {
      const parsed = TrashRootIdInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid trash.restoreTask payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const updatedAt = nowIso()
      const tx = db.transaction(() => {
        const task = getTaskRootRow(db, parsed.data.id)
        if (!task) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Trash task root not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        const sync = createLocalSyncRecorder(db, updatedAt)

        if (task.project_id && isProjectActive(db, task.project_id)) {
          const nextSectionId = isSectionActive(db, task.section_id, task.project_id) ? task.section_id : null

          db.prepare(
            `UPDATE tasks
             SET deleted_at = NULL,
                 updated_at = @updated_at,
                 section_id = @section_id
             WHERE id = @id
               AND deleted_at IS NOT NULL
               AND purged_at IS NULL`
          ).run({
            id: task.id,
            updated_at: updatedAt,
            section_id: nextSectionId,
          })

          const row = db
            .prepare(
              `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id,
                      scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at, purged_at
               FROM tasks
               WHERE id = ?
               LIMIT 1`
            )
            .get(task.id)
          const changedFields = nextSectionId === task.section_id
            ? ['deleted_at', 'updated_at']
            : ['deleted_at', 'updated_at', 'section_id']
          sync.recordEntity('task', TaskSchema.parse(row), changedFields)
          sync.finalize()

          return { ok: true as const, data: TrashRestoreResultSchema.parse({ restored: true }) }
        }

        if (!task.project_id && task.area_id && isAreaActive(db, task.area_id)) {
          db.prepare(
            `UPDATE tasks
             SET deleted_at = NULL,
                 updated_at = @updated_at
             WHERE id = @id
               AND deleted_at IS NOT NULL
               AND purged_at IS NULL`
          ).run({
            id: task.id,
            updated_at: updatedAt,
          })

          const row = db
            .prepare(
              `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id,
                      scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at, purged_at
               FROM tasks
               WHERE id = ?
               LIMIT 1`
            )
            .get(task.id)
          sync.recordEntity('task', TaskSchema.parse(row), ['deleted_at', 'updated_at'])
          sync.finalize()

          return { ok: true as const, data: TrashRestoreResultSchema.parse({ restored: true }) }
        }

        db.prepare(
          `UPDATE tasks
           SET deleted_at = NULL,
               updated_at = @updated_at,
               is_inbox = 1,
               is_someday = 0,
               project_id = NULL,
               section_id = NULL,
               area_id = NULL,
               scheduled_at = NULL
           WHERE id = @id
             AND deleted_at IS NOT NULL
             AND purged_at IS NULL`
        ).run({
          id: task.id,
          updated_at: updatedAt,
        })

        const row = db
          .prepare(
            `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id,
                    scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at, purged_at
             FROM tasks
             WHERE id = ?
             LIMIT 1`
          )
          .get(task.id)
        sync.recordEntity('task', TaskSchema.parse(row), [
          'deleted_at',
          'updated_at',
          'is_inbox',
          'is_someday',
          'project_id',
          'section_id',
          'area_id',
          'scheduled_at',
        ])
        sync.finalize()

        return { ok: true as const, data: TrashRestoreResultSchema.parse({ restored: true }) }
      })

      return tx()
    },

    'trash.restoreProject': (payload) => {
      const parsed = TrashRootIdInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid trash.restoreProject payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const updatedAt = nowIso()
      const tx = db.transaction(() => {
        const project = getProjectRootRow(db, parsed.data.id)
        if (!project) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Trash project root not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        const sync = createLocalSyncRecorder(db, updatedAt)
        const nextAreaId = isAreaActive(db, project.area_id) ? project.area_id : null

        db.prepare(
          `UPDATE projects
           SET deleted_at = NULL,
               updated_at = @updated_at,
               area_id = @area_id
           WHERE id = @id
             AND deleted_at IS NOT NULL
             AND purged_at IS NULL`
        ).run({
          id: project.id,
          updated_at: updatedAt,
          area_id: nextAreaId,
        })

        db.prepare(
          `UPDATE project_sections
           SET deleted_at = NULL,
               updated_at = @updated_at
           WHERE project_id = @project_id
             AND deleted_at IS NOT NULL
             AND purged_at IS NULL`
        ).run({
          project_id: project.id,
          updated_at: updatedAt,
        })

        db.prepare(
          `UPDATE tasks
           SET deleted_at = NULL,
               updated_at = @updated_at,
               area_id = @area_id
           WHERE project_id = @project_id
             AND deleted_at IS NOT NULL
             AND purged_at IS NULL`
        ).run({
          project_id: project.id,
          updated_at: updatedAt,
          area_id: nextAreaId,
        })

        const projectRow = db
          .prepare(
            `SELECT id, title, notes, area_id, status, position, scheduled_at, is_someday, due_at,
                    created_at, updated_at, completed_at, deleted_at, purged_at
             FROM projects
             WHERE id = ?
             LIMIT 1`
          )
          .get(project.id)
        const sectionRows = db
          .prepare(
            `SELECT id, project_id, title, position, created_at, updated_at, deleted_at, purged_at
             FROM project_sections
             WHERE project_id = ?
               AND deleted_at IS NULL`
          )
          .all(project.id)
        const taskRows = db
          .prepare(
            `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id,
                    scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at, purged_at
             FROM tasks
             WHERE project_id = ?
               AND deleted_at IS NULL`
          )
          .all(project.id)

        const changedProjectFields = nextAreaId === project.area_id
          ? ['deleted_at', 'updated_at']
          : ['deleted_at', 'updated_at', 'area_id']
        const changedTaskFields = nextAreaId === project.area_id
          ? ['deleted_at', 'updated_at']
          : ['deleted_at', 'updated_at', 'area_id']

        sync.recordEntity('project', ProjectSchema.parse(projectRow), changedProjectFields)
        for (const row of sectionRows) {
          sync.recordEntity('project_section', ProjectSectionSchema.parse(row), ['deleted_at', 'updated_at'])
        }
        for (const row of taskRows) {
          sync.recordEntity('task', TaskSchema.parse(row), changedTaskFields)
        }
        sync.finalize()

        return { ok: true as const, data: TrashRestoreResultSchema.parse({ restored: true }) }
      })

      return tx()
    },

    'trash.purgeTask': (payload) => {
      const parsed = TrashRootIdInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid trash.purgeTask payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const updatedAt = nowIso()
      const tx = db.transaction(() => {
        const sync = createLocalSyncRecorder(db, updatedAt)
        if (!purgeTaskRoot(db, sync, parsed.data.id, updatedAt)) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Trash task root not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        sync.finalize()
        return { ok: true as const, data: TrashPurgeResultSchema.parse({ purged: true }) }
      })

      return tx()
    },

    'trash.purgeProject': (payload) => {
      const parsed = TrashRootIdInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid trash.purgeProject payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const updatedAt = nowIso()
      const tx = db.transaction(() => {
        const sync = createLocalSyncRecorder(db, updatedAt)
        if (!purgeProjectRoot(db, sync, parsed.data.id, updatedAt)) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Trash project root not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        sync.finalize()
        return { ok: true as const, data: TrashPurgeResultSchema.parse({ purged: true }) }
      })

      return tx()
    },

    'trash.empty': (payload) => {
      const parsed = TrashListInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid trash.empty payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const updatedAt = nowIso()
      const tx = db.transaction(() => {
        const entries = listTrashEntries(db)
        if (entries.length === 0) {
          return { ok: true as const, data: TrashEmptyResultSchema.parse({ purged_count: 0 }) }
        }

        const sync = createLocalSyncRecorder(db, updatedAt)
        for (const entry of entries) {
          if (entry.kind === 'project') {
            purgeProjectRoot(db, sync, entry.id, updatedAt)
            continue
          }
          purgeTaskRoot(db, sync, entry.id, updatedAt)
        }

        sync.finalize()
        return {
          ok: true as const,
          data: TrashEmptyResultSchema.parse({ purged_count: entries.length }),
        }
      })

      return tx()
    },
  }
}
