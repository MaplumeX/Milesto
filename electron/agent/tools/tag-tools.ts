import { tool } from '@langchain/core/tools'
import { z } from 'zod'

import type { DbWorkerClient } from '../../workers/db/db-worker-client'
import { formatToolResult } from './tool-result'

export function makeTagTools(db: DbWorkerClient) {
  return [
    tool(
      async () => {
        const result = await db.request('tag.list', {})
        return formatToolResult(result)
      },
      {
        name: 'tag_list',
        description: 'List all tags.',
        schema: z.object({}),
      }
    ),
  ] as const
}
