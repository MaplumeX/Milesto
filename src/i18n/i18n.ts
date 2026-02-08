import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import type { Locale } from '../../shared/i18n/locale'
import { SUPPORTED_LOCALES } from '../../shared/i18n/locale'
import { checkMessageCatalogParity, messagesEn, messagesZhCN } from '../../shared/i18n/messages'

const resources = {
  en: { translation: messagesEn },
  'zh-CN': { translation: messagesZhCN },
} as const

export async function initI18n(locale: Locale): Promise<void> {
  if (import.meta.env.DEV) {
    const { missingInEn, missingInZhCN } = checkMessageCatalogParity()
    if (missingInEn.length > 0 || missingInZhCN.length > 0) {
      throw new Error(
        `i18n message catalogs out of sync. missingInEn=${missingInEn.join(',')} missingInZhCN=${missingInZhCN.join(',')}`
      )
    }
  }

  if (!i18n.isInitialized) {
    await i18n
      .use(initReactI18next)
      .init({
        resources,
        lng: locale,
        fallbackLng: 'en',
        supportedLngs: [...SUPPORTED_LOCALES],
        interpolation: { escapeValue: false },
        returnEmptyString: false,
      })
    return
  }

  if (i18n.language !== locale) {
    await i18n.changeLanguage(locale)
  }
}

export default i18n
