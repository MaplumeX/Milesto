import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../../shared/app-error'
import type { ViewListProjectItem } from '../../../shared/schemas/view-list'

import { useAppEvents } from '../../app/AppEventsContext'
import { useConfirm } from '../../contexts/ConfirmDialogContext'

export function useViewProjectCompletion({
  setError,
  refresh,
}: {
  setError: (error: AppError) => void
  refresh: () => Promise<void>
}) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const { bumpRevision } = useAppEvents()

  return useCallback(
    async (project: ViewListProjectItem) => {
      const openCount = Math.max(0, project.total_count - project.done_count)
      const confirmed = await confirm({
        message: t('project.completeConfirm', { count: openCount }),
        variant: 'default',
      })
      if (!confirmed) return

      const res = await window.api.project.complete(project.id)
      if (!res.ok) {
        setError(res.error)
        return
      }

      bumpRevision()
      await refresh()
    },
    [bumpRevision, refresh, setError, t, confirm]
  )
}
