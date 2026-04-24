import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import type { ViewListItem } from '../../shared/schemas/view-list'
import { formatLocalDate } from '../lib/dates'
import { useAppEvents } from '../app/AppEventsContext'
import { TagFilter } from '../features/tasks/TagFilter'
import { UpcomingViewGroupedList } from '../features/view-list/UpcomingViewGroupedList'
import { useViewTagFilter } from '../features/view-list/use-view-tag-filter'
import { useViewProjectCompletion } from '../features/view-list/use-view-project-completion'

export function UpcomingPage() {
  const { t } = useTranslation()
  const { revision } = useAppEvents()
  const [items, setItems] = useState<ViewListItem[]>([])
  const [error, setError] = useState<AppError | null>(null)

  const today = formatLocalDate(new Date())

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    filteredItems,
    hasFilter,
  } = useViewTagFilter(items)

  const refresh = useCallback(async () => {
    const today = formatLocalDate(new Date())
    const res = await window.api.view.listUpcoming(today)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setError(null)
    setItems(res.data)
  }, [])

  useEffect(() => {
    void revision
    void refresh()
  }, [refresh, revision])

  const completeProject = useViewProjectCompletion({ setError, refresh })

  return (
    <>
      {error ? <ErrorBanner error={error} /> : null}
      <UpcomingViewGroupedList
        items={filteredItems}
        today={today}
        topContent={
          <TagFilter
            tags={availableTags}
            selectedTagIds={selectedTagIds}
            onChange={setSelectedTagIds}
          />
        }
        emptyState={hasFilter ? t('taskEditor.noTagsMatch') : undefined}
        onCompleteProject={completeProject}
        onToggleTaskDone={async (taskId, done) => {
          const updated = await window.api.task.toggleDone(taskId, done)
          if (!updated.ok) {
            setError(updated.error)
            return
          }
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
