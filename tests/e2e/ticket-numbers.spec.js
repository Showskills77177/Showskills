import { test, expect } from '@playwright/test'
import { e2eSecret } from '../support/env.mjs'
import { openLegacyBundleEntry } from '../support/entry.mjs'
import { openE2eDb, paidTicketNumbersForEmail } from '../support/db.mjs'

test.describe('Ticket numbers on confirmed checkout', () => {
  test('mock session checkout creates paid ticket with SS- numbers', async ({ page }) => {
    const email = `e2e-tkt-session-${Date.now()}@example.test`
    const name = 'E2E Ticket Session'

    await openLegacyBundleEntry(page)
    await page.locator('#modal-paid-fullname').fill(name)
    await page.locator('#modal-paid-email').fill(email)
    await page.getByRole('checkbox', { name: /I agree to the/i }).check()
    await page.getByRole('button', { name: /E2E simulated checkout/i }).click()
    await expect(page.getByText(/Payment received/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/SS-[A-F0-9]{8}/)).toBeVisible()

    const db = openE2eDb()
    const { ticket, numbers } = paidTicketNumbersForEmail(db, email)
    expect(ticket?.payment_status).toBe('paid')
    expect(numbers.length).toBe(1)
    expect(numbers[0]).toMatch(/^SS-[A-F0-9]{8}$/)
    db.close()
  })

  test('mock payment-intent path creates one number per bundle slot', async ({ request }) => {
    const email = `e2e-tkt-pi-${Date.now()}@example.test`
    const qty = 1
    const res = await request.post('/api/e2e/mock-stripe-payment-intent', {
      headers: { 'x-e2e-secret': e2eSecret, 'Content-Type': 'application/json' },
      data: {
        customerEmail: email,
        customerFullName: 'E2E PI User',
        bundleId: 'single',
        quantity: qty,
        amountPence: 30,
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.ticketNumbers).toHaveLength(qty)
    for (const num of body.ticketNumbers) {
      expect(num).toMatch(/^SS-[A-F0-9]{8}$/)
    }

    const db = openE2eDb()
    const { numbers } = paidTicketNumbersForEmail(db, email)
    expect(numbers).toEqual(body.ticketNumbers)
    db.close()
  })
})
