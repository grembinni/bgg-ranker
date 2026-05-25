import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
    environmentMatchGlobs: [
      ['src/**/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['src/test-setup.ts'],
  },
})
