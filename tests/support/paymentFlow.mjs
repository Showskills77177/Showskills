import { expect } from '@playwright/test'
import { TEST_TICKET_BUNDLE_ID } from '../../shared/ticketBundles.mjs'
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
  await page.getByRole('checkbox', { name: /I agree to the/i }).check()
}

/** £0.30 test tier — default in E2E; completes via simulated checkout (no live Stripe). */
export async function completeTest30pMockCheckout(page, { name, email }) {
  await openLegacyBundleEntry(page)
  await selectTicketBundle(page, TEST_TICKET_BUNDLE_ID)
  const radio = page.locator(`input[type="radio"][value="${TEST_TICKET_BUNDLE_ID}"]`)
  const select = page.locator('#ticket-bundle-select')
  if (await select.isVisible().catch(() => false)) {
    await expect(select).toHaveValue(TEST_TICKET_BUNDLE_ID)
  } else if (await radio.isVisible().catch(() => false)) {
    await expect(radio).toBeChecked()
  }
  await fillPaidEntryForm(page, { name, email })
  await page.getByRole('button', { name: /Continue \(E2E simulated checkout\)/i }).click()
  await expect(page.getByText(/Payment received/i)).toBeVisible({ timeout: 25_000 })
  await expect(page.getByText(/SS-[A-F0-9]{8}/)).toBeVisible({ timeout: 15_000 })
}

/** Pay now opens the in-modal payment sheet (card / PayPal UI) on the first click. */
export async function assertPayNowOpensPaymentSheet(page) {
  await openLegacyBundleEntry(page)
  await selectTicketBundle(page, TEST_TICKET_BUNDLE_ID)
  await fillPaidEntryForm(page, {
    name: 'Pay Sheet User',
    email: `sheet-${Date.now()}@example.test`,
  })
  await page.getByRole('button', { name: /^Pay now$/i }).click()
  const sheet = page.getByRole('dialog', { name: /Complete payment/i })
  await expect(sheet).toBeVisible({ timeout: 15_000 })
  await expect(sheet.getByText('£0.30', { exact: true })).toBeVisible()
}
