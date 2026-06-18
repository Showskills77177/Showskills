import { test, expect } from '@playwright/test'
import { installPageErrorAsserter } from '../support/console.mjs'
import { closeEntryModal, openLegacyBundleEntryFromHome } from '../support/entry.mjs'

test.describe('Homepage — layout & stress', () => {
  test('hero panels, prize studio labels, and bundle list render', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'ShowSkills Rewards' })).toBeVisible()
    await expect(page.getByText('Signed Legacy Bundle details')).toBeVisible()
    await expect(page.locator('.ss-ticket-bundles-heading')).toBeVisible()

    const prizes = page.locator('#prizes')
    await expect(prizes.getByText('Phone prize')).toBeVisible()
    await expect(prizes.getByText('Case prize')).toBeVisible()
    await expect(prizes.getByText('iPhone 17 Pro Max', { exact: true })).toBeVisible()
    await expect(prizes.getByText('24K gold case', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Prize lineup' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enter Bundle Draw' })).toBeVisible()
    await expect(page.getByText(/refunded automatically/i)).toBeVisible()

    await assertClean()
  })

  test('Enter Bundle Draw opens and closes entry modal', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    await openLegacyBundleEntryFromHome(page)
    await expect(page.getByRole('heading', { name: /Enter — Signed Legacy Bundle/i })).toBeVisible()

    await closeEntryModal(page)
    await expect(page.getByRole('heading', { name: /Enter — Signed Legacy Bundle/i })).toBeHidden({
      timeout: 10_000,
    })

    await assertClean()
  })

  test('Prize lineup jumps to prize studio', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Prize lineup' }).click()
    await expect(page.locator('#prizes')).toBeInViewport()
  })

  test('stress: reload homepage and re-open entry five times', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)

    for (let i = 0; i < 5; i += 1) {
      await page.goto('/')
      await expect(page.getByRole('button', { name: 'Enter Bundle Draw' })).toBeVisible()
      await page.getByRole('button', { name: 'Enter Bundle Draw' }).click()
      await expect(page.getByRole('heading', { name: /Enter — Signed Legacy Bundle/i })).toBeVisible({
        timeout: 15_000,
      })
      await closeEntryModal(page)
      await expect(page.getByRole('heading', { name: /Enter — Signed Legacy Bundle/i })).toBeHidden({
        timeout: 10_000,
      })
    }

    await assertClean()
  })

  test('stress: rapid double-click Enter Bundle Draw does not break modal', async ({ page }) => {
    const assertClean = installPageErrorAsserter(page)
    await page.goto('/')
    const draw = page.getByRole('button', { name: 'Enter Bundle Draw' })
    await draw.dblclick()
    // Double-click may toggle open then closed; a third click should still open a single modal.
    if (!(await page.getByRole('heading', { name: /Enter — Signed Legacy Bundle/i }).isVisible().catch(() => false))) {
      await draw.click()
    }
    await expect(page.getByRole('heading', { name: /Enter — Signed Legacy Bundle/i })).toBeVisible({
      timeout: 15_000,
    })
    const modals = page.getByRole('heading', { name: /Enter — Signed Legacy Bundle/i })
    await expect(modals).toHaveCount(1)

    await assertClean()
  })
})
