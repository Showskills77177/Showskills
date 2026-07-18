import { test, expect } from '@playwright/test'
import { adminUser, adminPass } from '../support/env.mjs'

/** Hub payload when YouTube is connected (E2E env has no real OAuth). */
const EOF_HUB_READY = {
  staging: true,
  youtube: { isReadyToPublish: true, hasOAuthClient: true, hasRefreshToken: true },
  channel: { title: 'E2E Test Channel', subscriberCount: 1200, thumbnailUrl: '' },
  analytics: {
    available: true,
    periodDays: 28,
    subscriberCount: 1200,
    totalViews: 8400,
    totalWatchTimeHours: 42,
    subscribersGained: 18,
    topContent: [{ videoId: 'abc123', title: 'Test clip', views: 100, watchTimeHours: 2 }],
  },
  session: { username: adminUser, isOwner: true, isEditor: false, canApprove: true },
  projects: [],
  calendar: {},
}

async function adminLogin(page, context) {
  const cookies = await context.cookies()
  if (cookies.some((c) => c.name === 'admin_session' && c.value)) return

  await page.goto('/admin/login')
  await page.locator('#admin-user').fill(adminUser)
  await page.locator('#admin-pass').fill(adminPass)
  await page.getByRole('button', { name: /Sign in/i }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 20_000 })
}

async function mockEofHub(page, hub = EOF_HUB_READY) {
  await page.route('**/api/admin/eyes-of-football', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(hub),
    })
  })
}

async function gotoEof(page, { mockHub = false } = {}) {
  if (mockHub) await mockEofHub(page)
  await page.goto('/admin/eyes-of-football')
  if (mockHub) {
    await expect(page.getByRole('button', { name: 'Studio' })).toBeVisible({ timeout: 20_000 })
  } else {
    await expect(page.getByRole('heading', { name: /Eyes Of Football/i })).toBeVisible({ timeout: 20_000 })
  }
}

test.describe('Eyes Of Football — admin shell & navigation', () => {
  test('dedicated layout hides ShowSkills nav and shows Back to ShowSkills', async ({ page, context }) => {
    await adminLogin(page, context)
    await page.goto('/admin/eyes-of-football')
    await expect(page).toHaveURL(/\/admin\/eyes-of-football/)

    await expect(page.getByRole('link', { name: /Back to ShowSkills/i })).toBeVisible()
    await expect(page.getByText(/YouTube Studio/i)).toBeVisible()
    await expect(page.getByRole('navigation').getByRole('link', { name: /Dashboard/i })).toHaveCount(0)
    await expect(page.getByRole('img', { name: /ShowSkills/i })).toHaveCount(0)
  })

  test('Back to ShowSkills returns to main admin dashboard', async ({ page, context }) => {
    await adminLogin(page, context)
    await page.goto('/admin/eyes-of-football')
    await page.getByRole('link', { name: /Back to ShowSkills/i }).click()
    await expect(page).toHaveURL(/\/admin\/dashboard/)
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
    await expect(page.getByRole('navigation').getByRole('link', { name: /Dashboard/i })).toBeVisible()
  })

  test('main admin nav still links to Eyes Of Football', async ({ page, context }) => {
    await adminLogin(page, context)
    await page.getByRole('navigation').getByRole('link', { name: /Eyes Of Football/i }).click()
    await expect(page).toHaveURL(/\/admin\/eyes-of-football/)
    await expect(page.getByRole('heading', { name: /Eyes Of Football/i })).toBeVisible()
  })

  test('unauthenticated user cannot access EOF page', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/admin/eyes-of-football')
    await expect(page).toHaveURL(/\/admin\/login/)
  })
  test('shows Connect YouTube when channel is not linked (real API)', async ({ page, context }) => {
    await adminLogin(page, context)
    await gotoEof(page)
    await expect(page.getByRole('heading', { name: /Connect YouTube/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Studio' })).toHaveCount(0)
  })
})

test.describe('Eyes Of Football — studio tabs & API', () => {
  test('studio, analytics, calendar, and content tabs work', async ({ page, context }) => {
    await adminLogin(page, context)
    await gotoEof(page, { mockHub: true })
    await expect(page.getByRole('button', { name: 'Studio' })).toBeVisible()
    await expect(page.getByText(/Publish Shorts and long-form/i)).toBeVisible()

    await page.getByRole('button', { name: 'Analytics' }).click()
    await expect(page.getByRole('heading', { name: /Channel analytics/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Top content/i })).toBeVisible()
    await expect(page.getByText('8,400')).toBeVisible()

    await page.getByRole('button', { name: 'Calendar' }).click()
    await expect(page.getByRole('heading', { name: /Publishing calendar/i })).toBeVisible()

    await page.getByRole('button', { name: 'Content' }).click()
    await expect(page.getByRole('heading', { name: /Channel content/i })).toBeVisible()
  })

  test('GET /api/admin/eyes-of-football returns expected shape', async ({ page, context, request }) => {
    await adminLogin(page, context)
    await gotoEof(page)
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const res = await request.get('/api/admin/eyes-of-football', {
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.staging).toBe(true)
    expect(body).toHaveProperty('youtube')
    expect(body).toHaveProperty('projects')
    expect(body).toHaveProperty('calendar')
    expect(body).toHaveProperty('analytics')
    expect(body).toHaveProperty('session')
    expect(Array.isArray(body.projects)).toBe(true)
  })

  test('upload init without YouTube returns 503', async ({ page, context, request }) => {
    await adminLogin(page, context)
    await gotoEof(page)
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const res = await request.post('/api/admin/eof-upload-init', {
      headers: {
        Cookie: cookieHeader,
        'Content-Type': 'application/json',
      },
      data: {
        title: 'E2E test video',
        description: 'Automated test',
        uploadSource: 'admin',
        videoContentType: 'short',
        visibility: 'private',
      },
    })
    expect(res.status()).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/YouTube/i)
  })
})

test.describe('Eyes Of Football — upload form UI', () => {
  test.beforeEach(async ({ page, context }) => {
    await adminLogin(page, context)
    await gotoEof(page, { mockHub: true })
    await page.getByRole('button', { name: 'Studio' }).click()
  })

  test('create form shows metadata tabs, preview, and made for kids default off', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Create' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Details' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Visibility' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Advanced' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Checks' })).toBeVisible()
    await expect(page.getByText('Preview')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Short' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Long form' })).toBeVisible()

    await page.getByRole('button', { name: 'Advanced' }).click()
    const row = page.locator('label').filter({ hasText: 'Made for kids' })
    await expect(row).toBeVisible()
    await expect(row.locator('input[type="checkbox"]')).not.toBeChecked()
  })
})

