import { HashRouter } from 'react-router-dom'

import { AppRouter } from './app/AppRouter'
import { AppEventsProvider } from './app/AppEventsContext'

export default function App() {
  return (
    <HashRouter>
      <AppEventsProvider>
        <AppRouter />
      </AppEventsProvider>
    </HashRouter>
  )
}
