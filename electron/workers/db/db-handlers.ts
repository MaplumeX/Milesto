import type Database from 'better-sqlite3'

import { createDbActions } from './actions/db-actions'
import { createTaskActions } from './actions/task-actions'
import { createProjectActions } from './actions/project-actions'
import { createAreaActions } from './actions/area-actions'
import { createTagActions } from './actions/tag-actions'
import { createChecklistActions } from './actions/checklist-actions'
import { createListPositionActions } from './actions/list-position-actions'
import { createDataTransferActions } from './actions/data-transfer-actions'
import { createSidebarActions } from './actions/sidebar-actions'
import { createSettingsActions } from './actions/settings-actions'
import type { DbActionHandler } from './actions/db-actions'

export function buildDbHandlers(db: Database.Database): Record<string, DbActionHandler> {
  return {
    ...createDbActions(db),
    ...createSettingsActions(db),
    ...createTaskActions(db),
    ...createProjectActions(db),
    ...createAreaActions(db),
    ...createTagActions(db),
    ...createChecklistActions(db),
    ...createListPositionActions(db),
    ...createDataTransferActions(db),
    ...createSidebarActions(db),
  }
}
