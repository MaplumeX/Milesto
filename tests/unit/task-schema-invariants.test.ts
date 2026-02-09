import { describe, expect, it } from 'vitest'

import { TaskSchema } from '../../shared/schemas/task'

function makeBaseTask() {
  return {
    id: 't1',
    title: 'Task',
    notes: '',
    status: 'open' as const,
    is_inbox: false,
    is_someday: false,
    project_id: null,
    section_id: null,
    area_id: null,
    scheduled_at: null,
    due_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    completed_at: null,
    deleted_at: null,
  }
}

describe('shared/schemas/task invariants', () => {
  it('rejects is_someday=true with scheduled_at not null', () => {
    const parsed = TaskSchema.safeParse({
      ...makeBaseTask(),
      is_someday: true,
      scheduled_at: '2026-01-02',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects inbox tasks with any assignment/schedule/someday flags', () => {
    const parsed = TaskSchema.safeParse({
      ...makeBaseTask(),
      is_inbox: true,
      project_id: 'p1',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts a valid task row', () => {
    expect(TaskSchema.parse(makeBaseTask()).id).toBe('t1')
  })
})
