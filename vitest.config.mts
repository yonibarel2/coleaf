import { defineConfig } from 'vitest/config'

// electron-vite's config is not a Vite config, so Vitest gets its own.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
})
