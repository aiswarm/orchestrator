import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    globals: true,
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: './coverage'
    }
  }
})
