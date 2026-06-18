import { test, expect } from '@playwright/test'
import { installPageErrorAsserter } from '../support/console.mjs'

test.describe('World Cup Ball Giveaway', () => {
  test('rules page renders how-to-win content', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    await page.goto('/world-cup-ball-giveaway')
    await expect(page.getByRole('heading', { name: /World Cup Ball Giveaway/i })).toBeVisible()
    await expect(page.getByText(/How to win|How it works/i)).toBeVisible()
    await expect(page.locator('#how-to-enter')).toBeVisible()
    await assertClean()
  })

  test('rules page opens from homepage link', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    await page.goto('/')
    const link = page.getByRole('link', { name: /Full rules.*how to win/i })
    await link.scrollIntoViewIfNeeded()
    await link.click()
    await expect(page).toHaveURL(/\/world-cup-ball-giveaway$/)
    await expect(page.getByRole('heading', { name: /World Cup Ball Giveaway/i })).toBeVisible()
    await assertClean()
  })

  test('competitions card links to rules page', async ({ page }) => {
    await page.goto('/competitions')
    const link = page.getByRole('link', { name: /Read full rules/i })
    await link.scrollIntoViewIfNeeded()
    await link.click()
    await expect(page).toHaveURL(/\/world-cup-ball-giveaway$/)
    await expect(page.getByRole('heading', { name: /World Cup Ball Giveaway/i })).toBeVisible()
  })
})
