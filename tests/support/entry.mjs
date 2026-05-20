import { expect } from '@playwright/test'

/** Open Legacy Bundle paid entry modal (stable vs home layout changes). */
export async function openLegacyBundleEntry(page) {
  await page.goto('/competitions')
  await page.getByRole('button', { name: /Enter this competition/i }).click()
  await expect(page.getByRole('heading', { name: /Enter — Ronaldo Legacy Bundle/i })).toBeVisible({
    timeout: 15_000,
  })
}

/** Open free shirt giveaway modal. */
export async function openShirtGiveawayEntry(page) {
  await page.goto('/archive/ronaldo-shirt-giveaway')
  await page.getByRole('button', { name: /Open free giveaway form/i }).click()
  await expect(page.getByRole('heading', { name: /Enter — Ronaldo shirt giveaway/i })).toBeVisible({
    timeout: 15_000,
  })
}
