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
              `SELECT id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id, scheduled_at, due_at,
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
               `SELECT id, title, notes, area_id, status, scheduled_at, is_someday, due_at,
                       position, created_at, updated_at, completed_at, deleted_at
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
              `SELECT id, title, notes, position, created_at, updated_at, deleted_at
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

      const projectTags = z
        .array(z.object({ project_id: z.string(), tag_id: z.string(), position: z.number().int() }))
        .parse(
          db
            .prepare(
              `SELECT pt.project_id, pt.tag_id, pt.position
               FROM project_tags pt
               JOIN projects p ON p.id = pt.project_id AND p.deleted_at IS NULL
               JOIN tags g ON g.id = pt.tag_id AND g.deleted_at IS NULL
               ORDER BY pt.project_id ASC, pt.position ASC`
            )
            .all()
        )

      const areaTags = z
        .array(z.object({ area_id: z.string(), tag_id: z.string(), position: z.number().int() }))
        .parse(
          db
            .prepare(
              `SELECT at.area_id, at.tag_id, at.position
               FROM area_tags at
               JOIN areas a ON a.id = at.area_id AND a.deleted_at IS NULL
               JOIN tags g ON g.id = at.tag_id AND g.deleted_at IS NULL
               ORDER BY at.area_id ASC, at.position ASC`
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
               `SELECT lp.list_id, lp.task_id, lp.rank, lp.updated_at AS updated_at
                FROM list_positions lp
                JOIN tasks t ON t.id = lp.task_id AND t.deleted_at IS NULL`
              )
             .all()
         )

      const exportData = DataExportSchema.parse({
        schema_version: 3,
        app_version: parsed.data.app_version,
        exported_at: exportedAt,
        tasks,
        projects,
        project_sections: projectSections,
        areas,
        tags,
        task_tags: taskTags,
        project_tags: projectTags,
        area_tags: areaTags,
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
      const projectTags = data.schema_version === 3 ? data.project_tags : []
      const areaTags = data.schema_version === 3 ? data.area_tags : []

      const tx = db.transaction(() => {
        db.exec(`
          -- Keep app_settings (e.g. locale preference) when importing.
          DELETE FROM task_tags;
          DELETE FROM project_tags;
          DELETE FROM area_tags;
          DELETE FROM task_checklist_items;
          DELETE FROM list_positions;
          DELETE FROM tasks;
          DELETE FROM project_sections;
          DELETE FROM projects;
          DELETE FROM tags;
          DELETE FROM areas;
        `)

        const insertArea = db.prepare(
          `INSERT INTO areas (id, title, notes, position, created_at, updated_at, deleted_at)
           VALUES (@id, @title, @notes, @position, @created_at, @updated_at, @deleted_at)`
        )
        for (const area of data.areas) {
          insertArea.run({ ...area, position: area.position ?? null })
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
             id, title, notes, area_id, status, position, scheduled_at, is_someday, due_at,
             created_at, updated_at, completed_at, deleted_at
           ) VALUES (
             @id, @title, @notes, @area_id, @status, @position, @scheduled_at, @is_someday, @due_at,
             @created_at, @updated_at, @completed_at, @deleted_at
           )`
        )
        for (const project of data.projects) {
          const isSomeday = project.is_someday ? 1 : 0
          const scheduledAt = isSomeday ? null : project.scheduled_at

          insertProject.run({
            ...project,
            position: project.position ?? null,
            scheduled_at: scheduledAt,
            is_someday: scheduledAt !== null ? 0 : isSomeday,
          })
        }

        if (projectTags.length > 0) {
          const insertProjectTag = db.prepare(
            `INSERT INTO project_tags (project_id, tag_id, position, created_at)
             VALUES (@project_id, @tag_id, @position, @created_at)`
          )
          const relCreatedAt = nowIso()
          for (const rel of projectTags) {
            insertProjectTag.run({ ...rel, created_at: relCreatedAt })
          }
        }

        if (areaTags.length > 0) {
          const insertAreaTag = db.prepare(
            `INSERT INTO area_tags (area_id, tag_id, position, created_at)
             VALUES (@area_id, @tag_id, @position, @created_at)`
          )
          const relCreatedAt = nowIso()
          for (const rel of areaTags) {
            insertAreaTag.run({ ...rel, created_at: relCreatedAt })
          }
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
             id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id,
             scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at
           ) VALUES (
             @id, @title, @notes, @status, @is_inbox, @is_someday, @project_id, @section_id, @area_id,
             @scheduled_at, @due_at, @created_at, @updated_at, @completed_at, @deleted_at
           )`
        )
        for (const task of data.tasks) {
          insertTask.run({
            ...task,
            is_inbox: task.is_inbox ? 1 : 0,
            is_someday: task.is_someday ? 1 : 0,
          })
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
