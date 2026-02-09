import { defineConfig } from 'vitest/config'

// DB action tests: Node environment, separate pool for native deps (better-sqlite3).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    pool: 'forks',
    testTimeout: 30_000,
    restoreMocks: true,
    clearMocks: true,
  },
})
