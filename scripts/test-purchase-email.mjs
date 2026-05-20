/**
 * Send a sample purchase confirmation email (no payment).
 * Usage: npm run test:purchase-email -- you@example.com
 */
import { config } from 'dotenv'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PURCHASE_EMAIL_SAMPLE } from '../shared/purchaseConfirmationEmail.mjs'
import { sendPurchaseConfirmationEmail } from '../backend/api/lib/sendPurchaseEmail.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env.local') })
config({ path: join(root, '.env') })

const to = process.argv[2]?.trim()
if (!to || !to.includes('@')) {
  console.error('Usage: npm run test:purchase-email -- your@email.com')
  process.exit(1)
}

const key = process.env.RESEND_API_KEY?.trim()
if (!key || !key.startsWith('re_')) {
  console.error('Add RESEND_API_KEY=re_... to .env.local (from resend.com → API Keys), then retry.')
  process.exit(1)
}

const result = await sendPurchaseConfirmationEmail({
  to,
  customerFullName: PURCHASE_EMAIL_SAMPLE.customerFullName,
  bundleId: 'medium10',
  quantity: PURCHASE_EMAIL_SAMPLE.quantity,
  amountPence: PURCHASE_EMAIL_SAMPLE.amountPence,
  ticketNumbers: PURCHASE_EMAIL_SAMPLE.ticketNumbers,
  purchaseRef: 'ORD-TESTPREVIEW',
})

if (result.ok) {
  console.log(`Sent test email to ${to} (Resend id: ${result.id ?? 'ok'})`)
} else {
  console.error('Send failed:', result.error || result.reason || result)
  process.exit(1)
}
