import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../../shared/app-error'
import type { ViewListProjectItem } from '../../../shared/schemas/view-list'

import { useAppEvents } from '../../app/AppEventsContext'

export function useViewProjectCompletion({
  setError,
  refresh,
}: {
  setError: (error: AppError) => void
  refresh: () => Promise<void>
}) {
  const { t } = useTranslation()
  const { bumpRevision } = useAppEvents()

  return useCallback(
    async (project: ViewListProjectItem) => {
      const openCount = Math.max(0, project.total_count - project.done_count)
      const confirmed = window.confirm(t('project.completeConfirm', { count: openCount }))
      if (!confirmed) return

      const res = await window.api.project.complete(project.id)
      if (!res.ok) {
        setError(res.error)
        return
      }

      bumpRevision()
      await refresh()
    },
    [bumpRevision, refresh, setError, t]
  )
}
