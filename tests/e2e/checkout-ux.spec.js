import { test, expect } from '@playwright/test'
import { installPageErrorAsserter } from '../support/console.mjs'
import { openLegacyBundleEntry } from '../support/entry.mjs'
import { fillPaidEntryForm } from '../support/paymentFlow.mjs'

test.describe('Checkout & site UX (cross-browser)', () => {
  test('home and competitions load without console errors', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Enter Bundle Draw' })).toBeVisible()
    await page.goto('/competitions')
    await expect(page.getByRole('heading', { name: 'Competitions' })).toBeVisible()
    await assertClean()
  })

  test('paid entry form accepts keyboard input and has mobile-safe field size', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    await openLegacyBundleEntry(page)

    const name = page.locator('#modal-paid-fullname')
    const email = page.locator('#modal-paid-email')

    await name.click()
    await name.fill('Alex Morgan')
    await expect(name).toHaveValue('Alex Morgan')

    await email.click()
    await email.fill('buyer@example.test')
    await expect(email).toHaveValue('buyer@example.test')

    await expect(name).toHaveAttribute('autocomplete', 'name')
    await expect(email).toHaveAttribute('autocomplete', 'email')

    const nameFontPx = await name.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    const emailFontPx = await email.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(nameFontPx).toBeGreaterThanOrEqual(16)
    expect(emailFontPx).toBeGreaterThanOrEqual(16)

    await page.locator('.ss-entry-consent-label input[type="checkbox"]').check()

    const payBtn = page
      .getByRole('button', { name: /^Pay now$/i })
      .or(page.getByRole('button', { name: /Continue \(E2E simulated checkout\)/i }))
    await expect(payBtn.first()).toBeVisible()
    const box = await payBtn.first().boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)

    const consent = page.locator('.ss-entry-consent-text')
    await expect(consent).toContainText('Terms & Conditions')
    await expect(consent).toContainText('Privacy Policy')

    await assertClean()
  })

  test('entry modal scrolls on small viewports without clipping actions', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    await page.setViewportSize({ width: 390, height: 664 })
    await openLegacyBundleEntry(page)
    await fillPaidEntryForm(page, { name: 'Scroll Test', email: 'scroll@example.test' })

    const payBtn = page
      .getByRole('button', { name: /^Pay now$/i })
      .or(page.getByRole('button', { name: /Continue \(E2E simulated checkout\)/i }))
    await payBtn.first().scrollIntoViewIfNeeded()
    await expect(payBtn.first()).toBeVisible()

    const consent = page.locator('.ss-entry-consent-box')
    await expect(consent).toBeVisible()

    await assertClean()
  })

  test('contact form fields are tappable and 16px on mobile', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/contact')

    const email = page.getByLabel(/^Email$/i)
    await email.fill('contact@example.test')
    const fontPx = await email.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(fontPx).toBeGreaterThanOrEqual(16)

    const send = page.getByRole('button', { name: /Send message/i })
    const box = await send.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)

    await assertClean()
  })
})
