import { test, expect } from '@playwright/test'
import { openShirtGiveawayEntry } from '../support/entry.mjs'
import { completeE2eMockCheckout } from '../support/paymentFlow.mjs'
import { shirtGiveawayEmailInput } from '../support/selectors.mjs'

test.describe('Edge cases & errors', () => {
  test('shirt giveaway rejects incorrect qualification answer', async ({ page }) => {
    await openShirtGiveawayEntry(page)
    await page.getByLabel(/Full name/i).first().fill('Edge Case')
    await page.getByLabel(/Qualification question/i).fill('wrong answer')
    await shirtGiveawayEmailInput(page).fill('edge@example.test')
    await page.locator('#modal-kick-phone').fill('07123456789')
    await page.getByRole('checkbox', { name: /Subscribe me to ShowSkills/i }).check()
    await page.locator('label:has(input[name="kick-social-platform"][value="tiktok"])').click()
    await page.locator('#modal-kick-social-handle').fill('edge_user')
    await page.getByRole('checkbox', { name: /I have followed ShowSkills/i }).check()
    await page.getByRole('checkbox', { name: /I agree to the/i }).check()
    await page.getByRole('button', { name: /Submit giveaway entry/i }).click()
    await expect(page.getByText(/not correct/i)).toBeVisible({ timeout: 10_000 })
  })

  test('paid quiz accepts lenient correct answers (Bolton, Butt, 47)', async ({ page }) => {
    const email = `lenient-${Date.now()}@example.test`
    await completeE2eMockCheckout(page, { name: 'Lenient Answers', email })

    const qInputs = page.locator('input[placeholder="Type your answer"]')
    await qInputs.nth(0).fill('Bolton')
    await qInputs.nth(1).fill('Butt')
    await qInputs.nth(2).fill('47')
    await page.getByRole('button', { name: 'Submit answers' }).click()
    await expect(page.getByText(/All three answers were correct/i)).toBeVisible({ timeout: 15_000 })
  })

  test('paid quiz shows not qualified for wrong answers', async ({ page }) => {
    const email = `wrong-${Date.now()}@example.test`
    await completeE2eMockCheckout(page, { name: 'Wrong Answers', email })

    const qInputs = page.locator('input[placeholder="Type your answer"]')
    await qInputs.nth(0).fill('wrong')
    await qInputs.nth(1).fill('wrong')
    await qInputs.nth(2).fill('wrong')
    await page.getByRole('button', { name: 'Submit answers' }).click()
    await expect(page.getByText(/do not qualify for the main Signed Football Legend Bundle draw/i)).toBeVisible({ timeout: 15_000 })
  })

  test('unknown path falls back to home route', async ({ page }) => {
    await page.goto('/this-route-should-not-exist-xyz')
    await expect(page.getByRole('heading', { name: 'ShowSkills Rewards' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enter Bundle Draw' })).toBeVisible()
  })
})
