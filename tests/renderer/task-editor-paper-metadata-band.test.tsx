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
        <TaskEditorPaper taskId="t1" onRequestClose={() => {}} />
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
    const notes = container.querySelector<HTMLElement>('#task-notes')
    expect(notes).not.toBeNull()
    const metadataBand = container.querySelector<HTMLElement>('[data-task-inline-meta-band="true"]')
    expect(metadataBand).not.toBeNull()

    const items = Array.from(metadataBand?.querySelectorAll<HTMLElement>('[data-task-inline-meta-kind]') ?? [])
    expect(items.map((item) => item.dataset.taskInlineMetaKind)).toEqual([
      'schedule',
      'due',
      'tags',
      'checklist',
    ])
    expect(items[0]?.textContent).toContain('2026-03-30')
    expect(items[1]?.textContent).toContain('2026-03-28')
    expect(items[2]?.textContent).toContain('Urgent')
    expect(items[2]?.textContent).toContain('Home')
    expect(items[2]?.textContent).toContain('Deep Work')

    expect(Boolean(titleInput.compareDocumentPosition(notes as Node) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    expect(Boolean((notes as Node).compareDocumentPosition(metadataBand as Node) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    expect(getComputedStyle(notes as Element).minHeight).toBe('48px')

    // The empty-triggers placeholder area should not render schedule/due/tags placeholders
    // when those fields already have values. Only the checklist placeholder remains because
    // the test task has no checklist items.
    const emptyTriggersArea = metadataBand?.querySelector<HTMLElement>(
      '.task-inline-metadata-empty-triggers'
    )
    expect(emptyTriggersArea).not.toBeNull()
    expect(emptyTriggersArea?.querySelector('[data-task-inline-meta-kind="schedule"]')).toBeNull()
    expect(emptyTriggersArea?.querySelector('[data-task-inline-meta-kind="due"]')).toBeNull()
    expect(emptyTriggersArea?.querySelector('[data-task-inline-meta-kind="tags"]')).toBeNull()
    // When tags are set, the `+ Tags` add-more trigger persists at the end of the chip row
    // (also using `taskEditor.tagsLabel` as its accessible name). Verify it is rendered inside
    // the set-values area's tags row, not in the empty-triggers placeholder area.
    const addMoreTagsBtn = metadataBand?.querySelector<HTMLButtonElement>(
      '.task-inline-meta-tags-row .task-inline-meta-tags-add'
    )
    expect(addMoreTagsBtn).not.toBeNull()
    expect(addMoreTagsBtn?.getAttribute('aria-label')).toBe('taskEditor.tagsLabel')
    expect(screen.getByRole('button', { name: /taskEditor\.checklistLabel/ })).toBeInTheDocument()
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
    const scheduleTrigger = metadataBand
      ?.querySelector<HTMLElement>('[data-task-inline-meta-kind="schedule"]')
      ?.querySelector<HTMLButtonElement>('button.meta-date-badge-value')
    const dueTrigger = metadataBand
      ?.querySelector<HTMLElement>('[data-task-inline-meta-kind="due"]')
      ?.querySelector<HTMLButtonElement>('button.meta-date-badge-value')
    // When tags are set, the row container carries the `tags` data attribute, but the click
    // target is the `+ Tags` add-more button rendered at the end of the row.
    const tagsTrigger = metadataBand?.querySelector<HTMLElement>(
      '.task-inline-meta-tags-row .task-inline-meta-tags-add'
    )

    expect(scheduleTrigger).not.toBeNull()
    expect(dueTrigger).not.toBeNull()
    expect(tagsTrigger).not.toBeNull()

    await user.click(scheduleTrigger as HTMLElement)
    await waitFor(() => {
      expect(document.querySelector('.task-inline-popover-calendar')).not.toBeNull()
    })
    expect(screen.getByRole('button', { name: 'nav.someday' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(document.querySelector('.task-inline-popover')).toBeNull()
    })

    await user.click(dueTrigger as HTMLElement)
    await waitFor(() => {
      expect(document.querySelector('.task-inline-popover-calendar')).not.toBeNull()
    })
    expect(screen.queryByRole('button', { name: 'nav.someday' })).toBeNull()
    const clearBtn = Array.from(document.querySelectorAll('.task-inline-popover button')).find(
      (b) => b.textContent === 'common.clear'
    )
    expect(clearBtn).toBeDefined()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(document.querySelector('.task-inline-popover')).toBeNull()
    })

    await user.click(tagsTrigger as HTMLElement)
    expect(await screen.findByPlaceholderText('taskEditor.newTagPlaceholder')).toBeInTheDocument()
  })

  it('renders placeholder metadata actions while keeping footer actions available', async () => {
    setupApi()
    const { container } = renderInlineEditor()

    await screen.findByDisplayValue('Task A')

    const metadataBand = container.querySelector<HTMLElement>('[data-task-inline-meta-band="true"]')
    expect(metadataBand).not.toBeNull()
    expect(metadataBand?.textContent).toContain('common.schedule')
    expect(metadataBand?.textContent).toContain('taskEditor.dueLabel')
    expect(metadataBand?.textContent).toContain('taskEditor.tagsLabel')
    expect(screen.getByRole('button', { name: 'common.schedule' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'taskEditor.dueLabel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'taskEditor.tagsLabel' })).toBeInTheDocument()
  })

  it('removing a single tag chip persists only the remaining ids', async () => {
    const user = userEvent.setup()
    const { api } = setupApi({ tagIds: ['tag-1', 'tag-2', 'tag-3'] })
    const { container } = renderInlineEditor()

    await screen.findByDisplayValue('Task A')
    await screen.findByText(/Urgent/)

    const metadataBand = container.querySelector<HTMLElement>('[data-task-inline-meta-band="true"]')
    const chips = Array.from(
      metadataBand?.querySelectorAll<HTMLElement>('.meta-tag-chip') ?? []
    )
    expect(chips.length).toBe(3)

    // Remove the middle chip (Home, tag-2). The chip's clear button is icon-only and
    // its aria-label is `aria.removeTag` (interpolated with the tag title in production
    // i18n; the test mock just returns the key).
    const homeChip = chips.find((chip) => chip.textContent?.includes('Home'))
    expect(homeChip).toBeTruthy()
    const removeBtn = homeChip?.querySelector<HTMLButtonElement>('.meta-tag-chip-clear')
    expect(removeBtn).not.toBeNull()
    expect(removeBtn?.getAttribute('aria-label')).toBe('aria.removeTag')

    await user.click(removeBtn as HTMLElement)

    await waitFor(() => {
      expect(api.task.setTags).toHaveBeenCalled()
    })
    const calls = (api.task.setTags as unknown as { mock: { calls: unknown[][] } }).mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall?.[0]).toBe('t1')
    expect(lastCall?.[1]).toEqual(['tag-1', 'tag-3'])
  })
})
