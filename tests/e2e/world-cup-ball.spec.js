import { test, expect } from '@playwright/test'
import { installPageErrorAsserter } from '../support/console.mjs'

const GIVEAWAY_TITLE = /World Cup Ball Question-Challenge Giveaway/i

test.describe('World Cup Ball Question-Challenge Giveaway', () => {
  test('rules page renders how-to-win content', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    await page.goto('/world-cup-ball-giveaway')
    await expect(page.getByRole('heading', { name: GIVEAWAY_TITLE })).toBeVisible()
    await expect(page.getByText(/How to win|How it works/i)).toBeVisible()
    await expect(page.locator('#how-to-enter')).toBeVisible()
    await assertClean()
  })

  test('rules page opens from homepage link', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    await page.goto('/')
    await page.getByRole('link', { name: /Full rules/i }).first().click()
    await expect(page).toHaveURL(/\/world-cup-ball-giveaway$/)
    await expect(page.getByRole('heading', { name: GIVEAWAY_TITLE })).toBeVisible()
    await assertClean()
  })

  test('rules page opens from competitions card link', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    await page.goto('/competitions')
    await page.getByRole('link', { name: /Full rules/i }).first().click()
    await expect(page).toHaveURL(/\/world-cup-ball-giveaway$/)
    await expect(page.getByRole('heading', { name: GIVEAWAY_TITLE })).toBeVisible()
    await assertClean()
  })
})
