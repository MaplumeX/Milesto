import { useMemo, useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import type { TaskListItem } from '../../shared/schemas/task-list'
import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { ContentScrollProvider } from '../../src/app/ContentScrollContext'
import { ProjectGroupedList } from '../../src/features/tasks/ProjectGroupedList'
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

function ProjectGroupedListHarness({
  openTasks,
}: {
  openTasks: TaskListItem[]
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
    }),
    [openTaskId, selectedTaskId]
  )

  return (
    <AppEventsProvider>
      <TaskSelectionProvider value={selection}>
        <ContentScrollProvider scrollRef={contentScrollRef}>
          <div ref={contentScrollRef} className="content-scroll">
            <ProjectGroupedList
              projectId="project-1"
              scope="active"
              sections={[]}
              openTasks={openTasks}
              doneTasks={[]}
              editingSectionId={null}
              onStartSectionTitleEdit={() => {}}
              onCancelSectionTitleEdit={() => {}}
              onCommitSectionTitle={async () => {}}
              onToggleDone={async () => {}}
            />
          </div>
        </ContentScrollProvider>
      </TaskSelectionProvider>
    </AppEventsProvider>
  )
}

function makeTask(): TaskListItem {
  return {
    id: 't1',
    title: 'Project task',
    status: 'open',
    is_inbox: false,
    is_someday: false,
    project_id: 'project-1',
    project_title: 'Project Alpha',
    section_id: null,
    area_id: null,
    scheduled_at: null,
    due_at: null,
    created_at: '2026-03-17T00:00:00.000Z',
    updated_at: '2026-03-17T00:00:00.000Z',
    completed_at: null,
    deleted_at: null,
    rank: 1000,
  }
}

describe('ProjectGroupedList', () => {
  afterEach(() => {
    cleanup()
  })

  it('opens the shared task context menu on right click for project task rows', async () => {
    render(<ProjectGroupedListHarness openTasks={[makeTask()]} />)

    const titleButton = await screen.findByRole('button', { name: 'Project task' })
    fireEvent.contextMenu(titleButton, { clientX: 120, clientY: 80 })

    expect(await screen.findByRole('button', { name: 'common.schedule' })).toBeInTheDocument()
  })
})
