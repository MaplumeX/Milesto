import { describe, expect, it, vi } from 'vitest'

import { makeTagTools } from '../../../electron/agent/tools/tag-tools'
import type { DbWorkerClient } from '../../../electron/workers/db/db-worker-client'

const TAG_ID = '550e8400-e29b-41d4-a716-446655440030'

function createMockDb(): DbWorkerClient {
  return {
    request: vi.fn(),
  } as unknown as DbWorkerClient
}

describe('makeTagTools', () => {
  it('tag_list calls db.request with tag.list', async () => {
    const db = createMockDb()
    const tools = makeTagTools(db)

    const listTool = tools.find((t) => t.name === 'tag_list')!
    vi.mocked(db.request).mockResolvedValue({
      ok: true,
      data: [{ id: TAG_ID, title: 'Urgent' }],
    })

    const result = await listTool.invoke({})

    expect(db.request).toHaveBeenCalledWith('tag.list', {})
    expect(result).toContain(TAG_ID)
    expect(result).toContain('Urgent')
  })

  it('returns formatted error when db request fails', async () => {
    const db = createMockDb()
    const tools = makeTagTools(db)

    const listTool = tools.find((t) => t.name === 'tag_list')!
    vi.mocked(db.request).mockResolvedValue({
      ok: false,
      error: { code: 'DB_ERROR', message: 'Database unreachable' },
    })

    const result = await listTool.invoke({})

    expect(result).toContain('"ok":false')
    expect(result).toContain('DB_ERROR')
  })
})
