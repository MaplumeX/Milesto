import { tool } from '@langchain/core/tools'
import { z } from 'zod'

import type { DbWorkerClient } from '../../workers/db/db-worker-client'
import { formatToolResult } from './tool-result'

export function makeTaskTools(db: DbWorkerClient) {
  return [
    tool(
      async () => {
        const r = await db.request('task.listToday', { date: formatLocalDate(new Date()) })
        return formatToolResult(r)
      },
      {
        name: 'task_listToday',
        description: 'List tasks scheduled for today.',
        schema: z.object({}),
      }
    ),
    tool(
      async () => {
        const r = await db.request('task.listInbox', {})
        return formatToolResult(r)
      },
      {
        name: 'task_listInbox',
        description: 'List tasks in the Inbox.',
        schema: z.object({}),
      }
    ),
    tool(
      async () => {
        const r = await db.request('task.listAnytime', {})
        return formatToolResult(r)
      },
      {
        name: 'task_listAnytime',
        description: 'List tasks in Anytime (no specific schedule).',
        schema: z.object({}),
      }
    ),
    tool(
      async () => {
        const r = await db.request('task.listSomeday', {})
        return formatToolResult(r)
      },
      {
        name: 'task_listSomeday',
        description: 'List tasks in Someday (no concrete plan yet).',
        schema: z.object({}),
      }
    ),
    tool(
      async () => {
        const r = await db.request('task.listUpcoming', { from_date: formatLocalDate(new Date()) })
        return formatToolResult(r)
      },
      {
        name: 'task_listUpcoming',
        description: 'List upcoming tasks (scheduled after today).',
        schema: z.object({}),
      }
    ),
    tool(
      async () => {
        const r = await db.request('task.listLogbook', {})
        return formatToolResult(r)
      },
      {
        name: 'task_listLogbook',
        description: 'List completed or cancelled tasks in the Logbook.',
        schema: z.object({}),
      }
    ),
    tool(
      async ({ projectId }) => {
        const r = await db.request('task.listProject', { project_id: projectId })
        return formatToolResult(r)
      },
      {
        name: 'task_listProject',
        description: 'List tasks belonging to a specific project.',
        schema: z.object({
          projectId: z.string().uuid(),
        }),
      }
    ),
    tool(
      async ({ areaId }) => {
        const r = await db.request('task.listArea', { area_id: areaId })
        return formatToolResult(r)
      },
      {
        name: 'task_listArea',
        description: 'List tasks belonging to a specific area.',
        schema: z.object({
          areaId: z.string().uuid(),
        }),
      }
    ),
    tool(
      async ({ keyword }) => {
        const r = await db.request('task.search', {
          query: keyword,
          include_logbook: false,
        })
        return formatToolResult(r)
      },
      {
        name: 'task_search',
        description: 'Search tasks by keyword.',
        schema: z.object({
          keyword: z.string().min(1),
        }),
      }
    ),
    tool(
      async ({ id }) => {
        const r = await db.request('task.getDetail', { id })
        return formatToolResult(r)
      },
      {
        name: 'task_getDetail',
        description: 'Get detailed information about a specific task.',
        schema: z.object({
          id: z.string().uuid(),
        }),
      }
    ),
  ] as const
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
