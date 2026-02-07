import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { nowIso } from './utils'

import { AreaSchema } from '../../../../shared/schemas/area'
import { ProjectSchema } from '../../../../shared/schemas/project'
import {
  SidebarListModelInputSchema,
  SidebarListModelSchema,
  SidebarMoveProjectInputSchema,
  SidebarReorderAreasInputSchema,
  SidebarReorderProjectsInputSchema,
} from '../../../../shared/schemas/sidebar'

function isSameNullableId(a: string | null, b: string | null): boolean {
  return a === b
}

function hasDuplicates(ids: string[]): boolean {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) return true
    seen.add(id)
  }
  return false
}

function listAreaIds(db: Database.Database): string[] {
  const rows = db
    .prepare(
      `SELECT id
       FROM areas
       WHERE deleted_at IS NULL`
    )
    .all() as { id: string }[]
  return rows.map((r) => r.id)
}

function listOpenProjectIdsInScope(db: Database.Database, areaId: string | null): string[] {
  const rows = db
    .prepare(
      `SELECT id
       FROM projects
       WHERE deleted_at IS NULL
         AND status = 'open'
         AND area_id IS @area_id`
    )
    .all({ area_id: areaId }) as { id: string }[]
  return rows.map((r) => r.id)
}

function ensureAreaPositionsInitialized(db: Database.Database, updatedAt: string) {
  const needsInit = db
    .prepare(
      `SELECT 1
       FROM areas
       WHERE deleted_at IS NULL
         AND position IS NULL
       LIMIT 1`
    )
    .get()

  if (!needsInit) return

  const rows = db
    .prepare(
      `SELECT id
       FROM areas
       WHERE deleted_at IS NULL
       ORDER BY title COLLATE NOCASE ASC`
    )
    .all() as { id: string }[]

  const update = db.prepare(
    `UPDATE areas
     SET position = @position, updated_at = @updated_at
     WHERE id = @id AND deleted_at IS NULL`
  )

  for (let i = 0; i < rows.length; i++) {
    update.run({ id: rows[i]!.id, position: (i + 1) * 1000, updated_at: updatedAt })
  }
}

function ensureProjectPositionsInitialized(db: Database.Database, areaId: string | null, updatedAt: string) {
  const needsInit = db
    .prepare(
      `SELECT 1
       FROM projects
       WHERE deleted_at IS NULL
         AND status = 'open'
         AND area_id IS @area_id
         AND position IS NULL
       LIMIT 1`
    )
    .get({ area_id: areaId })

  if (!needsInit) return

  const rows = db
    .prepare(
      `SELECT id
       FROM projects
       WHERE deleted_at IS NULL
         AND status = 'open'
         AND area_id IS @area_id
       ORDER BY title COLLATE NOCASE ASC`
    )
    .all({ area_id: areaId }) as { id: string }[]

  const update = db.prepare(
    `UPDATE projects
     SET position = @position, updated_at = @updated_at
     WHERE id = @id AND deleted_at IS NULL`
  )

  for (let i = 0; i < rows.length; i++) {
    update.run({ id: rows[i]!.id, position: (i + 1) * 1000, updated_at: updatedAt })
  }
}

