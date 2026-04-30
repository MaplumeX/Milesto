import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'
import type { ReactNode } from 'react'

import { createWindowApiMock } from '../renderer/window-api-mock'
import type { WindowApi } from '../../shared/window-api'

// Keep renderer tests stable: treat window.api + i18n as explicit boundaries.
vi.mock('react-i18next', () => {
  return {
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: 'en', changeLanguage: async () => {} },
    }),
    Trans: ({ i18nKey, children }: { i18nKey?: string; children?: ReactNode }) => i18nKey ?? children ?? null,
  }
})

// Auto-confirm in tests so components using useConfirm() work without a Provider.
vi.mock('../../src/contexts/ConfirmDialogContext', () => {
  return {
    ConfirmDialogProvider: ({ children }: { children: ReactNode }) => children,
    useConfirm: () => () => Promise.resolve(true),
  }
})

// Provide a default typed window.api for component tests.
// Individual tests can override specific methods via vi.fn().
beforeEach(() => {
  if (typeof window === 'undefined') return
  const api: WindowApi = createWindowApiMock()
  Object.defineProperty(window, 'api', {
    value: api,
    writable: true,
    configurable: true,
  })
})
