import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'server', environment: 'node', include: ['tests/server/**/*.test.ts'] },
      },
      {
        plugins: [react()],
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['tests/web/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/web/setup.ts'],
          css: false,
        },
      },
    ],
  },
})
