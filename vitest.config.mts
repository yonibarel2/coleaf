import { defineConfig } from 'vitest/config'

// electron-vite's config is not a Vite config, so Vitest gets its own.
export default defineConfig({
  // Not node_modules/.vite: the dev server rewrites that while it starts, which broke test runs.
  cacheDir: 'node_modules/.vitest',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
})
