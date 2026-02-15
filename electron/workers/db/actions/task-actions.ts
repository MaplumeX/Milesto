import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'

import { nowIso, uuidv7 } from './utils'

import {
  TaskCreateInputSchema,
  TaskDeleteInputSchema,
  TaskRestoreInputSchema,
  TaskSchema,
  TaskToggleDoneInputSchema,
  TaskUpdateInputSchema,
} from '../../../../shared/schemas/task'
import {
  TaskRolloverScheduledToTodayInputSchema,
  TaskRolloverScheduledToTodayResultSchema,
} from '../../../../shared/schemas/task-rollover'
import {
  TaskListAnytimeInputSchema,
  TaskCountProjectDoneInputSchema,
  TaskCountProjectsProgressInputSchema,
  TaskCountProjectsProgressResultSchema,
  TaskCountResultSchema,
  TaskListInboxInputSchema,
  TaskListItemSchema,
  TaskListLogbookInputSchema,
  TaskListProjectDoneInputSchema,
  TaskListProjectInputSchema,
  TaskListSomedayInputSchema,
  TaskListTodayInputSchema,
  TaskListUpcomingInputSchema,
} from '../../../../shared/schemas/task-list'
import { TaskSearchInputSchema, TaskSearchResultItemSchema } from '../../../../shared/schemas/search'
import { TaskDetailSchema, TaskIdInputSchema } from '../../../../shared/schemas/task-detail'
import { ChecklistItemSchema } from '../../../../shared/schemas/checklist'
import {
  TASK_LIST_ID_ANYTIME,
  TASK_LIST_ID_INBOX,
  TASK_LIST_ID_SOMEDAY,
  TASK_LIST_ID_TODAY,
  taskListIdArea,
} from '../../../../shared/task-list-ids'

const TagIdRowSchema = z.object({ id: z.string() })
const ChecklistDbRowSchema = ChecklistItemSchema.extend({
  done: z.preprocess((v) => Boolean(v), z.boolean()),
})

