import { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import { LocaleSchema, type Locale } from '../../shared/i18n/locale'

import i18n from '../i18n/i18n'

export function SettingsPage() {
  const { t } = useTranslation()
  const [version, setVersion] = useState<string>('')
  const [userDataPath, setUserDataPath] = useState<string>('')
  const [error, setError] = useState<AppError | null>(null)
  const [lastExportPath, setLastExportPath] = useState<string | null>(null)
  const [locale, setLocale] = useState<Locale>('en')
  const [supportedLocales, setSupportedLocales] = useState<Locale[]>(['en', 'zh-CN'])

  useEffect(() => {
    void (async () => {
      const [verRes, pathRes, localeRes] = await Promise.all([
        window.api.app.getVersion(),
        window.api.app.getUserDataPath(),
        window.api.settings.getLocaleState(),
      ])
      if (!verRes.ok) {
        setError(verRes.error)
        return
      }
      if (!pathRes.ok) {
        setError(pathRes.error)
        return
      }
      if (!localeRes.ok) {
        setError(localeRes.error)
        return
      }
      setError(null)
      setVersion(verRes.data)
      setUserDataPath(pathRes.data)
      setLocale(localeRes.data.locale)
      setSupportedLocales(localeRes.data.supportedLocales)
    })()
  }, [])

  function getLocaleLabel(l: Locale): string {
    return l === 'en' ? t('settings.languageEnglish') : t('settings.languageChinese')
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{t('settings.title')}</h1>
      </header>

      {error ? (
        <div className="error">
          <div className="error-code">{error.code}</div>
          <div>{error.message}</div>
        </div>
      ) : null}

      <div className="settings-grid">
        <section className="card">
          <h2 className="card-title">{t('settings.language')}</h2>
          <div className="row">
            <select
              className="input"
              value={locale}
              onChange={(e) => {
                const parsed = LocaleSchema.safeParse(e.target.value)
                if (!parsed.success) return
                void (async () => {
                  const res = await window.api.settings.setLocale(parsed.data)
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  setError(null)
                  setLocale(res.data.locale)
                  setSupportedLocales(res.data.supportedLocales)
                  document.documentElement.lang = res.data.locale
                  await i18n.changeLanguage(res.data.locale)
                })()
              }}
            >
              {supportedLocales.map((l) => (
                <option key={l} value={l}>
                  {getLocaleLabel(l)}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">{t('settings.data')}</h2>
          <div className="row">
            <button
              type="button"
              className="button"
              onClick={() => {
                void (async () => {
                  const res = await window.api.data.exportToFile()
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  if (res.data.canceled) return
                  if (res.data.filePath) setLastExportPath(res.data.filePath)
                })()
              }}
            >
              {t('settings.export')}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                void (async () => {
                  const res = await window.api.data.importFromFile()
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                })()
              }}
            >
              {t('settings.import')}
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                const confirmed = confirm(t('settings.resetConfirm'))
                if (!confirmed) return
                void (async () => {
                  const res = await window.api.data.resetAllData()
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                })()
              }}
            >
              {t('settings.resetAllData')}
            </button>
          </div>

          {lastExportPath ? (
            <div className="row">
              <div className="mono">{lastExportPath}</div>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  void window.api.app.showItemInFolder(lastExportPath)
                }}
              >
                {t('settings.showInFolder')}
              </button>
            </div>
          ) : null}
        </section>

        <section className="card">
          <h2 className="card-title">{t('settings.about')}</h2>
          <div className="row">
            <div>{t('settings.version')}</div>
            <div className="mono">{version}</div>
          </div>
          <div className="row">
            <div>{t('settings.userData')}</div>
            <div className="mono">{userDataPath}</div>
          </div>
          <div className="row">
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                void window.api.app.openPath(userDataPath)
              }}
            >
              {t('settings.openDataFolder')}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
