import { useMemo, useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { ok } from '../../shared/result'
import type { WindowApi } from '../../shared/window-api'
import type { EntityScope } from '../../shared/schemas/common'
import type { Tag } from '../../shared/schemas/tag'
import type { TaskDetail } from '../../shared/schemas/task-detail'
import type { Task } from '../../shared/schemas/task'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { ContentScrollProvider } from '../../src/app/ContentScrollContext'
import { TaskList } from '../../src/features/tasks/TaskList'
import type { TaskSelection } from '../../src/features/tasks/TaskSelectionContext'
import { TaskSelectionProvider } from '../../src/features/tasks/TaskSelectionContext'

vi.mock('@tanstack/react-virtual', () => {
  return {
    useVirtualizer: (opts: { count: number; scrollMargin?: number }) => {
      const scrollMargin = opts.scrollMargin ?? 0
      return {
        options: { scrollMargin },
        getTotalSize: () => opts.count * 44,
        getVirtualItems: () => Array.from({ length: opts.count }, (_, index) => ({ index, start: index * 44 })),
        measureElement: () => {},
        scrollToIndex: () => {},
      }
    },
  }
})

function makeTask(overrides?: Partial<TaskListItem>): TaskListItem {
  return {
    id: 't1',
    title: 'Task A',
    status: 'open',
    is_inbox: false,
    is_someday: false,
    project_id: null,
    project_title: null,
    section_id: null,
    area_id: null,
    scheduled_at: null,
    due_at: null,
    created_at: '2026-03-17T00:00:00.000Z',
    updated_at: '2026-03-17T00:00:00.000Z',
    completed_at: null,
    deleted_at: null,
    ...overrides,
  }
}

function TaskListHarness({
  tasks,
  scope,
  selectionOverrides,
}: {
  tasks: TaskListItem[]
  scope?: EntityScope
  selectionOverrides?: Partial<TaskSelection>
}) {
  const contentScrollRef = useRef<HTMLDivElement | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const selection: TaskSelection = useMemo(
    () => ({
      selectedTaskId,
      selectTask: (id) => setSelectedTaskId(id),
      openTaskId,
      openTask: async (id) => setOpenTaskId(id),
      closeTask: () => setOpenTaskId(null),
      requestCloseTask: async () => true,
      registerOpenEditor: () => {},
      ...selectionOverrides,
    }),
    [openTaskId, selectedTaskId, selectionOverrides]
  )

  return (
    <AppEventsProvider>
      <TaskSelectionProvider value={selection}>
        <ContentScrollProvider scrollRef={contentScrollRef}>
          <div ref={contentScrollRef} className="content-scroll">
            <TaskList
              title="Tasks"
              tasks={tasks}
              scope={scope}
              onToggleDone={async () => {}}
            />
          </div>
        </ContentScrollProvider>
      </TaskSelectionProvider>
    </AppEventsProvider>
  )
}

function getApi(): WindowApi {
  return (window as unknown as { api: WindowApi }).api
}

function makeTaskRecord(overrides?: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'Task A',
    notes: '',
    status: 'open',
    is_inbox: false,
    is_someday: false,
    project_id: null,
    section_id: null,
    area_id: null,
    scheduled_at: null,
    due_at: null,
    created_at: '2026-03-17T00:00:00.000Z',
    updated_at: '2026-03-17T00:00:00.000Z',
    completed_at: null,
    deleted_at: null,
    ...overrides,
  }
}

function makeTaskDetail(overrides?: Partial<TaskDetail>): TaskDetail {
  return {
    task: makeTaskRecord(),
    tag_ids: [],
    checklist_items: [],
    ...overrides,
  }
}

function makeTag(id: string, title: string): Tag {
  return {
    id,
    title,
    color: null,
    created_at: '2026-03-17T00:00:00.000Z',
    updated_at: '2026-03-17T00:00:00.000Z',
    deleted_at: null,
  }
}

