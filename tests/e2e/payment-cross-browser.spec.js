import { test, expect } from '@playwright/test'
import { installPageErrorAsserter } from '../support/console.mjs'
import {
  completeTest30pMockCheckout,
  assertPayNowOpensPaymentSheet,
} from '../support/paymentFlow.mjs'
import { openE2eDb, paidTicketNumbersForEmail } from '../support/db.mjs'

test.describe('Payment — £0.30 test bundle (all browsers / mobile)', () => {
  test('mock checkout at £0.30 creates paid ticket + ticket number', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    const email = `e2e-30p-${Date.now()}@example.test`

    await completeTest30pMockCheckout(page, { name: 'Cross Browser Buyer', email })

    const db = openE2eDb()
    const { ticket, numbers } = paidTicketNumbersForEmail(db, email)
    expect(ticket?.payment_status).toBe('paid')
    expect(numbers.length).toBe(1)
    expect(numbers[0]).toMatch(/^SS-[A-F0-9]{8}$/)
    db.close()

    await assertClean()
  })

  test('Pay now opens payment sheet on first tap (Safari / mobile safe)', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    await assertPayNowOpensPaymentSheet(page)
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByRole('heading', { name: /Complete payment/i })).toBeHidden()
    await assertClean()
  })
})
