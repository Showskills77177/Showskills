import { expect } from '@playwright/test'
import { DEFAULT_TICKET_BUNDLE_ID } from '../../shared/ticketBundles.mjs'
import { openLegacyBundleEntry } from './entry.mjs'

/** Select a ticket bundle (mobile native select or desktop radio). */
export async function selectTicketBundle(page, bundleId) {
  const select = page.locator('#ticket-bundle-select')
  if (await select.isVisible().catch(() => false)) {
    await select.selectOption(bundleId)
    return
  }
  await page.locator(`input[type="radio"][value="${bundleId}"]`).check()
}

export async function fillPaidEntryForm(page, { name, email }) {
  await page.locator('#modal-paid-fullname').fill(name)
  await page.locator('#modal-paid-email').fill(email)
  await page.locator('.ss-entry-consent-label input[type="checkbox"]').check()
}

/** E2E simulated checkout (no live Stripe) — uses the default single ticket bundle. */
export async function completeE2eMockCheckout(page, { name, email, bundleId = DEFAULT_TICKET_BUNDLE_ID }) {
  await openLegacyBundleEntry(page)
  await selectTicketBundle(page, bundleId)
  const radio = page.locator(`input[type="radio"][value="${bundleId}"]`)
  const select = page.locator('#ticket-bundle-select')
  if (await select.isVisible().catch(() => false)) {
    await expect(select).toHaveValue(bundleId)
  } else if (await radio.isVisible().catch(() => false)) {
    await expect(radio).toBeChecked()
  }
  await fillPaidEntryForm(page, { name, email })
  await page.getByRole('button', { name: /Continue \(E2E simulated checkout\)/i }).click()
  await expect(page.getByText(/Payment received/i)).toBeVisible({ timeout: 25_000 })
  await expect(page.getByText(/SS-[A-F0-9]{8}/)).toBeVisible({ timeout: 15_000 })
}