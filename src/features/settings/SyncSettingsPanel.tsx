import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../../shared/app-error'
import type { SyncConfig, SyncState } from '../../../shared/schemas/sync'

export function SyncSettingsPanel() {
  const { t } = useTranslation()
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'disabled',
    lastSyncAt: null,
    lastError: null,
    pendingCount: 0,
  })
  const [serverUrl, setServerUrl] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState<AppError | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await window.api.sync.getState()
      if (res.ok) {
        setSyncState(res.data)
      }
    })()

    const unsubscribe = window.api.sync.onStateChange((state) => {
      setSyncState(state)
    })

    return unsubscribe
  }, [])

  const isConnected =
    syncState.status === 'connected' ||
    syncState.status === 'syncing'

  async function handleConnect() {
    setIsLoading(true)
    setError(null)

    const config: SyncConfig = {
      serverUrl: serverUrl.trim(),
      token: token.trim(),
      enabled: true,
    }

    const res = await window.api.sync.configure(config)
    if (!res.ok) {
      setError(res.error)
    }
    setIsLoading(false)
  }

  async function handleDisconnect() {
    setIsLoading(true)
    const res = await window.api.sync.disconnect()
    if (!res.ok) {
      setError(res.error)
    }
    setServerUrl('')
    setToken('')
    setIsLoading(false)
  }

  function getStatusLabel(status: SyncState['status']): string {
    switch (status) {
      case 'disabled':
        return t('settings.syncStatusDisabled')
      case 'connecting':
        return t('settings.syncStatusConnecting')
      case 'connected':
        return t('settings.syncStatusConnected')
      case 'syncing':
        return t('settings.syncStatusSyncing')
      case 'error':
        return t('settings.syncStatusError', {
          error: syncState.lastError ?? 'Unknown',
        })
      case 'offline':
        return t('settings.syncStatusOffline')
    }
  }

  function getStatusDotClass(): string {
    switch (syncState.status) {
      case 'connected':
      case 'syncing':
        return 'sync-dot sync-dot--connected'
      case 'connecting':
        return 'sync-dot sync-dot--connecting'
      case 'error':
        return 'sync-dot sync-dot--error'
      case 'offline':
        return 'sync-dot sync-dot--offline'
      case 'disabled':
        return 'sync-dot sync-dot--disabled'
    }
  }

  return (
    <div className="settings-panel">
      {error ? (
        <div className="error">
          <div className="error-code">{error.code}</div>
          <div>{error.message}</div>
        </div>
      ) : null}

      <div className="settings-general-grid">
        <section className="card">
          <h3 className="card-title">{t('settings.syncStatus')}</h3>
          <div className="settings-field settings-field-stack">
            <div className="sync-status-row">
              <span className={getStatusDotClass()} />
              <span className="sync-status-text">{getStatusLabel(syncState.status)}</span>
            </div>
            {syncState.lastSyncAt ? (
              <div className="mono sync-last-sync">
                Last sync: {new Date(syncState.lastSyncAt).toLocaleString()}
              </div>
            ) : null}
          </div>
        </section>

        <section className="card">
          <h3 className="card-title">{t('settings.syncTab')}</h3>
          <div className="settings-field settings-field-stack">
            <label className="settings-label" htmlFor="sync-server-url">
              {t('settings.syncServerUrl')}
            </label>
            <input
              id="sync-server-url"
              type="url"
              className="input"
              placeholder="wss://your-server.com"
              value={serverUrl}
              disabled={isConnected || isLoading}
              onChange={(e) => setServerUrl(e.target.value)}
            />

            <label className="settings-label" htmlFor="sync-token">
              {t('settings.syncToken')}
            </label>
            <input
              id="sync-token"
              type="password"
              className="input"
              placeholder="your-sync-token"
              value={token}
              disabled={isConnected || isLoading}
              onChange={(e) => setToken(e.target.value)}
            />

            <div className="settings-actions">
              {!isConnected ? (
                <button
                  type="button"
                  className="button"
                  disabled={!serverUrl.trim() || !token.trim() || isLoading}
                  onClick={handleConnect}
                >
                  {isLoading ? t('common.loading') : t('settings.syncConnect')}
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={isLoading}
                  onClick={handleDisconnect}
                >
                  {isLoading ? t('common.loading') : t('settings.syncDisconnect')}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
