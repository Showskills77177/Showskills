import { test, expect } from '@playwright/test'
import { installPageErrorAsserter } from '../support/console.mjs'
import { completeE2eMockCheckout } from '../support/paymentFlow.mjs'
import {
  openE2eDb,
  latestCompetitionEntryByEmail,
  paidTicketMetaForEmail,
} from '../support/db.mjs'

test.describe('Quiz session & email stress', () => {
  test.use({ viewport: { width: 1400, height: 900 } })

  test.beforeEach(async ({ page }) => {
    installPageErrorAsserter(page)
  })

  test('dev email preview shows unanswered ticket template', async ({ page }) => {
    await page.goto('/dev/email-preview')
    await expect(page.getByRole('heading', { name: /Email previews/i })).toBeVisible()
    await page.locator('select').first().selectOption('quiz_pending')
    const frame = page.frameLocator('iframe[title="Purchase email HTML preview"]')
    await expect(frame.getByText(/Your questions are not answered/i)).toBeVisible({ timeout: 20_000 })
    await expect(frame.getByText(/Answer your questions now/i)).toBeVisible()
    await expect(frame.getByText('SS-1A2B3C4D')).toBeVisible()
  })

  test('admin test-email page shows unanswered ticket template', async ({ page }) => {
    const { adminUser, adminPass } = await import('../support/env.mjs')
    await page.goto('/admin/login')
    await page.locator('#admin-user').fill(adminUser)
    await page.locator('#admin-pass').fill(adminPass)
    await page.getByRole('button', { name: /Sign in/i }).click()
    await page.waitForURL(/\/admin\/(dashboard|verify)/, { timeout: 20_000 }).catch(() => {})
    if (!page.url().includes('/admin/dashboard')) {
      test.skip(true, 'Admin needs email OTP on this server — preview manually at /admin/test-email after sign-in')
    }

    await page.goto('/admin/test-email')
    await expect(page.getByRole('heading', { name: /Email previews/i })).toBeVisible()
    await page.locator('select').first().selectOption('quiz_pending')
    await expect(page.getByText(/Your questions are not answered/i)).toBeVisible()
    const frame = page.frameLocator('iframe[title="Purchase email HTML preview"]')
    await expect(frame.getByText(/Answer your questions now/i)).toBeVisible({ timeout: 20_000 })
    await expect(frame.getByText(/SS-/)).toBeVisible()
  })

  test('pay → answer in modal → green header, no unanswered email on close', async ({ page }) => {
    const email = `e2e-answered-${Date.now()}@example.test`
    await completeE2eMockCheckout(page, { name: 'Stress Answered', email })

    const qInputs = page.locator('input[placeholder="Type your answer"]')
    await qInputs.nth(0).fill('Bolton 4-0')
    await qInputs.nth(1).fill('Nicky Butt')
    await qInputs.nth(2).fill('47')
    await page.getByRole('button', { name: 'Submit answers' }).click()
    await expect(page.getByText(/All three answers were correct/i)).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).first().click()
    const strayEmailApi = await page
      .waitForResponse(
        (res) =>
          res.url().includes('/api/entries/send-unanswered-quiz-email') &&
          res.request().method() === 'POST',
        { timeout: 2500 },
      )
      .catch(() => null)
    expect(strayEmailApi).toBeNull()

    const navQuiz = page.locator('nav[aria-label="Main navigation"] [data-testid="quiz-prompt-nav"]')
    await expect(navQuiz).toHaveAttribute('data-quiz-status', 'answered')
    await expect(navQuiz).toHaveText(/Questions answered/i)

    const db = openE2eDb()
    expect(latestCompetitionEntryByEmail(db, email)?.entry_type).toBe('paid')
    db.close()
  })

  test('pay → close without answers → red header + resume APIs', async ({ page }) => {
    const email = `e2e-pending-${Date.now()}@example.test`
    const navQuiz = page.locator('nav[aria-label="Main navigation"] [data-testid="quiz-prompt-nav"]')
    await completeE2eMockCheckout(page, { name: 'Stress Pending', email })

    await expect(page.getByRole('button', { name: 'Submit answers' })).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).first().click()
    await expect(navQuiz).toHaveAttribute('data-quiz-status', 'pending', { timeout: 10_000 })

    const resumeRes = await page.request.post('/api/entries/resume-paid-quiz', {
      data: { email },
    })
    expect(resumeRes.status()).toBeLessThan(500)
    expect(resumeRes.ok()).toBeTruthy()
    const resume = await resumeRes.json()
    expect(resume.pending).toBe(true)
    expect(resume.ticketNumbers?.length).toBeGreaterThan(0)
    expect(resume.resumeToken?.length).toBeGreaterThan(20)

    const db1 = openE2eDb()
    const meta1 = paidTicketMetaForEmail(db1, email)
    expect(meta1?.quiz_resume_token).toBe(resume.resumeToken)
    db1.close()

    const emailRes = await page.request.post('/api/entries/send-unanswered-quiz-email', {
      data: { email },
    })
    expect(emailRes.ok()).toBeTruthy()
    const emailed = await emailRes.json()
    expect(
      emailed.emailSent ||
        emailed.skipped ||
        ['no_resend_key', 'already_sent', 'quiz_already_submitted'].includes(emailed.reason),
    ).toBeTruthy()

    const emailRes2 = await page.request.post('/api/entries/send-unanswered-quiz-email', {
      data: { email },
    })
    const emailed2 = await emailRes2.json()
    expect(emailed2.skipped || emailed2.reason === 'already_sent').toBeTruthy()

    await page.goto(
      `/competitions?complete-quiz=1&resume=${encodeURIComponent(resume.resumeToken)}`,
    )
    await expect(page.getByText(/Payment received/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('#modal-paid-quiz-email')).toHaveValue(email)
  })

  test('rapid reopen header + sessionStorage survives reload', async ({ page }) => {
    const email = `e2e-reload-${Date.now()}@example.test`
    const navQuiz = page.locator('nav[aria-label="Main navigation"] [data-testid="quiz-prompt-nav"]')
    await completeE2eMockCheckout(page, { name: 'Stress Reload', email })
    await page.getByRole('button', { name: 'Close' }).first().click()
    await expect(navQuiz).toBeVisible({ timeout: 10_000 })

    for (let i = 0; i < 5; i++) {
      await navQuiz.click()
      await expect(page.getByText(/Payment received/i)).toBeVisible()
      await page.getByRole('button', { name: 'Close' }).first().click()
      await expect(navQuiz).toBeVisible()
    }

    const sessionRaw = await page.evaluate(() => sessionStorage.getItem('ss_paid_quiz_session'))
    expect(sessionRaw).toContain('pending')

    await page.reload()
    await expect(navQuiz).toHaveAttribute('data-quiz-status', 'pending', { timeout: 10_000 })
  })

  test('parallel resume lookups do not 500', async ({ page }) => {
    const email = `e2e-parallel-${Date.now()}@example.test`
    await completeE2eMockCheckout(page, { name: 'Stress Parallel', email })
    await page.getByRole('button', { name: 'Close' }).first().click()

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        page.request.post('/api/entries/resume-paid-quiz', { data: { email } }),
      ),
    )
    for (const res of results) {
      expect(res.status()).toBeLessThan(500)
      if (res.status() === 200) {
        const j = await res.json()
        expect(j.ok).toBe(true)
      }
    }
  })
})
