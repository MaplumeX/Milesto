import { afterEach, describe, expect, it } from 'vitest'

import { createSettingsActions } from '../../electron/workers/db/actions/settings-actions'
import { createTestDb } from './db-test-helper'

describe('settings actions', () => {
  let cleanupDb: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (!cleanupDb) return
    await cleanupDb()
    cleanupDb = null
  })

  async function setup() {
    const { db, cleanup } = await createTestDb()
    cleanupDb = cleanup
    return { db, actions: createSettingsActions(db) }
  }

  it('persists and reads font size slider steps', async () => {
    const { actions } = await setup()

    const setRes = actions['settings.setFontSizeStep']({ step: 3 })
    expect(setRes).toEqual({ ok: true, data: { step: 3 } })

    const getRes = actions['settings.getFontSizeStep']({})
    expect(getRes).toEqual({ ok: true, data: { step: 3 } })
  })

  it('rejects unsupported font size slider steps', async () => {
    const { actions } = await setup()

    const res = actions['settings.setFontSizeStep']({ step: 4 })

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('VALIDATION_FAILED')
      expect(res.error.message).toBe('Invalid font size step.')
    }
  })

  it('rejects font size payloads without a step field', async () => {
    const { actions } = await setup()

    const res = actions['settings.setFontSizeStep']({})

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('VALIDATION_FAILED')
      expect(res.error.message).toBe('Invalid settings.setFontSizeStep payload.')
    }
  })

  it('treats invalid persisted font size values as unset', async () => {
    const { db, actions } = await setup()

    db.prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('fontSize.step', '500', '2026-04-26T00:00:00.000Z')`
    ).run()

    const res = actions['settings.getFontSizeStep']({})
    expect(res).toEqual({ ok: true, data: { step: null } })
  })

  it('treats non-canonical persisted font size strings as unset', async () => {
    const { db, actions } = await setup()

    db.prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('fontSize.step', '01', '2026-04-26T00:00:00.000Z')`
    ).run()

    const res = actions['settings.getFontSizeStep']({})
    expect(res).toEqual({ ok: true, data: { step: null } })
  })
})
