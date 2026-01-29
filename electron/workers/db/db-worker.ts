import Database from 'better-sqlite3'
import { parentPort, workerData } from 'node:worker_threads'

import { DbWorkerRequestSchema } from '../../../shared/db-worker-protocol'
import type { DbWorkerRequest, DbWorkerResponse } from '../../../shared/db-worker-protocol'

import { createDbActions } from './actions/db-actions'
import { createTaskActions } from './actions/task-actions'
import { createProjectActions } from './actions/project-actions'
import { createAreaActions } from './actions/area-actions'
import { createTagActions } from './actions/tag-actions'
import { createChecklistActions } from './actions/checklist-actions'
import { createListPositionActions } from './actions/list-position-actions'
import { createDataTransferActions } from './actions/data-transfer-actions'
import type { DbActionHandler } from './actions/db-actions'

type WorkerData = {
  dbPath: string
}

function initDb(dbPath: string) {
  const db = new Database(dbPath)

  // Baseline pragmas (docs/tech-framework.md).
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  migrate(db)
  return db
}

function migrate(db: Database.Database) {
  const userVersion = db.pragma('user_version', { simple: true }) as number

  if (userVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS areas (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        color TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        area_id TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        scheduled_at TEXT,
        due_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        deleted_at TEXT,
        FOREIGN KEY (area_id) REFERENCES areas(id)
      );

      CREATE TABLE IF NOT EXISTS project_sections (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        base_list TEXT NOT NULL DEFAULT 'inbox',
        project_id TEXT,
        section_id TEXT,
        area_id TEXT,
        scheduled_at TEXT,
        due_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        deleted_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (section_id) REFERENCES project_sections(id),
        FOREIGN KEY (area_id) REFERENCES areas(id)
      );

      CREATE TABLE IF NOT EXISTS task_tags (
        task_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (task_id, tag_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (tag_id) REFERENCES tags(id)
      );

      CREATE TABLE IF NOT EXISTS task_checklist_items (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        title TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      );

      CREATE TABLE IF NOT EXISTS list_positions (
        list_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        rank INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (list_id, task_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_base_list ON tasks(base_list);
      CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_at ON tasks(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_section_id ON tasks(section_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_area_id ON tasks(area_id);
      CREATE INDEX IF NOT EXISTS idx_projects_area_id ON projects(area_id);
      CREATE INDEX IF NOT EXISTS idx_project_sections_project_id ON project_sections(project_id);
      CREATE INDEX IF NOT EXISTS idx_list_positions_list_rank ON list_positions(list_id, rank);

      CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
        title,
        notes,
        content='tasks',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks
      WHEN new.deleted_at IS NULL
      BEGIN
        INSERT INTO tasks_fts(rowid, title, notes) VALUES (new.rowid, new.title, new.notes);
      END;

      CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks
      WHEN old.deleted_at IS NULL
      BEGIN
        INSERT INTO tasks_fts(tasks_fts, rowid, title, notes) VALUES('delete', old.rowid, old.title, old.notes);
      END;

      CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE OF title, notes ON tasks
      WHEN old.deleted_at IS NULL AND new.deleted_at IS NULL
      BEGIN
        INSERT INTO tasks_fts(tasks_fts, rowid, title, notes) VALUES('delete', old.rowid, old.title, old.notes);
        INSERT INTO tasks_fts(rowid, title, notes) VALUES (new.rowid, new.title, new.notes);
      END;

      CREATE TRIGGER IF NOT EXISTS tasks_au_soft_delete AFTER UPDATE OF deleted_at ON tasks
      WHEN old.deleted_at IS NULL AND new.deleted_at IS NOT NULL
      BEGIN
        INSERT INTO tasks_fts(tasks_fts, rowid, title, notes) VALUES('delete', old.rowid, old.title, old.notes);
      END;

      CREATE TRIGGER IF NOT EXISTS tasks_au_restore AFTER UPDATE OF deleted_at ON tasks
      WHEN old.deleted_at IS NOT NULL AND new.deleted_at IS NULL
      BEGIN
        INSERT INTO tasks_fts(rowid, title, notes) VALUES (new.rowid, new.title, new.notes);
      END;
    `)

    db.pragma('user_version = 1')
  }
}

function respond(response: DbWorkerResponse) {
  parentPort?.postMessage(response)
}

function buildHandlers(db: Database.Database) {
  return {
    ...createDbActions(db),
    ...createTaskActions(db),
    ...createProjectActions(db),
    ...createAreaActions(db),
    ...createTagActions(db),
    ...createChecklistActions(db),
    ...createListPositionActions(db),
    ...createDataTransferActions(db),
  }
}

function handleRequest(handlers: Record<string, DbActionHandler>, req: DbWorkerRequest): DbWorkerResponse {
  try {
    const handler = handlers[req.action]
    if (!handler) {
      return {
        id: req.id,
        ok: false,
        error: {
          code: 'DB_UNKNOWN_ACTION',
          message: 'Unknown DB action.',
          details: { action: req.action },
        },
      }
    }

    const result = handler(req.payload)
    return { id: req.id, ...result }
  } catch (e) {
    return {
      id: req.id,
      ok: false,
      error: {
        code: 'DB_UNHANDLED',
        message: 'Unhandled DB error.',
        details: { error: String(e) },
      },
    }
  }
}

function main() {
  const data = workerData as WorkerData
  const db = initDb(data.dbPath)
  const handlers = buildHandlers(db)

  if (!parentPort) {
    throw new Error('DB worker started without parentPort')
  }

  parentPort.on('message', (raw) => {
    const parsed = DbWorkerRequestSchema.safeParse(raw)
    if (!parsed.success) {
      respond({
        id: 'unknown',
        ok: false,
        error: {
          code: 'DB_PROTOCOL_INVALID_REQUEST',
          message: 'Invalid DB worker request.',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    const res = handleRequest(handlers, parsed.data)
    respond(res)
  })
}

main()
