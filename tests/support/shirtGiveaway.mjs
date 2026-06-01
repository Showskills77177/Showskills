/** Fill the free shirt giveaway modal with valid test data (E2E). */
export async function fillShirtGiveawayForm(page, { name, email, answer = 'Ronaldo R9', phone = '07123456789' }) {
  await page.getByLabel(/Full name/i).first().fill(name)
  await page.getByLabel(/Qualification question/i).fill(answer)
  await page.getByLabel(/^Email$/i).fill(email)
  await page.locator('#modal-kick-phone').fill(phone)
  await page.getByRole('checkbox', { name: /Subscribe me to ShowSkills/i }).check()
  await page.locator('label:has(input[name="kick-social-platform"][value="tiktok"])').click()
  await page.locator('#modal-kick-social-handle').fill('e2e_test_user')
  await page.getByRole('checkbox', { name: /I have followed ShowSkills/i }).check()
  await page.getByRole('checkbox', { name: /I agree to the/i }).check()
}
