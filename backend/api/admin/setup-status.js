import { adminAuthConfigStatus, isAdminAuthConfigured } from '../lib/adminAuth.mjs'
import {
  isAdminEmailOtpConfigured,
  isAdminEmailOtpBypassed,
  getAdminEmailSetupHint,
  adminEmail,
  maskAdminEmail,
} from '../lib/adminEmailOtp.mjs'
import { getResendApiKey, isResendProductionMode, resolveResendFrom } from '../lib/resendConfig.mjs'
import { json } from '../lib/http.mjs'

/** Safe diagnostics for admin login page (no secrets). */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const auth = adminAuthConfigStatus()
  const hasResendKey = Boolean(getResendApiKey())
  const hasAdminEmail = Boolean(adminEmail().includes('@'))
  const otpBypassed = isAdminEmailOtpBypassed()
  const emailOtp = isAdminEmailOtpConfigured() && !otpBypassed
  const hint = otpBypassed ? null : getAdminEmailSetupHint()
  const missingEmail = []
  if (!hasResendKey) missingEmail.push('RESEND_API_KEY')
  if (!hasAdminEmail) missingEmail.push('ADMIN_EMAIL')

  return json(res, 200, {
    ok: true,
    adminAuthConfigured: isAdminAuthConfigured(),
    adminAuthMissing: auth.missing,
    emailOtpEnabled: emailOtp,
    emailOtpBypassed: otpBypassed,
    emailOtpHint: hint,
    emailOtpMissing: missingEmail,
    hasResendKey,
    hasAdminEmail,
    maskedAdminEmail: hasAdminEmail ? maskAdminEmail() : null,
    resendProductionMode: isResendProductionMode(),
    fromAddress: resolveResendFrom().replace(/<[^>]+>/, '…'),
    vercelEnv: process.env.VERCEL_ENV || null,
  })
}
