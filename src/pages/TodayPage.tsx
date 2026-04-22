import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { TASK_LIST_ID_TODAY } from '../../shared/task-list-ids'
import { formatLocalDate } from '../lib/dates'
import { TaskList } from '../features/tasks/TaskList'
import { TagFilter } from '../features/tasks/TagFilter'
import { useTaskTagFilter } from '../features/tasks/use-task-tag-filter'
import { useAppEvents } from '../app/AppEventsContext'

export function TodayPage() {
  const { t } = useTranslation()
  const { revision } = useAppEvents()
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [error, setError] = useState<AppError | null>(null)

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    filteredTasks,
    hasFilter,
  } = useTaskTagFilter(tasks)

  const refresh = useCallback(async () => {
    const today = formatLocalDate(new Date())
    const res = await window.api.task.listToday(today)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setError(null)
    setTasks(res.data)
  }, [])

  useEffect(() => {
    void revision
    void refresh()
  }, [refresh, revision])

  return (
    <>
      {error ? <ErrorBanner error={error} /> : null}
      <TaskList
        title={t('nav.today')}
        listId={TASK_LIST_ID_TODAY}
        tasks={filteredTasks}
        topContent={
          <TagFilter
            tags={availableTags}
            selectedTagIds={selectedTagIds}
            onChange={setSelectedTagIds}
          />
        }
        emptyState={hasFilter ? t('taskEditor.noTagsMatch') : undefined}
        onAfterReorder={refresh}
        onToggleDone={async (taskId, done) => {
          const updated = await window.api.task.toggleDone(taskId, done)
          if (!updated.ok) throw new Error(`${updated.error.code}: ${updated.error.message}`)
          await refresh()
        }}
      />
    </>
  )
}

function ErrorBanner({ error }: { error: AppError }) {
  return (
    <div className="error">
      <div className="error-code">{error.code}</div>
      <div>{error.message}</div>
    </div>
  )
}
