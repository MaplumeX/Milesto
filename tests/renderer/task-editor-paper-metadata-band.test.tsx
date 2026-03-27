import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { ok } from '../../shared/result'
import type { WindowApi } from '../../shared/window-api'
import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { TaskEditorPaper } from '../../src/features/tasks/TaskEditorPaper'

function setupApi(options?: {
  scheduledAt?: string | null
  dueAt?: string | null
  tagIds?: string[]
}) {
  const api = (window as unknown as { api: WindowApi }).api
  const task = {
    id: 't1',
    title: 'Task A',
    notes: '',
    status: 'open' as const,
    is_inbox: false,
    is_someday: false,
    project_id: null,
    section_id: null,
    area_id: null,
    scheduled_at: options?.scheduledAt ?? null,
    due_at: options?.dueAt ?? null,
    created_at: '2026-03-26T00:00:00.000Z',
    updated_at: '2026-03-26T00:00:00.000Z',
    completed_at: null,
    deleted_at: null,
  }

  api.task.getDetail = vi.fn(async () =>
    ok({
      task,
      tag_ids: options?.tagIds ?? [],
      checklist_items: [],
    })
  )
  api.project.listOpen = vi.fn(async () => ok([]))
  api.tag.list = vi.fn(async () =>
    ok([
      {
        id: 'tag-1',
        title: 'Urgent',
        color: null,
        created_at: '2026-03-26T00:00:00.000Z',
        updated_at: '2026-03-26T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: 'tag-2',
        title: 'Home',
        color: null,
        created_at: '2026-03-26T00:00:00.000Z',
        updated_at: '2026-03-26T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: 'tag-3',
        title: 'Deep Work',
        color: null,
        created_at: '2026-03-26T00:00:00.000Z',
        updated_at: '2026-03-26T00:00:00.000Z',
        deleted_at: null,
      },
    ])
  )
  api.area.list = vi.fn(async () => ok([]))
  api.project.listSections = vi.fn(async () => ok([]))
  api.task.countProjectsProgress = vi.fn(async () => ok([]))
  api.task.update = vi.fn(async (input) =>
    ok({
      ...task,
      ...input,
      updated_at: '2026-03-26T00:00:01.000Z',
    })
  )
  api.task.setTags = vi.fn(async () => ok({ updated: true }))

  return { api }
}

function renderInlineEditor() {
  return render(
    <MemoryRouter>
      <AppEventsProvider>
        <TaskEditorPaper taskId="t1" variant="inline" onRequestClose={() => {}} />
      </AppEventsProvider>
    </MemoryRouter>
  )
}

describe('TaskEditorPaper metadata band', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders metadata below notes while removing duplicate footer actions', async () => {
    setupApi({
      scheduledAt: '2026-03-30',
      dueAt: '2026-03-28',
      tagIds: ['tag-1', 'tag-2', 'tag-3'],
    })
    const { container } = renderInlineEditor()

    await screen.findByDisplayValue('Task A')
    await screen.findByText(/Urgent/)

    const titleInput = screen.getByDisplayValue('Task A')
    const notes = screen.getByPlaceholderText('task.notesPlaceholder')
    const metadataBand = container.querySelector<HTMLElement>('[data-task-inline-meta-band="true"]')
    expect(metadataBand).not.toBeNull()

    const items = Array.from(metadataBand?.querySelectorAll<HTMLElement>('[data-task-inline-meta-kind]') ?? [])
    expect(items.map((item) => item.dataset.taskInlineMetaKind)).toEqual(['schedule', 'due', 'tags'])
    expect(items[0]?.textContent).toContain('taskEditor.scheduledPrefix')
    expect(items[0]?.textContent).toContain('2026-03-30')
    expect(items[1]?.textContent).toContain('taskEditor.duePrefix')
    expect(items[1]?.textContent).toContain('2026-03-28')
    expect(items[2]?.textContent).toContain('Urgent')
    expect(items[2]?.textContent).toContain('Home')
    expect(items[2]?.textContent).toContain('+1')

    expect(Boolean(titleInput.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    expect(Boolean(notes.compareDocumentPosition(metadataBand as Node) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    expect(getComputedStyle(notes).minHeight).toBe('48px')

    expect(screen.queryByRole('button', { name: 'common.schedule' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'taskEditor.dueLabel' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'taskEditor.tagsLabel' })).toBeNull()
    expect(screen.getByRole('button', { name: 'taskEditor.checklistLabel' })).toBeInTheDocument()
  })

  it('opens the existing pickers from metadata-band interactions', async () => {
    const user = userEvent.setup()
    setupApi({
      scheduledAt: '2026-03-30',
      dueAt: '2026-03-28',
      tagIds: ['tag-1', 'tag-2', 'tag-3'],
    })
    const { container } = renderInlineEditor()

    await screen.findByDisplayValue('Task A')
    await screen.findByText(/Urgent/)

    const metadataBand = container.querySelector<HTMLElement>('[data-task-inline-meta-band="true"]')
    const scheduleTrigger = metadataBand?.querySelector<HTMLElement>('[data-task-inline-meta-kind="schedule"] button')
    const dueTrigger = metadataBand?.querySelector<HTMLElement>('[data-task-inline-meta-kind="due"] button')
    const tagsTrigger = metadataBand?.querySelector<HTMLElement>('[data-task-inline-meta-kind="tags"] button')

    expect(scheduleTrigger).not.toBeNull()
    expect(dueTrigger).not.toBeNull()
    expect(tagsTrigger).not.toBeNull()

    await user.click(scheduleTrigger as HTMLElement)
    expect(await screen.findByText('taskEditor.popoverScheduleTitle')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(document.querySelector('.task-inline-popover')).toBeNull()
    })

    await user.click(dueTrigger as HTMLElement)
    expect(await screen.findByText('taskEditor.popoverDueTitle')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(document.querySelector('.task-inline-popover')).toBeNull()
    })

    await user.click(tagsTrigger as HTMLElement)
    expect(await screen.findByPlaceholderText('taskEditor.newTagPlaceholder')).toBeInTheDocument()
  })

  it('keeps add actions available in the footer when metadata is absent', async () => {
    setupApi()
    renderInlineEditor()

    await screen.findByDisplayValue('Task A')

    expect(document.querySelector('[data-task-inline-meta-band="true"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'common.schedule' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'taskEditor.dueLabel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'taskEditor.tagsLabel' })).toBeInTheDocument()
  })
})
