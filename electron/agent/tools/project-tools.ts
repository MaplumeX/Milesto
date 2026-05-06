import { tool } from '@langchain/core/tools'
import { z } from 'zod'

import type { DbWorkerClient } from '../../workers/db/db-worker-client'
import { formatToolResult } from './tool-result'
import type { ConfirmGate } from '../confirm-gate'

export type ProjectToolCallbacks = {
  onBumpRevision: () => void
  confirmGate: ConfirmGate
  aiContext?: {
    sessionId: string
    userMessageId: string
    runMessageId: string
  }
}

export function makeProjectTools(db: DbWorkerClient, callbacks: ProjectToolCallbacks) {
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
      async ({ title, areaId, notes, scheduledAt, dueAt, isSomeday }) => {
        const result = await requestMutation('project_create', 'project.create', {
          title,
          area_id: areaId ?? null,
          notes: notes ?? '',
          scheduled_at: scheduledAt ?? null,
          due_at: dueAt ?? null,
          is_someday: isSomeday ?? false,
        })
        if (result.ok) onBumpRevision()
        const data = result.ok ? (result.data as { id: string }) : null
        const description = data
          ? `已创建项目 "${title}"（ID: ${data.id}）`
          : `创建项目 "${title}" 失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'project_create',
        description: 'Create a new project.',
        schema: z.object({
          title: z.string().min(1),
          areaId: z.string().uuid().optional(),
          notes: z.string().optional(),
          scheduledAt: z.string().optional(),
          dueAt: z.string().optional(),
          isSomeday: z.boolean().optional(),
        }),
      }
    ),

    tool(
      async ({ id, title, notes, areaId, scheduledAt, dueAt, isSomeday }) => {
        const result = await requestMutation('project_update', 'project.update', {
          id,
          title,
          notes,
          area_id: areaId,
          scheduled_at: scheduledAt,
          due_at: dueAt,
          is_someday: isSomeday,
        })
        if (result.ok) onBumpRevision()
        const data = result.ok ? (result.data as { title: string }) : null
        const description = data
          ? `已更新项目 "${data.title}"（ID: ${id}）`
          : `更新项目（ID: ${id}）失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'project_update',
        description: 'Update an existing project. Only pass fields you want to change.',
        schema: z.object({
          id: z.string().uuid(),
          title: z.string().optional(),
          notes: z.string().optional(),
          areaId: z.string().uuid().optional(),
          scheduledAt: z.string().optional(),
          dueAt: z.string().optional(),
          isSomeday: z.boolean().optional(),
        }),
      }
    ),

    tool(
      async ({ id }) => {
        // High-risk: requires confirm gate
        const detail = await db.request('project.getDetail', { id })
        if (!detail.ok) return formatToolResult(detail)

        const detailData = detail.data as { project: { title: string } }
        const approved = await confirmGate('project.complete', `完成项目 "${detailData.project.title}"`)
        if (!approved) return '用户拒绝完成项目。'

        const result = await requestMutation('project_complete', 'project.complete', { id })
        if (result.ok) onBumpRevision()
        const data = result.ok ? (result.data as { tasks_completed: number }) : null
        const description = data
          ? `已完成项目 "${detailData.project.title}"，同时完成了 ${data.tasks_completed} 个任务`
          : `完成项目（ID: ${id}）失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'project_complete',
        description: 'Complete a project and all its open tasks. This is a high-risk action and requires user confirmation.',
        schema: z.object({
          id: z.string().uuid(),
        }),
      }
    ),

    tool(
      async ({ id }) => {
        // High-risk: requires confirm gate
        const detail = await db.request('project.getDetail', { id })
        if (!detail.ok) return formatToolResult(detail)

        const detailData = detail.data as { project: { title: string } }
        const approved = await confirmGate('project.cancel', `取消项目 "${detailData.project.title}"`)
        if (!approved) return '用户拒绝取消项目。'

        const result = await requestMutation('project_cancel', 'project.cancel', { id })
        if (result.ok) onBumpRevision()
        const data = result.ok ? (result.data as { tasks_completed: number }) : null
        const description = data
          ? `已取消项目 "${detailData.project.title}"，同时取消了 ${data.tasks_completed} 个任务`
          : `取消项目（ID: ${id}）失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'project_cancel',
        description: 'Cancel a project and all its open tasks. This is a high-risk action and requires user confirmation.',
        schema: z.object({
          id: z.string().uuid(),
        }),
      }
    ),

    tool(
      async ({ id }) => {
        // High-risk: requires confirm gate
        const detail = await db.request('project.getDetail', { id })
        if (!detail.ok) return formatToolResult(detail)

        const detailData = detail.data as { project: { title: string } }
        const approved = await confirmGate('project.delete', `删除项目 "${detailData.project.title}"`)
        if (!approved) return '用户拒绝删除项目。'

        const result = await requestMutation('project_delete', 'project.delete', { id })
        if (result.ok) onBumpRevision()
        const description = result.ok
          ? `已删除项目 "${detailData.project.title}"（已移至回收站）`
          : `删除项目（ID: ${id}）失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'project_delete',
        description: 'Delete a project (moves to Trash). This is a high-risk action and requires user confirmation.',
        schema: z.object({
          id: z.string().uuid(),
        }),
      }
    ),

    tool(
      async ({ projectId, tagIds }) => {
        const result = await requestMutation('project_setTags', 'project.setTags', { project_id: projectId, tag_ids: tagIds })
        if (result.ok) onBumpRevision()
        const description = result.ok
          ? `已设置项目标签（ID: ${projectId}）`
          : `设置项目标签（ID: ${projectId}）失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'project_setTags',
        description: 'Set tags on a project. Pass the full list of tag IDs you want applied.',
        schema: z.object({
          projectId: z.string().uuid(),
          tagIds: z.array(z.string().uuid()),
        }),
      }
    ),

    tool(
      async ({ projectId, title }) => {
        const result = await requestMutation('project_createSection', 'project.section.create', { project_id: projectId, title })
        if (result.ok) onBumpRevision()
        const data = result.ok ? (result.data as { id: string }) : null
        const description = data
          ? `已在项目中创建分区 "${title}"（ID: ${data.id}）`
          : `创建分区 "${title}" 失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'project_createSection',
        description: 'Create a new section inside a project.',
        schema: z.object({
          projectId: z.string().uuid(),
          title: z.string().min(1),
        }),
      }
    ),

    tool(
      async ({ id, title }) => {
        const result = await requestMutation('project_renameSection', 'project.section.rename', { id, title })
        if (result.ok) onBumpRevision()
        const description = result.ok
          ? `已重命名分区为 "${title}"（ID: ${id}）`
          : `重命名分区（ID: ${id}）失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'project_renameSection',
        description: 'Rename a project section.',
        schema: z.object({
          id: z.string().uuid(),
          title: z.string().min(1),
        }),
      }
    ),

    tool(
      async ({ id }) => {
        // High-risk: requires confirm gate
        const approved = await confirmGate('project.deleteSection', `删除项目分区（ID: ${id}）`)
        if (!approved) return '用户拒绝删除项目分区。'

        const result = await requestMutation('project_deleteSection', 'project.section.delete', { id })
        if (result.ok) onBumpRevision()
        const description = result.ok
          ? `已删除项目分区（ID: ${id}）`
          : `删除项目分区（ID: ${id}）失败`
        return description + '\n' + formatToolResult(result)
      },
      {
        name: 'project_deleteSection',
        description: 'Delete a project section. Tasks in the section are moved to the previous section. This is a high-risk action and requires user confirmation.',
        schema: z.object({
          id: z.string().uuid(),
        }),
      }
    ),

    tool(
      async ({ projectId }) => {
        const result = await db.request('project.section.list', { project_id: projectId })
        return formatToolResult(result)
      },
      {
        name: 'project_listSections',
        description: 'List all sections in a project.',
        schema: z.object({
          projectId: z.string().uuid(),
        }),
      }
    ),
  ] as const
}