/** Thin Production smoke — mocked API only (no ffmpeg / image fetch). */
test.describe('Eyes Of Football — Production (mocked)', () => {
  test('opens Production, shows draft job + quality gate banner', async ({ page, context }) => {
    await adminLogin(page, context)
    await mockEofHub(page)

    const draftJob = {
      id: 'e2e-prod-draft-1',
      topic: 'E2E England draft',
      title: 'E2E England draft',
      status: 'draft',
      script: {
        format: 'hot_take',
        plainTextDraft: 'England need a reset. The manager faces pressure tonight.',
        scenes: [
          { narration: 'England need a reset.', caption: 'England need a reset', durationSec: 4 },
        ],
      },
      qualityGate: {
        pass: false,
        blocked: true,
        mode: 'manual',
        phase: 'preflight',
        checkedAt: '2026-07-18T12:00:00.000Z',
        reasons: ['Script scenes incomplete for build'],
        warnings: [],
        checks: [],
        visionUsed: false,
      },
      qualityGateHistory: [
        {
          pass: false,
          blocked: true,
          phase: 'preflight',
          mode: 'manual',
          checkedAt: '2026-07-18T12:00:00.000Z',
          reasons: ['Script scenes incomplete for build'],
          warnings: [],
        },
      ],
      musicTrackId: null,
      errorMessage: null,
      renderProgress: null,
      createdAt: '2026-07-18T11:00:00.000Z',
      updatedAt: '2026-07-18T12:00:00.000Z',
    }

    await page.route('**/api/admin/eof-production**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, job: draftJob }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          jobs: [draftJob],
          scriptFormats: [{ id: 'hot_take', label: 'Hot take' }],
          imageSources: { oxylabs: false, serpapi: false },
          imagesNote: 'No SerpAPI/Oxylabs keys — falling back to Wikidata + Wikimedia Commons.',
          oxylabs: { configured: false, ok: false, detail: 'OXYLABS_USERNAME / OXYLABS_PASSWORD not set' },
          imageProviderOptions: [{ id: 'auto', label: 'Auto', configured: true }],
        }),
      })
    })

    await page.goto('/admin/eyes-of-football')
    await page.getByRole('button', { name: 'Production' }).click()
    await expect(page.getByRole('heading', { name: /Production/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(/E2E England draft/i).first()).toBeVisible()
    await page.getByText(/E2E England draft/i).first().click()
    await expect(page.getByText(/Quality gate/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Gate history/i)).toBeVisible()
  })
})
