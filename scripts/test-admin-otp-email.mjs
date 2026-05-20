/**
 * Test admin OTP email via Resend (same path as /api/admin/login).
 * Usage: npm run test:admin-email
 */
import { config } from 'dotenv'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sendAdminLoginOtpEmail, getAdminEmailSetupHint } from '../backend/api/lib/adminEmailOtp.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env.local') })
config({ path: join(root, '.env') })

const hint = getAdminEmailSetupHint()
if (hint) {
  console.error('Setup issue:', hint)
  process.exit(1)
}

const key = process.env.RESEND_API_KEY?.trim()
if (!key?.startsWith('re_')) {
  console.error('RESEND_API_KEY missing or invalid in .env')
  process.exit(1)
}

console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL)
console.log('RESEND_ACCOUNT_EMAIL:', process.env.RESEND_ACCOUNT_EMAIL || '(not set)')
console.log('From:', process.env.PURCHASE_EMAIL_FROM || '(sandbox onboarding@resend.dev)')

try {
  const sent = await sendAdminLoginOtpEmail()
  console.log('OK — code sent to:', sent.deliveredTo)
  if (sent.sandboxRedirect) {
    console.log('(Sandbox mode: check RESEND_ACCOUNT_EMAIL inbox, not ADMIN_EMAIL)')
  }
  console.log('Code (dev only):', sent.code)
} catch (e) {
  console.error('Failed:', e instanceof Error ? e.message : e)
  process.exit(1)
}
