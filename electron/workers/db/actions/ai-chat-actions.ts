import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { ChatRollbackConflict } from '../../../../shared/schemas/chat'
import { IdSchema } from '../../../../shared/schemas/common'
import type { DbActionHandler, DbActionResult } from './db-actions'
import { nowIso, uuidv7 } from './utils'

type TableSpec = {
  name: string
  keyColumns: string[]
  softDelete: boolean
}

type SnapshotRow = Record<string, string | number | null>
type Snapshot = Map<string, SnapshotRow>
type JournalDiff = {
  table: TableSpec
  entityId: string
  before: SnapshotRow | null
  after: SnapshotRow | null
  operation: 'insert' | 'update' | 'delete'
}

type EffectBatchRow = {
  id: string
  tool_name: string
}

type EffectJournalRow = {
  table_name: string
  entity_id: string
  before_json: string | null
  after_json: string | null
  operation: string
}

const AiChatContextSchema = z.object({
  session_id: IdSchema,
  user_message_id: IdSchema,
  run_message_id: z.string().min(1),
  tool_name: z.string().min(1),
  tool_call_id: z.string().min(1).nullable().optional(),
})

const AiChatRunMutationInputSchema = z.object({
  context: AiChatContextSchema,
  action: z.string().min(1),
  payload: z.unknown(),
})

const JOURNALED_TABLES: TableSpec[] = [
  { name: 'projects', keyColumns: ['id'], softDelete: true },
  { name: 'project_sections', keyColumns: ['id'], softDelete: true },
  { name: 'tasks', keyColumns: ['id'], softDelete: true },
  { name: 'task_checklist_items', keyColumns: ['id'], softDelete: true },
  { name: 'task_tags', keyColumns: ['task_id', 'tag_id'], softDelete: true },
  { name: 'project_tags', keyColumns: ['project_id', 'tag_id'], softDelete: true },
]

const JOURNALED_TABLE_BY_NAME = new Map(JOURNALED_TABLES.map((table) => [table.name, table]))

const ALLOWED_AI_MUTATION_ACTIONS = new Set([
  'task.create',
  'task.update',
  'task.toggleDone',
  'task.cancel',
  'task.restore',
  'task.convertToProject',
  'task.setTags',
  'task.delete',
  'project.create',
  'project.update',
  'project.complete',
  'project.cancel',
  'project.delete',
  'project.setTags',
  'project.section.create',
  'project.section.rename',
  'project.section.delete',
])

export function createAiChatActions(
  db: Database.Database,
  handlers: Record<string, DbActionHandler>
): Record<string, DbActionHandler> {
  return {
    'aiChat.runMutation': (payload) => {
      const parsed = AiChatRunMutationInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid aiChat.runMutation payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const { context, action, payload: actionPayload } = parsed.data
      if (!ALLOWED_AI_MUTATION_ACTIONS.has(action)) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'AI chat mutation action is not journalable.',
            details: { action },
          },
        }
      }

      const handler = handlers[action]
      if (!handler) {
        return {
          ok: false,
          error: {
            code: 'DB_UNKNOWN_ACTION',
            message: 'Unknown DB action.',
            details: { action },
          },
        }
      }

      const tx = db.transaction(() => {
        const before = captureSnapshot(db)
        const result = handler(actionPayload)
        if (!result.ok) return result

        const after = captureSnapshot(db)
        const diffs = diffSnapshots(before, after)
        if (diffs.length > 0) {
          insertJournalBatch(db, {
            sessionId: context.session_id,
            userMessageId: context.user_message_id,
            runMessageId: context.run_message_id,
            toolName: context.tool_name,
            toolCallId: context.tool_call_id ?? null,
            action,
            diffs,
          })
        }

        return result
      })

      return tx() as DbActionResult
    },
  }
}

