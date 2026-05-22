import { test, expect } from '@playwright/test'
import { adminUser, adminPass } from '../support/env.mjs'

test.describe('D) Admin panel', () => {
  test('login, dashboard, users, submissions load', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.getByRole('heading', { name: /Admin sign in/i })).toBeVisible()

    await page.locator('#admin-user').fill(adminUser)
    await page.locator('#admin-pass').fill(adminPass)
    await page.getByRole('button', { name: /Sign in/i }).click()

    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
    await expect(page.getByText(/Kick-up submissions pending/i)).toBeVisible()

    await page.getByRole('navigation').getByRole('link', { name: /Users & entries/i }).click()
    await expect(page.getByRole('heading', { name: /Users & entries/i })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('navigation').getByRole('link', { name: /Draw winner/i }).click()
    await expect(page.getByRole('heading', { name: /Draw winner/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /Draw winner now/i })).toBeVisible()

    await page.getByRole('navigation').getByRole('link', { name: /Kick-up videos/i }).click()
    await expect(page.getByRole('heading', { name: /Free shirt giveaway/i })).toBeVisible()
  })

  test('unauthenticated user is redirected from /admin/dashboard', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})