function buildFts5PrefixMatchQuery(raw: string): string | null {
  // Convert arbitrary user input into a safe FTS5 prefix query.
  // We intentionally do NOT pass raw user query into MATCH to avoid malformed query errors
  // and to prevent exposing FTS query operators (OR/NEAR/title:...) to the user.
  const normalized = raw.normalize('NFKC')
  const tokens = normalized.match(/[\p{L}\p{N}]+/gu) ?? []
  if (tokens.length === 0) return null

  return tokens
    .map((t) => {
      const escaped = t.replace(/"/g, '""')
      return `"${escaped}"*`
    })
    .join(' ')
}

function normalizeBucketFlags(input: {
  isInbox: boolean
  isSomeday: boolean
  scheduledAt: string | null
  projectId: string | null
}): { isInbox: boolean; isSomeday: boolean; scheduledAt: string | null; projectId: string | null } {
  let { isInbox, isSomeday, scheduledAt, projectId } = input

  // Someday and a concrete scheduled date are mutually exclusive.
  if (scheduledAt !== null) isSomeday = false
  if (isSomeday) scheduledAt = null

  // Inbox is only for unprocessed tasks. Any concrete plan/assignment moves it out.
  if (projectId !== null || scheduledAt !== null || isSomeday) isInbox = false
  if (isInbox) {
    projectId = null
    scheduledAt = null
    isSomeday = false
  }

  return { isInbox, isSomeday, scheduledAt, projectId }
}

export function createTaskActions(db: Database.Database): Record<string, DbActionHandler> {
  const ROLLOVER_LAST_DATE_KEY = 'tasks.rollover.lastDate'

  return {
    'task.create': (payload) => {
      const parsedPayload = TaskCreateInputSchema.safeParse(payload)
      if (!parsedPayload.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.create payload.',
            details: { issues: parsedPayload.error.issues },
          },
        }
      }

      const input = parsedPayload.data
      const createdAt = nowIso()
      const id = uuidv7()

      const bucket = normalizeBucketFlags({
        isInbox: input.is_inbox ?? false,
        isSomeday: input.is_someday ?? false,
        scheduledAt: input.scheduled_at ?? null,
        projectId: input.project_id ?? null,
      })

      const insertTask = db.transaction(() => {
        const stmt = db.prepare(`
          INSERT INTO tasks (
            id, title, notes, status, is_inbox, is_someday,
            project_id, section_id, area_id,
            scheduled_at, due_at,
            created_at, updated_at, completed_at, deleted_at
          ) VALUES (
            @id, @title, @notes, 'open', @is_inbox, @is_someday,
            @project_id, @section_id, @area_id,
            @scheduled_at, @due_at,
            @created_at, @updated_at, NULL, NULL
          )
        `)

        stmt.run({
          id,
          title: input.title,
          notes: input.notes ?? '',
          is_inbox: bucket.isInbox ? 1 : 0,
          is_someday: bucket.isSomeday ? 1 : 0,
          project_id: bucket.projectId,
          section_id: input.section_id ?? null,
          area_id: input.area_id ?? null,
          scheduled_at: bucket.scheduledAt,
          due_at: input.due_at ?? null,
          created_at: createdAt,
          updated_at: createdAt,
        })
      })
      insertTask()

      const task = TaskSchema.parse({
        id,
        title: input.title,
        notes: input.notes ?? '',
        status: 'open',
        is_inbox: bucket.isInbox,
        is_someday: bucket.isSomeday,
        project_id: bucket.projectId,
        section_id: input.section_id ?? null,
        area_id: input.area_id ?? null,
        scheduled_at: bucket.scheduledAt,
        due_at: input.due_at ?? null,
        created_at: createdAt,
        updated_at: createdAt,
        completed_at: null,
        deleted_at: null,
      })

      return { ok: true, data: task }
    },

    'task.update': (payload) => {
      const parsed = TaskUpdateInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.update payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const input = parsed.data
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const current = db
          .prepare(
            `SELECT is_inbox, is_someday, project_id, scheduled_at
             FROM tasks
             WHERE id = ? AND deleted_at IS NULL
             LIMIT 1`
          )
          .get(input.id) as
          | { is_inbox: number; is_someday: number; project_id: string | null; scheduled_at: string | null }
          | undefined
        if (!current) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Task not found.',
              details: { id: input.id },
            },
          }
        }

        const bucket = normalizeBucketFlags({
          isInbox: input.is_inbox !== undefined ? input.is_inbox : Boolean(current.is_inbox),
          isSomeday: input.is_someday !== undefined ? input.is_someday : Boolean(current.is_someday),
          scheduledAt: input.scheduled_at !== undefined ? input.scheduled_at : current.scheduled_at,
          projectId: input.project_id !== undefined ? input.project_id : current.project_id,
        })

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

        // Bucket-related fields are merged and normalized, so we update based on diff.
        if (bucket.isInbox !== Boolean(current.is_inbox)) {
          fields.push('is_inbox = @is_inbox')
          params.is_inbox = bucket.isInbox ? 1 : 0
        }
        if (bucket.isSomeday !== Boolean(current.is_someday)) {
          fields.push('is_someday = @is_someday')
          params.is_someday = bucket.isSomeday ? 1 : 0
        }
        if (bucket.projectId !== current.project_id) {
          fields.push('project_id = @project_id')
          params.project_id = bucket.projectId
        }
        if (input.section_id !== undefined) {
          fields.push('section_id = @section_id')
          params.section_id = input.section_id
        }
        if (input.area_id !== undefined) {
          fields.push('area_id = @area_id')
          params.area_id = input.area_id
        }
        if (bucket.scheduledAt !== current.scheduled_at) {
          fields.push('scheduled_at = @scheduled_at')
          params.scheduled_at = bucket.scheduledAt
        }
        if (input.due_at !== undefined) {
          fields.push('due_at = @due_at')
          params.due_at = input.due_at
        }

        if (fields.length === 0) {
          // Still touch updated_at to reflect a user-initiated edit.
          db.prepare('UPDATE tasks SET updated_at = @updated_at WHERE id = @id').run(params)
        } else {
          db.prepare(
            `UPDATE tasks SET ${fields.join(', ')}, updated_at = @updated_at WHERE id = @id`
          ).run(params)
        }

        const row = db
          .prepare(
            `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id, scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
             FROM tasks WHERE id = ? AND deleted_at IS NULL LIMIT 1`
          )
          .get(input.id)
        return { ok: true as const, data: TaskSchema.parse(row) }
      })

      return tx()
    },

    'task.toggleDone': (payload) => {
      const parsed = TaskToggleDoneInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.toggleDone payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const input = parsed.data
      const updatedAt = nowIso()
      const completedAt = input.done ? updatedAt : null

      const tx = db.transaction(() => {
        const res = db
          .prepare(
            `UPDATE tasks
             SET status = @status,
                 completed_at = @completed_at,
                 updated_at = @updated_at
             WHERE id = @id AND deleted_at IS NULL`
          )
          .run({
            id: input.id,
            status: input.done ? 'done' : 'open',
            completed_at: completedAt,
            updated_at: updatedAt,
          })

        if (res.changes === 0) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Task not found.',
              details: { id: input.id },
            },
          }
        }

        const row = db
          .prepare(
            `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id, scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
             FROM tasks WHERE id = ? AND deleted_at IS NULL LIMIT 1`
          )
          .get(input.id)
        return { ok: true as const, data: TaskSchema.parse(row) }
      })

      return tx()
    },

    'task.restore': (payload) => {
      const parsed = TaskRestoreInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.restore payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const updatedAt = nowIso()
      const tx = db.transaction(() => {
        const res = db
          .prepare(
            `UPDATE tasks
             SET status = 'open',
                 completed_at = NULL,
                 updated_at = @updated_at
             WHERE id = @id AND deleted_at IS NULL`
          )
          .run({ id: parsed.data.id, updated_at: updatedAt })
        if (res.changes === 0) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Task not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        const row = db
          .prepare(
            `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id, scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
             FROM tasks WHERE id = ? AND deleted_at IS NULL LIMIT 1`
          )
          .get(parsed.data.id)
        return { ok: true as const, data: TaskSchema.parse(row) }
      })

      return tx()
    },

    'task.delete': (payload) => {
      const parsed = TaskDeleteInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.delete payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const deletedAt = nowIso()

      const tx = db.transaction(() => {
        const res = db
          .prepare(
            `UPDATE tasks
             SET deleted_at = @deleted_at, updated_at = @updated_at
             WHERE id = @id AND deleted_at IS NULL`
          )
          .run({ id: parsed.data.id, deleted_at: deletedAt, updated_at: deletedAt })
        if (res.changes === 0) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Task not found.',
              details: { id: parsed.data.id },
            },
          }
        }

        return { ok: true as const, data: { deleted: true } }
      })

      return tx()
    },

    'task.rolloverScheduledToToday': (payload) => {
      const parsed = TaskRolloverScheduledToTodayInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.rolloverScheduledToToday payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const today = parsed.data.today
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const lastRow = db
          .prepare('SELECT value FROM app_settings WHERE key = ? LIMIT 1')
          .get(ROLLOVER_LAST_DATE_KEY) as { value?: unknown } | undefined
        const lastDate = lastRow && typeof lastRow.value === 'string' ? lastRow.value : null

        if (lastDate === today) {
          const anyEligible = db
            .prepare(
              `SELECT 1 AS one
               FROM tasks
               WHERE deleted_at IS NULL
                 AND status = 'open'
                 AND scheduled_at IS NOT NULL
                 AND scheduled_at < @today
               LIMIT 1`
            )
            .get({ today }) as { one?: number } | undefined
          if (!anyEligible) {
            return { rolled_count: 0 }
          }
        }

        const res = db
          .prepare(
            `UPDATE tasks
             SET scheduled_at = @today,
                 updated_at = @updated_at
             WHERE deleted_at IS NULL
               AND status = 'open'
               AND scheduled_at IS NOT NULL
               AND scheduled_at < @today`
          )
          .run({ today, updated_at: updatedAt })

        db.prepare(
          `INSERT INTO app_settings (key, value, updated_at)
           VALUES (@key, @value, @updated_at)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at`
        ).run({ key: ROLLOVER_LAST_DATE_KEY, value: today, updated_at: updatedAt })

        return { rolled_count: res.changes }
      })

      const result = tx()
      return { ok: true, data: TaskRolloverScheduledToTodayResultSchema.parse(result) }
    },

    'task.getDetail': (payload) => {
      const parsed = TaskIdInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.getDetail payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const row = db
        .prepare(
          `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id, scheduled_at, due_at,
                  created_at, updated_at, completed_at, deleted_at
           FROM tasks
           WHERE id = ? AND deleted_at IS NULL
           LIMIT 1`
        )
        .get(parsed.data.id)

      if (!row) {
        return {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Task not found.',
            details: { id: parsed.data.id },
          },
        }
      }

      const task = TaskSchema.parse(row)
      const tagIdRows = db
        .prepare(
          `SELECT tt.tag_id AS id
           FROM task_tags tt
           JOIN tags t ON t.id = tt.tag_id AND t.deleted_at IS NULL
           WHERE tt.task_id = ?
           ORDER BY tt.created_at ASC`
        )
        .all(parsed.data.id) as unknown[]

      const tagIds = z.array(TagIdRowSchema).parse(tagIdRows).map((r) => r.id)

      const checklistRows = db
        .prepare(
          `SELECT id, task_id, title, done, position, created_at, updated_at, deleted_at
           FROM task_checklist_items
           WHERE deleted_at IS NULL AND task_id = ?
           ORDER BY position ASC`
        )
        .all(parsed.data.id) as unknown[]

      const checklistItems = z.array(ChecklistDbRowSchema).parse(checklistRows)

      const detail = TaskDetailSchema.parse({
        task,
        tag_ids: tagIds,
        checklist_items: checklistItems,
      })

      return { ok: true, data: detail }
    },

    'task.listInbox': (payload) => {
      const parsed = TaskListInboxInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.listInbox payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const listId = TASK_LIST_ID_INBOX
      const rows = db
        .prepare(
          `SELECT
             t.id, t.title, t.status, t.is_inbox, t.is_someday, t.project_id, t.section_id, t.area_id,
             t.scheduled_at, t.due_at, t.created_at, t.updated_at, t.completed_at, t.deleted_at,
             lp.rank AS rank
           FROM tasks t
           LEFT JOIN list_positions lp
             ON lp.list_id = @list_id AND lp.task_id = t.id
           WHERE t.deleted_at IS NULL
             AND t.status = 'open'
             AND t.is_inbox = 1
           ORDER BY
             CASE WHEN lp.rank IS NULL THEN 1 ELSE 0 END,
             lp.rank ASC,
             t.created_at ASC`
        )
        .all({ list_id: listId })

      const items = z.array(TaskListItemSchema).parse(rows)
      return { ok: true, data: items }
    },

    'task.listAnytime': (payload) => {
      const parsed = TaskListAnytimeInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.listAnytime payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const listId = TASK_LIST_ID_ANYTIME
      const rows = db
        .prepare(
          `SELECT
             t.id, t.title, t.status, t.is_inbox, t.is_someday, t.project_id, t.section_id, t.area_id,
             t.scheduled_at, t.due_at, t.created_at, t.updated_at, t.completed_at, t.deleted_at,
             lp.rank AS rank
           FROM tasks t
           LEFT JOIN list_positions lp
             ON lp.list_id = @list_id AND lp.task_id = t.id
           WHERE t.deleted_at IS NULL
             AND t.status = 'open'
             AND t.scheduled_at IS NULL
             AND t.is_inbox = 0
             AND t.is_someday = 0
           ORDER BY
             CASE WHEN lp.rank IS NULL THEN 1 ELSE 0 END,
             lp.rank ASC,
             t.created_at ASC`
        )
        .all({ list_id: listId })

      const items = z.array(TaskListItemSchema).parse(rows)
      return { ok: true, data: items }
    },

    'task.listSomeday': (payload) => {
      const parsed = TaskListSomedayInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.listSomeday payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const listId = TASK_LIST_ID_SOMEDAY
      const rows = db
        .prepare(
          `SELECT
             t.id, t.title, t.status, t.is_inbox, t.is_someday, t.project_id, t.section_id, t.area_id,
             t.scheduled_at, t.due_at, t.created_at, t.updated_at, t.completed_at, t.deleted_at,
             lp.rank AS rank
           FROM tasks t
           LEFT JOIN list_positions lp
             ON lp.list_id = @list_id AND lp.task_id = t.id
           WHERE t.deleted_at IS NULL
             AND t.status = 'open'
             AND t.is_someday = 1
           ORDER BY
             CASE WHEN lp.rank IS NULL THEN 1 ELSE 0 END,
             lp.rank ASC,
             t.created_at ASC`
        )
        .all({ list_id: listId })

      const items = z.array(TaskListItemSchema).parse(rows)
      return { ok: true, data: items }
    },

    'task.listToday': (payload) => {
      const parsed = TaskListTodayInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.listToday payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const listId = TASK_LIST_ID_TODAY
      const rows = db
        .prepare(
          `SELECT
             t.id, t.title, t.status, t.is_inbox, t.is_someday, t.project_id, t.section_id, t.area_id,
             t.scheduled_at, t.due_at, t.created_at, t.updated_at, t.completed_at, t.deleted_at,
             lp.rank AS rank
           FROM tasks t
           LEFT JOIN list_positions lp
             ON lp.list_id = @list_id AND lp.task_id = t.id
           WHERE t.deleted_at IS NULL
             AND t.status = 'open'
             AND t.scheduled_at = @date
           ORDER BY
             CASE WHEN lp.rank IS NULL THEN 1 ELSE 0 END,
             lp.rank ASC,
             t.created_at ASC`
        )
        .all({ list_id: listId, date: parsed.data.date })

      const items = z.array(TaskListItemSchema).parse(rows)
      return { ok: true, data: items }
    },

    'task.listUpcoming': (payload) => {
      const parsed = TaskListUpcomingInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.listUpcoming payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const rows = db
        .prepare(
          `SELECT id, title, status, is_inbox, is_someday, project_id, section_id, area_id,
                  scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
           FROM tasks
           WHERE deleted_at IS NULL
             AND status = 'open'
             AND scheduled_at IS NOT NULL
             AND scheduled_at > @from_date
           ORDER BY scheduled_at ASC, created_at ASC`
        )
        .all({ from_date: parsed.data.from_date })

      const items = z.array(TaskListItemSchema).parse(rows)
      return { ok: true, data: items }
    },

    'task.listLogbook': (payload) => {
      const parsed = TaskListLogbookInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.listLogbook payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const rows = db
        .prepare(
          `SELECT id, title, status, is_inbox, is_someday, project_id, section_id, area_id,
                  scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
           FROM tasks
           WHERE deleted_at IS NULL
             AND status = 'done'
           ORDER BY completed_at DESC, updated_at DESC`
        )
        .all()

      const items = z.array(TaskListItemSchema).parse(rows)
      return { ok: true, data: items }
    },

    'task.listProject': (payload) => {
      const parsed = TaskListProjectInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.listProject payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const rows = db
        .prepare(
          `SELECT
             t.id, t.title, t.status, t.is_inbox, t.is_someday, t.project_id, t.section_id, t.area_id,
             t.scheduled_at, t.due_at, t.created_at, t.updated_at, t.completed_at, t.deleted_at,
             lp.rank AS rank
           FROM tasks t
           LEFT JOIN list_positions lp
             ON lp.task_id = t.id
            AND lp.list_id = ('project:' || @project_id || ':' || COALESCE(t.section_id, 'none'))
           WHERE t.deleted_at IS NULL
             AND t.status = 'open'
             AND t.project_id = @project_id
           ORDER BY
             CASE WHEN lp.rank IS NULL THEN 1 ELSE 0 END,
             lp.rank ASC,
             t.created_at ASC`
        )
        .all({ project_id: parsed.data.project_id })

      const items = z.array(TaskListItemSchema).parse(rows)
      return { ok: true, data: items }
    },

    'task.countProjectDone': (payload) => {
      const parsed = TaskCountProjectDoneInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.countProjectDone payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const row = db
        .prepare(
          `SELECT COUNT(1) AS count
           FROM tasks
           WHERE deleted_at IS NULL
             AND project_id = @project_id
             AND status = 'done'`
        )
        .get({ project_id: parsed.data.project_id }) as { count: number }

      return { ok: true, data: TaskCountResultSchema.parse({ count: row.count }) }
    },

    'task.countProjectsProgress': (payload) => {
      const parsed = TaskCountProjectsProgressInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.countProjectsProgress payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const uniqueProjectIds: string[] = []
      const seen = new Set<string>()
      for (const id of parsed.data.project_ids) {
        if (seen.has(id)) continue
        seen.add(id)
        uniqueProjectIds.push(id)
      }

      if (uniqueProjectIds.length === 0) {
        return { ok: true, data: TaskCountProjectsProgressResultSchema.parse([]) }
      }

      const placeholders = uniqueProjectIds.map(() => '?').join(', ')
      const rows = db
        .prepare(
          `SELECT
             project_id,
             COUNT(1) AS total_count,
             COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS done_count
           FROM tasks
           WHERE deleted_at IS NULL
             AND project_id IN (${placeholders})
             AND status IN ('open', 'done')
           GROUP BY project_id`
        )
        .all(...uniqueProjectIds) as unknown[]

      const parsedRows = TaskCountProjectsProgressResultSchema.parse(rows)
      const byProjectId = new Map<string, { total_count: number; done_count: number }>()
      for (const row of parsedRows) {
        byProjectId.set(row.project_id, { total_count: row.total_count, done_count: row.done_count })
      }

      const result = uniqueProjectIds.map((projectId) => {
        const counts = byProjectId.get(projectId) ?? { total_count: 0, done_count: 0 }
        return { project_id: projectId, total_count: counts.total_count, done_count: counts.done_count }
      })

      return { ok: true, data: TaskCountProjectsProgressResultSchema.parse(result) }
    },

    'task.listProjectDone': (payload) => {
      const parsed = TaskListProjectDoneInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.listProjectDone payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const rows = db
        .prepare(
          `SELECT
             t.id, t.title, t.status, t.is_inbox, t.is_someday, t.project_id, t.section_id, t.area_id,
             t.scheduled_at, t.due_at, t.created_at, t.updated_at, t.completed_at, t.deleted_at,
             lp.rank AS rank
           FROM tasks t
           LEFT JOIN list_positions lp
             ON lp.task_id = t.id
            AND lp.list_id = ('project:' || @project_id || ':' || COALESCE(t.section_id, 'none'))
           WHERE t.deleted_at IS NULL
             AND t.status = 'done'
             AND t.project_id = @project_id
           ORDER BY
             CASE WHEN lp.rank IS NULL THEN 1 ELSE 0 END,
             lp.rank ASC,
             t.created_at ASC`
        )
        .all({ project_id: parsed.data.project_id })

      const items = z.array(TaskListItemSchema).parse(rows)
      return { ok: true, data: items }
    },

    'task.listArea': (payload) => {
      const parsed = z.object({ area_id: z.string().min(1) }).safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.listArea payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const listId = taskListIdArea(parsed.data.area_id)
      const rows = db
        .prepare(
          `SELECT
             t.id, t.title, t.status, t.is_inbox, t.is_someday, t.project_id, t.section_id, t.area_id,
             t.scheduled_at, t.due_at, t.created_at, t.updated_at, t.completed_at, t.deleted_at,
             lp.rank AS rank
           FROM tasks t
           LEFT JOIN list_positions lp
             ON lp.list_id = @list_id AND lp.task_id = t.id
           WHERE t.deleted_at IS NULL
             AND t.status = 'open'
             AND (
               t.area_id = @area_id
               OR t.project_id IN (
                 SELECT id FROM projects WHERE deleted_at IS NULL AND area_id = @area_id
               )
             )
           ORDER BY
             CASE WHEN lp.rank IS NULL THEN 1 ELSE 0 END,
             lp.rank ASC,
             t.created_at ASC`
        )
        .all({ list_id: listId, area_id: parsed.data.area_id })

      const items = z.array(TaskListItemSchema).parse(rows)
      return { ok: true, data: items }
    },

    'task.search': (payload) => {
      const parsed = TaskSearchInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.search payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const includeLogbook = parsed.data.include_logbook ?? false

      const matchQuery = buildFts5PrefixMatchQuery(parsed.data.query)
      if (!matchQuery) {
        return { ok: true, data: [] }
      }

      try {
        const rows = db
          .prepare(
            `SELECT
               t.id, t.title, t.status, t.is_inbox, t.is_someday, t.project_id, t.section_id, t.area_id,
               t.scheduled_at, t.due_at, t.created_at, t.updated_at, t.completed_at, t.deleted_at,
               snippet(tasks_fts, -1, '[', ']', '…', 10) AS snippet
             FROM tasks_fts
             JOIN tasks t ON tasks_fts.rowid = t.rowid
             WHERE t.deleted_at IS NULL
               AND (${includeLogbook ? '1=1' : "t.status = 'open'"})
               AND tasks_fts MATCH @query
              ORDER BY bm25(tasks_fts) ASC
              LIMIT 200`
          )
          .all({ query: matchQuery })

        const items = z.array(TaskSearchResultItemSchema).parse(rows)
        return { ok: true, data: items }
      } catch (e) {
        return {
          ok: false,
          error: {
            code: 'SEARCH_FAILED',
            message: 'Search failed.',
            details: { error: String(e) },
          },
        }
      }
    },
  }
}
