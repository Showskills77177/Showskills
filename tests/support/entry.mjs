import { expect } from '@playwright/test'

/** Open Signed Legacy Bundle paid entry from the homepage hero. */
export async function openLegacyBundleEntryFromHome(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter Bundle Draw' }).click()
  await expect(page.getByRole('heading', { name: /Enter — Signed Legacy Bundle/i })).toBeVisible({
    timeout: 15_000,
  })
}

/** Open Signed Legacy Bundle paid entry modal (stable vs home layout changes). */
export async function openLegacyBundleEntry(page) {
  await page.goto('/competitions')
  await page.getByRole('button', { name: /Enter this competition/i }).first().click()
  await expect(page.getByRole('heading', { name: /Enter — Signed Legacy Bundle/i })).toBeVisible({
    timeout: 15_000,
  })
}

/** Open iPhone 17 Pro or Cash paid entry from the homepage panel. */
export async function openIphone17ProEntryFromHome(page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Enter iPhone draw/i }).click()
  await expect(page.getByRole('heading', { name: /Enter — iPhone 17 Pro or Cash/i })).toBeVisible({
    timeout: 15_000,
  })
}

/** Open iPhone 17 Pro or Cash paid entry from the competitions page card. */
export async function openIphone17ProEntryFromCompetitions(page) {
  await page.goto('/competitions')
  const card = page.locator('[data-competition-card]').filter({ hasText: 'iPhone 17 Pro or Cash' })
  await card.getByRole('button', { name: /Enter this competition/i }).click()
  await expect(page.getByRole('heading', { name: /Enter — iPhone 17 Pro or Cash/i })).toBeVisible({
    timeout: 15_000,
  })
}

/** Close the entry modal via the header X (not the footer "Close" button). */
export async function closeEntryModal(page) {
  await page.locator('#entry-modal-title').locator('..').getByRole('button', { name: 'Close', exact: true }).click()
}

/** Open free shirt giveaway modal. */
export async function openShirtGiveawayEntry(page) {
  await page.goto('/archive/ronaldo-shirt-giveaway')
  await page.getByRole('button', { name: /Open free giveaway form/i }).click()
  await expect(page.getByRole('heading', { name: /Enter — Ronaldo shirt giveaway/i })).toBeVisible({
    timeout: 15_000,
  })
}
