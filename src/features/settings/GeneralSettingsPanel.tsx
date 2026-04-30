import { useEffect, useRef, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { Select } from '../../components/Select'
import type { AppError } from '../../../shared/app-error'
import { LocaleSchema, type Locale } from '../../../shared/i18n/locale'
import {
  DEFAULT_FONT_SIZE_STEP,
  FONT_SIZE_STEP_MAX,
  FONT_SIZE_STEP_MIN,
  FontSizeStepSchema,
  ThemePreferenceSchema,
  type EffectiveTheme,
  type FontSizeStep,
  type ThemePreference,
} from '../../../shared/schemas'

import i18n from '../../i18n/i18n'
import { applyAppFontSize } from '../../app/app-font-size'
import { useConfirm } from '../../contexts/ConfirmDialogContext'

function getFontSizeStepLabel(t: (key: string) => string, step: FontSizeStep): string {
  switch (step) {
    case -3:
      return t('settings.fontSizeVerySmall')
    case -2:
      return t('settings.fontSizeSmall')
    case -1:
      return t('settings.fontSizeSlightlySmall')
    case 0:
      return t('settings.fontSizeDefault')
    case 1:
      return t('settings.fontSizeSlightlyLarge')
    case 2:
      return t('settings.fontSizeLarge')
    case 3:
      return t('settings.fontSizeVeryLarge')
  }
}

export function GeneralSettingsPanel() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const fontSizeRequestIdRef = useRef(0)
  const [version, setVersion] = useState<string>('')
  const [userDataPath, setUserDataPath] = useState<string>('')
  const [error, setError] = useState<AppError | null>(null)
  const [lastExportPath, setLastExportPath] = useState<string | null>(null)
  const [locale, setLocale] = useState<Locale>('en')
  const [supportedLocales, setSupportedLocales] = useState<Locale[]>(['en', 'zh-CN'])
  const [themePreference, setThemePreference] = useState<ThemePreference>('system')
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>('light')
  const [fontSizeStep, setFontSizeStep] = useState<FontSizeStep>(DEFAULT_FONT_SIZE_STEP)

  useEffect(() => {
    void (async () => {
      const [verRes, pathRes, localeRes, themeRes, fontSizeRes] = await Promise.all([
        window.api.app.getVersion(),
        window.api.app.getUserDataPath(),
        window.api.settings.getLocaleState(),
        window.api.settings.getThemeState(),
        window.api.settings.getFontSizeState(),
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
      if (!fontSizeRes.ok) {
        setError(fontSizeRes.error)
        return
      }

      setError(null)
      setVersion(verRes.data)
      setUserDataPath(pathRes.data)
      setLocale(localeRes.data.locale)
      setSupportedLocales(localeRes.data.supportedLocales)
      setThemePreference(themeRes.data.preference)
      setEffectiveTheme(themeRes.data.effectiveTheme)
      setFontSizeStep(fontSizeRes.data.step)
      applyAppFontSize(fontSizeRes.data.step)
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
            <Select
              aria-label={t('settings.language')}
              value={locale}
              options={supportedLocales.map((value) => ({ value, label: getLocaleLabel(value) }))}
              onValueChange={(value) => {
                const parsed = LocaleSchema.safeParse(value)
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
            />
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
            <Select
              aria-label={t('settings.theme')}
              value={themePreference}
              data-testid="settings-theme-select"
              options={[
                { value: 'system', label: t('settings.themeSystem') },
                { value: 'light', label: t('settings.themeLight') },
                { value: 'dark', label: t('settings.themeDark') },
              ]}
              onValueChange={(value) => {
                const parsed = ThemePreferenceSchema.safeParse(value)
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
            />
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">{t('settings.appearance')}</div>
        <div className="settings-row">
          <div className="settings-row-label">{t('settings.fontSize')}</div>
          <div className="settings-row-control settings-font-size-control">
            <span className="settings-font-size-bound">{t('settings.fontSizeEndpointSmall')}</span>
            <div className="settings-font-size-slider-wrap">
              <input
                type="range"
                aria-label={t('settings.fontSize')}
                aria-valuetext={getFontSizeStepLabel(t, fontSizeStep)}
                min={FONT_SIZE_STEP_MIN}
                max={FONT_SIZE_STEP_MAX}
                step={1}
                value={fontSizeStep}
                className="settings-font-size-slider"
                data-testid="settings-font-size-slider"
                onChange={(event) => {
                  const parsed = FontSizeStepSchema.safeParse(Number(event.currentTarget.value))
                  if (!parsed.success) return
                  const nextStep = parsed.data
                  const requestId = fontSizeRequestIdRef.current + 1
                  fontSizeRequestIdRef.current = requestId

                  setFontSizeStep(nextStep)
                  applyAppFontSize(nextStep)

                  void (async () => {
                    const res = await window.api.settings.setFontSizeStep(nextStep)
                    if (requestId !== fontSizeRequestIdRef.current) return

                    if (!res.ok) {
                      setError(res.error)
                      return
                    }

                    setError(null)
                    setFontSizeStep(res.data.step)
                    applyAppFontSize(res.data.step)
                  })()
                }}
              />
              <div className="settings-font-size-default-marker" aria-hidden="true">
                <span className="settings-font-size-default-tick" />
                <span className="settings-font-size-default-label">{t('settings.fontSizeDefaultMarker')}</span>
              </div>
            </div>
            <span className="settings-font-size-bound">{t('settings.fontSizeEndpointLarge')}</span>
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
              onClick={async () => {
                const confirmed = await confirm({ message: t('settings.resetConfirm'), variant: 'danger', confirmText: t('common.delete') })
                if (!confirmed) return

                const res = await window.api.data.resetAllData()
                if (!res.ok) {
                  setError(res.error)
                  return
                }
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
