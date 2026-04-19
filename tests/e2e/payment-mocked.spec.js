import { test, expect } from '@playwright/test'
import { e2eSecret } from '../support/env.mjs'
import { openE2eDb, countTickets, latestCompetitionEntryByEmail } from '../support/db.mjs'

test.describe('B) Mocked payment + persistence', () => {
  test('mock Stripe completion creates paid ticket; quiz creates competition entry', async ({ page, request }) => {
    const email = `e2e-pay-${Date.now()}@example.test`
    const name = 'E2E Payment User'

    const before = openE2eDb()
    const ticketsBefore = countTickets(before)
    before.close()

    const mockRes = await request.post('/api/e2e/mock-stripe-completion', {
      headers: { 'x-e2e-secret': e2eSecret, 'Content-Type': 'application/json' },
      data: {
        customerEmail: email,
        customerFullName: name,
        bundleId: 'single',
        quantity: 1,
        amountPence: 75,
      },
    })
    expect(mockRes.ok(), await mockRes.text()).toBeTruthy()

    const db1 = openE2eDb()
    expect(countTickets(db1)).toBeGreaterThan(ticketsBefore)
    db1.close()

    await page.goto('/')
    await page.getByRole('button', { name: /^Open entry$/i }).first().click()
    await page.locator('#modal-paid-fullname').fill(name)
    await page.locator('#modal-paid-email').fill(email)
    await page.getByRole('checkbox', { name: /I agree to the/i }).check()
    await page.getByRole('button', { name: /E2E simulated checkout/i }).click()
    await expect(page.getByText(/Payment received/i)).toBeVisible({ timeout: 20_000 })

    const qInputs = page.locator('input[placeholder="Type your answer"]')
    await qInputs.nth(0).fill('Bolton 4-0')
    await qInputs.nth(1).fill('Nicky Butt')
    await qInputs.nth(2).fill('47')
    await page.getByRole('button', { name: 'Submit answers' }).click()
    await expect(page.getByText(/All correct/i)).toBeVisible()

    const db2 = openE2eDb()
    const entry = latestCompetitionEntryByEmail(db2, email)
    expect(entry, 'competition_entries row').toBeTruthy()
    expect(entry.entry_type).toBe('paid')
    expect(entry.all_correct).toBe(1)
    db2.close()
  })
})
