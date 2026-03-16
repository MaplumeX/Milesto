import type Database from 'better-sqlite3'

import {
  AreaSchema,
  ChecklistItemSchema,
  ProjectSchema,
  ProjectSectionSchema,
  SyncApplyRemoteBatchInputSchema,
  SyncApplyRemoteBatchResultSchema,
  SyncBatchSchema,
  SyncConflictEventSchema,
  SyncCursorSchema,
  SyncDbStateSchema,
  SyncEntityTypeSchema,
  SyncPendingOutboxBatchSchema,
  SyncRelationTypeSchema,
  SyncRepositoryConfigSchema,
  TagSchema,
  TaskSchema,
  type SyncApplyRemoteBatchResult,
  type SyncBatch,
  type SyncConflictEvent,
  type SyncCursor,
  type SyncDbState,
  type SyncEntityPayload,
  type SyncEntityType,
  type SyncPendingOutboxBatch,
  type SyncRelationPayload,
  type SyncRelationType,
  type SyncRepositoryConfig,
  type SyncStatusUpdateInput,
} from '../../../../shared/schemas'

import { nowIso, uuidv7 } from './utils'

type DeviceStateRow = {
  device_id: string
  device_name: string
  sync_enabled: number
  last_local_hlc: string | null
  last_successful_sync_at: string | null
  last_attempted_sync_at: string | null
  last_error_code: string | null
  last_error_message: string | null
}

type SyncEntityDefinition<T> = {
  table: string
  fields: readonly string[]
  parse: (row: unknown) => T
  toDb: (entity: T) => Record<string, unknown>
}

const SYNC_CONFIG_KEY = 'sync.config'
const DEFAULT_DEVICE_NAME = 'This Device'
const RELATION_FIELD_NAME = 'relation'

const TASK_FIELDS = [
  'id',
  'title',
  'notes',
  'status',
  'is_inbox',
  'is_someday',
  'project_id',
  'section_id',
  'area_id',
  'scheduled_at',
  'due_at',
  'created_at',
  'updated_at',
  'completed_at',
  'deleted_at',
] as const

const PROJECT_FIELDS = [
  'id',
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
] as const

const AREA_FIELDS = ['id', 'title', 'notes', 'position', 'created_at', 'updated_at', 'deleted_at'] as const

const TAG_FIELDS = ['id', 'title', 'color', 'created_at', 'updated_at', 'deleted_at'] as const

const PROJECT_SECTION_FIELDS = [
  'id',
  'project_id',
  'title',
  'position',
  'created_at',
  'updated_at',
  'deleted_at',
] as const

const CHECKLIST_ITEM_FIELDS = [
  'id',
  'task_id',
  'title',
  'done',
  'position',
  'created_at',
  'updated_at',
  'deleted_at',
] as const

const ENTITY_DEFINITIONS: Record<SyncEntityType, SyncEntityDefinition<SyncEntityPayload>> = {
  task: {
    table: 'tasks',
    fields: TASK_FIELDS,
    parse: (row) => TaskSchema.parse(row),
    toDb: (entity) => {
      const task = TaskSchema.parse(entity)
      return {
        ...task,
        is_inbox: task.is_inbox ? 1 : 0,
        is_someday: task.is_someday ? 1 : 0,
      }
    },
  },
  project: {
    table: 'projects',
    fields: PROJECT_FIELDS,
    parse: (row) => ProjectSchema.parse(row),
    toDb: (entity) => {
      const project = ProjectSchema.parse(entity)
      return {
        ...project,
        position: project.position ?? null,
        is_someday: project.is_someday ? 1 : 0,
      }
    },
  },
  area: {
    table: 'areas',
    fields: AREA_FIELDS,
    parse: (row) => AreaSchema.parse(row),
    toDb: (entity) => {
      const area = AreaSchema.parse(entity)
      return {
        ...area,
        position: area.position ?? null,
      }
    },
  },
  tag: {
    table: 'tags',
    fields: TAG_FIELDS,
    parse: (row) => TagSchema.parse(row),
    toDb: (entity) => TagSchema.parse(entity),
  },
  project_section: {
    table: 'project_sections',
    fields: PROJECT_SECTION_FIELDS,
    parse: (row) => ProjectSectionSchema.parse(row),
    toDb: (entity) => ProjectSectionSchema.parse(entity),
  },
  checklist_item: {
    table: 'task_checklist_items',
    fields: CHECKLIST_ITEM_FIELDS,
    parse: (row) => ChecklistItemSchema.parse(row),
    toDb: (entity) => {
      const item = ChecklistItemSchema.parse(entity)
      return {
        ...item,
        done: item.done ? 1 : 0,
      }
    },
  },
}

function parseSyncVersion(version: string): { physical: number; counter: number; deviceId: string } | null {
  const match = /^(\d{13})-(\d{6})-(.+)$/.exec(version)
  if (!match) return null

  return {
    physical: Number(match[1]),
    counter: Number(match[2]),
    deviceId: match[3] ?? '',
  }
}

export function compareSyncVersions(left: string, right: string): number {
  const parsedLeft = parseSyncVersion(left)
  const parsedRight = parseSyncVersion(right)

  if (!parsedLeft || !parsedRight) return left.localeCompare(right)
  if (parsedLeft.physical !== parsedRight.physical) return parsedLeft.physical - parsedRight.physical
  if (parsedLeft.counter !== parsedRight.counter) return parsedLeft.counter - parsedRight.counter
  return parsedLeft.deviceId.localeCompare(parsedRight.deviceId)
}

