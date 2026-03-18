import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import type { TrashEntry } from '../../shared/schemas/trash'
import { useAppEvents } from '../app/AppEventsContext'
import { TrashList } from '../features/trash/TrashList'

function pickNextSelectedEntryId(entries: TrashEntry[], entryId: string): string | null {
  const currentIndex = entries.findIndex((entry) => entry.id === entryId)
  if (currentIndex < 0) return entries[0]?.id ?? null
  return entries[currentIndex + 1]?.id ?? entries[currentIndex - 1]?.id ?? null
}

function resolveSelectedEntryId(entries: TrashEntry[], preferredId: string | null): string | null {
  if (entries.length === 0) return null
  if (preferredId && entries.some((entry) => entry.id === preferredId)) return preferredId
  return entries[0]?.id ?? null
}

export function TrashPage() {
  const { t } = useTranslation()
  const { revision, bumpRevision } = useAppEvents()
  const [entries, setEntries] = useState<TrashEntry[]>([])
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null)
  const [isEmptying, setIsEmptying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<AppError | null>(null)
  const skipNextRevisionRefreshRef = useRef(false)

  const refresh = useCallback(async (preferredSelectedId?: string | null) => {
    const res = await window.api.trash.list()
    if (!res.ok) {
      setError(res.error)
      setIsLoading(false)
      return
    }

    setEntries(res.data)
    setSelectedEntryId((current) => resolveSelectedEntryId(res.data, preferredSelectedId ?? current))
    setError(null)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (skipNextRevisionRefreshRef.current) {
      skipNextRevisionRefreshRef.current = false
      return
    }

    void revision
    void refresh()
  }, [refresh, revision])

  const hasEntries = entries.length > 0

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  )

  const handleRestoreEntry = useCallback(
    async (entry: TrashEntry) => {
      setBusyEntryId(entry.id)
      const nextSelectedId = pickNextSelectedEntryId(entries, entry.id)
      const res =
        entry.kind === 'task'
          ? await window.api.trash.restoreTask(entry.id)
          : await window.api.trash.restoreProject(entry.id)

      if (!res.ok) {
        setError(res.error)
        setBusyEntryId(null)
        return
      }

      skipNextRevisionRefreshRef.current = true
      bumpRevision()
      await refresh(nextSelectedId)
      setBusyEntryId(null)
    },
    [bumpRevision, entries, refresh]
  )

  const handlePurgeEntry = useCallback(
    async (entry: TrashEntry) => {
      if (!window.confirm(t('trash.purgeConfirm'))) return

      setBusyEntryId(entry.id)
      const nextSelectedId = pickNextSelectedEntryId(entries, entry.id)
      const res =
        entry.kind === 'task'
          ? await window.api.trash.purgeTask(entry.id)
          : await window.api.trash.purgeProject(entry.id)

      if (!res.ok) {
        setError(res.error)
        setBusyEntryId(null)
        return
      }

      skipNextRevisionRefreshRef.current = true
      bumpRevision()
      await refresh(nextSelectedId)
      setBusyEntryId(null)
    },
    [bumpRevision, entries, refresh, t]
  )

  const handleEmpty = useCallback(async () => {
    if (!hasEntries) return
    if (!window.confirm(t('trash.emptyConfirm'))) return

    setIsEmptying(true)
    const res = await window.api.trash.empty()
    if (!res.ok) {
      setError(res.error)
      setIsEmptying(false)
      return
    }

    skipNextRevisionRefreshRef.current = true
    bumpRevision()
    await refresh(null)
    setIsEmptying(false)
  }, [bumpRevision, hasEntries, refresh, t])

  return (
    <div className="page">
      <header className="page-header trash-page-header">
        <div>
          <h1 className="page-title">{t('nav.trash')}</h1>
          {hasEntries ? <div className="nav-muted">{t('trash.rootCount', { count: entries.length })}</div> : null}
        </div>

        <button
          type="button"
          className="button button-ghost"
          onClick={() => void handleEmpty()}
          disabled={!hasEntries || isEmptying || busyEntryId !== null}
          data-trash-empty-action="true"
        >
          {t('trash.emptyAction')}
        </button>
      </header>

      {error ? <ErrorBanner error={error} /> : null}

      {isLoading ? <div className="nav-muted">{t('common.loading')}</div> : null}

      {!isLoading && !hasEntries ? <div className="nav-muted">{t('trash.emptyState')}</div> : null}

      {!isLoading && hasEntries ? (
        <TrashList
          entries={entries}
          selectedEntryId={selectedEntry?.id ?? selectedEntryId}
          busyEntryId={busyEntryId}
          onSelectEntry={setSelectedEntryId}
          onRestoreEntry={handleRestoreEntry}
          onPurgeEntry={handlePurgeEntry}
        />
      ) : null}
    </div>
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
