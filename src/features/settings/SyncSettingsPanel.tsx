import { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'

import type { AppError } from '../../../shared/app-error'
import type { SyncConnectionInput, SyncSaveConfigurationInput, SyncState } from '../../../shared/schemas/sync'
import { Checkbox } from '../../components/Checkbox'

function trimToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function buildSaveInput(
  form: SyncFormState,
  currentState: SyncState | null
): SyncSaveConfigurationInput {
  const hasCredentialInput = Boolean(form.accessKeyId.trim() && form.secretAccessKey.trim())

  return {
    config: {
      endpoint: form.endpoint.trim(),
      region: form.region.trim(),
      bucket: form.bucket.trim(),
      prefix: form.prefix.trim(),
      force_path_style: form.forcePathStyle,
    },
    device_name: form.deviceName.trim() || currentState?.device_name || 'This Device',
    credentials: hasCredentialInput
      ? {
          access_key_id: form.accessKeyId.trim(),
          secret_access_key: form.secretAccessKey.trim(),
          session_token: trimToNull(form.sessionToken),
        }
      : undefined,
  }
}

function buildTestInput(form: SyncFormState): SyncConnectionInput | null {
  if (!form.accessKeyId.trim() || !form.secretAccessKey.trim()) return null

  return {
    config: {
      endpoint: form.endpoint.trim(),
      region: form.region.trim(),
      bucket: form.bucket.trim(),
      prefix: form.prefix.trim(),
      force_path_style: form.forcePathStyle,
    },
    credentials: {
      access_key_id: form.accessKeyId.trim(),
      secret_access_key: form.secretAccessKey.trim(),
      session_token: trimToNull(form.sessionToken) ?? undefined,
    },
  }
}

type SyncFormState = {
  endpoint: string
  region: string
  bucket: string
  prefix: string
  forcePathStyle: boolean
  deviceName: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
}

const EMPTY_FORM: SyncFormState = {
  endpoint: '',
  region: 'auto',
  bucket: '',
  prefix: '',
  forcePathStyle: true,
  deviceName: '',
  accessKeyId: '',
  secretAccessKey: '',
  sessionToken: '',
}

const STATUS_REFRESH_MS = 5_000

function applyStateToForm(current: SyncFormState, state: SyncState): SyncFormState {
  return {
    ...current,
    endpoint: state.config?.endpoint ?? current.endpoint,
    region: state.config?.region ?? current.region,
    bucket: state.config?.bucket ?? current.bucket,
    prefix: state.config?.prefix ?? current.prefix,
    forcePathStyle: state.config?.force_path_style ?? current.forcePathStyle,
    deviceName: state.device_name,
  }
}

function modeLabel(t: (key: string) => string, mode: SyncState['mode']): string {
  if (mode === 'disabled') return t('settings.syncModeDisabled')
  if (mode === 'syncing') return t('settings.syncModeSyncing')
  if (mode === 'error') return t('settings.syncModeError')
  return t('settings.syncModeIdle')
}

export function SyncSettingsPanel() {
  const { t } = useTranslation()
  const [syncState, setSyncState] = useState<SyncState | null>(null)
  const [syncError, setSyncError] = useState<AppError | null>(null)
  const [form, setForm] = useState<SyncFormState>(EMPTY_FORM)
  const [isBusy, setIsBusy] = useState(false)

  async function loadState(options?: { syncForm?: boolean }) {
    const result = await window.api.sync.getState()
    if (!result.ok) {
      setSyncError(result.error)
      return
    }

    setSyncError(null)
    setSyncState(result.data)
    if (options?.syncForm) {
      setForm((current) => applyStateToForm(current, result.data))
    }
  }

  useEffect(() => {
    void loadState({ syncForm: true })
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (isBusy) return
      void loadState()
    }, STATUS_REFRESH_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isBusy])

  async function runAction(action: () => Promise<{ ok: true; data: SyncState } | { ok: false; error: AppError }>) {
    setIsBusy(true)
    try {
      const result = await action()
      if (!result.ok) {
        setSyncError(result.error)
        return
      }

      setSyncError(null)
      setSyncState(result.data)
      setForm((current) => applyStateToForm(current, result.data))
    } finally {
      setIsBusy(false)
    }
  }

  const visibleError = syncError ?? syncState?.last_error ?? null

  return (
    <div className="settings-sync-panel" data-testid="settings-sync-panel">
      {visibleError ? (
        <div className="error">
          <div className="error-code">{visibleError.code}</div>
          <div>{visibleError.message}</div>
        </div>
      ) : null}

      <section className="card">
        <h3 className="card-title">{t('settings.syncTitle')}</h3>

        {syncState ? (
          <div className="settings-status-grid">
            <div className="settings-status-item">
              <div className="settings-status-label">{t('settings.syncStatus')}</div>
              <div className="mono">{modeLabel(t, syncState.mode)}</div>
            </div>

            <div className="settings-status-item">
              <div className="settings-status-label">{t('settings.syncDeviceName')}</div>
              <div className="mono">{syncState.device_name}</div>
            </div>

            <div className="settings-status-item">
              <div className="settings-status-label">{t('settings.syncPendingOutbox')}</div>
              <div className="mono">{String(syncState.pending_outbox_count)}</div>
            </div>

            <div className="settings-status-item">
              <div className="settings-status-label">{t('settings.syncLastSuccess')}</div>
              <div className="mono">{syncState.last_successful_sync_at ?? t('common.none')}</div>
            </div>

            <div className="settings-status-item">
              <div className="settings-status-label">{t('settings.syncLastAttempt')}</div>
              <div className="mono">{syncState.last_attempted_sync_at ?? t('common.none')}</div>
            </div>

            <div className="settings-status-item">
              <div className="settings-status-label">{t('settings.syncStoredCredentials')}</div>
              <div className="mono">
                {syncState.has_stored_credentials
                  ? t('settings.syncStoredCredentialsYes')
                  : t('settings.syncStoredCredentialsNo')}
              </div>
            </div>
          </div>
        ) : null}

        {syncState?.has_stored_credentials && !form.accessKeyId && !form.secretAccessKey && !form.sessionToken ? (
          <div className="settings-inline-note">
            <div className="mono">{t('settings.syncStoredCredentialsHint')}</div>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h3 className="card-title">{t('settings.syncTab')}</h3>

        <div className="settings-stack">
          <div className="settings-field">
            <div className="settings-field-label">{t('settings.syncDeviceName')}</div>
            <input
              className="input"
              aria-label={t('settings.syncDeviceName')}
              value={form.deviceName}
              onChange={(event) => {
                const value = event.target.value
                setForm((current) => ({ ...current, deviceName: value }))
              }}
            />
          </div>

          <div className="settings-field">
            <div className="settings-field-label">{t('settings.syncEndpoint')}</div>
            <input
              className="input"
              aria-label={t('settings.syncEndpoint')}
              value={form.endpoint}
              onChange={(event) => {
                const value = event.target.value
                setForm((current) => ({ ...current, endpoint: value }))
              }}
            />
          </div>

          <div className="settings-field">
            <div className="settings-field-label">{t('settings.syncRegion')}</div>
            <input
              className="input"
              aria-label={t('settings.syncRegion')}
              value={form.region}
              onChange={(event) => {
                const value = event.target.value
                setForm((current) => ({ ...current, region: value }))
              }}
            />
          </div>

          <div className="settings-field">
            <div className="settings-field-label">{t('settings.syncBucket')}</div>
            <input
              className="input"
              aria-label={t('settings.syncBucket')}
              value={form.bucket}
              onChange={(event) => {
                const value = event.target.value
                setForm((current) => ({ ...current, bucket: value }))
              }}
            />
          </div>

          <div className="settings-field">
            <div className="settings-field-label">{t('settings.syncPrefix')}</div>
            <input
              className="input"
              aria-label={t('settings.syncPrefix')}
              value={form.prefix}
              onChange={(event) => {
                const value = event.target.value
                setForm((current) => ({ ...current, prefix: value }))
              }}
            />
          </div>

          <div className="settings-inline-note">
            <Checkbox
              checked={form.forcePathStyle}
              onCheckedChange={(forcePathStyle) => {
                setForm((current) => ({ ...current, forcePathStyle }))
              }}
            >
              {t('settings.syncForcePathStyle')}
            </Checkbox>
          </div>

          <div className="settings-field">
            <div className="settings-field-label">{t('settings.syncAccessKeyId')}</div>
            <input
              className="input"
              aria-label={t('settings.syncAccessKeyId')}
              value={form.accessKeyId}
              onChange={(event) => {
                const value = event.target.value
                setForm((current) => ({ ...current, accessKeyId: value }))
              }}
            />
          </div>

          <div className="settings-field">
            <div className="settings-field-label">{t('settings.syncSecretAccessKey')}</div>
            <input
              className="input"
              aria-label={t('settings.syncSecretAccessKey')}
              type="password"
              value={form.secretAccessKey}
              onChange={(event) => {
                const value = event.target.value
                setForm((current) => ({ ...current, secretAccessKey: value }))
              }}
            />
          </div>

          <div className="settings-field">
            <div className="settings-field-label">{t('settings.syncSessionToken')}</div>
            <input
              className="input"
              aria-label={t('settings.syncSessionToken')}
              value={form.sessionToken}
              onChange={(event) => {
                const value = event.target.value
                setForm((current) => ({ ...current, sessionToken: value }))
              }}
            />
          </div>
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="button"
            disabled={isBusy}
            onClick={() => {
              const input = buildTestInput(form)
              if (!input) {
                setSyncError({
                  code: 'SYNC_CREDENTIALS_REQUIRED',
                  message: t('settings.syncCredentialsRequired'),
                })
                return
              }

              void (async () => {
                setIsBusy(true)
                try {
                  const result = await window.api.sync.testConnection(input)
                  if (!result.ok) {
                    setSyncError(result.error)
                    return
                  }
                  setSyncError(null)
                } finally {
                  setIsBusy(false)
                }
              })()
            }}
          >
            {t('settings.syncTestConnection')}
          </button>

          <button
            type="button"
            className="button"
            disabled={isBusy}
            onClick={() => {
              void runAction(async () => await window.api.sync.saveConfiguration(buildSaveInput(form, syncState)))
            }}
          >
            {t('settings.syncSaveConfiguration')}
          </button>

          {syncState?.enabled ? (
            <button
              type="button"
              className="button button-ghost"
              disabled={isBusy}
              onClick={() => {
                void runAction(async () => await window.api.sync.disable())
              }}
            >
              {t('settings.syncDisable')}
            </button>
          ) : (
            <button
              type="button"
              className="button"
              disabled={isBusy}
              onClick={() => {
                void runAction(async () => await window.api.sync.enable())
              }}
            >
              {t('settings.syncEnable')}
            </button>
          )}

          <button
            type="button"
            className="button"
            data-testid="settings-sync-now"
            disabled={isBusy}
            onClick={() => {
              void runAction(async () => await window.api.sync.syncNow())
            }}
          >
            {t('settings.syncNow')}
          </button>
        </div>
      </section>
    </div>
  )
}
