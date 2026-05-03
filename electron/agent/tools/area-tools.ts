import { tool } from '@langchain/core/tools'
import { z } from 'zod'

import type { DbWorkerClient } from '../../workers/db/db-worker-client'
import { formatToolResult } from './tool-result'

export function makeAreaTools(db: DbWorkerClient) {
  return [
    tool(
      async () => {
        const result = await db.request('area.list', {})
        return formatToolResult(result)
      },
      {
        name: 'area_list',
        description: 'List all areas.',
        schema: z.object({}),
      }
    ),

    tool(
      async ({ id }) => {
        const result = await db.request('area.getDetail', { id })
        return formatToolResult(result)
      },
      {
        name: 'area_getDetail',
        description: 'Get detailed information about a specific area, including its tags.',
        schema: z.object({
          id: z.string().uuid(),
        }),
      }
    ),

    tool(
      async ({ query }) => {
        const result = await db.request('area.search', { query })
        return formatToolResult(result)
      },
      {
        name: 'area_search',
        description: 'Search areas by keyword.',
        schema: z.object({
          query: z.string().min(1),
        }),
      }
    ),
  ] as const
}
