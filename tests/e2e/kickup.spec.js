import { test, expect } from '@playwright/test'
import { openShirtGiveawayEntry } from '../support/entry.mjs'
import { fillShirtGiveawayForm } from '../support/shirtGiveaway.mjs'
import { openE2eDb, kickupById, countKickups } from '../support/db.mjs'

test.describe('C) Free shirt giveaway', () => {
  test('submit qualification answer and appear in DB', async ({ page }) => {
    const email = `e2e-shirt-${Date.now()}@example.test`
    const name = 'E2E Shirt Entry'

    const db0 = openE2eDb()
    const before = countKickups(db0)
    db0.close()

    await openShirtGiveawayEntry(page)
    await fillShirtGiveawayForm(page, { name, email })

    const submitResponse = page.waitForResponse(
      (res) =>
        /\/api\/submissions\/kickups$/.test(new URL(res.url()).pathname) &&
        res.request().method() === 'POST',
    )
    await page.getByRole('button', { name: /Submit giveaway entry/i }).click()
    const res = await submitResponse
    const body = await res.json().catch(() => ({}))
    expect(res.ok(), `kickups POST ${res.status()}: ${JSON.stringify(body)}`).toBeTruthy()
    expect(body.ok).toBe(true)
    expect(body.id).toBeTruthy()
    await expect(page.getByText(/You're in the draw/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Entry number:/i)).toBeVisible()

    const db = openE2eDb()
    const row = kickupById(db, body.id)
    expect(row, `kickup id ${body.id} in e2e.sqlite`).toBeTruthy()
    expect(row?.email?.toLowerCase()).toBe(email.toLowerCase())
    expect(countKickups(db)).toBeGreaterThan(before)
    expect(row?.video_ref).toBe('answer:ronaldo-shirt-giveaway')
    expect(row?.video_filename).toContain('Ronaldo R9')
    expect(row?.admin_notes).toMatch(/Newsletter: yes/i)
    expect(row?.admin_notes).toMatch(/Social follow: tiktok/i)
    db.close()
  })

  test('rejects entry without newsletter and social follow', async ({ page }) => {
    await openShirtGiveawayEntry(page)
    await page.getByLabel(/Full name/i).first().fill('Incomplete Entry')
    await page.getByLabel(/Qualification question/i).fill('Ronaldo R9')
    await page.locator('#modal-kick-email').fill('incomplete@example.test')
    await page.locator('#modal-kick-phone').fill('07123456789')
    await page.getByRole('checkbox', { name: /I agree to the/i }).check()
    await page.getByRole('button', { name: /Submit giveaway entry/i }).click()
    await expect(page.getByText(/Please subscribe to the ShowSkills newsletter/i)).toBeVisible({ timeout: 10_000 })
  })
})
