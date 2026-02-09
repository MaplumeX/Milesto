import { defineConfig } from 'vitest/config'

// Fast tests: shared/unit + renderer component tests (no Electron runtime).
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts', 'tests/renderer/**/*.test.ts', 'tests/renderer/**/*.test.tsx'],
    setupFiles: ['tests/setup/fast.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
})
