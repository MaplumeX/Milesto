import { describe, expect, it, vi } from 'vitest'

import { makeAreaTools } from '../../../electron/agent/tools/area-tools'
import type { DbWorkerClient } from '../../../electron/workers/db/db-worker-client'

const AREA_ID = '550e8400-e29b-41d4-a716-446655440020'

function createMockDb(): DbWorkerClient {
  return {
    request: vi.fn(),
  } as unknown as DbWorkerClient
}

describe('makeAreaTools', () => {
  it('area_list calls db.request with area.list', async () => {
    const db = createMockDb()
    const tools = makeAreaTools(db)

    const listTool = tools.find((t) => t.name === 'area_list')!
    vi.mocked(db.request).mockResolvedValue({
      ok: true,
      data: [{ id: AREA_ID, title: 'Work' }],
    })

    const result = await listTool.invoke({})

    expect(db.request).toHaveBeenCalledWith('area.list', {})
    expect(result).toContain(AREA_ID)
    expect(result).toContain('Work')
  })

  it('area_getDetail calls db.request with area.getDetail', async () => {
    const db = createMockDb()
    const tools = makeAreaTools(db)

    const detailTool = tools.find((t) => t.name === 'area_getDetail')!
    vi.mocked(db.request).mockResolvedValue({
      ok: true,
      data: { id: AREA_ID, title: 'Work', tags: [] },
    })

    const result = await detailTool.invoke({ id: AREA_ID })

    expect(db.request).toHaveBeenCalledWith('area.getDetail', { id: AREA_ID })
    expect(result).toContain(AREA_ID)
  })

  it('area_search calls db.request with area.search', async () => {
    const db = createMockDb()
    const tools = makeAreaTools(db)

    const searchTool = tools.find((t) => t.name === 'area_search')!
    vi.mocked(db.request).mockResolvedValue({
      ok: true,
      data: [{ id: AREA_ID, title: 'Work Area' }],
    })

    const result = await searchTool.invoke({ query: 'work' })

    expect(db.request).toHaveBeenCalledWith('area.search', { query: 'work' })
    expect(result).toContain('Work Area')
  })

  it('returns formatted error when db request fails', async () => {
    const db = createMockDb()
    const tools = makeAreaTools(db)

    const listTool = tools.find((t) => t.name === 'area_list')!
    vi.mocked(db.request).mockResolvedValue({
      ok: false,
      error: { code: 'DB_ERROR', message: 'Database unreachable' },
    })

    const result = await listTool.invoke({})

    expect(result).toContain('"ok":false')
    expect(result).toContain('DB_ERROR')
  })
})
