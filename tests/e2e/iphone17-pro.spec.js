import { test, expect } from '@playwright/test'
import { installPageErrorAsserter } from '../support/console.mjs'
import { openIphone17ProEntryFromCompetitions, openIphone17ProEntryFromHome } from '../support/entry.mjs'
import {
  fillPaidEntryForm,
  selectTicketBundle,
} from '../support/paymentFlow.mjs'
import {
  openE2eDb,
  latestCompetitionEntryByEmail,
  paidTicketNumbersForEmail,
} from '../support/db.mjs'
import { e2eSecret } from '../support/env.mjs'
import { IPHONE_17_PRO_COMPETITION_SLUG } from '../../shared/iphone17ProCompetition.mjs'

const IPHONE_QUIZ = {
  q1: '1099',
  q2: 'A19 Pro',
  q3: 'Silver',
}

test.describe('iPhone 17 Pro or Cash bundle', () => {
  test('homepage panel → 29p checkout → iPhone skill quiz → qualified entry', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    const email = `e2e-iphone-home-${Date.now()}@example.test`
    const name = 'E2E iPhone Home'

    await openIphone17ProEntryFromHome(page)
    await expect(page.locator('#ticket-bundle-select option[value="single"]')).toContainText('£0.29')
    await selectTicketBundle(page, 'single')
    await fillPaidEntryForm(page, { name, email })
    await page.getByRole('button', { name: /Continue \(E2E simulated checkout\)/i }).click()
    await expect(page.getByText(/Payment received/i)).toBeVisible({ timeout: 25_000 })

    const db1 = openE2eDb()
    const { ticket, numbers } = paidTicketNumbersForEmail(db1, email)
    expect(ticket?.payment_status).toBe('paid')
    expect(numbers.length).toBe(1)
    const payment = db1
      .prepare(`SELECT amount_pence FROM payments WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1`)
      .get(ticket.id)
    expect(payment?.amount_pence).toBe(29)
    db1.close()

    const qInputs = page.locator('input[placeholder="Type your answer"]')
    await expect(qInputs).toHaveCount(3)
    await qInputs.nth(0).fill(IPHONE_QUIZ.q1)
    await qInputs.nth(1).fill(IPHONE_QUIZ.q2)
    await qInputs.nth(2).fill(IPHONE_QUIZ.q3)
    await page.getByRole('button', { name: 'Submit answers' }).click()
    await expect(page.getByText(/All three answers were correct/i)).toBeVisible({ timeout: 15_000 })

    const db2 = openE2eDb()
    const entry = latestCompetitionEntryByEmail(db2, email)
    expect(entry?.entry_type).toBe('paid')
    expect(entry?.competition).toBe(IPHONE_17_PRO_COMPETITION_SLUG)
    expect(entry?.all_correct).toBe(1)
    db2.close()

    await assertClean()
  })

  test('competitions card → value10 bundle via mock API records 270p payment', async ({ request }) => {
    const email = `e2e-iphone-api-${Date.now()}@example.test`
    const res = await request.post('/api/e2e/mock-paid-completion', {
      headers: { 'x-e2e-secret': e2eSecret, 'Content-Type': 'application/json' },
      data: {
        customerEmail: email,
        customerFullName: 'E2E iPhone API',
        bundleId: 'value10',
        competition: IPHONE_17_PRO_COMPETITION_SLUG,
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.ticketNumbers?.length).toBe(10)

    const db = openE2eDb()
    const { ticket } = paidTicketNumbersForEmail(db, email)
    expect(ticket?.payment_status).toBe('paid')
    const meta = db
      .prepare(
        `SELECT t.competition, t.bundle_id, p.amount_pence
         FROM tickets t
         JOIN users u ON u.id = t.user_id
         JOIN payments p ON p.ticket_id = t.id
         WHERE lower(u.email) = lower(?)
         ORDER BY t.created_at DESC LIMIT 1`,
      )
      .get(email)
    expect(meta?.competition).toBe(IPHONE_17_PRO_COMPETITION_SLUG)
    expect(meta?.bundle_id).toBe('value10')
    expect(meta?.amount_pence).toBe(270)
    db.close()
  })

  test('competitions page opens iPhone modal with competition bundles', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    await openIphone17ProEntryFromCompetitions(page)
    await expect(page.locator('#ticket-bundle-select option[value="single"]')).toContainText('£0.29')
    await expect(page.getByRole('radio', { name: /Single.*£0\.29/i })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Value bundle/i })).toBeVisible()
    await assertClean()
  })
})
