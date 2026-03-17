import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { ok } from '../../shared/result'
import type { WindowApi } from '../../shared/window-api'
import { TaskRow } from '../../src/features/tasks/TaskRow'

describe('TaskRow project affiliation', () => {
  beforeEach(() => {
    const api = (window as unknown as { api: WindowApi }).api
    api.project.get = vi.fn(async () =>
      ok({
        id: 'p1',
        title: '',
        notes: '',
        area_id: null,
        status: 'open',
        scheduled_at: null,
        is_someday: false,
        due_at: null,
        created_at: '2026-03-17T00:00:00.000Z',
        updated_at: '2026-03-17T00:00:00.000Z',
        completed_at: null,
        deleted_at: null,
      })
    )
  })

  afterEach(() => {
    cleanup()
  })

  it('renders a muted project line below the title when project_title exists', () => {
    render(
      <TaskRow
        task={{
          id: 't1',
          title: 'Task A',
          status: 'open',
          is_inbox: false,
          is_someday: false,
          project_id: 'p1',
          project_title: 'Project Alpha',
          section_id: null,
          area_id: null,
          scheduled_at: null,
          due_at: null,
          created_at: '2026-03-17T00:00:00.000Z',
          updated_at: '2026-03-17T00:00:00.000Z',
          completed_at: null,
          deleted_at: null,
        }}
      />
    )

    expect(screen.getByText('Project Alpha')).toBeInTheDocument()
  })

  it('fetches the project title when the list item is missing project_title', async () => {
    const api = (window as unknown as { api: WindowApi }).api
    api.project.get = vi.fn(async () =>
      ok({
        id: 'p1',
        title: 'Project Alpha',
        notes: '',
        area_id: null,
        status: 'open',
        scheduled_at: null,
        is_someday: false,
        due_at: null,
        created_at: '2026-03-17T00:00:00.000Z',
        updated_at: '2026-03-17T00:00:00.000Z',
        completed_at: null,
        deleted_at: null,
      })
    )

    render(
      <TaskRow
        task={{
          id: 't-fetch',
          title: 'Task Fetch',
          status: 'open',
          is_inbox: false,
          is_someday: false,
          project_id: 'p1',
          project_title: null,
          section_id: null,
          area_id: null,
          scheduled_at: null,
          due_at: null,
          created_at: '2026-03-17T00:00:00.000Z',
          updated_at: '2026-03-17T00:00:00.000Z',
          completed_at: null,
          deleted_at: null,
        }}
      />
    )

    expect(await screen.findByText('Project Alpha')).toBeInTheDocument()
  })

  it('falls back to the project placeholder when the task belongs to an untitled project', async () => {
    render(
      <TaskRow
        task={{
          id: 't2',
          title: 'Task B',
          status: 'open',
          is_inbox: false,
          is_someday: false,
          project_id: 'p2',
          project_title: '',
          section_id: null,
          area_id: null,
          scheduled_at: null,
          due_at: null,
          created_at: '2026-03-17T00:00:00.000Z',
          updated_at: '2026-03-17T00:00:00.000Z',
          completed_at: null,
          deleted_at: null,
        }}
      />
    )

    expect(await screen.findByText('project.untitled')).toBeInTheDocument()
  })

  it('does not render the project affiliation when the parent page disables it', () => {
    render(
      <TaskRow
        task={{
          id: 't-no-project-label',
          title: 'Task Hidden',
          status: 'open',
          is_inbox: false,
          is_someday: false,
          project_id: 'p1',
          project_title: 'Project Alpha',
          section_id: null,
          area_id: null,
          scheduled_at: null,
          due_at: null,
          created_at: '2026-03-17T00:00:00.000Z',
          updated_at: '2026-03-17T00:00:00.000Z',
          completed_at: null,
          deleted_at: null,
        }}
        showProjectAffiliation={false}
      />
    )

    expect(screen.queryByText('Project Alpha')).toBeNull()
  })
})
