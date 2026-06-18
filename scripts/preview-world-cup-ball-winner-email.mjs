/**
 * Preview World Cup Ball winner notification email (HTML + text).
 *
 *   npm run preview:world-cup-ball-winner-email
 *   npm run preview:world-cup-ball-winner-email -- --no-send
 *   npm run preview:world-cup-ball-winner-email -- --pending
 */
import { config as loadEnv } from 'dotenv'
import { resolve, join } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import {
  buildWorldCupBallWinnerEmailHtml,
  buildWorldCupBallWinnerEmailText,
  worldCupBallWinnerEmailSubject,
} from '../shared/worldCupBallWinnerEmail.mjs'
import { buildWorldCupBallClaimUrl } from '../shared/worldCupBallClaim.mjs'
import { DEV_PREVIEW_WC_BALL_CLAIM_TOKEN } from '../shared/devEmailPreview.mjs'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

const noSend = process.argv.includes('--no-send')
const pending = process.argv.includes('--pending')
const siteUrl = (process.env.SITE_URL || 'http://localhost:5173').replace(/\/$/, '')
const wonAt = new Date().toISOString()

const sample = {
  customerFullName: 'Alex Morgan',
  customerPhone: '+447700900456',
  winReference: 'WC-A1B2C3D4',
  siteUrl,
  wonAt,
  claimUrl: buildWorldCupBallClaimUrl(siteUrl, DEV_PREVIEW_WC_BALL_CLAIM_TOKEN),
  detailsComplete: !pending,
  forBrowserPreview: true,
}

const outDir = resolve(process.cwd(), 'public/email-previews')
mkdirSync(outDir, { recursive: true })
const suffix = pending ? '-pending' : ''
const htmlPath = join(outDir, `world-cup-ball-winner-email-preview${suffix}.html`)
const textPath = join(resolve(process.cwd(), 'tmp'), `world-cup-ball-winner-email-preview${suffix}.txt`)

const html = buildWorldCupBallWinnerEmailHtml(sample)
const text = buildWorldCupBallWinnerEmailText(sample)
const subject = worldCupBallWinnerEmailSubject(sample.detailsComplete)

writeFileSync(htmlPath, html, 'utf8')
writeFileSync(textPath, text, 'utf8')

console.log('World Cup Ball winner email preview written:')
console.log('  HTML:', htmlPath)
console.log('  Text:', textPath)
console.log('  Subject:', subject)
console.log('  Variant:', sample.detailsComplete ? 'details saved (after claim)' : 'action required (before claim)')
const previewUrl = `${siteUrl}/email-previews/world-cup-ball-winner-email-preview${suffix}.html`
console.log('  View in browser:', previewUrl)

try {
  if (process.platform === 'darwin') {
    execSync(`open "${previewUrl}"`, { stdio: 'ignore' })
  }
} catch {
  /* ignore */
}

if (noSend) {
  console.log('\nSkipped send (--no-send).')
  process.exit(0)
}

const { sendWorldCupBallWinnerEmail } = await import('../backend/api/lib/sendWorldCupBallWinnerEmail.mjs')
const { resendAccountEmail } = await import('../backend/api/lib/resendConfig.mjs')

const to = resendAccountEmail() || process.env.WINNER_PREVIEW_TO?.trim()
if (!to) {
  console.log(
    '\nTo receive a test copy in your inbox, set RESEND_ACCOUNT_EMAIL in .env.local (your Resend signup address).',
  )
  process.exit(0)
}

const result = await sendWorldCupBallWinnerEmail({ to, ...sample })

if (result.ok) {
  console.log(`\nTest World Cup Ball winner email sent to ${result.deliveredTo || to}`)
  if (result.sandboxRedirect) {
    console.log(`(Sandbox: redirected to ${result.deliveredTo})`)
  }
  console.log('Resend id:', result.id)
} else {
  console.error('\nSend failed:', result.error || result.reason || result)
  process.exit(1)
}