export function rollbackAiChatEffects(
  db: Database.Database,
  userMessageIds: string[],
  rollbackChatMessageId: string
): {
  revertedEffectCount: number
  conflicts: ChatRollbackConflict[]
} {
  if (userMessageIds.length === 0) {
    return { revertedEffectCount: 0, conflicts: [] }
  }

  const placeholders = userMessageIds.map(() => '?').join(', ')
  const batches = db
    .prepare(
      `SELECT id, tool_name
       FROM ai_chat_effect_batches
       WHERE user_message_id IN (${placeholders})
         AND reverted_at IS NULL
       ORDER BY created_at DESC, id DESC`
    )
    .all(...userMessageIds) as EffectBatchRow[]

  const conflicts: ChatRollbackConflict[] = []
  let revertedEffectCount = 0

  for (const batch of batches) {
    const rows = db
      .prepare(
        `SELECT table_name, entity_id, before_json, after_json, operation
         FROM ai_chat_effect_rows
         WHERE batch_id = ?
         ORDER BY order_index DESC`
      )
      .all(batch.id) as EffectJournalRow[]

    for (const row of rows) {
      const table = JOURNALED_TABLE_BY_NAME.get(row.table_name)
      if (!table) continue

      const before = parseSnapshotJson(row.before_json)
      const after = parseSnapshotJson(row.after_json)
      const current = selectRowByEntityId(db, table, row.entity_id)

      if (!isRollbackSafe(current, after)) {
        conflicts.push({
          table_name: row.table_name,
          entity_id: row.entity_id,
          tool_name: batch.tool_name,
          reason: 'Current row no longer matches the AI-produced state.',
        })
        continue
      }

      applyReverseRow(db, table, row.entity_id, before, after)
      revertedEffectCount += 1
    }

    db.prepare(
      `UPDATE ai_chat_effect_batches
       SET reverted_at = ?, rollback_chat_message_id = ?
       WHERE id = ?`
    ).run(nowIso(), rollbackChatMessageId, batch.id)
  }

  return { revertedEffectCount, conflicts }
}

function captureSnapshot(db: Database.Database): Map<string, Snapshot> {
  const snapshots = new Map<string, Snapshot>()
  for (const table of JOURNALED_TABLES) {
    const rows = db.prepare(`SELECT * FROM ${table.name}`).all() as SnapshotRow[]
    const snapshot: Snapshot = new Map()
    for (const row of rows) {
      snapshot.set(entityIdForRow(table, row), normalizeRow(row))
    }
    snapshots.set(table.name, snapshot)
  }
  return snapshots
}

function diffSnapshots(
  before: Map<string, Snapshot>,
  after: Map<string, Snapshot>
): JournalDiff[] {
  const diffs: JournalDiff[] = []

  for (const table of JOURNALED_TABLES) {
    const beforeRows = before.get(table.name) ?? new Map()
    const afterRows = after.get(table.name) ?? new Map()
    const entityIds = new Set([...beforeRows.keys(), ...afterRows.keys()])

    for (const entityId of entityIds) {
      const beforeRow = beforeRows.get(entityId) ?? null
      const afterRow = afterRows.get(entityId) ?? null
      if (stableStringify(beforeRow) === stableStringify(afterRow)) continue

      diffs.push({
        table,
        entityId,
        before: beforeRow,
        after: afterRow,
        operation: beforeRow === null ? 'insert' : afterRow === null ? 'delete' : 'update',
      })
    }
  }

  return diffs
}

function insertJournalBatch(
  db: Database.Database,
  input: {
    sessionId: string
    userMessageId: string
    runMessageId: string
    toolName: string
    toolCallId: string | null
    action: string
    diffs: JournalDiff[]
  }
) {
  const batchId = uuidv7()
  const createdAt = nowIso()

  db.prepare(
    `INSERT INTO ai_chat_effect_batches (
      id, session_id, user_message_id, run_message_id, tool_name, tool_call_id,
      action, created_at, reverted_at, rollback_chat_message_id
    )
    VALUES (
      @id, @session_id, @user_message_id, @run_message_id, @tool_name, @tool_call_id,
      @action, @created_at, NULL, NULL
    )`
  ).run({
    id: batchId,
    session_id: input.sessionId,
    user_message_id: input.userMessageId,
    run_message_id: input.runMessageId,
    tool_name: input.toolName,
    tool_call_id: input.toolCallId,
    action: input.action,
    created_at: createdAt,
  })

  const insertRow = db.prepare(
    `INSERT INTO ai_chat_effect_rows (
      id, batch_id, order_index, table_name, entity_id, before_json, after_json, operation
    )
    VALUES (
      @id, @batch_id, @order_index, @table_name, @entity_id, @before_json, @after_json, @operation
    )`
  )

  input.diffs.forEach((diff, index) => {
    insertRow.run({
      id: uuidv7(),
      batch_id: batchId,
      order_index: index,
      table_name: diff.table.name,
      entity_id: diff.entityId,
      before_json: diff.before === null ? null : stableStringify(diff.before),
      after_json: diff.after === null ? null : stableStringify(diff.after),
      operation: diff.operation,
    })
  })
}

function isRollbackSafe(current: SnapshotRow | null, after: SnapshotRow | null): boolean {
  if (after === null) return current === null
  if (current === null) return false
  return stableStringify(snapshotForConflictCheck(normalizeRow(current))) ===
    stableStringify(snapshotForConflictCheck(after))
}

