import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from './AppShell'
import { AnytimePage } from '../pages/AnytimePage'
import { InboxPage } from '../pages/InboxPage'
import { LogbookPage } from '../pages/LogbookPage'
import { AreaPage } from '../pages/AreaPage'
import { ProjectPage } from '../pages/ProjectPage'
import { SearchPage } from '../pages/SearchPage'
import { SettingsPage } from '../pages/SettingsPage'
import { SomedayPage } from '../pages/SomedayPage'
import { TodayPage } from '../pages/TodayPage'
import { UpcomingPage } from '../pages/UpcomingPage'

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/today" replace />} />

        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/upcoming" element={<UpcomingPage />} />
        <Route path="/anytime" element={<AnytimePage />} />
        <Route path="/someday" element={<SomedayPage />} />
        <Route path="/logbook" element={<LogbookPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route path="/search" element={<SearchPage />} />

        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/areas/:areaId" element={<AreaPage />} />
      </Route>
    </Routes>
  )
}
