import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import type { ViewListItem } from '../../shared/schemas/view-list'
import { TASK_LIST_ID_ANYTIME } from '../../shared/task-list-ids'
import { TagFilter } from '../features/tasks/TagFilter'
import { ViewList } from '../features/view-list/ViewList'
import { useViewTagFilter } from '../features/view-list/use-view-tag-filter'
import { useViewProjectCompletion } from '../features/view-list/use-view-project-completion'
import { useAppEvents } from '../app/AppEventsContext'

export function AnytimePage() {
  const { t } = useTranslation()
  const { revision } = useAppEvents()
  const [items, setItems] = useState<ViewListItem[]>([])
  const [error, setError] = useState<AppError | null>(null)

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    filteredItems,
    hasFilter,
  } = useViewTagFilter(items)

  const refresh = useCallback(async () => {
    const res = await window.api.view.listAnytime()
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
      <ViewList
        title={t('nav.anytime')}
        listId={TASK_LIST_ID_ANYTIME}
        items={filteredItems}
        topContent={
          <TagFilter
            tags={availableTags}
            selectedTagIds={selectedTagIds}
            onChange={setSelectedTagIds}
          />
        }
        emptyState={hasFilter ? t('taskEditor.noTagsMatch') : undefined}
        onAfterReorder={refresh}
        onCompleteProject={completeProject}
        onToggleTaskDone={async (taskId, done) => {
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
