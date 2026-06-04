import { expect } from '@playwright/test'

/** Page `<h1>` on /competitions (avoids matching section headings that contain "competitions"). */
export function competitionsPageHeading(page) {
  return page.locator('main h1').filter({ hasText: /^Competitions$/ })
}

export async function expectCompetitionsPage(page) {
  await expect(competitionsPageHeading(page)).toBeVisible()
}

/** Shirt giveaway modal email field (not footer newsletter). */
export function shirtGiveawayEmailInput(page) {
  return page.locator('#modal-kick-email')
}

/** Contact form email field (not footer newsletter). */
export function contactFormEmailInput(page) {
  return page.locator('.ss-contact-form input[type="email"]').first()
}

/** Email preview template selector on dev/admin preview pages. */
export function emailPreviewTemplateSelect(page) {
  return page.getByLabel('Template')
}