function formatSyncVersion(physical: number, counter: number, deviceId: string): string {
  return `${String(physical).padStart(13, '0')}-${String(counter).padStart(6, '0')}-${deviceId}`
}

function nextLocalVersion(lastVersion: string | null, deviceId: string, nowMs = Date.now()): string {
  const parsed = lastVersion ? parseSyncVersion(lastVersion) : null

  if (!parsed || parsed.deviceId !== deviceId) {
    return formatSyncVersion(nowMs, 0, deviceId)
  }

  const physical = Math.max(nowMs, parsed.physical)
  const counter = physical === parsed.physical ? parsed.counter + 1 : 0
  return formatSyncVersion(physical, counter, deviceId)
}

function getCurrentDeviceState(db: Database.Database, timestamp: string): DeviceStateRow {
  const existing = db
    .prepare(
      `SELECT device_id, device_name, sync_enabled, last_local_hlc,
              last_successful_sync_at, last_attempted_sync_at,
              last_error_code, last_error_message
       FROM sync_device_state
       WHERE singleton = 1
       LIMIT 1`
    )
    .get() as DeviceStateRow | undefined

  if (existing) return existing

  const deviceId = uuidv7()
  db.prepare(
    `INSERT INTO sync_device_state (
       singleton, device_id, device_name, sync_enabled,
       last_local_hlc, last_successful_sync_at, last_attempted_sync_at,
       last_error_code, last_error_message, created_at, updated_at
     ) VALUES (
       1, @device_id, @device_name, 0,
       NULL, NULL, NULL,
       NULL, NULL, @created_at, @updated_at
     )`
  ).run({
    device_id: deviceId,
    device_name: DEFAULT_DEVICE_NAME,
    created_at: timestamp,
    updated_at: timestamp,
  })

  return {
    device_id: deviceId,
    device_name: DEFAULT_DEVICE_NAME,
    sync_enabled: 0,
    last_local_hlc: null,
    last_successful_sync_at: null,
    last_attempted_sync_at: null,
    last_error_code: null,
    last_error_message: null,
  }
}

function readSyncConfig(db: Database.Database): SyncRepositoryConfig | null {
  const row = db
    .prepare(
      `SELECT value
       FROM app_settings
       WHERE key = ?
       LIMIT 1`
    )
    .get(SYNC_CONFIG_KEY) as { value?: unknown } | undefined

  if (!row || typeof row.value !== 'string' || !row.value.trim()) return null

  try {
    return SyncRepositoryConfigSchema.parse(JSON.parse(row.value) as unknown)
  } catch {
    return null
  }
}

