import { test, expect } from '@playwright/test'
import { openLegacyBundleEntry } from '../support/entry.mjs'
import {
  openE2eDb,
  countTickets,
  latestCompetitionEntryByEmail,
  paidTicketNumbersForEmail,
} from '../support/db.mjs'

test.describe('B) Mocked payment + persistence', () => {
  test('mock Stripe completion creates paid ticket; quiz creates competition entry', async ({ page }) => {
    const email = `e2e-pay-${Date.now()}@example.test`
    const name = 'E2E Payment User'

    const before = openE2eDb()
    const ticketsBefore = countTickets(before)
    const ticketNumsBefore = before.prepare(`SELECT COUNT(*) AS c FROM ticket_numbers`).get().c
    before.close()

    await openLegacyBundleEntry(page)
    await page.locator('#modal-paid-fullname').fill(name)
    await page.locator('#modal-paid-email').fill(email)
    await page.getByRole('checkbox', { name: /I agree to the/i }).check()
    await page.getByRole('button', { name: /E2E simulated checkout/i }).click()
    await expect(page.getByText(/Payment received/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/SS-[A-F0-9]{8}/)).toBeVisible({ timeout: 10_000 })

    const db1 = openE2eDb()
    expect(countTickets(db1)).toBeGreaterThan(ticketsBefore)
    expect(db1.prepare(`SELECT COUNT(*) AS c FROM ticket_numbers`).get().c).toBeGreaterThan(ticketNumsBefore)
    const { ticket, numbers } = paidTicketNumbersForEmail(db1, email)
    expect(ticket?.payment_status).toBe('paid')
    expect(numbers.length).toBe(1)
    expect(numbers[0]).toMatch(/^SS-[A-F0-9]{8}$/)
    db1.close()

    const qInputs = page.locator('input[placeholder="Type your answer"]')
    await qInputs.nth(0).fill('Bolton 4-0')
    await qInputs.nth(1).fill('Nicky Butt')
    await qInputs.nth(2).fill('47')
    await page.getByRole('button', { name: 'Submit answers' }).click()
    await expect(page.getByText(/All correct — you qualify/i)).toBeVisible()

    const db2 = openE2eDb()
    const entry = latestCompetitionEntryByEmail(db2, email)
    expect(entry, 'competition_entries row').toBeTruthy()
    expect(entry.entry_type).toBe('paid')
    expect(entry.all_correct).toBe(1)
    db2.close()
  })
})
