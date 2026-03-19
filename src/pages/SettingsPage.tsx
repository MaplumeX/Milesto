import { useTranslation } from 'react-i18next'

import { GeneralSettingsPanel } from '../features/settings/GeneralSettingsPanel'
import { SyncSettingsPanel } from '../features/settings/SyncSettingsPanel'

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{t('settings.title')}</h1>
      </header>

      <div className="settings-page-stack">
        <GeneralSettingsPanel />
        <SyncSettingsPanel />
      </div>
    </div>
  )
}