function writeSyncConfig(db: Database.Database, config: SyncRepositoryConfig | null, timestamp: string) {
  if (!config) {
    db.prepare('DELETE FROM app_settings WHERE key = ?').run(SYNC_CONFIG_KEY)
    return
  }

  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (@key, @value, @updated_at)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`
  ).run({
    key: SYNC_CONFIG_KEY,
    value: JSON.stringify(config),
    updated_at: timestamp,
  })
}

function hasStoredCredentials(db: Database.Database): boolean {
  const row = db
    .prepare(
      `SELECT encrypted_blob
       FROM sync_credentials
       WHERE singleton = 1
       LIMIT 1`
    )
    .get() as { encrypted_blob?: unknown } | undefined

  return Boolean(row && typeof row.encrypted_blob === 'string' && row.encrypted_blob.length > 0)
}

function buildEntitySelect(entityType: SyncEntityType): string {
  const def = ENTITY_DEFINITIONS[entityType]
  return `SELECT ${def.fields.join(', ')} FROM ${def.table} WHERE id = ? LIMIT 1`
}

function parseEntity(entityType: SyncEntityType, row: unknown): SyncEntityPayload {
  const def = ENTITY_DEFINITIONS[entityType]
  return def.parse(row)
}

function loadEntityById(db: Database.Database, entityType: SyncEntityType, id: string): SyncEntityPayload | null {
  const row = db.prepare(buildEntitySelect(entityType)).get(id)
  if (!row) return null
  return parseEntity(entityType, row)
}

function insertEntity(db: Database.Database, entityType: SyncEntityType, entity: SyncEntityPayload) {
  const def = ENTITY_DEFINITIONS[entityType]
  const params = def.toDb(entity)
  db.prepare(
    `INSERT INTO ${def.table} (${def.fields.join(', ')})
     VALUES (${def.fields.map((field) => `@${field}`).join(', ')})`
  ).run(params)
}

function updateEntityFields(
  db: Database.Database,
  entityType: SyncEntityType,
  entity: SyncEntityPayload,
  changedFields: string[]
) {
  const def = ENTITY_DEFINITIONS[entityType]
  const fields = changedFields.filter((field) => field !== 'id' && def.fields.includes(field))
  if (fields.length === 0) return

  const params = def.toDb(entity)
  db.prepare(
    `UPDATE ${def.table}
     SET ${fields.map((field) => `${field} = @${field}`).join(', ')}
     WHERE id = @id`
  ).run(params)
}

function assertValidChangedFields(entityType: SyncEntityType, changedFields: readonly string[]) {
  const def = ENTITY_DEFINITIONS[entityType]
  const invalid = changedFields.filter((field) => field !== 'id' && !def.fields.includes(field))

  if (invalid.length > 0) {
    throw new Error(`Invalid changed fields for ${entityType}: ${invalid.join(', ')}`)
  }
}

function setFieldVersion(
  db: Database.Database,
  entityType: string,
  entityId: string,
  fieldName: string,
  version: string,
  deviceId: string,
  timestamp: string
) {
  db.prepare(
    `INSERT INTO sync_field_versions (entity_type, entity_id, field_name, version, device_id, updated_at)
     VALUES (@entity_type, @entity_id, @field_name, @version, @device_id, @updated_at)
     ON CONFLICT(entity_type, entity_id, field_name) DO UPDATE SET
       version = excluded.version,
       device_id = excluded.device_id,
       updated_at = excluded.updated_at`
  ).run({
    entity_type: entityType,
    entity_id: entityId,
    field_name: fieldName,
    version,
    device_id: deviceId,
    updated_at: timestamp,
  })
}

function getFieldVersion(
  db: Database.Database,
  entityType: string,
  entityId: string,
  fieldName: string
): { version: string; device_id: string } | null {
  const row = db
    .prepare(
      `SELECT version, device_id
       FROM sync_field_versions
       WHERE entity_type = ? AND entity_id = ? AND field_name = ?
       LIMIT 1`
    )
    .get(entityType, entityId, fieldName) as { version: string; device_id: string } | undefined

  return row ?? null
}

function setListVersion(
  db: Database.Database,
  listScope: string,
  version: string,
  deviceId: string,
  timestamp: string
) {
  db.prepare(
    `INSERT INTO sync_list_versions (list_scope, version, device_id, updated_at)
     VALUES (@list_scope, @version, @device_id, @updated_at)
     ON CONFLICT(list_scope) DO UPDATE SET
       version = excluded.version,
       device_id = excluded.device_id,
       updated_at = excluded.updated_at`
  ).run({
    list_scope: listScope,
    version,
    device_id: deviceId,
    updated_at: timestamp,
  })
}

function getListVersion(db: Database.Database, listScope: string): { version: string; device_id: string } | null {
  const row = db
    .prepare(
      `SELECT version, device_id
       FROM sync_list_versions
       WHERE list_scope = ?
       LIMIT 1`
    )
    .get(listScope) as { version: string; device_id: string } | undefined

  return row ?? null
}

function buildRelationEntityId(relationType: SyncRelationType, relation: SyncRelationPayload): string {
  if (relationType === 'task_tag' && 'task_id' in relation) return `${relation.task_id}:${relation.tag_id}`
  if (relationType === 'project_tag' && 'project_id' in relation) return `${relation.project_id}:${relation.tag_id}`
  if (relationType === 'area_tag' && 'area_id' in relation) return `${relation.area_id}:${relation.tag_id}`
  throw new Error(`Invalid relation payload for ${relationType}`)
}

function recordConflict(
  db: Database.Database,
  input: Omit<SyncConflictEvent, 'id' | 'created_at'> & { created_at?: string }
) {
  const createdAt = input.created_at ?? nowIso()
  const event = SyncConflictEventSchema.parse({
    id: uuidv7(),
    scope: input.scope,
    source_device_id: input.source_device_id,
    incoming_version: input.incoming_version,
    winning_version: input.winning_version,
    code: input.code,
    message: input.message,
    created_at: createdAt,
  })

  db.prepare(
    `INSERT INTO sync_conflict_events (
       id, scope, source_device_id, incoming_version, winning_version, code, message, created_at
     ) VALUES (
       @id, @scope, @source_device_id, @incoming_version, @winning_version, @code, @message, @created_at
     )`
  ).run(event)
}

function normalizeIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.filter((id) => id.trim())))
}

function upsertTaskTagRow(db: Database.Database, taskId: string, tagId: string, timestamp: string, deletedAt: string | null) {
  db.prepare(
    `INSERT INTO task_tags (task_id, tag_id, created_at, updated_at, deleted_at)
     VALUES (@task_id, @tag_id, @created_at, @updated_at, @deleted_at)
     ON CONFLICT(task_id, tag_id) DO UPDATE SET
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at`
  ).run({
    task_id: taskId,
    tag_id: tagId,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: deletedAt,
  })
}

function upsertProjectTagRow(
  db: Database.Database,
  projectId: string,
  tagId: string,
  position: number | null,
  timestamp: string,
  deletedAt: string | null
) {
  db.prepare(
    `INSERT INTO project_tags (project_id, tag_id, position, created_at, updated_at, deleted_at)
     VALUES (@project_id, @tag_id, @position, @created_at, @updated_at, @deleted_at)
     ON CONFLICT(project_id, tag_id) DO UPDATE SET
       position = excluded.position,
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at`
  ).run({
    project_id: projectId,
    tag_id: tagId,
    position,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: deletedAt,
  })
}

function upsertAreaTagRow(
  db: Database.Database,
  areaId: string,
  tagId: string,
  position: number | null,
  timestamp: string,
  deletedAt: string | null
) {
  db.prepare(
    `INSERT INTO area_tags (area_id, tag_id, position, created_at, updated_at, deleted_at)
     VALUES (@area_id, @tag_id, @position, @created_at, @updated_at, @deleted_at)
     ON CONFLICT(area_id, tag_id) DO UPDATE SET
       position = excluded.position,
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at`
  ).run({
    area_id: areaId,
    tag_id: tagId,
    position,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: deletedAt,
  })
}

function listScopeToAreaId(listScope: string): string | null {
  const encoded = listScope.slice('sidebar-projects:'.length)
  return encoded === 'none' ? null : encoded
}

function applyTaskListOrder(db: Database.Database, listId: string, orderedIds: string[], updatedAt: string) {
  db.prepare('DELETE FROM list_positions WHERE list_id = ?').run(listId)

  const insert = db.prepare(
    `INSERT INTO list_positions (list_id, task_id, rank, updated_at)
     VALUES (@list_id, @task_id, @rank, @updated_at)`
  )

  for (let index = 0; index < orderedIds.length; index++) {
    insert.run({
      list_id: listId,
      task_id: orderedIds[index],
      rank: (index + 1) * 1000,
      updated_at: updatedAt,
    })
  }
}

function applySidebarAreaOrder(db: Database.Database, orderedIds: string[], updatedAt: string) {
  const update = db.prepare(
    `UPDATE areas
     SET position = @position,
         updated_at = @updated_at
     WHERE id = @id AND deleted_at IS NULL`
  )

  for (let index = 0; index < orderedIds.length; index++) {
    update.run({
      id: orderedIds[index],
      position: (index + 1) * 1000,
      updated_at: updatedAt,
    })
  }
}

function applySidebarProjectOrder(
  db: Database.Database,
  areaId: string | null,
  orderedIds: string[],
  updatedAt: string
) {
  const update = db.prepare(
    `UPDATE projects
     SET position = @position,
         updated_at = @updated_at
     WHERE id = @id AND deleted_at IS NULL AND status = 'open' AND area_id IS @area_id`
  )

  for (let index = 0; index < orderedIds.length; index++) {
    update.run({
      id: orderedIds[index],
      area_id: areaId,
      position: (index + 1) * 1000,
      updated_at: updatedAt,
    })
  }
}

function applyProjectSectionOrder(db: Database.Database, projectId: string, orderedIds: string[], updatedAt: string) {
  const update = db.prepare(
    `UPDATE project_sections
     SET position = @position,
         updated_at = @updated_at
     WHERE id = @id AND project_id = @project_id AND deleted_at IS NULL`
  )

  for (let index = 0; index < orderedIds.length; index++) {
    update.run({
      id: orderedIds[index],
      project_id: projectId,
      position: (index + 1) * 1000,
      updated_at: updatedAt,
    })
  }
}

type LocalRecorder = ReturnType<typeof createLocalSyncRecorder>

export function createLocalSyncRecorder(db: Database.Database, timestamp = nowIso()) {
  const deviceState = getCurrentDeviceState(db, timestamp)
  const version = nextLocalVersion(deviceState.last_local_hlc, deviceState.device_id)
  const operations: SyncBatch['operations'] = []

  function recordEntity(entityType: SyncEntityType, entity: SyncEntityPayload, changedFields: readonly string[]) {
    const parsedType = SyncEntityTypeSchema.parse(entityType)
    const normalizedFields = normalizeIds(changedFields)
    assertValidChangedFields(parsedType, normalizedFields)

    if (normalizedFields.length === 0) return

    for (const field of normalizedFields) {
      setFieldVersion(db, parsedType, entity.id, field, version, deviceState.device_id, timestamp)
    }

    operations.push({
      kind: 'entity.put',
      entity_type: parsedType,
      changed_fields: normalizedFields,
      field_versions: Object.fromEntries(normalizedFields.map((field) => [field, version])),
      entity,
    })
  }

  function recordRelation(relationType: SyncRelationType, relation: SyncRelationPayload) {
    const parsedType = SyncRelationTypeSchema.parse(relationType)
    const entityId = buildRelationEntityId(parsedType, relation)
    setFieldVersion(db, parsedType, entityId, RELATION_FIELD_NAME, version, deviceState.device_id, timestamp)

    operations.push({
      kind: 'relation.put',
      relation_type: parsedType,
      version,
      relation,
    })
  }

  function recordList(listScope: string, orderedIds: readonly string[], updatedAt: string) {
    const normalizedIds = normalizeIds(orderedIds)
    setListVersion(db, listScope, version, deviceState.device_id, updatedAt)

    operations.push({
      kind: 'list.put',
      list_scope: listScope,
      version,
      updated_at: updatedAt,
      ordered_ids: normalizedIds,
    })
  }

  function finalize() {
    if (operations.length === 0) return

    const nextSequenceRow = db
      .prepare('SELECT COALESCE(MAX(sequence_number), 0) AS max_sequence FROM sync_outbox_batches')
      .get() as { max_sequence: number }
    const sequenceNumber = (nextSequenceRow.max_sequence ?? 0) + 1
    const batch = SyncBatchSchema.parse({
      batch_id: `${deviceState.device_id}:${sequenceNumber}`,
      source_device_id: deviceState.device_id,
      sequence_number: sequenceNumber,
      created_at: timestamp,
      version,
      operations,
    })

    db.prepare(
      `INSERT INTO sync_outbox_batches (
         batch_id, device_id, sequence_number, version, batch_json, status,
         retry_count, last_error_code, last_error_message,
         uploaded_at, created_at, updated_at
       ) VALUES (
         @batch_id, @device_id, @sequence_number, @version, @batch_json, 'pending',
         0, NULL, NULL,
         NULL, @created_at, @updated_at
       )`
    ).run({
      batch_id: batch.batch_id,
      device_id: batch.source_device_id,
      sequence_number: batch.sequence_number,
      version: batch.version,
      batch_json: JSON.stringify(batch),
      created_at: batch.created_at,
      updated_at: batch.created_at,
    })

    db.prepare(
      `UPDATE sync_device_state
       SET last_local_hlc = @last_local_hlc,
           updated_at = @updated_at
       WHERE singleton = 1`
    ).run({
      last_local_hlc: version,
      updated_at: timestamp,
    })
  }

  return {
    deviceId: deviceState.device_id,
    version,
    recordEntity,
    recordRelation,
    recordList,
    finalize,
  }
}

export function replaceTaskTags(
  db: Database.Database,
  sync: LocalRecorder,
  taskId: string,
  tagIds: readonly string[],
  timestamp: string
) {
  const desired = normalizeIds(tagIds)
  const existingRows = db
    .prepare(
      `SELECT task_id, tag_id, created_at, updated_at, deleted_at
       FROM task_tags
       WHERE task_id = ?`
    )
    .all(taskId) as Array<{
      task_id: string
      tag_id: string
      created_at: string
      updated_at: string
      deleted_at: string | null
    }>

  const existingByTagId = new Map(existingRows.map((row) => [row.tag_id, row]))

  for (const tagId of desired) {
    upsertTaskTagRow(db, taskId, tagId, timestamp, null)
    const row = existingByTagId.get(tagId)
    if (!row || row.deleted_at !== null || row.updated_at !== timestamp) {
      sync.recordRelation('task_tag', {
        task_id: taskId,
        tag_id: tagId,
        created_at: row?.created_at ?? timestamp,
        updated_at: timestamp,
        deleted_at: null,
      })
    }
  }

  for (const row of existingRows) {
    if (desired.includes(row.tag_id) || row.deleted_at !== null) continue
    upsertTaskTagRow(db, row.task_id, row.tag_id, row.created_at, timestamp)
    db.prepare(
      `UPDATE task_tags
       SET updated_at = @updated_at,
           deleted_at = @deleted_at
       WHERE task_id = @task_id AND tag_id = @tag_id`
    ).run({
      task_id: row.task_id,
      tag_id: row.tag_id,
      updated_at: timestamp,
      deleted_at: timestamp,
    })
    sync.recordRelation('task_tag', {
      task_id: row.task_id,
      tag_id: row.tag_id,
      created_at: row.created_at,
      updated_at: timestamp,
      deleted_at: timestamp,
    })
  }
}

export function replaceProjectTags(
  db: Database.Database,
  sync: LocalRecorder,
  projectId: string,
  tagIds: readonly string[],
  timestamp: string
) {
  const desired = normalizeIds(tagIds)
  const existingRows = db
    .prepare(
      `SELECT project_id, tag_id, position, created_at, updated_at, deleted_at
       FROM project_tags
       WHERE project_id = ?`
    )
    .all(projectId) as Array<{
      project_id: string
      tag_id: string
      position: number | null
      created_at: string
      updated_at: string
      deleted_at: string | null
    }>

  const existingByTagId = new Map(existingRows.map((row) => [row.tag_id, row]))

  for (let index = 0; index < desired.length; index++) {
    const tagId = desired[index]!
    const position = (index + 1) * 1000
    const row = existingByTagId.get(tagId)
    upsertProjectTagRow(db, projectId, tagId, position, row?.created_at ?? timestamp, null)
    db.prepare(
      `UPDATE project_tags
       SET position = @position,
           updated_at = @updated_at,
           deleted_at = NULL
       WHERE project_id = @project_id AND tag_id = @tag_id`
    ).run({
      project_id: projectId,
      tag_id: tagId,
      position,
      updated_at: timestamp,
    })
    sync.recordRelation('project_tag', {
      project_id: projectId,
      tag_id: tagId,
      position,
      created_at: row?.created_at ?? timestamp,
      updated_at: timestamp,
      deleted_at: null,
    })
  }

  for (const row of existingRows) {
    if (desired.includes(row.tag_id) || row.deleted_at !== null) continue
    db.prepare(
      `UPDATE project_tags
       SET position = NULL,
           updated_at = @updated_at,
           deleted_at = @deleted_at
       WHERE project_id = @project_id AND tag_id = @tag_id`
    ).run({
      project_id: row.project_id,
      tag_id: row.tag_id,
      updated_at: timestamp,
      deleted_at: timestamp,
    })
    sync.recordRelation('project_tag', {
      project_id: row.project_id,
      tag_id: row.tag_id,
      position: null,
      created_at: row.created_at,
      updated_at: timestamp,
      deleted_at: timestamp,
    })
  }
}

export function replaceAreaTags(
  db: Database.Database,
  sync: LocalRecorder,
  areaId: string,
  tagIds: readonly string[],
  timestamp: string
) {
  const desired = normalizeIds(tagIds)
  const existingRows = db
    .prepare(
      `SELECT area_id, tag_id, position, created_at, updated_at, deleted_at
       FROM area_tags
       WHERE area_id = ?`
    )
    .all(areaId) as Array<{
      area_id: string
      tag_id: string
      position: number | null
      created_at: string
      updated_at: string
      deleted_at: string | null
    }>

  const existingByTagId = new Map(existingRows.map((row) => [row.tag_id, row]))

  for (let index = 0; index < desired.length; index++) {
    const tagId = desired[index]!
    const position = (index + 1) * 1000
    const row = existingByTagId.get(tagId)
    upsertAreaTagRow(db, areaId, tagId, position, row?.created_at ?? timestamp, null)
    db.prepare(
      `UPDATE area_tags
       SET position = @position,
           updated_at = @updated_at,
           deleted_at = NULL
       WHERE area_id = @area_id AND tag_id = @tag_id`
    ).run({
      area_id: areaId,
      tag_id: tagId,
      position,
      updated_at: timestamp,
    })
    sync.recordRelation('area_tag', {
      area_id: areaId,
      tag_id: tagId,
      position,
      created_at: row?.created_at ?? timestamp,
      updated_at: timestamp,
      deleted_at: null,
    })
  }

  for (const row of existingRows) {
    if (desired.includes(row.tag_id) || row.deleted_at !== null) continue
    db.prepare(
      `UPDATE area_tags
       SET position = NULL,
           updated_at = @updated_at,
           deleted_at = @deleted_at
       WHERE area_id = @area_id AND tag_id = @tag_id`
    ).run({
      area_id: row.area_id,
      tag_id: row.tag_id,
      updated_at: timestamp,
      deleted_at: timestamp,
    })
    sync.recordRelation('area_tag', {
      area_id: row.area_id,
      tag_id: row.tag_id,
      position: null,
      created_at: row.created_at,
      updated_at: timestamp,
      deleted_at: timestamp,
    })
  }
}

function applyRemoteEntityPut(db: Database.Database, batch: SyncBatch, operation: SyncBatch['operations'][number]) {
  if (operation.kind !== 'entity.put') return

  const entityType = operation.entity_type
  const incomingEntity = parseEntity(entityType, operation.entity)
  assertValidChangedFields(entityType, operation.changed_fields)
  const existing = loadEntityById(db, entityType, incomingEntity.id)

  if (!existing) {
    insertEntity(db, entityType, incomingEntity)
    for (const field of operation.changed_fields) {
      const version = operation.field_versions[field]
      if (!version) continue
      setFieldVersion(db, entityType, incomingEntity.id, field, version, batch.source_device_id, batch.created_at)
    }
    return
  }

  let nextEntity: SyncEntityPayload = existing
  const winningFields: string[] = []

  for (const field of operation.changed_fields) {
    const incomingVersion = operation.field_versions[field]
    if (!incomingVersion) continue

    const currentVersion = getFieldVersion(db, entityType, incomingEntity.id, field)
    if (!currentVersion || compareSyncVersions(incomingVersion, currentVersion.version) > 0) {
      nextEntity = {
        ...nextEntity,
        [field]: (incomingEntity as Record<string, unknown>)[field],
      } as SyncEntityPayload
      setFieldVersion(db, entityType, incomingEntity.id, field, incomingVersion, batch.source_device_id, batch.created_at)
      winningFields.push(field)
      continue
    }

    recordConflict(db, {
      scope: `${entityType}:${incomingEntity.id}:${field}`,
      source_device_id: batch.source_device_id,
      incoming_version: incomingVersion,
      winning_version: currentVersion.version,
      code: 'SYNC_FIELD_CONFLICT',
      message: `Ignored stale ${entityType}.${field} update.`,
      created_at: batch.created_at,
    })
  }

  if (winningFields.length === 0) return
  updateEntityFields(db, entityType, nextEntity, winningFields)
}

function applyRemoteRelationPut(db: Database.Database, batch: SyncBatch, operation: SyncBatch['operations'][number]) {
  if (operation.kind !== 'relation.put') return

  const relationType = operation.relation_type
  const relationId = buildRelationEntityId(relationType, operation.relation)
  const currentVersion = getFieldVersion(db, relationType, relationId, RELATION_FIELD_NAME)

  if (currentVersion && compareSyncVersions(operation.version, currentVersion.version) <= 0) {
    recordConflict(db, {
      scope: `${relationType}:${relationId}`,
      source_device_id: batch.source_device_id,
      incoming_version: operation.version,
      winning_version: currentVersion.version,
      code: 'SYNC_RELATION_CONFLICT',
      message: `Ignored stale ${relationType} update.`,
      created_at: batch.created_at,
    })
    return
  }

  if (relationType === 'task_tag' && 'task_id' in operation.relation) {
    const relation = operation.relation
    upsertTaskTagRow(db, relation.task_id, relation.tag_id, relation.created_at, relation.deleted_at)
    db.prepare(
      `UPDATE task_tags
       SET updated_at = @updated_at,
           deleted_at = @deleted_at
       WHERE task_id = @task_id AND tag_id = @tag_id`
    ).run({
      task_id: relation.task_id,
      tag_id: relation.tag_id,
      updated_at: relation.updated_at,
      deleted_at: relation.deleted_at,
    })
  }

  if (relationType === 'project_tag' && 'project_id' in operation.relation) {
    const relation = operation.relation
    upsertProjectTagRow(
      db,
      relation.project_id,
      relation.tag_id,
      relation.deleted_at ? null : relation.position,
      relation.created_at,
      relation.deleted_at
    )
    db.prepare(
      `UPDATE project_tags
       SET position = @position,
           updated_at = @updated_at,
           deleted_at = @deleted_at
       WHERE project_id = @project_id AND tag_id = @tag_id`
    ).run({
      project_id: relation.project_id,
      tag_id: relation.tag_id,
      position: relation.deleted_at ? null : relation.position,
      updated_at: relation.updated_at,
      deleted_at: relation.deleted_at,
    })
  }

  if (relationType === 'area_tag' && 'area_id' in operation.relation) {
    const relation = operation.relation
    upsertAreaTagRow(
      db,
      relation.area_id,
      relation.tag_id,
      relation.deleted_at ? null : relation.position,
      relation.created_at,
      relation.deleted_at
    )
    db.prepare(
      `UPDATE area_tags
       SET position = @position,
           updated_at = @updated_at,
           deleted_at = @deleted_at
       WHERE area_id = @area_id AND tag_id = @tag_id`
    ).run({
      area_id: relation.area_id,
      tag_id: relation.tag_id,
      position: relation.deleted_at ? null : relation.position,
      updated_at: relation.updated_at,
      deleted_at: relation.deleted_at,
    })
  }

  setFieldVersion(
    db,
    relationType,
    relationId,
    RELATION_FIELD_NAME,
    operation.version,
    batch.source_device_id,
    batch.created_at
  )
}

function applyRemoteListPut(db: Database.Database, batch: SyncBatch, operation: SyncBatch['operations'][number]) {
  if (operation.kind !== 'list.put') return

  const currentVersion = getListVersion(db, operation.list_scope)
  if (currentVersion && compareSyncVersions(operation.version, currentVersion.version) <= 0) {
    recordConflict(db, {
      scope: operation.list_scope,
      source_device_id: batch.source_device_id,
      incoming_version: operation.version,
      winning_version: currentVersion.version,
      code: 'SYNC_LIST_CONFLICT',
      message: `Ignored stale ${operation.list_scope} order update.`,
      created_at: batch.created_at,
    })
    return
  }

  if (operation.list_scope.startsWith('task-list:')) {
    applyTaskListOrder(db, operation.list_scope.slice('task-list:'.length), operation.ordered_ids, operation.updated_at)
  } else if (operation.list_scope === 'sidebar-areas') {
    applySidebarAreaOrder(db, operation.ordered_ids, operation.updated_at)
  } else if (operation.list_scope.startsWith('sidebar-projects:')) {
    applySidebarProjectOrder(db, listScopeToAreaId(operation.list_scope), operation.ordered_ids, operation.updated_at)
  } else if (operation.list_scope.startsWith('project-sections:')) {
    applyProjectSectionOrder(
      db,
      operation.list_scope.slice('project-sections:'.length),
      operation.ordered_ids,
      operation.updated_at
    )
  }

  setListVersion(db, operation.list_scope, operation.version, batch.source_device_id, operation.updated_at)
}

export function applyRemoteBatch(db: Database.Database, payload: unknown): SyncApplyRemoteBatchResult {
  const parsed = SyncApplyRemoteBatchInputSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(JSON.stringify(parsed.error.issues))
  }

  const batch = parsed.data.batch

  const tx = db.transaction(() => {
    const existingCursor = db
      .prepare(
        `SELECT last_applied_sequence
         FROM sync_remote_cursors
         WHERE source_device_id = ?
         LIMIT 1`
      )
      .get(batch.source_device_id) as { last_applied_sequence: number } | undefined

    if (existingCursor && existingCursor.last_applied_sequence >= batch.sequence_number) {
      return SyncApplyRemoteBatchResultSchema.parse({ applied: false, duplicate: true })
    }

    for (const operation of batch.operations) {
      if (operation.kind === 'entity.put') {
        applyRemoteEntityPut(db, batch, operation)
      } else if (operation.kind === 'relation.put') {
        applyRemoteRelationPut(db, batch, operation)
      } else if (operation.kind === 'list.put') {
        applyRemoteListPut(db, batch, operation)
      }
    }

    db.prepare(
      `INSERT INTO sync_remote_cursors (source_device_id, last_applied_sequence, updated_at)
       VALUES (@source_device_id, @last_applied_sequence, @updated_at)
       ON CONFLICT(source_device_id) DO UPDATE SET
         last_applied_sequence = excluded.last_applied_sequence,
         updated_at = excluded.updated_at`
    ).run({
      source_device_id: batch.source_device_id,
      last_applied_sequence: batch.sequence_number,
      updated_at: batch.created_at,
    })

    return SyncApplyRemoteBatchResultSchema.parse({ applied: true, duplicate: false })
  })

  return tx()
}

export function getSyncDbState(db: Database.Database): SyncDbState {
  const timestamp = nowIso()
  const deviceState = getCurrentDeviceState(db, timestamp)
  const pendingRow = db
    .prepare(
      `SELECT COUNT(1) AS count
       FROM sync_outbox_batches
       WHERE status = 'pending'`
    )
    .get() as { count: number }

  const latestConflictRow = db
    .prepare(
      `SELECT id, scope, source_device_id, incoming_version, winning_version, code, message, created_at
       FROM sync_conflict_events
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get() as SyncConflictEvent | undefined

  return SyncDbStateSchema.parse({
    device_id: deviceState.device_id,
    device_name: deviceState.device_name,
    enabled: Boolean(deviceState.sync_enabled),
    config: readSyncConfig(db),
    has_stored_credentials: hasStoredCredentials(db),
    pending_outbox_count: pendingRow.count ?? 0,
    last_successful_sync_at: deviceState.last_successful_sync_at,
    last_attempted_sync_at: deviceState.last_attempted_sync_at,
    last_error:
      deviceState.last_error_code && deviceState.last_error_message
        ? {
            code: deviceState.last_error_code,
            message: deviceState.last_error_message,
          }
        : null,
    latest_conflict: latestConflictRow ? SyncConflictEventSchema.parse(latestConflictRow) : null,
  })
}

