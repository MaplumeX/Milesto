import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { nowIso } from './utils'

import { DataExportInputSchema, DataExportSchema, DataImportOverwriteInputSchema } from '../../../../shared/schemas/data-transfer'
import {
  AreaSchema,
  ChecklistItemSchema,
  ListPositionSchema,
  ProjectSchema,
  ProjectSectionSchema,
  TagSchema,
  TaskSchema,
} from '../../../../shared/schemas'

const ChecklistDbRowSchema = ChecklistItemSchema.extend({
  done: z.preprocess((v) => Boolean(v), z.boolean()),
})

export function createDataTransferActions(db: Database.Database): Record<string, DbActionHandler> {
  return {
    'data.export': (payload) => {
      const parsed = DataExportInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid data.export payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const exportedAt = nowIso()

      const tasks = z
        .array(TaskSchema)
        .parse(
          db
            .prepare(
              `SELECT id, title, notes, status, base_list, project_id, section_id, area_id, scheduled_at, due_at,
                      created_at, updated_at, completed_at, deleted_at
               FROM tasks
               WHERE deleted_at IS NULL`
            )
            .all()
        )

      const projects = z
        .array(ProjectSchema)
        .parse(
          db
            .prepare(
              `SELECT id, title, notes, area_id, status, scheduled_at, due_at,
                      created_at, updated_at, completed_at, deleted_at
               FROM projects
               WHERE deleted_at IS NULL`
            )
            .all()
        )

      const projectSections = z
        .array(ProjectSectionSchema)
        .parse(
          db
            .prepare(
              `SELECT id, project_id, title, position, created_at, updated_at, deleted_at
               FROM project_sections
               WHERE deleted_at IS NULL`
            )
            .all()
        )

      const areas = z
        .array(AreaSchema)
        .parse(
          db
            .prepare(
              `SELECT id, title, notes, created_at, updated_at, deleted_at
               FROM areas
               WHERE deleted_at IS NULL`
            )
            .all()
        )

      const tags = z
        .array(TagSchema)
        .parse(
          db
            .prepare(
              `SELECT id, title, color, created_at, updated_at, deleted_at
               FROM tags
               WHERE deleted_at IS NULL`
            )
            .all()
        )

      const taskTags = z
        .array(z.object({ task_id: z.string(), tag_id: z.string() }))
        .parse(
          db
            .prepare(
              `SELECT tt.task_id, tt.tag_id
               FROM task_tags tt
               JOIN tasks t ON t.id = tt.task_id AND t.deleted_at IS NULL
               JOIN tags g ON g.id = tt.tag_id AND g.deleted_at IS NULL`
            )
            .all()
        )

      const checklistItems = z
        .array(ChecklistDbRowSchema)
        .parse(
          db
            .prepare(
              `SELECT id, task_id, title, done, position, created_at, updated_at, deleted_at
               FROM task_checklist_items
               WHERE deleted_at IS NULL`
            )
            .all() as unknown[]
        )

      const listPositions = z
        .array(ListPositionSchema)
        .parse(
          db
            .prepare(
              `SELECT list_id, task_id, rank, updated_at
               FROM list_positions lp
               JOIN tasks t ON t.id = lp.task_id AND t.deleted_at IS NULL`
            )
            .all()
        )

      const exportData = DataExportSchema.parse({
        schema_version: 1,
        app_version: parsed.data.app_version,
        exported_at: exportedAt,
        tasks,
        projects,
        project_sections: projectSections,
        areas,
        tags,
        task_tags: taskTags,
        checklist_items: checklistItems,
        list_positions: listPositions,
      })

      return { ok: true, data: exportData }
    },

    'data.importOverwrite': (payload) => {
      const parsed = DataImportOverwriteInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid data.importOverwrite payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const data = parsed.data.data

      const tx = db.transaction(() => {
        db.exec(`
          DELETE FROM task_tags;
          DELETE FROM task_checklist_items;
          DELETE FROM list_positions;
          DELETE FROM tasks;
          DELETE FROM project_sections;
          DELETE FROM projects;
          DELETE FROM tags;
          DELETE FROM areas;
        `)

        const insertArea = db.prepare(
          `INSERT INTO areas (id, title, notes, created_at, updated_at, deleted_at)
           VALUES (@id, @title, @notes, @created_at, @updated_at, @deleted_at)`
        )
        for (const area of data.areas) {
          insertArea.run(area)
        }

        const insertTag = db.prepare(
          `INSERT INTO tags (id, title, color, created_at, updated_at, deleted_at)
           VALUES (@id, @title, @color, @created_at, @updated_at, @deleted_at)`
        )
        for (const tag of data.tags) {
          insertTag.run(tag)
        }

        const insertProject = db.prepare(
          `INSERT INTO projects (
             id, title, notes, area_id, status, scheduled_at, due_at,
             created_at, updated_at, completed_at, deleted_at
           ) VALUES (
             @id, @title, @notes, @area_id, @status, @scheduled_at, @due_at,
             @created_at, @updated_at, @completed_at, @deleted_at
           )`
        )
        for (const project of data.projects) {
          insertProject.run(project)
        }

        const insertSection = db.prepare(
          `INSERT INTO project_sections (
             id, project_id, title, position, created_at, updated_at, deleted_at
           ) VALUES (
             @id, @project_id, @title, @position, @created_at, @updated_at, @deleted_at
           )`
        )
        for (const section of data.project_sections) {
          insertSection.run(section)
        }

        const insertTask = db.prepare(
          `INSERT INTO tasks (
             id, title, notes, status, base_list, project_id, section_id, area_id,
             scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
           ) VALUES (
             @id, @title, @notes, @status, @base_list, @project_id, @section_id, @area_id,
             @scheduled_at, @due_at, @created_at, @updated_at, @completed_at, @deleted_at
           )`
        )
        for (const task of data.tasks) {
          insertTask.run(task)
        }

        const insertTaskTag = db.prepare(
          `INSERT INTO task_tags (task_id, tag_id, created_at)
           VALUES (@task_id, @tag_id, @created_at)`
        )
        const tagCreatedAt = nowIso()
        for (const rel of data.task_tags) {
          insertTaskTag.run({ ...rel, created_at: tagCreatedAt })
        }

        const insertChecklist = db.prepare(
          `INSERT INTO task_checklist_items (
             id, task_id, title, done, position, created_at, updated_at, deleted_at
           ) VALUES (
             @id, @task_id, @title, @done, @position, @created_at, @updated_at, @deleted_at
           )`
        )
        for (const item of data.checklist_items) {
          insertChecklist.run({ ...item, done: item.done ? 1 : 0 })
        }

        const insertPos = db.prepare(
          `INSERT INTO list_positions (list_id, task_id, rank, updated_at)
           VALUES (@list_id, @task_id, @rank, @updated_at)`
        )
        for (const pos of data.list_positions) {
          insertPos.run(pos)
        }

        return { ok: true as const, data: { imported: true } }
      })

      return tx()
    },
  }
}
