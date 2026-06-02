import { HashRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { LucideProvider } from 'lucide-react'

import { AppRouter } from './app/AppRouter'
import { AppEventsProvider } from './app/AppEventsContext'
import { ConfirmDialogProvider } from './contexts/ConfirmDialogContext'
import i18n from './i18n/i18n'

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <LucideProvider size={"1em" as unknown as number}>
        <HashRouter>
          <AppEventsProvider>
            <ConfirmDialogProvider>
              <AppRouter />
            </ConfirmDialogProvider>
          </AppEventsProvider>
        </HashRouter>
      </LucideProvider>
    </I18nextProvider>
  )
}
