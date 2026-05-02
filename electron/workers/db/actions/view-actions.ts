import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { createLocalSyncRecorder } from './sync-support'
import { nowIso } from './utils'

import {
  ViewListAnytimeInputSchema,
  ViewListByAreaInputSchema,
  ViewListItemSchema,
  ViewListProjectItemSchema,
  ViewListSomedayInputSchema,
  ViewListTaskItemSchema,
  ViewListTodayInputSchema,
  ViewListUpcomingInputSchema,
  ViewReorderBatchInputSchema,
  type ViewListItem,
} from '../../../../shared/schemas/view-list'
import {
  TASK_LIST_ID_ANYTIME,
  TASK_LIST_ID_SOMEDAY,
  TASK_LIST_ID_TODAY,
} from '../../../../shared/task-list-ids'

const TAG_PREVIEW_SEPARATOR = '|||'

const TagPreviewRowSchema = z
  .object({
    tag_count: z.number().int().nonnegative().nullable().optional(),
    tag_preview_text: z.string().nullable().optional(),
    tag_ids_text: z.string().nullable().optional(),
  })
  .passthrough()

function tagCountSql(relationTable: 'task_tags' | 'project_tags', entityColumn: 'task_id' | 'project_id', alias: string) {
  return `(
    SELECT COUNT(1)
    FROM ${relationTable} rel
    JOIN tags tag ON tag.id = rel.tag_id AND tag.deleted_at IS NULL
    WHERE rel.deleted_at IS NULL
      AND rel.${entityColumn} = ${alias}.id
  )`
}

function tagPreviewSql(relationTable: 'task_tags' | 'project_tags', entityColumn: 'task_id' | 'project_id', alias: string) {
  const orderExpr = relationTable === 'project_tags' ? 'rel.position ASC, rel.created_at ASC' : 'rel.created_at ASC'
  return `(
    SELECT group_concat(preview.title, '${TAG_PREVIEW_SEPARATOR}')
    FROM (
      SELECT tag.title AS title
      FROM ${relationTable} rel
      JOIN tags tag ON tag.id = rel.tag_id AND tag.deleted_at IS NULL
      WHERE rel.deleted_at IS NULL
        AND rel.${entityColumn} = ${alias}.id
      ORDER BY ${orderExpr}, rel.rowid ASC
      LIMIT 2
    ) preview
  )`
}

function tagIdsSql(relationTable: 'task_tags' | 'project_tags', entityColumn: 'task_id' | 'project_id', alias: string) {
  const orderExpr = relationTable === 'project_tags' ? 'rel.position ASC, rel.created_at ASC' : 'rel.created_at ASC'
  return `(
    SELECT group_concat(rel.tag_id, '${TAG_PREVIEW_SEPARATOR}')
    FROM ${relationTable} rel
    JOIN tags tag ON tag.id = rel.tag_id AND tag.deleted_at IS NULL
    WHERE rel.deleted_at IS NULL
      AND rel.${entityColumn} = ${alias}.id
    ORDER BY ${orderExpr}, rel.rowid ASC
  )`
}

function parseDelimitedText(value: string | null | undefined): string[] {
  if (!value) return []
  return value.split(TAG_PREVIEW_SEPARATOR).filter((part) => part.length > 0)
}

function taskSelectColumns(rankExpr?: string): string {
  const columns = [
    "'task' AS kind",
    't.id',
    't.title',
    't.notes',
    't.status',
    't.is_inbox',
    't.is_someday',
    't.project_id',
    'p.title AS project_title',
    't.section_id',
    't.area_id',
    't.scheduled_at',
    't.due_at',
    't.created_at',
    't.updated_at',
    't.completed_at',
    't.deleted_at',
    `${tagCountSql('task_tags', 'task_id', 't')} AS tag_count`,
    `${tagPreviewSql('task_tags', 'task_id', 't')} AS tag_preview_text`,
    `${tagIdsSql('task_tags', 'task_id', 't')} AS tag_ids_text`,
  ]

  if (rankExpr) columns.push(`${rankExpr} AS rank`)
  return columns.join(',\n             ')
}

