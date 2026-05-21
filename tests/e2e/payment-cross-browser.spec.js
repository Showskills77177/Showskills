import { test, expect } from '@playwright/test'
import { installPageErrorAsserter } from '../support/console.mjs'
import { completeE2eMockCheckout } from '../support/paymentFlow.mjs'
import { openE2eDb, paidTicketNumbersForEmail } from '../support/db.mjs'

test.describe('Payment — single ticket bundle (all browsers / mobile)', () => {
  test('mock checkout creates paid ticket + ticket number', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    const email = `e2e-pay-${Date.now()}@example.test`

    await completeE2eMockCheckout(page, { name: 'Cross Browser Buyer', email })

    const db = openE2eDb()
    const { ticket, numbers } = paidTicketNumbersForEmail(db, email)
    expect(ticket?.payment_status).toBe('paid')
    expect(numbers.length).toBe(1)
    expect(numbers[0]).toMatch(/^SS-[A-F0-9]{8}$/)
    db.close()

    await assertClean()
  })

  test('entry modal shows Pay now when form is complete', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    const { openLegacyBundleEntry } = await import('../support/entry.mjs')
    const { fillPaidEntryForm } = await import('../support/paymentFlow.mjs')

    await openLegacyBundleEntry(page)
    await fillPaidEntryForm(page, {
      name: 'Pay Button User',
      email: `pay-btn-${Date.now()}@example.test`,
    })
    await expect(page.getByRole('button', { name: /^Pay now$/i })).toBeEnabled()
    await assertClean()
  })
})
