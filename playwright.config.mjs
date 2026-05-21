import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(root, '.env.e2e') })

const e2eSecret = (process.env.E2E_SECRET || 'e2e-dev-only-secret').trim()
const adminUser = (process.env.E2E_ADMIN_USER || process.env.ADMIN_USER || 'e2e-admin').trim()
const adminPass = (process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'e2e-admin-test-pass').trim()
const jwtSecret = (
  process.env.ADMIN_JWT_SECRET || 'e2e-jwt-secret-must-be-32-chars-min!'
).trim()

export default defineConfig({
  testDir: './tests/e2e',
  /** Single shared SQLite file (db/e2e.sqlite) — avoid parallel writes. */
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: join(root, 'tests/support/global-setup.mjs'),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    /** Must match vite --port in dev:e2e (strict — fails if busy). */
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox-payment',
      testMatch: /payment-cross-browser\.spec\.js/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-payment',
      testMatch: /payment-cross-browser\.spec\.js/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome-payment',
      testMatch: /payment-cross-browser\.spec\.js/,
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari-payment',
      testMatch: /payment-cross-browser\.spec\.js/,
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'firefox-checkout-ux',
      testMatch: /checkout-ux\.spec\.js/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-checkout-ux',
      testMatch: /checkout-ux\.spec\.js/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome-checkout-ux',
      testMatch: /checkout-ux\.spec\.js/,
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari-checkout-ux',
      testMatch: /checkout-ux\.spec\.js/,
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'chromium-checkout-ux',
      testMatch: /checkout-ux\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    /** API on :3001 + Vite :5173 so tests do not clash with a normal dev:all on :3000/:5173. */
    command: 'npm run dev:e2e',
    url: 'http://localhost:5173',
    /** Always start E2E env (VITE_E2E_SIMULATE_CHECKOUT, :3001 API) — avoid reusing dev:all. */
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: '3001',
      VITE_PROXY_API_TARGET: 'http://127.0.0.1:3001',
      SQLITE_PATH: 'db/e2e.sqlite',
      E2E_MODE: '1',
      E2E_SECRET: e2eSecret,
      ADMIN_USER: adminUser,
      ADMIN_PASSWORD: adminPass,
      ADMIN_JWT_SECRET: jwtSecret,
      VITE_E2E_SIMULATE_CHECKOUT: '1',
      VITE_E2E_SECRET: e2eSecret,
      VITE_DEFAULT_BUNDLE_ID: 'single',
      VITE_STRIPE_PUBLISHABLE_KEY: '',
      VITE_STRIPE_PAYMENT_LINK: '',
      VITE_PAYPAL_CLIENT_ID: '',
    },
  },
})