export function createSidebarActions(db: Database.Database): Record<string, DbActionHandler> {
  return {
    'sidebar.listModel': (payload) => {
      const parsed = SidebarListModelInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid sidebar.listModel payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const areaRows = db
        .prepare(
          `SELECT id, title, notes, position, created_at, updated_at, deleted_at
           FROM areas
           WHERE deleted_at IS NULL
           ORDER BY (position IS NULL) ASC, position ASC, title COLLATE NOCASE ASC`
        )
        .all()
      const projectRows = db
        .prepare(
          `SELECT id, title, notes, area_id, status, position, scheduled_at, due_at,
                  created_at, updated_at, completed_at, deleted_at
           FROM projects
           WHERE deleted_at IS NULL AND status = 'open'
           ORDER BY
             CASE WHEN area_id IS NULL THEN 0 ELSE 1 END ASC,
             area_id ASC,
             (position IS NULL) ASC,
             position ASC,
             title COLLATE NOCASE ASC`
        )
        .all()

      const model = SidebarListModelSchema.parse({
        areas: z.array(AreaSchema).parse(areaRows),
        openProjects: z.array(ProjectSchema).parse(projectRows),
      })
      return { ok: true, data: model }
    },

    'sidebar.reorderAreas': (payload) => {
      const parsed = SidebarReorderAreasInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid sidebar.reorderAreas payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const ordered = parsed.data.ordered_area_ids
      if (hasDuplicates(ordered)) {
        return {
          ok: false,
          error: {
            code: 'INVALID_ORDER',
            message: 'Invalid area ordering (duplicate ids).',
          },
        }
      }

      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        ensureAreaPositionsInitialized(db, updatedAt)

        const currentIds = listAreaIds(db)
        if (currentIds.length !== ordered.length) {
          return {
            ok: false as const,
            error: {
              code: 'INVALID_ORDER',
              message: 'Invalid area ordering (length mismatch).',
              details: { expected: currentIds.length, got: ordered.length },
            },
          }
        }

        const currentSet = new Set(currentIds)
        for (const id of ordered) {
          if (!currentSet.has(id)) {
            return {
              ok: false as const,
              error: {
                code: 'INVALID_ORDER',
                message: 'Invalid area ordering (unknown id).',
                details: { id },
              },
            }
          }
        }

        const update = db.prepare(
          `UPDATE areas
           SET position = @position, updated_at = @updated_at
           WHERE id = @id AND deleted_at IS NULL`
        )
        for (let i = 0; i < ordered.length; i++) {
          update.run({ id: ordered[i]!, position: (i + 1) * 1000, updated_at: updatedAt })
        }

        return { ok: true as const, data: { reordered: true } }
      })

      return tx()
    },

    'sidebar.reorderProjects': (payload) => {
      const parsed = SidebarReorderProjectsInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid sidebar.reorderProjects payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const ordered = parsed.data.ordered_project_ids
      const areaId = parsed.data.area_id
      if (hasDuplicates(ordered)) {
        return {
          ok: false,
          error: {
            code: 'INVALID_ORDER',
            message: 'Invalid project ordering (duplicate ids).',
          },
        }
      }

      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        ensureProjectPositionsInitialized(db, areaId, updatedAt)

        const currentIds = listOpenProjectIdsInScope(db, areaId)
        if (currentIds.length !== ordered.length) {
          return {
            ok: false as const,
            error: {
              code: 'INVALID_ORDER',
              message: 'Invalid project ordering (length mismatch).',
              details: { expected: currentIds.length, got: ordered.length, area_id: areaId },
            },
          }
        }

        const currentSet = new Set(currentIds)
        for (const id of ordered) {
          if (!currentSet.has(id)) {
            return {
              ok: false as const,
              error: {
                code: 'INVALID_ORDER',
                message: 'Invalid project ordering (unknown id).',
                details: { id, area_id: areaId },
              },
            }
          }
        }

        const update = db.prepare(
          `UPDATE projects
           SET position = @position, updated_at = @updated_at
           WHERE id = @id AND deleted_at IS NULL AND status = 'open' AND area_id IS @area_id`
        )
        for (let i = 0; i < ordered.length; i++) {
          update.run({ id: ordered[i]!, position: (i + 1) * 1000, updated_at: updatedAt, area_id: areaId })
        }

        return { ok: true as const, data: { reordered: true } }
      })

      return tx()
    },

    'sidebar.moveProject': (payload) => {
      const parsed = SidebarMoveProjectInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid sidebar.moveProject payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const input = parsed.data
      if (hasDuplicates(input.from_ordered_project_ids) || hasDuplicates(input.to_ordered_project_ids)) {
        return {
          ok: false,
          error: {
            code: 'INVALID_ORDER',
            message: 'Invalid project ordering (duplicate ids).',
          },
        }
      }

      if (isSameNullableId(input.from_area_id, input.to_area_id)) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid move (same source and target).',
          },
        }
      }

      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        const projectRow = db
          .prepare(
            `SELECT id, area_id, status
             FROM projects
             WHERE id = @id AND deleted_at IS NULL
             LIMIT 1`
          )
          .get({ id: input.project_id }) as { id: string; area_id: string | null; status: string } | undefined

        if (!projectRow) {
          return {
            ok: false as const,
            error: {
              code: 'NOT_FOUND',
              message: 'Project not found.',
              details: { id: input.project_id },
            },
          }
        }

        if (projectRow.status !== 'open') {
          return {
            ok: false as const,
            error: {
              code: 'INVALID_MOVE',
              message: 'Only open projects can be moved from the sidebar.',
              details: { id: input.project_id, status: projectRow.status },
            },
          }
        }

        if (!isSameNullableId(projectRow.area_id, input.from_area_id)) {
          return {
            ok: false as const,
            error: {
              code: 'CONFLICT',
              message: 'Project ownership changed before move could be applied.',
              details: { id: input.project_id, expected_from_area_id: input.from_area_id, actual_area_id: projectRow.area_id },
            },
          }
        }

        // Lazy-init ordering in both scopes before applying the move.
        ensureProjectPositionsInitialized(db, input.from_area_id, updatedAt)
        ensureProjectPositionsInitialized(db, input.to_area_id, updatedAt)

        const fromIdsBefore = listOpenProjectIdsInScope(db, input.from_area_id)
        if (!fromIdsBefore.includes(input.project_id)) {
          return {
            ok: false as const,
            error: {
              code: 'INVALID_MOVE',
              message: 'Project not in source group.',
              details: { id: input.project_id, from_area_id: input.from_area_id },
            },
          }
        }

        const fromExpected = fromIdsBefore.filter((id) => id !== input.project_id)
        const fromExpectedSet = new Set(fromExpected)
        if (fromExpected.length !== input.from_ordered_project_ids.length) {
          return {
            ok: false as const,
            error: {
              code: 'INVALID_ORDER',
              message: 'Invalid from-group ordering (length mismatch).',
              details: { expected: fromExpected.length, got: input.from_ordered_project_ids.length, from_area_id: input.from_area_id },
            },
          }
        }
        for (const id of input.from_ordered_project_ids) {
          if (!fromExpectedSet.has(id)) {
            return {
              ok: false as const,
              error: {
                code: 'INVALID_ORDER',
                message: 'Invalid from-group ordering (unknown id).',
                details: { id, from_area_id: input.from_area_id },
              },
            }
          }
        }

        const toIdsBefore = listOpenProjectIdsInScope(db, input.to_area_id)
        if (toIdsBefore.includes(input.project_id)) {
          return {
            ok: false as const,
            error: {
              code: 'CONFLICT',
              message: 'Project already exists in target group.',
              details: { id: input.project_id, to_area_id: input.to_area_id },
            },
          }
        }

        const toExpected = [...toIdsBefore, input.project_id]
        const toExpectedSet = new Set(toExpected)
        if (toExpected.length !== input.to_ordered_project_ids.length) {
          return {
            ok: false as const,
            error: {
              code: 'INVALID_ORDER',
              message: 'Invalid to-group ordering (length mismatch).',
              details: { expected: toExpected.length, got: input.to_ordered_project_ids.length, to_area_id: input.to_area_id },
            },
          }
        }
        for (const id of input.to_ordered_project_ids) {
          if (!toExpectedSet.has(id)) {
            return {
              ok: false as const,
              error: {
                code: 'INVALID_ORDER',
                message: 'Invalid to-group ordering (unknown id).',
                details: { id, to_area_id: input.to_area_id },
              },
            }
          }
        }

        // Apply ownership change.
        db.prepare(
          `UPDATE projects
           SET area_id = @area_id, updated_at = @updated_at
           WHERE id = @id AND deleted_at IS NULL AND status = 'open'`
        ).run({ id: input.project_id, area_id: input.to_area_id, updated_at: updatedAt })

        const updateFrom = db.prepare(
          `UPDATE projects
           SET position = @position, updated_at = @updated_at
           WHERE id = @id AND deleted_at IS NULL AND status = 'open' AND area_id IS @area_id`
        )
        for (let i = 0; i < input.from_ordered_project_ids.length; i++) {
          updateFrom.run({
            id: input.from_ordered_project_ids[i]!,
            position: (i + 1) * 1000,
            updated_at: updatedAt,
            area_id: input.from_area_id,
          })
        }

        const updateTo = db.prepare(
          `UPDATE projects
           SET position = @position, updated_at = @updated_at
           WHERE id = @id AND deleted_at IS NULL AND status = 'open' AND area_id IS @area_id`
        )
        for (let i = 0; i < input.to_ordered_project_ids.length; i++) {
          updateTo.run({
            id: input.to_ordered_project_ids[i]!,
            position: (i + 1) * 1000,
            updated_at: updatedAt,
            area_id: input.to_area_id,
          })
        }

        return { ok: true as const, data: { moved: true } }
      })

      return tx()
    },
  }
}
