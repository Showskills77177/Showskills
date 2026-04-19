import { test, expect } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openE2eDb, latestKickupByEmail, countKickups } from '../support/db.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const tinyMp4 = join(root, 'tests', 'fixtures', 'tiny.mp4')

test.describe('C) Kick-up challenge', () => {
  test('submit https link and appear in DB', async ({ page }) => {
    const email = `e2e-kick-url-${Date.now()}@example.test`
    const name = 'E2E Kick URL'

    const db0 = openE2eDb()
    const before = countKickups(db0)
    db0.close()

    await page.goto('/competitions')
    await page.getByRole('button', { name: /Enter shirt giveaway/i }).click()
    await page.getByLabel(/Full name/i).first().fill(name)
    await page.getByLabel(/Or video link/i).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    await page.getByLabel(/^Email$/i).fill(email)
    await page.getByRole('checkbox', { name: /I agree to the/i }).check()
    await page.getByRole('button', { name: /Submit giveaway entry/i }).click()
    await expect(page.getByText(/Thanks — your submission was received/i)).toBeVisible({ timeout: 15_000 })

    const db = openE2eDb()
    expect(countKickups(db)).toBeGreaterThan(before)
    const row = latestKickupByEmail(db, email)
    expect(row?.video_ref?.startsWith('https://')).toBe(true)
    db.close()
  })

  test('multipart video upload accepted (API)', async ({ request }) => {
    const email = `e2e-kick-file-${Date.now()}@example.test`
    const name = 'E2E Kick File'

    const db0 = openE2eDb()
    const before = countKickups(db0)
    db0.close()

    const res = await request.post('/api/submissions/kickups/upload', {
      multipart: {
        fullName: name,
        email,
        video: {
          name: 'clip.mp4',
          mimeType: 'video/mp4',
          path: tinyMp4,
        },
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()

    const db = openE2eDb()
    expect(countKickups(db)).toBeGreaterThan(before)
    const row = latestKickupByEmail(db, email)
    expect(row?.video_ref?.startsWith('local:')).toBe(true)
    db.close()
  })
})
