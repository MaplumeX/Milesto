import { useMemo, useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { TaskListItem } from '../../shared/schemas/task-list'
import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { ContentScrollProvider } from '../../src/app/ContentScrollContext'
import type { TaskSelection } from '../../src/features/tasks/TaskSelectionContext'
import { TaskSelectionProvider } from '../../src/features/tasks/TaskSelectionContext'
import { UpcomingGroupedList } from '../../src/features/tasks/UpcomingGroupedList'

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

function UpcomingGroupedListHarness({ tasks }: { tasks: TaskListItem[] }) {
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
            <UpcomingGroupedList
              tasks={tasks}
              today="2026-03-17"
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
    title: 'Upcoming task',
    status: 'open',
    is_inbox: false,
    is_someday: false,
    project_id: 'p1',
    project_title: 'Project Alpha',
    section_id: null,
    area_id: null,
    scheduled_at: '2026-03-18',
    due_at: null,
    created_at: '2026-03-17T00:00:00.000Z',
    updated_at: '2026-03-17T00:00:00.000Z',
    completed_at: null,
    deleted_at: null,
  }
}

describe('UpcomingGroupedList', () => {
  it('shows the task project affiliation below the title', async () => {
    render(<UpcomingGroupedListHarness tasks={[makeTask()]} />)

    await screen.findByText('Upcoming task')
    expect(screen.getByText('Project Alpha')).toBeInTheDocument()
  })
})
