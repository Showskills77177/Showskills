import { test, expect } from '@playwright/test'

test.describe('Contact page', () => {
  test('loads and shows contact email', async ({ page }) => {
    await page.goto('/contact')
    await expect(page.getByRole('heading', { name: 'Contact us' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'contact@showskills.co.uk' })).toBeVisible()
  })

  test('footer links to contact', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Contact' }).click()
    await expect(page).toHaveURL(/\/contact/)
  })

  test('terms mention contact@showskills.co.uk', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Full terms/i }).click()
    await expect(page.getByRole('dialog')).toContainText('contact@showskills.co.uk')
  })

  test('validates short message before mailto', async ({ page }) => {
    await page.goto('/contact')
    await page.getByLabel(/Your name/i).fill('Test User')
    await page.getByLabel(/Your email/i).fill('contact-test@example.test')
    await page.getByLabel(/^Message$/i).fill('Hi')
    await page.getByRole('button', { name: /Open email app/i }).click()
    await expect(page.getByText(/at least 10 characters/i)).toBeVisible({ timeout: 10_000 })
  })

  test('shows open email app action', async ({ page }) => {
    await page.goto('/contact')
    await expect(page.getByRole('button', { name: /Open email app to send/i })).toBeVisible()
    await expect(page.getByText(/email forwarding/i)).toBeVisible()
  })
})
