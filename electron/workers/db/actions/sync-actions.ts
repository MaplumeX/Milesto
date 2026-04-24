import type Database from 'better-sqlite3'
import type { DbActionHandler } from './db-actions'

export function createSyncActions(db: Database.Database): Record<string, DbActionHandler> {
  return {
    'sync.getState': () => {
      const rows = db.prepare('SELECT key, value FROM sync_state').all() as Array<{ key: string; value: string }>
      const state = Object.fromEntries(rows.map((r) => [r.key, r.value]))
      return { ok: true, data: state }
    },

    'sync.getConfig': () => {
      const row = db.prepare(
        `SELECT key, value FROM sync_state WHERE key IN ('server_url', 'sync_token', 'sync_enabled')`
      ).all() as Array<{ key: string; value: string }>
      const map = Object.fromEntries(row.map((r) => [r.key, r.value]))
      return {
        ok: true,
        data: {
          server_url: map.server_url || '',
          sync_token: map.sync_token || '',
          sync_enabled: map.sync_enabled === 'true',
        },
      }
    },

    'sync.setConfig': (payload) => {
      const { server_url, sync_token, sync_enabled } = payload as {
        server_url: string
        sync_token: string
        sync_enabled: boolean
      }
      db.prepare(`INSERT INTO sync_state (key, value) VALUES ('server_url', ?), ('sync_token', ?), ('sync_enabled', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(server_url, sync_token, String(sync_enabled))
      return { ok: true, data: { saved: true } }
    },

    'sync.getLastSyncAt': () => {
      const row = db.prepare("SELECT value FROM sync_state WHERE key = 'last_sync_at'").get() as { value: string } | undefined
      return { ok: true, data: { last_sync_at: row?.value || null } }
    },

    'sync.setLastSyncAt': (payload) => {
      const { last_sync_at } = payload as { last_sync_at: string }
      db.prepare("INSERT INTO sync_state (key, value) VALUES ('last_sync_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(last_sync_at)
      return { ok: true, data: { saved: true } }
    },

    'sync.listPendingChanges': () => {
      const lastSyncRow = db.prepare("SELECT value FROM sync_state WHERE key = 'last_sync_at'").get() as { value: string } | undefined
      const lastSyncAt = lastSyncRow?.value || '1970-01-01T00:00:00Z'

      const tasks = queryTable(db, 'tasks', lastSyncAt, [
        ['id', 'id'], ['title', 'title'], ['notes', 'notes'], ['status', 'status'],
        ['is_inbox', 'is_inbox'], ['is_someday', 'is_someday'],
        ['project_id', 'project_id'], ['section_id', 'section_id'], ['area_id', 'area_id'],
        ['scheduled_at', 'scheduled_at'], ['due_at', 'due_at'],
        ['created_at', 'created_at'], ['completed_at', 'completed_at'],
      ])

      const projects = queryTable(db, 'projects', lastSyncAt, [
        ['id', 'id'], ['title', 'title'], ['notes', 'notes'],
        ['area_id', 'area_id'], ['status', 'status'],
        ['scheduled_at', 'scheduled_at'], ['is_someday', 'is_someday'], ['due_at', 'due_at'],
        ['created_at', 'created_at'], ['completed_at', 'completed_at'],
      ])

      const areas = queryTable(db, 'areas', lastSyncAt, [
        ['id', 'id'], ['title', 'title'], ['notes', 'notes'], ['created_at', 'created_at'],
      ])

      const tags = queryTable(db, 'tags', lastSyncAt, [
        ['id', 'id'], ['title', 'title'], ['color', 'color'], ['created_at', 'created_at'],
      ])

      const checklistItems = queryTable(db, 'task_checklist_items', lastSyncAt, [
        ['id', 'id'], ['task_id', 'task_id'], ['title', 'title'],
        ['done', 'done'], ['position', 'position'], ['created_at', 'created_at'],
      ])

      const projectSections = queryTable(db, 'project_sections', lastSyncAt, [
        ['id', 'id'], ['project_id', 'project_id'], ['title', 'title'],
        ['position', 'position'], ['created_at', 'created_at'],
      ])

      const listPositions = db.prepare(`
        SELECT 'list_position' as entity_type,
          (list_id || ':' || task_id) as entity_id,
          updated_at, NULL as deleted_at,
          json_object('list_id', list_id, 'task_id', task_id, 'rank', rank) as payload
        FROM list_positions WHERE updated_at > ?
      `).all(lastSyncAt) as Array<{ entity_type: string; entity_id: string; updated_at: string; deleted_at: string | null; payload: string }>

      const viewPositions = db.prepare(`
        SELECT 'view_position' as entity_type,
          (list_id || ':' || entity_type || ':' || entity_id) as entity_id,
          updated_at, NULL as deleted_at,
          json_object('list_id', list_id, 'entity_type', entity_type, 'entity_id', entity_id, 'rank', rank) as payload
        FROM view_positions WHERE updated_at > ?
      `).all(lastSyncAt) as Array<{ entity_type: string; entity_id: string; updated_at: string; deleted_at: string | null; payload: string }>

      const taskTags = db.prepare(`
        SELECT 'task_tag' as entity_type,
          (task_id || ':' || tag_id) as entity_id,
          updated_at, deleted_at,
          json_object('task_id', task_id, 'tag_id', tag_id, 'created_at', created_at) as payload
        FROM task_tags WHERE updated_at > ?
      `).all(lastSyncAt) as Array<{ entity_type: string; entity_id: string; updated_at: string; deleted_at: string | null; payload: string }>

      const projectTags = db.prepare(`
        SELECT 'project_tag' as entity_type,
          (project_id || ':' || tag_id) as entity_id,
          updated_at, deleted_at,
          json_object('project_id', project_id, 'tag_id', tag_id, 'position', position, 'created_at', created_at) as payload
        FROM project_tags WHERE updated_at > ?
      `).all(lastSyncAt) as Array<{ entity_type: string; entity_id: string; updated_at: string; deleted_at: string | null; payload: string }>

      const areaTags = db.prepare(`
        SELECT 'area_tag' as entity_type,
          (area_id || ':' || tag_id) as entity_id,
          updated_at, deleted_at,
          json_object('area_id', area_id, 'tag_id', tag_id, 'position', position, 'created_at', created_at) as payload
        FROM area_tags WHERE updated_at > ?
      `).all(lastSyncAt) as Array<{ entity_type: string; entity_id: string; updated_at: string; deleted_at: string | null; payload: string }>

      return {
        ok: true,
        data: [
          ...tasks, ...projects, ...areas, ...tags,
          ...checklistItems, ...projectSections,
          ...listPositions.map((r) => ({ ...r, payload: JSON.parse(r.payload) as Record<string, unknown> })),
          ...viewPositions.map((r) => ({ ...r, payload: JSON.parse(r.payload) as Record<string, unknown> })),
          ...taskTags.map((r) => ({ ...r, payload: JSON.parse(r.payload) as Record<string, unknown> })),
          ...projectTags.map((r) => ({ ...r, payload: JSON.parse(r.payload) as Record<string, unknown> })),
          ...areaTags.map((r) => ({ ...r, payload: JSON.parse(r.payload) as Record<string, unknown> })),
        ],
      }
    },

    'sync.applyRemote': (payload) => {
      const { entity_type, entity_id, updated_at, deleted_at, payload: entityPayload } = payload as {
        entity_type: string
        entity_id: string
        updated_at: string
        deleted_at: string | null
        payload: Record<string, unknown>
      }

      const tx = db.transaction(() => {
        switch (entity_type) {
          case 'task':
            return applyRemoteTask(db, entity_id, updated_at, deleted_at, entityPayload)
          case 'project':
            return applyRemoteProject(db, entity_id, updated_at, deleted_at, entityPayload)
          case 'area':
            return applyRemoteArea(db, entity_id, updated_at, deleted_at, entityPayload)
          case 'tag':
            return applyRemoteTag(db, entity_id, updated_at, deleted_at, entityPayload)
          case 'checklist_item':
            return applyRemoteChecklistItem(db, entity_id, updated_at, deleted_at, entityPayload)
          case 'project_section':
            return applyRemoteProjectSection(db, entity_id, updated_at, deleted_at, entityPayload)
          case 'list_position':
            return applyRemoteListPosition(db, entity_id, updated_at, entityPayload)
          case 'view_position':
            return applyRemoteViewPosition(db, entity_id, updated_at, entityPayload)
          case 'task_tag':
            return applyRemoteTaskTag(db, entity_id, updated_at, deleted_at, entityPayload)
          case 'project_tag':
            return applyRemoteProjectTag(db, entity_id, updated_at, deleted_at, entityPayload)
          case 'area_tag':
            return applyRemoteAreaTag(db, entity_id, updated_at, deleted_at, entityPayload)
          default:
            return { applied: false, reason: 'unknown_entity_type' }
        }
      })

      return { ok: true, data: tx() }
    },
  }
}

function queryTable(
  db: Database.Database,
  table: string,
  lastSyncAt: string,
  fields: Array<[string, string]>
): Array<Record<string, unknown>> {
  const jsonFields = fields.map(([alias, col]) => `'${alias}', ${col}`).join(', ')
  const rows = db.prepare(`
    SELECT '${table.slice(0, -1)}' as entity_type, id as entity_id, updated_at, deleted_at,
      json_object(${jsonFields}) as payload
    FROM ${table} WHERE updated_at > ?
  `).all(lastSyncAt) as Array<{ entity_type: string; entity_id: string; updated_at: string; deleted_at: string | null; payload: string }>

  return rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) as Record<string, unknown> }))
}

function lwwCheck(db: Database.Database, table: string, id: string, updatedAt: string): boolean {
  const existing = db.prepare(`SELECT updated_at FROM ${table} WHERE id = ?`).get(id) as { updated_at: string } | undefined
  return !existing || existing.updated_at < updatedAt
}

function applyRemoteTask(
  db: Database.Database,
  id: string,
  updatedAt: string,
  deletedAt: string | null,
  payload: Record<string, unknown>
): { applied: boolean; reason?: string } {
  if (!lwwCheck(db, 'tasks', id, updatedAt)) return { applied: false, reason: 'local_is_newer' }

  db.prepare(`
    INSERT INTO tasks (id, title, notes, status, is_inbox, is_someday, project_id, section_id, area_id, scheduled_at, due_at, created_at, updated_at, completed_at, deleted_at)
    VALUES (:id, :title, :notes, :status, :is_inbox, :is_someday, :project_id, :section_id, :area_id, :scheduled_at, :due_at, :created_at, :updated_at, :completed_at, :deleted_at)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, notes = excluded.notes, status = excluded.status,
      is_inbox = excluded.is_inbox, is_someday = excluded.is_someday,
      project_id = excluded.project_id, section_id = excluded.section_id, area_id = excluded.area_id,
      scheduled_at = excluded.scheduled_at, due_at = excluded.due_at,
      completed_at = excluded.completed_at, deleted_at = excluded.deleted_at, updated_at = excluded.updated_at
  `).run({
    id, title: payload.title, notes: payload.notes || '', status: payload.status,
    is_inbox: payload.is_inbox ?? 0, is_someday: payload.is_someday ?? 0,
    project_id: payload.project_id, section_id: payload.section_id, area_id: payload.area_id,
    scheduled_at: payload.scheduled_at, due_at: payload.due_at,
    created_at: payload.created_at, updated_at: updatedAt,
    completed_at: payload.completed_at, deleted_at: deletedAt,
  })

  return { applied: true }
}

function applyRemoteProject(
  db: Database.Database,
  id: string,
  updatedAt: string,
  deletedAt: string | null,
  payload: Record<string, unknown>
): { applied: boolean; reason?: string } {
  if (!lwwCheck(db, 'projects', id, updatedAt)) return { applied: false, reason: 'local_is_newer' }

  db.prepare(`
    INSERT INTO projects (id, title, notes, area_id, status, scheduled_at, is_someday, due_at, created_at, updated_at, completed_at, deleted_at)
    VALUES (:id, :title, :notes, :area_id, :status, :scheduled_at, :is_someday, :due_at, :created_at, :updated_at, :completed_at, :deleted_at)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, notes = excluded.notes, area_id = excluded.area_id,
      status = excluded.status, scheduled_at = excluded.scheduled_at, is_someday = excluded.is_someday,
      due_at = excluded.due_at, completed_at = excluded.completed_at,
      deleted_at = excluded.deleted_at, updated_at = excluded.updated_at
  `).run({
    id, title: payload.title, notes: payload.notes || '', area_id: payload.area_id,
    status: payload.status || 'open', scheduled_at: payload.scheduled_at,
    is_someday: payload.is_someday ?? 0, due_at: payload.due_at,
    created_at: payload.created_at, updated_at: updatedAt,
    completed_at: payload.completed_at, deleted_at: deletedAt,
  })

  return { applied: true }
}

function applyRemoteArea(
  db: Database.Database,
  id: string,
  updatedAt: string,
  deletedAt: string | null,
  payload: Record<string, unknown>
): { applied: boolean; reason?: string } {
  if (!lwwCheck(db, 'areas', id, updatedAt)) return { applied: false, reason: 'local_is_newer' }

  db.prepare(`
    INSERT INTO areas (id, title, notes, created_at, updated_at, deleted_at)
    VALUES (:id, :title, :notes, :created_at, :updated_at, :deleted_at)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, notes = excluded.notes,
      deleted_at = excluded.deleted_at, updated_at = excluded.updated_at
  `).run({
    id, title: payload.title, notes: payload.notes || '',
    created_at: payload.created_at, updated_at: updatedAt, deleted_at: deletedAt,
  })

  return { applied: true }
}

function applyRemoteTag(
  db: Database.Database,
  id: string,
  updatedAt: string,
  deletedAt: string | null,
  payload: Record<string, unknown>
): { applied: boolean; reason?: string } {
  if (!lwwCheck(db, 'tags', id, updatedAt)) return { applied: false, reason: 'local_is_newer' }

  db.prepare(`
    INSERT INTO tags (id, title, color, created_at, updated_at, deleted_at)
    VALUES (:id, :title, :color, :created_at, :updated_at, :deleted_at)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, color = excluded.color,
      deleted_at = excluded.deleted_at, updated_at = excluded.updated_at
  `).run({
    id, title: payload.title, color: payload.color,
    created_at: payload.created_at, updated_at: updatedAt, deleted_at: deletedAt,
  })

  return { applied: true }
}

function applyRemoteChecklistItem(
  db: Database.Database,
  id: string,
  updatedAt: string,
  deletedAt: string | null,
  payload: Record<string, unknown>
): { applied: boolean; reason?: string } {
  if (!lwwCheck(db, 'task_checklist_items', id, updatedAt)) return { applied: false, reason: 'local_is_newer' }

  db.prepare(`
    INSERT INTO task_checklist_items (id, task_id, title, done, position, created_at, updated_at, deleted_at)
    VALUES (:id, :task_id, :title, :done, :position, :created_at, :updated_at, :deleted_at)
    ON CONFLICT(id) DO UPDATE SET
      task_id = excluded.task_id, title = excluded.title, done = excluded.done,
      position = excluded.position, deleted_at = excluded.deleted_at, updated_at = excluded.updated_at
  `).run({
    id, task_id: payload.task_id, title: payload.title,
    done: payload.done ?? 0, position: payload.position,
    created_at: payload.created_at, updated_at: updatedAt, deleted_at: deletedAt,
  })

  return { applied: true }
}

function applyRemoteProjectSection(
  db: Database.Database,
  id: string,
  updatedAt: string,
  deletedAt: string | null,
  payload: Record<string, unknown>
): { applied: boolean; reason?: string } {
  if (!lwwCheck(db, 'project_sections', id, updatedAt)) return { applied: false, reason: 'local_is_newer' }

  db.prepare(`
    INSERT INTO project_sections (id, project_id, title, position, created_at, updated_at, deleted_at)
    VALUES (:id, :project_id, :title, :position, :created_at, :updated_at, :deleted_at)
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id, title = excluded.title, position = excluded.position,
      deleted_at = excluded.deleted_at, updated_at = excluded.updated_at
  `).run({
    id, project_id: payload.project_id, title: payload.title, position: payload.position,
    created_at: payload.created_at, updated_at: updatedAt, deleted_at: deletedAt,
  })

  return { applied: true }
}

function applyRemoteListPosition(
  db: Database.Database,
  _compositeId: string,
  updatedAt: string,
  payload: Record<string, unknown>
): { applied: boolean; reason?: string } {
  const listId = payload.list_id as string
  const taskId = payload.task_id as string
  if (!listId || !taskId) return { applied: false, reason: 'invalid_composite_id' }

  db.prepare(`
    INSERT INTO list_positions (list_id, task_id, rank, updated_at)
    VALUES (:list_id, :task_id, :rank, :updated_at)
    ON CONFLICT(list_id, task_id) DO UPDATE SET
      rank = excluded.rank, updated_at = excluded.updated_at
  `).run({
    list_id: listId, task_id: taskId, rank: payload.rank, updated_at: updatedAt,
  })

  return { applied: true }
}

function applyRemoteViewPosition(
  db: Database.Database,
  _compositeId: string,
  updatedAt: string,
  payload: Record<string, unknown>
): { applied: boolean; reason?: string } {
  const listId = payload.list_id as string
  const entityType = payload.entity_type as string
  const entityId = payload.entity_id as string
  if (!listId || (entityType !== 'task' && entityType !== 'project') || !entityId) {
    return { applied: false, reason: 'invalid_composite_id' }
  }

  db.prepare(`
    INSERT INTO view_positions (list_id, entity_type, entity_id, rank, updated_at)
    VALUES (:list_id, :entity_type, :entity_id, :rank, :updated_at)
    ON CONFLICT(list_id, entity_type, entity_id) DO UPDATE SET
      rank = excluded.rank, updated_at = excluded.updated_at
  `).run({
    list_id: listId,
    entity_type: entityType,
    entity_id: entityId,
    rank: payload.rank,
    updated_at: updatedAt,
  })

  return { applied: true }
}

function applyRemoteTaskTag(
  db: Database.Database,
  _compositeId: string,
  updatedAt: string,
  deletedAt: string | null,
  payload: Record<string, unknown>
): { applied: boolean; reason?: string } {
  const taskId = payload.task_id as string
  const tagId = payload.tag_id as string
  if (!taskId || !tagId) return { applied: false, reason: 'invalid_composite_id' }

  if (deletedAt) {
    db.prepare(`
      UPDATE task_tags SET updated_at = :updated_at, deleted_at = :deleted_at
      WHERE task_id = :task_id AND tag_id = :tag_id
    `).run({ task_id: taskId, tag_id: tagId, updated_at: updatedAt, deleted_at: deletedAt })
  } else {
    db.prepare(`
      INSERT INTO task_tags (task_id, tag_id, created_at, updated_at, deleted_at)
      VALUES (:task_id, :tag_id, :created_at, :updated_at, NULL)
      ON CONFLICT(task_id, tag_id) DO UPDATE SET
        updated_at = excluded.updated_at, deleted_at = NULL
    `).run({
      task_id: taskId, tag_id: tagId,
      created_at: payload.created_at ?? updatedAt, updated_at: updatedAt,
    })
  }

  return { applied: true }
}

function applyRemoteProjectTag(
  db: Database.Database,
  _compositeId: string,
  updatedAt: string,
  deletedAt: string | null,
  payload: Record<string, unknown>
): { applied: boolean; reason?: string } {
  const projectId = payload.project_id as string
  const tagId = payload.tag_id as string
  if (!projectId || !tagId) return { applied: false, reason: 'invalid_composite_id' }

  if (deletedAt) {
    db.prepare(`
      UPDATE project_tags SET updated_at = :updated_at, deleted_at = :deleted_at
      WHERE project_id = :project_id AND tag_id = :tag_id
    `).run({ project_id: projectId, tag_id: tagId, updated_at: updatedAt, deleted_at: deletedAt })
  } else {
    db.prepare(`
      INSERT INTO project_tags (project_id, tag_id, position, created_at, updated_at, deleted_at)
      VALUES (:project_id, :tag_id, :position, :created_at, :updated_at, NULL)
      ON CONFLICT(project_id, tag_id) DO UPDATE SET
        position = excluded.position, updated_at = excluded.updated_at, deleted_at = NULL
    `).run({
      project_id: projectId, tag_id: tagId, position: payload.position,
      created_at: payload.created_at ?? updatedAt, updated_at: updatedAt,
    })
  }

  return { applied: true }
}

function applyRemoteAreaTag(
  db: Database.Database,
  _compositeId: string,
  updatedAt: string,
  deletedAt: string | null,
  payload: Record<string, unknown>
): { applied: boolean; reason?: string } {
  const areaId = payload.area_id as string
  const tagId = payload.tag_id as string
  if (!areaId || !tagId) return { applied: false, reason: 'invalid_composite_id' }

  if (deletedAt) {
    db.prepare(`
      UPDATE area_tags SET updated_at = :updated_at, deleted_at = :deleted_at
      WHERE area_id = :area_id AND tag_id = :tag_id
    `).run({ area_id: areaId, tag_id: tagId, updated_at: updatedAt, deleted_at: deletedAt })
  } else {
    db.prepare(`
      INSERT INTO area_tags (area_id, tag_id, position, created_at, updated_at, deleted_at)
      VALUES (:area_id, :tag_id, :position, :created_at, :updated_at, NULL)
      ON CONFLICT(area_id, tag_id) DO UPDATE SET
        position = excluded.position, updated_at = excluded.updated_at, deleted_at = NULL
    `).run({
      area_id: areaId, tag_id: tagId, position: payload.position,
      created_at: payload.created_at ?? updatedAt, updated_at: updatedAt,
    })
  }

  return { applied: true }
}
