import { describe, expect, it, vi } from 'vitest'

import { makeProjectTools } from '../../../electron/agent/tools/project-tools'
import type { DbWorkerClient } from '../../../electron/workers/db/db-worker-client'
import type { ConfirmGate } from '../../../electron/agent/confirm-gate'

const PROJ_ID = '550e8400-e29b-41d4-a716-446655440010'
const SEC_ID = '550e8400-e29b-41d4-a716-446655440011'

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

describe('makeProjectTools', () => {
  it('project_create calls db.request and bumps revision on success', async () => {
    const db = createMockDb()
    const callbacks = createMockCallbacks()
    const tools = makeProjectTools(db, callbacks)

    const createTool = tools.find((t) => t.name === 'project_create')!
    vi.mocked(db.request).mockResolvedValue({
      ok: true,
      data: { id: PROJ_ID, title: 'New Project' },
    })

    const result = await createTool.invoke({ title: 'New Project' })

    expect(db.request).toHaveBeenCalledWith('project.create', {
      input: {
        title: 'New Project',
        area_id: null,
        notes: '',
        scheduled_at: null,
        due_at: null,
        is_someday: false,
      },
    })
    expect(callbacks.onBumpRevision).toHaveBeenCalledTimes(1)
    expect(result).toContain('已创建项目')
    expect(result).toContain(PROJ_ID)
  })

  it('project_complete uses confirmGate and bumps revision when approved', async () => {
    const db = createMockDb()
    const callbacks = createMockCallbacks()
    const tools = makeProjectTools(db, callbacks)

    const completeTool = tools.find((t) => t.name === 'project_complete')!
    vi.mocked(callbacks.confirmGate).mockResolvedValue(true)
    vi.mocked(db.request)
      .mockResolvedValueOnce({
        ok: true,
        data: { project: { id: PROJ_ID, title: 'My Project' }, tags: [] },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { project: { id: PROJ_ID, title: 'My Project' }, tasks_completed: 3 },
      })

    const result = await completeTool.invoke({ id: PROJ_ID })

    expect(callbacks.confirmGate).toHaveBeenCalledWith('project.complete', '完成项目 "My Project"')
    expect(db.request).toHaveBeenLastCalledWith('project.complete', { id: PROJ_ID })
    expect(callbacks.onBumpRevision).toHaveBeenCalledTimes(1)
    expect(result).toContain('已完成项目')
    expect(result).toContain('3')
  })

  it('project_cancel returns rejection message when user declines', async () => {
    const db = createMockDb()
    const callbacks = createMockCallbacks()
    const tools = makeProjectTools(db, callbacks)

    const cancelTool = tools.find((t) => t.name === 'project_cancel')!
    vi.mocked(callbacks.confirmGate).mockResolvedValue(false)
    vi.mocked(db.request).mockResolvedValueOnce({
      ok: true,
      data: { project: { id: PROJ_ID, title: 'My Project' }, tags: [] },
    })

    const result = await cancelTool.invoke({ id: PROJ_ID })

    expect(callbacks.confirmGate).toHaveBeenCalled()
    expect(db.request).not.toHaveBeenCalledWith('project.cancel', expect.anything())
    expect(callbacks.onBumpRevision).not.toHaveBeenCalled()
    expect(result).toBe('用户拒绝取消项目。')
  })

  it('project_delete uses confirmGate for high-risk action', async () => {
    const db = createMockDb()
    const callbacks = createMockCallbacks()
    const tools = makeProjectTools(db, callbacks)

    const deleteTool = tools.find((t) => t.name === 'project_delete')!
    vi.mocked(callbacks.confirmGate).mockResolvedValue(true)
    vi.mocked(db.request)
      .mockResolvedValueOnce({
        ok: true,
        data: { project: { id: PROJ_ID, title: 'Old Project' }, tags: [] },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { deleted: true },
      })

    const result = await deleteTool.invoke({ id: PROJ_ID })

    expect(callbacks.confirmGate).toHaveBeenCalledWith('project.delete', '删除项目 "Old Project"')
    expect(callbacks.onBumpRevision).toHaveBeenCalledTimes(1)
    expect(result).toContain('已删除项目')
  })

  it('project_createSection bumps revision on success', async () => {
    const db = createMockDb()
    const callbacks = createMockCallbacks()
    const tools = makeProjectTools(db, callbacks)

    const createSectionTool = tools.find((t) => t.name === 'project_createSection')!
    vi.mocked(db.request).mockResolvedValue({
      ok: true,
      data: { id: SEC_ID, title: 'Section A' },
    })

    const result = await createSectionTool.invoke({ projectId: PROJ_ID, title: 'Section A' })

    expect(db.request).toHaveBeenCalledWith('project.section.create', {
      project_id: PROJ_ID,
      title: 'Section A',
    })
    expect(callbacks.onBumpRevision).toHaveBeenCalledTimes(1)
    expect(result).toContain('已在项目中创建分区')
  })

  it('project_listSections is read-only and does not bump revision', async () => {
    const db = createMockDb()
    const callbacks = createMockCallbacks()
    const tools = makeProjectTools(db, callbacks)

    const listSectionsTool = tools.find((t) => t.name === 'project_listSections')!
    vi.mocked(db.request).mockResolvedValue({
      ok: true,
      data: [{ id: SEC_ID, title: 'Section A' }],
    })

    const result = await listSectionsTool.invoke({ projectId: PROJ_ID })

    expect(db.request).toHaveBeenCalledWith('project.section.list', { project_id: PROJ_ID })
    expect(callbacks.onBumpRevision).not.toHaveBeenCalled()
    expect(result).toContain(SEC_ID)
  })
})
