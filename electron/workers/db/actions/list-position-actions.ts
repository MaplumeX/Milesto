import type Database from 'better-sqlite3'

import type { DbActionHandler } from './db-actions'
import { nowIso } from './utils'

import { TaskReorderBatchInputSchema } from '../../../../shared/schemas/list-position'

export function createListPositionActions(db: Database.Database): Record<string, DbActionHandler> {
  return {
    'task.reorderBatch': (payload) => {
      const parsed = TaskReorderBatchInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid task.reorderBatch payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const updatedAt = nowIso()
      const listId = parsed.data.list_id
      const ordered = parsed.data.ordered_task_ids

      const tx = db.transaction(() => {
        const upsert = db.prepare(
          `INSERT INTO list_positions (list_id, task_id, rank, updated_at)
           VALUES (@list_id, @task_id, @rank, @updated_at)
           ON CONFLICT(list_id, task_id) DO UPDATE SET
             rank = excluded.rank,
             updated_at = excluded.updated_at`
        )

        for (let i = 0; i < ordered.length; i++) {
          upsert.run({
            list_id: listId,
            task_id: ordered[i],
            rank: (i + 1) * 1000,
            updated_at: updatedAt,
          })
        }

        return { ok: true as const, data: { reordered: true } }
      })

      return tx()
    },
  }
}
