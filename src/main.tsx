import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import 'react-day-picker/style.css'
import './index.css'

import type { Locale } from '../shared/i18n/locale'
import { initI18n } from './i18n/i18n'

async function bootstrap() {
  const url = new URL(window.location.href)
  const selfTestEnabled = url.searchParams.get('selfTest') === '1'

  // Register the self-test entrypoint as early as possible.
  const selfTestPromise = selfTestEnabled
    ? import('./app/selfTest').then((m) => m.registerSelfTest())
    : Promise.resolve()

  let locale: Locale = 'en'
  try {
    const res = await window.api.settings.getLocaleState()
    if (res.ok) locale = res.data.locale
  } catch {
    // Fallback to English.
  }

  document.documentElement.lang = locale
  await initI18n(locale)
  await selfTestPromise

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void bootstrap()