export function saveSyncConfig(
  db: Database.Database,
  params: { config: SyncRepositoryConfig; deviceName: string; enabled?: boolean | null },
  timestamp = nowIso()
) {
  const deviceState = getCurrentDeviceState(db, timestamp)
  const config = SyncRepositoryConfigSchema.parse(params.config)

  writeSyncConfig(db, config, timestamp)

  db.prepare(
    `UPDATE sync_device_state
     SET device_name = @device_name,
         sync_enabled = COALESCE(@sync_enabled, sync_enabled),
         last_error_code = NULL,
         last_error_message = NULL,
         updated_at = @updated_at
     WHERE singleton = 1`
  ).run({
    device_name: params.deviceName,
    sync_enabled: params.enabled === null || params.enabled === undefined ? null : params.enabled ? 1 : 0,
    updated_at: timestamp,
  })

  return {
    ...deviceState,
    device_name: params.deviceName,
    sync_enabled:
      params.enabled === null || params.enabled === undefined ? deviceState.sync_enabled : params.enabled ? 1 : 0,
  }
}

export function setSyncEnabled(db: Database.Database, enabled: boolean, timestamp = nowIso()) {
  getCurrentDeviceState(db, timestamp)
  db.prepare(
    `UPDATE sync_device_state
     SET sync_enabled = @sync_enabled,
         updated_at = @updated_at
     WHERE singleton = 1`
  ).run({
    sync_enabled: enabled ? 1 : 0,
    updated_at: timestamp,
  })
}

