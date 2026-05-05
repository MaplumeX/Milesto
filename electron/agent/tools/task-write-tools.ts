import { tool } from '@langchain/core/tools'
import { z } from 'zod'

import type { DbWorkerClient } from '../../workers/db/db-worker-client'
import { formatToolResult } from './tool-result'
import type { ConfirmGate } from '../confirm-gate'

export type TaskWriteToolCallbacks = {
  onBumpRevision: () => void
  confirmGate: ConfirmGate
  aiContext?: {
    sessionId: string
    userMessageId: string
    runMessageId: string
  }
}

export function makeTaskWriteTools(db: DbWorkerClient, callbacks: TaskWriteToolCallbacks) {
  const { onBumpRevision, confirmGate } = callbacks
  const requestMutation = (toolName: string, action: string, payload: unknown) => {
    if (!callbacks.aiContext) return db.request(action, payload)
    return db.request('aiChat.runMutation', {
      context: {
        session_id: callbacks.aiContext.sessionId,
        user_message_id: callbacks.aiContext.userMessageId,
        run_message_id: callbacks.aiContext.runMessageId,
        tool_name: toolName,
      },
      action,
      payload,
    })
  }

  return [
    tool(
      async ({ title, projectId, areaId, notes, scheduledAt, dueAt, isInbox, isSomeday }) => {
        const result = await requestMutation('task_create', 'task.create', {
          title,
          project_id: projectId ?? null,
          area_id: areaId ?? null,
          notes: notes ?? '',
          scheduled_at: scheduledAt ?? null,
          due_at: dueAt ?? null,
          is_inbox: isInbox ?? false,
          is_someday: isSomeday ?? false,
        })
        if (result.ok) onBumpRevision()
        const data = result.ok ? (result.data as { id: string }) : null
        const description = data
          ? `已创建任务 "${title}"（ID: ${data.id}）`
          : `创建任务 "${title}" 失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'task_create',
        description: 'Create a new task. You can specify title, project, area, notes, schedule, due date, inbox, or someday flag.',
        schema: z.object({
          title: z.string().min(1),
          projectId: z.string().uuid().optional(),
          areaId: z.string().uuid().optional(),
          notes: z.string().optional(),
          scheduledAt: z.string().optional(),
          dueAt: z.string().optional(),
          isInbox: z.boolean().optional(),
          isSomeday: z.boolean().optional(),
        }),
      }
    ),

    tool(
      async ({ id, title, notes, scheduledAt, dueAt, projectId, areaId, sectionId, isInbox, isSomeday }) => {
        const result = await requestMutation('task_update', 'task.update', {
          id,
          title,
          notes,
          scheduled_at: scheduledAt,
          due_at: dueAt,
          project_id: projectId,
          area_id: areaId,
          section_id: sectionId,
          is_inbox: isInbox,
          is_someday: isSomeday,
        })
        if (result.ok) onBumpRevision()
        const data = result.ok ? (result.data as { title: string }) : null
        const description = data
          ? `已更新任务 "${data.title}"（ID: ${id}）`
          : `更新任务（ID: ${id}）失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'task_update',
        description: 'Update an existing task. Only pass fields you want to change.',
        schema: z.object({
          id: z.string().uuid(),
          title: z.string().optional(),
          notes: z.string().optional(),
          scheduledAt: z.string().optional(),
          dueAt: z.string().optional(),
          projectId: z.string().uuid().optional(),
          areaId: z.string().uuid().optional(),
          sectionId: z.string().uuid().optional(),
          isInbox: z.boolean().optional(),
          isSomeday: z.boolean().optional(),
        }),
      }
    ),

    tool(
      async ({ id, done }) => {
        const result = await requestMutation('task_toggleDone', 'task.toggleDone', { id, done })
        if (result.ok) onBumpRevision()
        const data = result.ok ? (result.data as { title: string }) : null
        const description = data
          ? `已将任务 "${data.title}" 标记为${done ? '已完成' : '未完成'}`
          : `标记任务完成状态（ID: ${id}）失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'task_toggleDone',
        description: 'Toggle a task as done or not done.',
        schema: z.object({
          id: z.string().uuid(),
          done: z.boolean(),
        }),
      }
    ),

    tool(
      async ({ id }) => {
        const result = await requestMutation('task_cancel', 'task.cancel', { id })
        if (result.ok) onBumpRevision()
        const data = result.ok ? (result.data as { title: string }) : null
        const description = data
          ? `已取消任务 "${data.title}"`
          : `取消任务（ID: ${id}）失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'task_cancel',
        description: 'Cancel an open task.',
        schema: z.object({
          id: z.string().uuid(),
        }),
      }
    ),

    tool(
      async ({ id }) => {
        const result = await requestMutation('task_restore', 'task.restore', { id })
        if (result.ok) onBumpRevision()
        const data = result.ok ? (result.data as { title: string }) : null
        const description = data
          ? `已恢复任务 "${data.title}"`
          : `恢复任务（ID: ${id}）失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'task_restore',
        description: 'Restore a cancelled task back to open.',
        schema: z.object({
          id: z.string().uuid(),
        }),
      }
    ),

    tool(
      async ({ id }) => {
        const result = await requestMutation('task_convertToProject', 'task.convertToProject', { id })
        if (result.ok) onBumpRevision()
        const data = result.ok ? (result.data as { project: { id: string } }) : null
        const description = data
          ? `已将任务转换为项目（项目ID: ${data.project.id}）`
          : `转换任务为项目（ID: ${id}）失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'task_convertToProject',
        description: 'Convert a task into a project. Its checklist items become child tasks.',
        schema: z.object({
          id: z.string().uuid(),
        }),
      }
    ),

    tool(
      async ({ taskId, tagIds }) => {
        const result = await requestMutation('task_setTags', 'task.setTags', { task_id: taskId, tag_ids: tagIds })
        if (result.ok) onBumpRevision()
        const description = result.ok
          ? `已设置任务标签（ID: ${taskId}）`
          : `设置任务标签（ID: ${taskId}）失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'task_setTags',
        description: 'Set tags on a task. Pass the full list of tag IDs you want applied.',
        schema: z.object({
          taskId: z.string().uuid(),
          tagIds: z.array(z.string().uuid()),
        }),
      }
    ),

    tool(
      async ({ id }) => {
        // High-risk: requires confirm gate
        const detail = await db.request('task.getDetail', { id })
        if (!detail.ok) return formatToolResult(detail)

        const detailData = detail.data as { task: { title: string } }
        const approved = await confirmGate('task.delete', `删除任务 "${detailData.task.title}"`)
        if (!approved) return '用户拒绝删除任务。'

        const result = await requestMutation('task_delete', 'task.delete', { id })
        if (result.ok) onBumpRevision()
        const description = result.ok
          ? `已删除任务 "${detailData.task.title}"（已移至回收站）`
          : `删除任务（ID: ${id}）失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'task_delete',
        description: 'Delete a task (moves to Trash). This is a high-risk action and requires user confirmation.',
        schema: z.object({
          id: z.string().uuid(),
        }),
      }
    ),
  ] as const
}