describe('task context menu', () => {
  afterEach(() => {
    cleanup()
  })

  it('opens a root context menu with schedule, tags, due, and complete actions for open tasks', async () => {
    render(<TaskListHarness tasks={[makeTask()]} />)

    const titleButton = await screen.findByRole('button', { name: 'Task A' })
    fireEvent.contextMenu(titleButton, { clientX: 120, clientY: 80 })

    expect(await screen.findByRole('button', { name: 'common.schedule' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'taskEditor.tagsLabel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'taskEditor.dueLabel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'taskEditor.markDone' })).toBeInTheDocument()
  })

  it('shows restore instead of complete for done tasks', async () => {
    render(<TaskListHarness tasks={[makeTask({ status: 'done', completed_at: '2026-03-17T02:00:00.000Z' })]} />)

    const titleButton = await screen.findByRole('button', { name: 'Task A' })
    fireEvent.contextMenu(titleButton, { clientX: 120, clientY: 80 })

    expect(await screen.findByRole('button', { name: 'task.restore' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'taskEditor.markDone' })).toBeNull()
  })

  it('closes the context menu on Escape', async () => {
    render(<TaskListHarness tasks={[makeTask()]} />)

    const titleButton = await screen.findByRole('button', { name: 'Task A' })
    fireEvent.contextMenu(titleButton, { clientX: 120, clientY: 80 })
    await screen.findByRole('button', { name: 'common.schedule' })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('button', { name: 'common.schedule' })).toBeNull()
  })

  it('closes the context menu on outside click', async () => {
    render(<TaskListHarness tasks={[makeTask()]} />)

    const titleButton = await screen.findByRole('button', { name: 'Task A' })
    fireEvent.contextMenu(titleButton, { clientX: 120, clientY: 80 })
    await screen.findByRole('button', { name: 'common.schedule' })

    fireEvent.pointerDown(document.body, { button: 0 })

    expect(screen.queryByRole('button', { name: 'common.schedule' })).toBeNull()
  })

  it('calls requestCloseTask before opening and aborts when flush fails', async () => {
    const errorTarget = document.createElement('button')
    document.body.append(errorTarget)

    const requestCloseTask = vi.fn(async () => {
      errorTarget.focus()
      return false
    })

    render(
      <TaskListHarness
        tasks={[makeTask()]}
        selectionOverrides={{ requestCloseTask }}
      />
    )

    const titleButton = await screen.findByRole('button', { name: 'Task A' })
    fireEvent.contextMenu(titleButton, { clientX: 120, clientY: 80 })

    await waitFor(() => {
      expect(requestCloseTask).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole('button', { name: 'common.schedule' })).toBeNull()
    expect(document.activeElement).toBe(errorTarget)

    errorTarget.remove()
  })

  it('saves schedule changes immediately and closes the menu on success', async () => {
    const api = getApi()
    api.task.update = vi.fn<WindowApi['task']['update']>(async (input) =>
      ok(makeTaskRecord({ ...input }))
    )

    render(<TaskListHarness tasks={[makeTask()]} />)

    const titleButton = await screen.findByRole('button', { name: 'Task A' })
    fireEvent.contextMenu(titleButton, { clientX: 120, clientY: 80 })
    fireEvent.click(await screen.findByRole('button', { name: 'common.schedule' }))
    fireEvent.click(await screen.findByRole('button', { name: 'nav.someday' }))

    await waitFor(() => {
      expect(api.task.update).toHaveBeenCalledWith({
        id: 't1',
        is_someday: true,
        scheduled_at: null,
        is_inbox: false,
        scope: 'active',
      })
    })
    expect(screen.queryByRole('button', { name: 'common.schedule' })).toBeNull()
  })

  it('saves due changes immediately and closes the menu on success', async () => {
    const api = getApi()
    api.task.update = vi.fn<WindowApi['task']['update']>(async (input) =>
      ok(makeTaskRecord({ ...input }))
    )

    render(<TaskListHarness tasks={[makeTask({ due_at: '2026-03-21' })]} />)

    const titleButton = await screen.findByRole('button', { name: 'Task A' })
    fireEvent.contextMenu(titleButton, { clientX: 120, clientY: 80 })
    fireEvent.click(await screen.findByRole('button', { name: 'taskEditor.dueLabel' }))
    fireEvent.click(await screen.findByRole('button', { name: 'common.clear' }))

    await waitFor(() => {
      expect(api.task.update).toHaveBeenCalledWith({
        id: 't1',
        due_at: null,
        scope: 'active',
      })
    })
    expect(screen.queryByRole('button', { name: 'common.schedule' })).toBeNull()
  })

  it('lazy-loads tags, saves toggles immediately, and keeps the tags panel open', async () => {
    const api = getApi()
    api.task.getDetail = vi.fn<WindowApi['task']['getDetail']>(async () =>
      ok(makeTaskDetail({ task: makeTaskRecord(), tag_ids: ['tag-1'] }))
    )
    api.tag.list = vi.fn<WindowApi['tag']['list']>(async () =>
      ok([makeTag('tag-1', 'Urgent'), makeTag('tag-2', 'Home')])
    )
    api.task.setTags = vi.fn<WindowApi['task']['setTags']>(async () => ok({ updated: true }))

    render(<TaskListHarness tasks={[makeTask()]} />)

    const titleButton = await screen.findByRole('button', { name: 'Task A' })
    fireEvent.contextMenu(titleButton, { clientX: 120, clientY: 80 })

    expect(api.task.getDetail).not.toHaveBeenCalled()
    expect(api.tag.list).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: 'taskEditor.tagsLabel' }))

    const homeCheckbox = await screen.findByRole('checkbox', { name: 'Home' })
    fireEvent.click(homeCheckbox)

    await waitFor(() => {
      expect(api.task.getDetail).toHaveBeenCalledWith('t1', 'active')
      expect(api.tag.list).toHaveBeenCalledTimes(1)
      expect(api.task.setTags).toHaveBeenCalledWith('t1', ['tag-1', 'tag-2'], 'active')
    })
    expect(screen.getByRole('checkbox', { name: 'Home' })).toBeInTheDocument()
  })

  it('completes open tasks immediately from the menu root and closes on success', async () => {
    const api = getApi()
    api.task.toggleDone = vi.fn<WindowApi['task']['toggleDone']>(async (id, done) =>
      ok(
        makeTaskRecord({
          id,
          status: done ? 'done' : 'open',
          completed_at: done ? '2026-03-17T02:00:00.000Z' : null,
        })
      )
    )

    render(<TaskListHarness tasks={[makeTask()]} />)

    const titleButton = await screen.findByRole('button', { name: 'Task A' })
    fireEvent.contextMenu(titleButton, { clientX: 120, clientY: 80 })
    fireEvent.click(await screen.findByRole('button', { name: 'taskEditor.markDone' }))

    await waitFor(() => {
      expect(api.task.toggleDone).toHaveBeenCalledWith('t1', true, 'active')
    })
    expect(screen.queryByRole('button', { name: 'common.schedule' })).toBeNull()
  })

  it('restores done tasks immediately from the menu root and closes on success', async () => {
    const api = getApi()
    api.task.toggleDone = vi.fn<WindowApi['task']['toggleDone']>(async (id, done) =>
      ok(
        makeTaskRecord({
          id,
          status: done ? 'done' : 'open',
          completed_at: done ? '2026-03-17T02:00:00.000Z' : null,
        })
      )
    )

    render(<TaskListHarness tasks={[makeTask({ status: 'done', completed_at: '2026-03-17T02:00:00.000Z' })]} />)

    const titleButton = await screen.findByRole('button', { name: 'Task A' })
    fireEvent.contextMenu(titleButton, { clientX: 120, clientY: 80 })
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'task.restore' }))

    await waitFor(() => {
      expect(api.task.toggleDone).toHaveBeenCalledWith('t1', false, 'active')
    })
    expect(screen.queryByRole('button', { name: 'common.schedule' })).toBeNull()
  })
})