export function saveEncryptedCredentials(db: Database.Database, encryptedBlob: string, timestamp = nowIso()) {
  db.prepare(
    `INSERT INTO sync_credentials (singleton, encrypted_blob, updated_at)
     VALUES (1, @encrypted_blob, @updated_at)
     ON CONFLICT(singleton) DO UPDATE SET
       encrypted_blob = excluded.encrypted_blob,
       updated_at = excluded.updated_at`
  ).run({
    encrypted_blob: encryptedBlob,
    updated_at: timestamp,
  })
}

export function clearEncryptedCredentials(db: Database.Database) {
  db.prepare('DELETE FROM sync_credentials WHERE singleton = 1').run()
}

export function getEncryptedCredentials(db: Database.Database): string | null {
  const row = db
    .prepare(
      `SELECT encrypted_blob
       FROM sync_credentials
       WHERE singleton = 1
       LIMIT 1`
    )
    .get() as { encrypted_blob?: unknown } | undefined

  return row && typeof row.encrypted_blob === 'string' ? row.encrypted_blob : null
}

export function listPendingOutboxBatches(db: Database.Database): SyncPendingOutboxBatch[] {
  const rows = db
    .prepare(
      `SELECT batch_id, sequence_number, created_at, retry_count, last_error_code, last_error_message, batch_json
       FROM sync_outbox_batches
       WHERE status = 'pending'
       ORDER BY sequence_number ASC`
    )
    .all() as Array<{
      batch_id: string
      sequence_number: number
      created_at: string
      retry_count: number
      last_error_code: string | null
      last_error_message: string | null
      batch_json: string
    }>

  return rows.map((row) =>
    SyncPendingOutboxBatchSchema.parse({
      batch_id: row.batch_id,
      sequence_number: row.sequence_number,
      created_at: row.created_at,
      retry_count: row.retry_count,
      last_error:
        row.last_error_code && row.last_error_message
          ? { code: row.last_error_code, message: row.last_error_message }
          : null,
      batch: JSON.parse(row.batch_json) as unknown,
    })
  )
}

