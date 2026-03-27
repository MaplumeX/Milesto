import { describe, expect, it } from 'vitest'

import { TaskSearchInputSchema, TaskSearchResultItemSchema } from '../../shared/schemas/search'
import { TaskListItemSchema } from '../../shared/schemas/task-list'

describe('shared/schemas/search', () => {
  it('requires non-empty query', () => {
    expect(TaskSearchInputSchema.safeParse({ query: '' }).success).toBe(false)
    expect(TaskSearchInputSchema.safeParse({ query: 'x' }).success).toBe(true)
  })

  it('accepts tag preview metadata on task list items and search results', () => {
    const baseItem = {
      id: 't1',
      title: 'Milk',
      status: 'open' as const,
      is_inbox: true,
      is_someday: false,
      project_id: null,
      project_title: null,
      section_id: null,
      area_id: null,
      scheduled_at: '2026-03-26',
      due_at: '2026-03-27',
      created_at: '2026-03-26T00:00:00.000Z',
      updated_at: '2026-03-26T00:00:00.000Z',
      completed_at: null,
      deleted_at: null,
      tag_preview: ['Urgent', 'Home'],
      tag_count: 3,
    }

    expect(TaskListItemSchema.parse(baseItem)).toMatchObject({
      tag_preview: ['Urgent', 'Home'],
      tag_count: 3,
    })

    expect(
      TaskSearchResultItemSchema.parse({
        ...baseItem,
        snippet: '[Milk]',
      })
    ).toMatchObject({
      tag_preview: ['Urgent', 'Home'],
      tag_count: 3,
      snippet: '[Milk]',
    })
  })

  it('keeps task list items backward compatible when tag preview metadata is absent', () => {
    expect(
      TaskListItemSchema.safeParse({
        id: 't1',
        title: 'Milk',
        status: 'open',
        is_inbox: true,
        is_someday: false,
        project_id: null,
        project_title: null,
        section_id: null,
        area_id: null,
        scheduled_at: null,
        due_at: null,
        created_at: '2026-03-26T00:00:00.000Z',
        updated_at: '2026-03-26T00:00:00.000Z',
        completed_at: null,
        deleted_at: null,
      }).success
    ).toBe(true)
  })
})
