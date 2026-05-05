import type Database from 'better-sqlite3'

import { createDbActions } from './actions/db-actions'
import { createTaskActions } from './actions/task-actions'
import { createProjectActions } from './actions/project-actions'
import { createAreaActions } from './actions/area-actions'
import { createTagActions } from './actions/tag-actions'
import { createChatActions } from './actions/chat-actions'
import { createChecklistActions } from './actions/checklist-actions'
import { createListPositionActions } from './actions/list-position-actions'
import { createDataTransferActions } from './actions/data-transfer-actions'
import { createSidebarActions } from './actions/sidebar-actions'
import { createSettingsActions } from './actions/settings-actions'
import { createTrashActions } from './actions/trash-actions'
import { createSyncActions } from './actions/sync-actions'
import { createViewActions } from './actions/view-actions'
import { createAiChatActions } from './actions/ai-chat-actions'
import type { DbActionHandler } from './actions/db-actions'

export function buildDbHandlers(db: Database.Database): Record<string, DbActionHandler> {
  const handlers: Record<string, DbActionHandler> = {
    ...createDbActions(db),
    ...createSettingsActions(db),
    ...createTaskActions(db),
    ...createViewActions(db),
    ...createProjectActions(db),
    ...createAreaActions(db),
    ...createTagActions(db),
    ...createChatActions(db),
    ...createChecklistActions(db),
    ...createListPositionActions(db),
    ...createDataTransferActions(db),
    ...createSidebarActions(db),
    ...createTrashActions(db),
    ...createSyncActions(db),
  }
  Object.assign(handlers, createAiChatActions(db, handlers))
  return handlers
}
