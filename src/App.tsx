import { HashRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'

import { AppRouter } from './app/AppRouter'
import { AppEventsProvider } from './app/AppEventsContext'
import i18n from './i18n/i18n'

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <HashRouter>
        <AppEventsProvider>
          <AppRouter />
        </AppEventsProvider>
      </HashRouter>
    </I18nextProvider>
  )
}
