import { test, expect } from '@playwright/test'
import { installPageErrorAsserter } from '../support/console.mjs'

const CORRECT = {
  q1: 'Bolton 4-0',
  q2: 'Nicky Butt',
  q3: '47',
}

test.describe('A) User flow — Legacy Bundle quiz after E2E checkout', () => {
  test('home → competitions → paid entry → simulated checkout → quiz → success', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    const email = `e2e-user-${Date.now()}@example.test`
    const name = 'E2E Legacy User'

    await page.goto('/')
    await expect(page.getByRole('heading', { name: /ShowSkills Rewards/i })).toBeVisible()
    await page.getByRole('link', { name: 'Competitions' }).click()
    await expect(page).toHaveURL(/\/competitions/)
    await expect(page.getByRole('heading', { name: 'Competitions' })).toBeVisible()

    await page.getByRole('button', { name: /Enter this competition/i }).click()
    await expect(page.getByRole('heading', { name: /Ronaldo Legacy Bundle/i })).toBeVisible()

    await page.locator('#modal-paid-fullname').fill(name)
    await page.locator('#modal-paid-email').fill(email)
    await page.getByRole('checkbox', { name: /I agree to the/i }).check()

    await page.getByRole('button', { name: /E2E simulated checkout/i }).click()
    await expect(page.getByText(/Payment received/i)).toBeVisible({ timeout: 20_000 })

    const qInputs = page.locator('input[placeholder="Type your answer"]')
    await expect(qInputs).toHaveCount(3)
    await qInputs.nth(0).fill(CORRECT.q1)
    await qInputs.nth(1).fill(CORRECT.q2)
    await qInputs.nth(2).fill(CORRECT.q3)
    await page.getByRole('button', { name: 'Submit answers' }).click()
    await expect(page.getByText(/All correct/i)).toBeVisible({ timeout: 15_000 })

    await assertClean()
  })
})