export function listRemoteCursors(db: Database.Database): SyncCursor[] {
  const rows = db
    .prepare(
      `SELECT source_device_id, last_applied_sequence, updated_at
       FROM sync_remote_cursors
       ORDER BY source_device_id ASC`
    )
    .all()

  return rows.map((row) => SyncCursorSchema.parse(row))
}

export function markOutboxBatchesUploaded(db: Database.Database, batchIds: readonly string[], uploadedAt: string) {
  const update = db.prepare(
    `UPDATE sync_outbox_batches
     SET status = 'uploaded',
         uploaded_at = @uploaded_at,
         updated_at = @updated_at,
         last_error_code = NULL,
         last_error_message = NULL
     WHERE batch_id = @batch_id`
  )

  for (const batchId of batchIds) {
    update.run({
      batch_id: batchId,
      uploaded_at: uploadedAt,
      updated_at: uploadedAt,
    })
  }
}

export function markOutboxBatchError(
  db: Database.Database,
  batchId: string,
  error: { code: string; message: string },
  timestamp = nowIso()
) {
  db.prepare(
    `UPDATE sync_outbox_batches
     SET retry_count = retry_count + 1,
         last_error_code = @last_error_code,
         last_error_message = @last_error_message,
         updated_at = @updated_at
     WHERE batch_id = @batch_id`
  ).run({
    batch_id: batchId,
    last_error_code: error.code,
    last_error_message: error.message,
    updated_at: timestamp,
  })
}

export function updateSyncStatus(db: Database.Database, input: SyncStatusUpdateInput, timestamp = nowIso()) {
  getCurrentDeviceState(db, timestamp)
  db.prepare(
    `UPDATE sync_device_state
     SET last_attempted_sync_at = COALESCE(@last_attempted_sync_at, last_attempted_sync_at),
         last_successful_sync_at = COALESCE(@last_successful_sync_at, last_successful_sync_at),
         last_error_code = @last_error_code,
         last_error_message = @last_error_message,
         updated_at = @updated_at
     WHERE singleton = 1`
  ).run({
    last_attempted_sync_at: input.last_attempted_sync_at ?? null,
    last_successful_sync_at: input.last_successful_sync_at ?? null,
    last_error_code: input.last_error?.code ?? null,
    last_error_message: input.last_error?.message ?? null,
    updated_at: timestamp,
  })
}
