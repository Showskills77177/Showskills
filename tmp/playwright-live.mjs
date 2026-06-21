import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '../tests/e2e',
  timeout: 60_000,
  use: { baseURL: 'https://showskills.co.uk', ...devices['iPhone 13'] },
  projects: [{ name: 'iphone', use: { ...devices['iPhone 13'] } }],
})
