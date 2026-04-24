import { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'

import type { AppError } from '../../../shared/app-error'
import { LocaleSchema, type Locale } from '../../../shared/i18n/locale'
import { ThemePreferenceSchema, type EffectiveTheme, type ThemePreference } from '../../../shared/schemas'

import i18n from '../../i18n/i18n'

export function GeneralSettingsPanel() {
  const { t } = useTranslation()
  const [version, setVersion] = useState<string>('')
  const [userDataPath, setUserDataPath] = useState<string>('')
  const [error, setError] = useState<AppError | null>(null)
  const [lastExportPath, setLastExportPath] = useState<string | null>(null)
  const [locale, setLocale] = useState<Locale>('en')
  const [supportedLocales, setSupportedLocales] = useState<Locale[]>(['en', 'zh-CN'])
  const [themePreference, setThemePreference] = useState<ThemePreference>('system')
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>('light')

  useEffect(() => {
    void (async () => {
      const [verRes, pathRes, localeRes, themeRes] = await Promise.all([
        window.api.app.getVersion(),
        window.api.app.getUserDataPath(),
        window.api.settings.getLocaleState(),
        window.api.settings.getThemeState(),
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
      if (!themeRes.ok) {
        setError(themeRes.error)
        return
      }

      setError(null)
      setVersion(verRes.data)
      setUserDataPath(pathRes.data)
      setLocale(localeRes.data.locale)
      setSupportedLocales(localeRes.data.supportedLocales)
      setThemePreference(themeRes.data.preference)
      setEffectiveTheme(themeRes.data.effectiveTheme)
    })()
  }, [])

  function getLocaleLabel(value: Locale): string {
    return value === 'en' ? t('settings.languageEnglish') : t('settings.languageChinese')
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
        <div className="settings-section-title">{t('settings.language')}</div>
        <div className="settings-row">
          <div className="settings-row-label">{t('settings.language')}</div>
          <div className="settings-row-control">
            <select
              className="input"
              aria-label={t('settings.language')}
              value={locale}
              onChange={(event) => {
                const parsed = LocaleSchema.safeParse(event.target.value)
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
              {supportedLocales.map((value) => (
                <option key={value} value={value}>
                  {getLocaleLabel(value)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">{t('settings.theme')}</div>
        <div className="settings-row">
          <div className="settings-row-label">
            {t('settings.theme')}
            <div className="settings-row-description">
              {t('settings.themeEffective', {
                theme: effectiveTheme === 'dark' ? t('settings.themeDark') : t('settings.themeLight'),
              })}
            </div>
          </div>
          <div className="settings-row-control">
            <select
              className="input"
              aria-label={t('settings.theme')}
              value={themePreference}
              data-settings-theme-select="true"
              onChange={(event) => {
                const parsed = ThemePreferenceSchema.safeParse(event.target.value)
                if (!parsed.success) return

                void (async () => {
                  const res = await window.api.settings.setThemePreference(parsed.data)
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }

                  setError(null)
                  setThemePreference(res.data.preference)
                  setEffectiveTheme(res.data.effectiveTheme)
                })()
              }}
            >
              <option value="system">{t('settings.themeSystem')}</option>
              <option value="light">{t('settings.themeLight')}</option>
              <option value="dark">{t('settings.themeDark')}</option>
            </select>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">{t('settings.data')}</div>
        <div className="settings-row">
          <div className="settings-row-label">{t('settings.export')}</div>
          <div className="settings-row-control">
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
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-label">{t('settings.import')}</div>
          <div className="settings-row-control">
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
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-label">{t('settings.resetAllData')}</div>
          <div className="settings-row-control">
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
        </div>

        {lastExportPath ? (
          <div className="settings-row">
            <div className="settings-row-label">
              <span className="mono">{lastExportPath}</span>
            </div>
            <div className="settings-row-control">
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
          </div>
        ) : null}
      </section>

      <section className="settings-section">
        <div className="settings-section-title">{t('settings.about')}</div>
        <div className="settings-row">
          <div className="settings-row-label">{t('settings.version')}</div>
          <div className="settings-row-control mono">{version}</div>
        </div>
        <div className="settings-row">
          <div className="settings-row-label">{t('settings.userData')}</div>
          <div className="settings-row-control mono">{userDataPath}</div>
        </div>
        <div className="settings-row">
          <div className="settings-row-label" />
          <div className="settings-row-control">
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
        </div>
      </section>
    </div>
  )
}
