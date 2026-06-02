import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../../shared/app-error'
import type { SyncConfig, SyncState } from '../../../shared/schemas/sync'

import { Button } from '../../components/Button'

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
      const stateRes = await window.api.sync.getState()
      if (stateRes.ok) {
        setSyncState(stateRes.data)
      }

      const configRes = await window.api.sync.getConfig()
      if (configRes.ok && configRes.data.enabled) {
        setServerUrl(configRes.data.serverUrl)
        setToken(configRes.data.token)
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

      <div className="settings-section-title">{t('settings.syncStatus')}</div>
      <div className="settings-card">
        <div className="settings-row settings-row-stack">
          <div className="settings-row-label">
            <span className={getStatusDotClass()} />
            <span className="sync-status-text">{getStatusLabel(syncState.status)}</span>
          </div>
          {syncState.lastSyncAt ? (
            <div className="settings-row-description">
              Last sync: {new Date(syncState.lastSyncAt).toLocaleString()}
            </div>
          ) : null}
        </div>
      </div>

      <div className="settings-section-title">{t('settings.syncTab')}</div>
      <div className="settings-card">
        <div className="settings-row settings-row-stack">
          <label className="settings-row-label" htmlFor="sync-server-url">
            {t('settings.syncServerUrl')}
          </label>
          <div className="settings-row-inputs">
            <input
              id="sync-server-url"
              type="url"
              className="input"
              placeholder="https://your-server.com"
              value={serverUrl}
              disabled={isConnected || isLoading}
              onChange={(e) => setServerUrl(e.target.value)}
            />
          </div>
        </div>
        <div className="settings-row settings-row-stack">
          <label className="settings-row-label" htmlFor="sync-token">
            {t('settings.syncToken')}
          </label>
          <div className="settings-row-inputs">
            <input
              id="sync-token"
              type="password"
              className="input"
              placeholder="your-sync-token"
              value={token}
              disabled={isConnected || isLoading}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-label" />
          <div className="settings-row-control">
            {!isConnected ? (
              <Button
                disabled={!serverUrl.trim() || !token.trim() || isLoading}
                onClick={handleConnect}
              >
                {isLoading ? t('common.loading') : t('settings.syncConnect')}
              </Button>
            ) : (
              <Button
                variant="ghost"
                disabled={isLoading}
                onClick={handleDisconnect}
              >
                {isLoading ? t('common.loading') : t('settings.syncDisconnect')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
