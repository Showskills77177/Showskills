import { escapeHtml, resolvePublicSiteUrlForEmail } from './purchaseConfirmationEmail.mjs'
import { wrapNewsletterEmailDocument } from './newsletterEmail.mjs'

const CODE_EXPIRY_MINUTES = 15

function ctaButtonHtml(href, label) {
  if (!href || !label) return ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px">
    <tr><td style="border-radius:12px;background:linear-gradient(90deg,#65a30d,#059669)">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${escapeHtml(label)}</a>
    </td></tr>
  </table>`
}

function codePanelHtml(code) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:rgba(0,0,0,0.35);border-radius:12px;border:1px solid rgba(132,204,22,0.45)">
    <tr>
      <td style="padding:22px 16px;text-align:center">
        <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#86efac">Your verification code</p>
        <p style="margin:0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:0.28em;color:#ecfccb">${escapeHtml(code)}</p>
      </td>
    </tr>
  </table>`
}

/**
 * @param {{ purpose?: 'reset' | 'claim' }} [opts]
 */
export function userPasswordResetEmailSubject({ purpose = 'reset' } = {}) {
  if (purpose === 'claim') return 'Verify your email — ShowSkills Rewards'
  return 'Your ShowSkills password reset code'
}

/**
 * @param {{
 *   code: string
 *   siteUrl: string
 *   fullName?: string
 *   purpose?: 'reset' | 'claim'
 * }} props
 */
export function buildUserPasswordResetEmailHtml(props) {
  const { code, fullName, purpose = 'reset' } = props
  const siteUrl = resolvePublicSiteUrlForEmail(props.siteUrl)
  const name = String(fullName || '').trim() || 'there'
  const isClaim = purpose === 'claim'

  const headline = isClaim ? 'Secure your account' : 'Reset your password'
  const subtitle = 'ShowSkills Rewards'
  const intro = isClaim
    ? 'You asked to set a password for an email already linked to a ShowSkills order. Enter this code on the site to verify your email and choose a password.'
    : 'You asked to reset your ShowSkills Rewards password. Enter this code on the site to choose a new password.'

  const forgotUrl = `${siteUrl}/forgot-password`

  const inner = `
    <p style="margin:0 0 14px;font-size:16px;color:#e7e5e4">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#d6d3d1">${escapeHtml(intro)}</p>
    ${codePanelHtml(code)}
    <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#fde68a">
      <strong style="color:#fef3c7">Expires in ${CODE_EXPIRY_MINUTES} minutes.</strong>
      If you did not request this, you can ignore this email — your password will stay the same.
    </p>
    ${ctaButtonHtml(forgotUrl, isClaim ? 'Verify & set password' : 'Enter reset code')}
    <p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#78716c">
      Or open <a href="${escapeHtml(siteUrl)}" style="color:#6ee7b7;text-decoration:underline">${escapeHtml(siteUrl)}</a> and use Forgot password.
    </p>
  `

  return wrapNewsletterEmailDocument({
    siteUrl,
    title: headline,
    headline,
    subtitle,
    innerHtml: inner,
    accent: 'lime',
    showShellFooter: true,
    headerMode: 'full',
  })
}

/**
 * @param {{
 *   code: string
 *   siteUrl: string
 *   fullName?: string
 *   purpose?: 'reset' | 'claim'
 * }} props
 */
export function buildUserPasswordResetEmailText(props) {
  const { code, fullName, purpose = 'reset' } = props
  const siteUrl = resolvePublicSiteUrlForEmail(props.siteUrl)
  const name = String(fullName || '').trim() || 'there'
  const isClaim = purpose === 'claim'

  const lines = [
    `Hi ${name},`,
    '',
    isClaim
      ? 'Verify your email to set a password for your ShowSkills Rewards account.'
      : 'You asked to reset your ShowSkills Rewards password.',
    '',
    `Your verification code: ${code}`,
    '',
    `This code expires in ${CODE_EXPIRY_MINUTES} minutes.`,
    'If you did not request this, ignore this email — your password will stay the same.',
    '',
    `Open ${siteUrl}/forgot-password to enter the code.`,
    '',
    siteUrl,
  ]
  return lines.join('\n')
}