function applyReverseRow(
  db: Database.Database,
  table: TableSpec,
  entityId: string,
  before: SnapshotRow | null,
  after: SnapshotRow | null
) {
  if (before === null && after !== null) {
    deleteCreatedRow(db, table, entityId)
    return
  }

  if (before !== null) {
    upsertSnapshotRow(db, table, before)
  }
}

function deleteCreatedRow(db: Database.Database, table: TableSpec, entityId: string) {
  if (!table.softDelete) {
    const { whereSql, params } = whereForEntityId(table, entityId)
    db.prepare(`DELETE FROM ${table.name} WHERE ${whereSql}`).run(...params)
    return
  }

  const now = nowIso()
  const columns = columnNames(db, table.name)
  const assignments = ['deleted_at = ?']
  const params: unknown[] = [now]

  if (columns.includes('updated_at')) {
    assignments.push('updated_at = ?')
    params.push(now)
  }
  if (columns.includes('purged_at')) {
    assignments.push('purged_at = NULL')
  }

  const { whereSql, params: whereParams } = whereForEntityId(table, entityId)
  db.prepare(`UPDATE ${table.name} SET ${assignments.join(', ')} WHERE ${whereSql}`).run(
    ...params,
    ...whereParams
  )
}

function upsertSnapshotRow(db: Database.Database, table: TableSpec, row: SnapshotRow) {
  const next = { ...row }
  if ('updated_at' in next) {
    next.updated_at = nowIso()
  }

  const existing = selectRowByEntityId(db, table, entityIdForRow(table, row))
  if (!existing) {
    const columns = Object.keys(next)
    const placeholders = columns.map((column) => `@${column}`).join(', ')
    db.prepare(
      `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${placeholders})`
    ).run(next)
    return
  }

  const nonKeyColumns = Object.keys(next).filter((column) => !table.keyColumns.includes(column))
  if (nonKeyColumns.length === 0) return

  const assignments = nonKeyColumns.map((column) => `${column} = @${column}`).join(', ')
  const { whereSql } = whereForRow(table)
  db.prepare(`UPDATE ${table.name} SET ${assignments} WHERE ${whereSql}`).run(next)
}

function selectRowByEntityId(
  db: Database.Database,
  table: TableSpec,
  entityId: string
): SnapshotRow | null {
  const { whereSql, params } = whereForEntityId(table, entityId)
  const row = db.prepare(`SELECT * FROM ${table.name} WHERE ${whereSql} LIMIT 1`).get(...params)
  return row ? normalizeRow(row as SnapshotRow) : null
}

function whereForEntityId(table: TableSpec, entityId: string): { whereSql: string; params: string[] } {
  if (table.keyColumns.length === 1) {
    return { whereSql: `${table.keyColumns[0]} = ?`, params: [entityId] }
  }

  const parsed = z.record(z.string(), z.string()).parse(JSON.parse(entityId))
  return {
    whereSql: table.keyColumns.map((column) => `${column} = ?`).join(' AND '),
    params: table.keyColumns.map((column) => parsed[column] ?? ''),
  }
}

function whereForRow(table: TableSpec): { whereSql: string } {
  return { whereSql: table.keyColumns.map((column) => `${column} = @${column}`).join(' AND ') }
}

function entityIdForRow(table: TableSpec, row: SnapshotRow): string {
  if (table.keyColumns.length === 1) {
    return String(row[table.keyColumns[0]!] ?? '')
  }

  const key: Record<string, string> = {}
  for (const column of table.keyColumns) {
    key[column] = String(row[column] ?? '')
  }
  return stableStringify(key)
}

function normalizeRow(row: SnapshotRow): SnapshotRow {
  const normalized: SnapshotRow = {}
  for (const key of Object.keys(row).sort()) {
    const value = row[key]
    normalized[key] = value === undefined ? null : value
  }
  return normalized
}

function snapshotForConflictCheck(row: SnapshotRow): SnapshotRow {
  const comparable = { ...row }
  // Rollback applies compensating writes with fresh updated_at timestamps.
  // Ignore that volatile field so reverse steps from the same chat tail do not
  // conflict with earlier reverse steps that already restored the row content.
  delete comparable.updated_at
  return comparable
}

function parseSnapshotJson(value: string | null): SnapshotRow | null {
  if (value === null) return null
  return normalizeRow(JSON.parse(value) as SnapshotRow)
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return JSON.stringify(value)
  }

  const record = value as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(record).sort()) {
    sorted[key] = record[key]
  }
  return JSON.stringify(sorted)
}

function columnNames(db: Database.Database, tableName: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[]
  return rows.map((row) => row.name)
}
