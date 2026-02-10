import type Database from 'better-sqlite3'

import type { AppError } from '../../../../shared/app-error'

export type DbActionResult =
  | { ok: true; data: unknown }
  | { ok: false; error: AppError }

export type DbActionHandler = (payload: unknown) => DbActionResult

export function createDbActions(db: Database.Database): Record<string, DbActionHandler> {
  return {
    'db.ping': () => ({ ok: true, data: { pong: true } }),

    'db.resetAllData': () => {
      const tx = db.transaction(() => {
        db.exec(`
          -- Keep app_settings (e.g. locale preference).
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
      })
      tx()
      return { ok: true, data: { reset: true } }
    },
  }
}
