import type Database from 'better-sqlite3'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { initDb } from '../../electron/workers/db/db-bootstrap'

export async function createTestDb(): Promise<{
  dbPath: string
  db: Database.Database
  cleanup: () => Promise<void>
}> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'milesto-db-test-'))
  const dbPath = path.join(dir, 'test.sqlite3')
  const db = initDb(dbPath)

  return {
    dbPath,
    db,
    cleanup: async () => {
      db.close()
      await rm(dir, { recursive: true, force: true })
    },
  }
}