function projectSelectColumns(rankExpr?: string): string {
  const columns = [
    "'project' AS kind",
    'p.id',
    'p.title',
    'p.notes',
    'p.status',
    'p.area_id',
    'p.scheduled_at',
    'p.is_someday',
    'p.due_at',
    'p.created_at',
    'p.updated_at',
    'p.completed_at',
    'p.deleted_at',
    `${tagCountSql('project_tags', 'project_id', 'p')} AS tag_count`,
    `${tagPreviewSql('project_tags', 'project_id', 'p')} AS tag_preview_text`,
    `${tagIdsSql('project_tags', 'project_id', 'p')} AS tag_ids_text`,
    `(
       SELECT COUNT(1)
       FROM tasks child
       WHERE child.deleted_at IS NULL
         AND child.project_id = p.id
         AND child.status IN ('open', 'done', 'cancelled')
     ) AS total_count`,
    `(
       SELECT COALESCE(SUM(CASE WHEN child.status IN ('done', 'cancelled') THEN 1 ELSE 0 END), 0)
       FROM tasks child
       WHERE child.deleted_at IS NULL
         AND child.project_id = p.id
         AND child.status IN ('open', 'done', 'cancelled')
     ) AS done_count`,
  ]

  if (rankExpr) columns.push(`${rankExpr} AS rank`)
  return columns.join(',\n             ')
}

function parseTaskRows(rows: unknown[]): ViewListItem[] {
  return z.array(TagPreviewRowSchema).parse(rows).map((row) =>
    ViewListTaskItemSchema.parse({
      ...row,
      kind: 'task',
      tag_preview: parseDelimitedText(row.tag_preview_text),
      tag_count: row.tag_count ?? 0,
      tag_ids: parseDelimitedText(row.tag_ids_text),
    })
  )
}

function parseProjectRows(rows: unknown[]): ViewListItem[] {
  return z.array(TagPreviewRowSchema).parse(rows).map((row) =>
    ViewListProjectItemSchema.parse({
      ...row,
      kind: 'project',
      tag_preview: parseDelimitedText(row.tag_preview_text),
      tag_count: row.tag_count ?? 0,
      tag_ids: parseDelimitedText(row.tag_ids_text),
    })
  )
}

function compareItemsByRankThenCreatedAt(left: ViewListItem, right: ViewListItem): number {
  const leftRank = left.rank ?? null
  const rightRank = right.rank ?? null

  if (leftRank !== null || rightRank !== null) {
    if (leftRank === null) return 1
    if (rightRank === null) return -1
    if (leftRank !== rightRank) return leftRank - rightRank
  }

  const created = left.created_at.localeCompare(right.created_at)
  if (created !== 0) return created
  const kind = left.kind.localeCompare(right.kind)
  if (kind !== 0) return kind
  return left.id.localeCompare(right.id)
}

function compareUpcomingItems(left: ViewListItem, right: ViewListItem): number {
  const leftDate = left.scheduled_at ?? ''
  const rightDate = right.scheduled_at ?? ''
  const scheduled = leftDate.localeCompare(rightDate)
  if (scheduled !== 0) return scheduled
  return compareItemsByRankThenCreatedAt(left, right)
}

function parseAndSortItems(taskRows: unknown[], projectRows: unknown[], mode: 'manual' | 'upcoming'): ViewListItem[] {
  const items = [...parseTaskRows(taskRows), ...parseProjectRows(projectRows)]
  const sorted = items.sort(mode === 'upcoming' ? compareUpcomingItems : compareItemsByRankThenCreatedAt)
  return z.array(ViewListItemSchema).parse(sorted)
}

function listManualView(db: Database.Database, listId: string, taskWhere: string, projectWhere: string, params: object) {
  const taskRows = db
    .prepare(
      `SELECT
             ${taskSelectColumns('COALESCE(vp.rank, lp.rank)')}
       FROM tasks t
       LEFT JOIN projects p
         ON p.id = t.project_id AND p.deleted_at IS NULL
       LEFT JOIN view_positions vp
         ON vp.list_id = @list_id AND vp.entity_type = 'task' AND vp.entity_id = t.id
       LEFT JOIN list_positions lp
         ON lp.list_id = @list_id AND lp.task_id = t.id
       WHERE t.deleted_at IS NULL
         AND t.status = 'open'
         AND ${taskWhere}`
    )
    .all({ ...params, list_id: listId })

  const projectRows = db
    .prepare(
      `SELECT
             ${projectSelectColumns('vp.rank')}
       FROM projects p
       LEFT JOIN view_positions vp
         ON vp.list_id = @list_id AND vp.entity_type = 'project' AND vp.entity_id = p.id
       WHERE p.deleted_at IS NULL
         AND p.status = 'open'
         AND ${projectWhere}`
    )
    .all({ ...params, list_id: listId })

  return parseAndSortItems(taskRows, projectRows, 'manual')
}

