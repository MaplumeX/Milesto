import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ok } from '../../shared/result'
import type { WindowApi } from '../../shared/window-api'
import type { SyncState } from '../../shared/schemas/sync'
import { SyncSettingsPanel } from '../../src/features/settings/SyncSettingsPanel'

type SyncApi = {
  getState: () => Promise<ReturnType<typeof ok<SyncState>>>
  testConnection: (input: unknown) => Promise<ReturnType<typeof ok<{ reachable: true }>>>
  saveConfiguration: (input: unknown) => Promise<ReturnType<typeof ok<SyncState>>>
  enable: () => Promise<ReturnType<typeof ok<SyncState>>>
  disable: () => Promise<ReturnType<typeof ok<SyncState>>>
  syncNow: () => Promise<ReturnType<typeof ok<SyncState>>>
}

type WindowApiWithSync = WindowApi & { sync: SyncApi }

const ERROR_STATE: SyncState = {
  enabled: true,
  mode: 'error',
  device_id: 'device-a',
  device_name: 'MacBook Pro',
  config: {
    endpoint: 'https://objects.example.test',
    region: 'auto',
    bucket: 'milesto-sync',
    prefix: 'users/demo',
    force_path_style: true,
  },
  has_stored_credentials: true,
  pending_outbox_count: 2,
  last_successful_sync_at: null,
  last_attempted_sync_at: '2026-03-16T00:00:00.000Z',
  last_error: {
    code: 'SYNC_PULL_FAILED',
    message: 'Pull failed.',
  },
}

describe('SyncSettingsPanel', () => {
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('renders sync status and exposes Sync now without leaking error details', async () => {
    const user = userEvent.setup()

    const api = (window as unknown as { api: WindowApiWithSync }).api
    const syncNow = vi.fn(async () =>
      ok({
        ...ERROR_STATE,
        mode: 'idle' as const,
        pending_outbox_count: 0,
        last_successful_sync_at: '2026-03-16T00:00:05.000Z',
        last_error: null,
      })
    )

    api.sync = {
      getState: vi.fn(async () => ok(ERROR_STATE)),
      testConnection: vi.fn(async () => ok({ reachable: true as const })),
      saveConfiguration: vi.fn(async () => ok(ERROR_STATE)),
      enable: vi.fn(async () => ok(ERROR_STATE)),
      disable: vi.fn(async () => ok({ ...ERROR_STATE, enabled: false, mode: 'disabled' })),
      syncNow,
    }

    render(<SyncSettingsPanel />)

    expect(await screen.findByTestId('settings-sync-panel')).toBeInTheDocument()
    expect(screen.getByDisplayValue('MacBook Pro')).toBeInTheDocument()
    expect(screen.getByText('SYNC_PULL_FAILED')).toBeInTheDocument()
    expect(screen.getByText('Pull failed.')).toBeInTheDocument()
    expect(screen.queryByText(/details/i)).not.toBeInTheDocument()

    await user.click(screen.getByTestId('settings-sync-now'))
    expect(syncNow).toHaveBeenCalledTimes(1)
  })

  it('keeps typed credentials visible after save and reflects cleared sync error state', async () => {
    const user = userEvent.setup()

    const api = (window as unknown as { api: WindowApiWithSync }).api
    const saveConfiguration = vi.fn(async () =>
      ok({
        ...ERROR_STATE,
        enabled: false,
        mode: 'disabled' as const,
        last_error: null,
        pending_outbox_count: 0,
      })
    )

    api.sync = {
      getState: vi.fn(async () =>
        ok({
          ...ERROR_STATE,
          enabled: false,
          mode: 'disabled' as const,
          has_stored_credentials: false,
        })
      ),
      testConnection: vi.fn(async () => ok({ reachable: true as const })),
      saveConfiguration,
      enable: vi.fn(async () => ok(ERROR_STATE)),
      disable: vi.fn(async () => ok({ ...ERROR_STATE, enabled: false, mode: 'disabled' })),
      syncNow: vi.fn(async () => ok(ERROR_STATE)),
    }

    render(<SyncSettingsPanel />)
    const card = await screen.findByTestId('settings-sync-panel')

    const textInputs = Array.from(card.querySelectorAll<HTMLInputElement>('input.input'))
    expect(textInputs.length).toBeGreaterThanOrEqual(8)

    const [
      deviceNameInput,
      endpointInput,
      regionInput,
      bucketInput,
      prefixInput,
      accessKeyIdInput,
      secretAccessKeyInput,
      sessionTokenInput,
    ] = textInputs

    await user.clear(deviceNameInput!)
    await user.type(deviceNameInput!, 'Studio Mac')
    await user.clear(endpointInput!)
    await user.type(endpointInput!, 'https://objects.example.test')
    await user.clear(regionInput!)
    await user.type(regionInput!, 'auto')
    await user.clear(bucketInput!)
    await user.type(bucketInput!, 'milesto-sync')
    await user.clear(prefixInput!)
    await user.type(prefixInput!, 'users/demo')
    await user.type(accessKeyIdInput!, 'AKIA_TEST')
    await user.type(secretAccessKeyInput!, 'SECRET_TEST')
    await user.type(sessionTokenInput!, 'SESSION_TEST')

    await user.click(within(card).getByText('settings.syncSaveConfiguration'))

    expect(saveConfiguration).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('SYNC_PULL_FAILED')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('AKIA_TEST')).toBeInTheDocument()
    expect(screen.getByDisplayValue('SECRET_TEST')).toBeInTheDocument()
    expect(screen.getByDisplayValue('SESSION_TEST')).toBeInTheDocument()
  })

  it('refreshes the displayed sync status while the settings page stays open', async () => {
    vi.useFakeTimers()

    const api = (window as unknown as { api: WindowApiWithSync }).api
    const getState = vi
      .fn()
      .mockResolvedValueOnce(
        ok({
          ...ERROR_STATE,
          enabled: false,
          mode: 'disabled' as const,
          pending_outbox_count: 0,
          has_stored_credentials: false,
          last_error: null,
        })
      )
      .mockResolvedValue(
        ok({
          ...ERROR_STATE,
          enabled: true,
          mode: 'syncing' as const,
          pending_outbox_count: 2,
          last_attempted_sync_at: '2026-03-16T00:00:08.000Z',
          last_error: null,
        })
      )

    api.sync = {
      getState,
      testConnection: vi.fn(async () => ok({ reachable: true as const })),
      saveConfiguration: vi.fn(async () => ok(ERROR_STATE)),
      enable: vi.fn(async () => ok(ERROR_STATE)),
      disable: vi.fn(async () => ok({ ...ERROR_STATE, enabled: false, mode: 'disabled' })),
      syncNow: vi.fn(async () => ok(ERROR_STATE)),
    }

    render(<SyncSettingsPanel />)
    await act(async () => {
      await Promise.resolve()
    })

    const card = screen.getByTestId('settings-sync-panel')
    expect(within(card).getByText('0')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(getState).toHaveBeenCalledTimes(2)
    expect(within(card).getByText('2')).toBeInTheDocument()
    expect(within(card).getByText('settings.syncModeSyncing')).toBeInTheDocument()
  })
})
