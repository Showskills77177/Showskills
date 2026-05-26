/**
 * Preview winner notification email (HTML file) and optionally send to Resend sandbox inbox.
 *
 *   npm run preview:winner-email          # open preview + send if RESEND_API_KEY set
 *   npm run preview:winner-email -- --no-send
 */
import { config as loadEnv } from 'dotenv'
import { resolve, join } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import {
  buildWinnerEmailHtml,
  buildWinnerEmailText,
  winnerEmailSubject,
} from '../shared/winnerNotificationEmail.mjs'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

const noSend = process.argv.includes('--no-send')
const siteUrl = (process.env.SITE_URL || 'https://showskills.co.uk').replace(/\/$/, '')
const drawnAt = new Date().toISOString()

const sample = {
  customerFullName: 'James Smith',
  customerPhone: '+447700900123',
  winningTicketNumber: 'SS-A1B2C3D4',
  periodTitle: 'Ronaldo Bundle Test 3',
  siteUrl,
  orderRef: 'ORD-TEST1234',
  drawnAt,
}

const outDir = resolve(process.cwd(), 'tmp')
mkdirSync(outDir, { recursive: true })
const htmlPath = join(outDir, 'winner-email-preview.html')
const textPath = join(outDir, 'winner-email-preview.txt')

const html = buildWinnerEmailHtml(sample)
const text = buildWinnerEmailText(sample)
const subject = winnerEmailSubject(sample.periodTitle)

writeFileSync(htmlPath, html, 'utf8')
writeFileSync(textPath, text, 'utf8')

console.log('Winner email preview written:')
console.log('  HTML:', htmlPath)
console.log('  Text:', textPath)
console.log('  Subject:', subject)

try {
  if (process.platform === 'darwin') {
    execSync(`open "${htmlPath}"`, { stdio: 'ignore' })
  }
} catch {
  /* ignore */
}

if (noSend) {
  console.log('\nSkipped send (--no-send).')
  process.exit(0)
}

const { sendWinnerNotificationEmail } = await import('../backend/api/lib/sendWinnerEmail.mjs')
const { resendAccountEmail } = await import('../backend/api/lib/resendConfig.mjs')

const to = resendAccountEmail() || process.env.WINNER_PREVIEW_TO?.trim()
if (!to) {
  console.log('\nTo receive a test copy in your inbox, set RESEND_ACCOUNT_EMAIL in .env.local (your Resend signup address).')
  process.exit(0)
}

const result = await sendWinnerNotificationEmail({
  to,
  ...sample,
})

if (result.ok) {
  console.log(`\nTest winner email sent to ${result.deliveredTo || to}`)
  if (result.sandboxRedirect) {
    console.log(`(Sandbox: intended winner would be test3-001@test3-bulk.local.test — check ${result.deliveredTo})`)
  }
  console.log('Resend id:', result.id)
} else {
  console.error('\nSend failed:', result.error || result.reason || result)
  process.exit(1)
}
