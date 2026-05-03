import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../components/Button'
import type { AppError } from '../../../shared/app-error'
import {
  AiConfigSchema,
  DEFAULT_AI_CONFIG,
  type AiConfig,
} from '../../../shared/schemas/chat'

export function AiSettingsPanel() {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState<boolean>(DEFAULT_AI_CONFIG.enabled)
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_AI_CONFIG.baseUrl)
  const [apiKey, setApiKey] = useState<string>(DEFAULT_AI_CONFIG.apiKey)
  const [model, setModel] = useState<string>(DEFAULT_AI_CONFIG.model)
  const [error, setError] = useState<AppError | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    let disposed = false
    void (async () => {
      const res = await window.api.settings.getAiConfig()
      if (disposed) return
      if (!res.ok) {
        setError(res.error)
        return
      }
      setError(null)
      setEnabled(res.data.enabled)
      setBaseUrl(res.data.baseUrl)
      setApiKey(res.data.apiKey)
      setModel(res.data.model)
    })()
    return () => { disposed = true }
  }, [])

  async function handleSave() {
    setIsLoading(true)

    const candidate: AiConfig = {
      enabled,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      model: model.trim(),
    }

    const validated = AiConfigSchema.safeParse(candidate)
    if (!validated.success) {
      setError({
        code: 'VALIDATION_FAILED',
        message: t('settings.aiInvalidConfig'),
        details: { issues: validated.error.issues },
      })
      setIsLoading(false)
      return
    }

    const res = await window.api.settings.setAiConfig(validated.data)
    if (!res.ok) {
      setError(res.error)
      setIsLoading(false)
      return
    }

    setError(null)
    setEnabled(res.data.enabled)
    setBaseUrl(res.data.baseUrl)
    setApiKey(res.data.apiKey)
    setModel(res.data.model)
    setSavedAt(Date.now())
    setIsLoading(false)
  }

  return (
    <div className="settings-panel">
      {error ? (
        <div className="error">
          <div className="error-code">{error.code}</div>
          <div>{error.message}</div>
        </div>
      ) : null}

      <section className="settings-section">
        <div className="settings-section-title">{t('settings.aiTab')}</div>

        <div className="settings-row">
          <label className="settings-row-label" htmlFor="ai-enabled">
            {t('settings.aiEnabled')}
          </label>
          <div className="settings-row-control">
            <input
              id="ai-enabled"
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
          </div>
        </div>

        <div className="settings-row settings-row-stack">
          <label className="settings-row-label" htmlFor="ai-base-url">
            {t('settings.aiBaseUrl')}
          </label>
          <div className="settings-row-inputs">
            <input
              id="ai-base-url"
              type="url"
              className="input"
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          </div>
        </div>

        <div className="settings-row settings-row-stack">
          <label className="settings-row-label" htmlFor="ai-api-key">
            {t('settings.aiApiKey')}
          </label>
          <div className="settings-row-inputs">
            <input
              id="ai-api-key"
              type="password"
              className="input"
              placeholder="sk-..."
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </div>
          <div className="settings-row-description">{t('settings.aiApiKeyHint')}</div>
        </div>

        <div className="settings-row settings-row-stack">
          <label className="settings-row-label" htmlFor="ai-model">
            {t('settings.aiModel')}
          </label>
          <div className="settings-row-inputs">
            <input
              id="ai-model"
              type="text"
              className="input"
              placeholder="gpt-4o-mini"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-label" />
          <div className="settings-row-control">
            <Button disabled={isLoading} onClick={handleSave}>
              {isLoading ? t('common.loading') : t('settings.aiSave')}
            </Button>
            {savedAt ? (
              <span className="settings-row-description"> {t('settings.aiSaved')}</span>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
