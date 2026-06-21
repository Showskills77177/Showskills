import { chromium, devices } from 'playwright'

const browser = await chromium.launch()
const context = await browser.newContext({ ...devices['iPhone 13'] })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`))
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`) })
await page.goto('https://showskills.co.uk/competitions', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(3000)
console.log('URL:', page.url())
console.log('TITLE:', await page.title())
console.log('main count:', await page.locator('main').count())
console.log('body text slice:', (await page.locator('body').innerText()).slice(0, 800))
console.log('header visible:', await page.locator('header').isVisible())
console.log('mobile nav count:', await page.locator('.ss-mobile-nav-dock').count())
console.log('ERRORS:', errors)
await browser.close()
