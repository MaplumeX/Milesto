import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'

import { nowIso, uuidv7 } from './utils'

import {
  TaskCreateInputSchema,
  TaskRestoreInputSchema,
  TaskSchema,
  TaskToggleDoneInputSchema,
  TaskUpdateInputSchema,
} from '../../../../shared/schemas/task'
import {
  TaskListBaseInputSchema,
  TaskListItemSchema,
  TaskListLogbookInputSchema,
  TaskListProjectInputSchema,
  TaskListTodayInputSchema,
  TaskListUpcomingInputSchema,
} from '../../../../shared/schemas/task-list'
import { TaskSearchInputSchema, TaskSearchResultItemSchema } from '../../../../shared/schemas/search'
import { TaskDetailSchema, TaskIdInputSchema } from '../../../../shared/schemas/task-detail'
import { ChecklistItemSchema } from '../../../../shared/schemas/checklist'

const TagIdRowSchema = z.object({ id: z.string() })
const ChecklistDbRowSchema = ChecklistItemSchema.extend({
  done: z.preprocess((v) => Boolean(v), z.boolean()),
})

export function createTaskActions(db: Database.Database): Record<string, DbActionHandler> {
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

      const insertTask = db.transaction(() => {
        const stmt = db.prepare(`
          INSERT INTO tasks (
            id, title, notes, status, base_list,
            project_id, section_id, area_id,
            scheduled_at, due_at,
            created_at, updated_at, completed_at, deleted_at
          ) VALUES (
            @id, @title, @notes, 'open', @base_list,
            @project_id, @section_id, @area_id,
            @scheduled_at, @due_at,
            @created_at, @updated_at, NULL, NULL
          )
        `)

        stmt.run({
          id,
          title: input.title,
          notes: input.notes ?? '',
          base_list: input.base_list ?? 'inbox',
          project_id: input.project_id ?? null,
          section_id: input.section_id ?? null,
          area_id: input.area_id ?? null,
          scheduled_at: input.scheduled_at ?? null,
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
        base_list: input.base_list ?? 'inbox',
        project_id: input.project_id ?? null,
        section_id: input.section_id ?? null,
        area_id: input.area_id ?? null,
        scheduled_at: input.scheduled_at ?? null,
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
            `SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL LIMIT 1`
          )
          .get(input.id)
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
        if (input.base_list !== undefined) {
          fields.push('base_list = @base_list')
          params.base_list = input.base_list
        }
        if (input.project_id !== undefined) {
          fields.push('project_id = @project_id')
          params.project_id = input.project_id
        }
        if (input.section_id !== undefined) {
          fields.push('section_id = @section_id')
          params.section_id = input.section_id
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
            `SELECT id, title, notes, status, base_list, project_id, section_id, area_id, scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
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
            `SELECT id, title, notes, status, base_list, project_id, section_id, area_id, scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
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
            `SELECT id, title, notes, status, base_list, project_id, section_id, area_id, scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
             FROM tasks WHERE id = ? AND deleted_at IS NULL LIMIT 1`
          )
          .get(parsed.data.id)
        return { ok: true as const, data: TaskSchema.parse(row) }
      })

      return tx()
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
          `SELECT id, title, notes, status, base_list, project_id, section_id, area_id, scheduled_at, due_at,
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

    'task.listBase': (payload) => {
      const parsed = TaskListBaseInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.listBase payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const rows = db
        .prepare(
          `SELECT id, title, status, base_list, project_id, section_id, area_id,
                  scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
           FROM tasks
           WHERE deleted_at IS NULL
             AND status = 'open'
             AND base_list = @base_list
             AND project_id IS NULL
           ORDER BY created_at ASC`
        )
        .all({ base_list: parsed.data.base_list })

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

      const listId = 'today'
      const rows = db
        .prepare(
          `SELECT
             t.id, t.title, t.status, t.base_list, t.project_id, t.section_id, t.area_id,
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
          `SELECT id, title, status, base_list, project_id, section_id, area_id,
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
          `SELECT id, title, status, base_list, project_id, section_id, area_id,
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
             t.id, t.title, t.status, t.base_list, t.project_id, t.section_id, t.area_id,
             t.scheduled_at, t.due_at, t.created_at, t.updated_at, t.completed_at, t.deleted_at,
             lp.rank AS rank
           FROM tasks t
           LEFT JOIN list_positions lp
             ON lp.task_id = t.id
            AND lp.list_id = ('project:' || @project_id || ':' || COALESCE(t.section_id, 'none'))
           WHERE t.deleted_at IS NULL
             AND t.status = 'open'
             AND t.project_id = @project_id
           ORDER BY t.created_at ASC`
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

      const rows = db
        .prepare(
          `SELECT id, title, status, base_list, project_id, section_id, area_id,
                  scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
           FROM tasks
           WHERE deleted_at IS NULL
             AND status = 'open'
             AND (
               area_id = @area_id
               OR project_id IN (
                 SELECT id FROM projects WHERE deleted_at IS NULL AND area_id = @area_id
               )
             )
           ORDER BY created_at ASC`
        )
        .all({ area_id: parsed.data.area_id })

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

      try {
        const rows = db
          .prepare(
            `SELECT
               t.id, t.title, t.status, t.base_list, t.project_id, t.section_id, t.area_id,
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
          .all({ query: parsed.data.query })

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