export function createViewActions(db: Database.Database): Record<string, DbActionHandler> {
  return {
    'view.listByArea': (payload) => {
      const parsed = ViewListByAreaInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid view.listByArea payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const projectRows = db
        .prepare(
          `SELECT
             ${projectSelectColumns()}
           FROM projects p
           WHERE p.deleted_at IS NULL
             AND p.status = 'open'
             AND p.area_id = @area_id`
        )
        .all({ area_id: parsed.data.area_id })

      const items = parseProjectRows(projectRows)
      return { ok: true, data: items }
    },

    'view.listAnytime': (payload) => {
      const parsed = ViewListAnytimeInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid view.listAnytime payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const items = listManualView(
        db,
        TASK_LIST_ID_ANYTIME,
        't.scheduled_at IS NULL AND t.is_inbox = 0 AND t.is_someday = 0',
        'p.scheduled_at IS NULL AND p.is_someday = 0',
        {}
      )
      return { ok: true, data: items }
    },

    'view.listSomeday': (payload) => {
      const parsed = ViewListSomedayInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid view.listSomeday payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const items = listManualView(
        db,
        TASK_LIST_ID_SOMEDAY,
        't.is_someday = 1',
        'p.is_someday = 1',
        {}
      )
      return { ok: true, data: items }
    },

    'view.listToday': (payload) => {
      const parsed = ViewListTodayInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid view.listToday payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const items = listManualView(
        db,
        TASK_LIST_ID_TODAY,
        't.scheduled_at = @date',
        'p.scheduled_at = @date',
        { date: parsed.data.date }
      )
      return { ok: true, data: items }
    },

    'view.listUpcoming': (payload) => {
      const parsed = ViewListUpcomingInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid view.listUpcoming payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const taskRows = db
        .prepare(
          `SELECT
             ${taskSelectColumns()}
           FROM tasks t
           LEFT JOIN projects p
             ON p.id = t.project_id AND p.deleted_at IS NULL
           WHERE t.deleted_at IS NULL
             AND t.status = 'open'
             AND t.scheduled_at IS NOT NULL
             AND t.scheduled_at > @from_date`
        )
        .all({ from_date: parsed.data.from_date })

      const projectRows = db
        .prepare(
          `SELECT
             ${projectSelectColumns()}
           FROM projects p
           WHERE p.deleted_at IS NULL
             AND p.status = 'open'
             AND p.scheduled_at IS NOT NULL
             AND p.scheduled_at > @from_date`
        )
        .all({ from_date: parsed.data.from_date })

      return { ok: true, data: parseAndSortItems(taskRows, projectRows, 'upcoming') }
    },

    'view.reorderBatch': (payload) => {
      const parsed = ViewReorderBatchInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid view.reorderBatch payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const updatedAt = nowIso()
      const listId = parsed.data.list_id
      const ordered = parsed.data.ordered_items

      const tx = db.transaction(() => {
        const sync = createLocalSyncRecorder(db, updatedAt)
        const upsert = db.prepare(
          `INSERT INTO view_positions (list_id, entity_type, entity_id, rank, updated_at)
           VALUES (@list_id, @entity_type, @entity_id, @rank, @updated_at)
           ON CONFLICT(list_id, entity_type, entity_id) DO UPDATE SET
             rank = excluded.rank,
             updated_at = excluded.updated_at`
        )

        for (let i = 0; i < ordered.length; i++) {
          const item = ordered[i]
          if (!item) continue
          upsert.run({
            list_id: listId,
            entity_type: item.kind,
            entity_id: item.id,
            rank: (i + 1) * 1000,
            updated_at: updatedAt,
          })
        }

        sync.recordList(
          `view-list:${listId}`,
          ordered.map((item) => `${item.kind}:${item.id}`),
          updatedAt
        )
        sync.finalize()

        return { ok: true as const, data: { reordered: true } }
      })

      return tx()
    },
  }
}
