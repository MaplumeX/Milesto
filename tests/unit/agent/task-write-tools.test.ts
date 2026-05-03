import { describe, expect, it, vi } from 'vitest'

import { makeTaskWriteTools } from '../../../electron/agent/tools/task-write-tools'
import type { DbWorkerClient } from '../../../electron/workers/db/db-worker-client'
import type { ConfirmGate } from '../../../electron/agent/confirm-gate'

const TASK_ID = '550e8400-e29b-41d4-a716-446655440001'
const TAG_ID_1 = '550e8400-e29b-41d4-a716-446655440002'
const TAG_ID_2 = '550e8400-e29b-41d4-a716-446655440003'

function createMockDb(): DbWorkerClient {
  return {
    request: vi.fn(),
  } as unknown as DbWorkerClient
}

function createMockCallbacks() {
  return {
    onBumpRevision: vi.fn(),
    confirmGate: vi.fn<ConfirmGate>(),
  }
}

describe('makeTaskWriteTools', () => {
  it('task_create calls db.request and bumps revision on success', async () => {
    const db = createMockDb()
    const callbacks = createMockCallbacks()
    const tools = makeTaskWriteTools(db, callbacks)

    const createTool = tools.find((t) => t.name === 'task_create')!
    vi.mocked(db.request).mockResolvedValue({
      ok: true,
      data: { id: TASK_ID, title: 'Test task' },
    })

    const result = await createTool.invoke({ title: 'Test task' })

    expect(db.request).toHaveBeenCalledWith('task.create', {
      title: 'Test task',
      project_id: null,
      area_id: null,
      notes: '',
      scheduled_at: null,
      due_at: null,
      is_inbox: false,
      is_someday: false,
    })
    expect(callbacks.onBumpRevision).toHaveBeenCalledTimes(1)
    expect(result).toContain('已创建任务')
    expect(result).toContain(TASK_ID)
  })

  it('task_update passes a top-level db payload and bumps revision on success', async () => {
    const db = createMockDb()
    const callbacks = createMockCallbacks()
    const tools = makeTaskWriteTools(db, callbacks)

    const updateTool = tools.find((t) => t.name === 'task_update')!
    vi.mocked(db.request).mockResolvedValue({
      ok: true,
      data: { id: TASK_ID, title: 'Updated task' },
    })

    const result = await updateTool.invoke({
      id: TASK_ID,
      title: 'Updated task',
      notes: 'Notes',
      scheduledAt: '2026-05-04',
      dueAt: '2026-05-05',
      isInbox: true,
      isSomeday: false,
    })

    expect(db.request).toHaveBeenCalledWith('task.update', {
      id: TASK_ID,
      title: 'Updated task',
      notes: 'Notes',
      scheduled_at: '2026-05-04',
      due_at: '2026-05-05',
      project_id: undefined,
      area_id: undefined,
      section_id: undefined,
      is_inbox: true,
      is_someday: false,
    })
    expect(callbacks.onBumpRevision).toHaveBeenCalledTimes(1)
    expect(result).toContain('已更新任务')
  })

  it('task_delete uses confirmGate and bumps revision when approved', async () => {
    const db = createMockDb()
    const callbacks = createMockCallbacks()
    const tools = makeTaskWriteTools(db, callbacks)

    const deleteTool = tools.find((t) => t.name === 'task_delete')!
    vi.mocked(callbacks.confirmGate).mockResolvedValue(true)
    vi.mocked(db.request)
      .mockResolvedValueOnce({
        ok: true,
        data: { task: { id: TASK_ID, title: 'Old task' } },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { deleted: true },
      })

    const result = await deleteTool.invoke({ id: TASK_ID })

    expect(callbacks.confirmGate).toHaveBeenCalledWith('task.delete', '删除任务 "Old task"')
    expect(db.request).toHaveBeenLastCalledWith('task.delete', { id: TASK_ID })
    expect(callbacks.onBumpRevision).toHaveBeenCalledTimes(1)
    expect(result).toContain('已删除任务')
  })

  it('task_delete returns rejection message when user declines', async () => {
    const db = createMockDb()
    const callbacks = createMockCallbacks()
    const tools = makeTaskWriteTools(db, callbacks)

    const deleteTool = tools.find((t) => t.name === 'task_delete')!
    vi.mocked(callbacks.confirmGate).mockResolvedValue(false)
    vi.mocked(db.request).mockResolvedValueOnce({
      ok: true,
      data: { task: { id: TASK_ID, title: 'Old task' } },
    })

    const result = await deleteTool.invoke({ id: TASK_ID })

    expect(callbacks.confirmGate).toHaveBeenCalled()
    expect(db.request).not.toHaveBeenCalledWith('task.delete', expect.anything())
    expect(callbacks.onBumpRevision).not.toHaveBeenCalled()
    expect(result).toBe('用户拒绝删除任务。')
  })

  it('task_toggleDone bumps revision on success', async () => {
    const db = createMockDb()
    const callbacks = createMockCallbacks()
    const tools = makeTaskWriteTools(db, callbacks)

    const toggleTool = tools.find((t) => t.name === 'task_toggleDone')!
    vi.mocked(db.request).mockResolvedValue({
      ok: true,
      data: { id: TASK_ID, title: 'My task' },
    })

    const result = await toggleTool.invoke({ id: TASK_ID, done: true })

    expect(db.request).toHaveBeenCalledWith('task.toggleDone', { id: TASK_ID, done: true })
    expect(callbacks.onBumpRevision).toHaveBeenCalledTimes(1)
    expect(result).toContain('已完成')
  })

  it('task_setTags bumps revision on success', async () => {
    const db = createMockDb()
    const callbacks = createMockCallbacks()
    const tools = makeTaskWriteTools(db, callbacks)

    const setTagsTool = tools.find((t) => t.name === 'task_setTags')!
    vi.mocked(db.request).mockResolvedValue({
      ok: true,
      data: { updated: true },
    })

    const result = await setTagsTool.invoke({ taskId: TASK_ID, tagIds: [TAG_ID_1, TAG_ID_2] })

    expect(db.request).toHaveBeenCalledWith('task.setTags', {
      task_id: TASK_ID,
      tag_ids: [TAG_ID_1, TAG_ID_2],
    })
    expect(callbacks.onBumpRevision).toHaveBeenCalledTimes(1)
    expect(result).toContain('已设置任务标签')
  })
})
