import { test, expect } from '@playwright/test'

test.describe('Edge cases & errors', () => {
  test('kick-up rejects non-https video URL', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Open entry/i }).nth(1).click()
    await page.getByLabel(/Full name/i).first().fill('Edge Case')
    await page.getByLabel(/Or video link/i).fill('http://insecure.example.com/v.mp4')
    await page.getByLabel(/^Email$/i).fill('edge@example.test')
    await page.getByRole('checkbox', { name: /I agree to the/i }).check()
    await page.getByRole('button', { name: /Submit giveaway entry/i }).click()
    await expect(page.getByText(/https link/i)).toBeVisible({ timeout: 10_000 })
  })

  test('paid quiz shows not qualified for wrong answers', async ({ page }) => {
    await page.goto('/competitions')
    await page.getByRole('button', { name: /Enter this competition/i }).click()
    await page.locator('#modal-paid-fullname').fill('Wrong Answers')
    await page.locator('#modal-paid-email').fill(`wrong-${Date.now()}@example.test`)
    await page.getByRole('checkbox', { name: /I agree to the/i }).check()
    await page.getByRole('button', { name: /E2E simulated checkout/i }).click()
    await expect(page.getByText(/Payment received/i)).toBeVisible({ timeout: 20_000 })

    const qInputs = page.locator('input[placeholder="Type your answer"]')
    await qInputs.nth(0).fill('wrong')
    await qInputs.nth(1).fill('wrong')
    await qInputs.nth(2).fill('wrong')
    await page.getByRole('button', { name: 'Submit answers' }).click()
    await expect(page.getByText(/incorrect/i)).toBeVisible({ timeout: 15_000 })
  })

  test('unknown path falls back to home route', async ({ page }) => {
    await page.goto('/this-route-should-not-exist-xyz')
    await expect(page.getByRole('heading', { name: /ShowSkills Rewards/i })).toBeVisible()
  })
})
