import { escapeHtml, emailLogoUrl } from './purchaseConfirmationEmail.mjs'

/**
 * Branded wrapper for one-off/admin-composed emails sent from sales@showskills.co.uk
 * (e.g. winner follow-ups, cheque re-sends, support replies).
 *
 * @param {{
 *   subject: string
 *   message: string
 *   recipientName?: string
 *   siteUrl: string
 *   forBrowserPreview?: boolean
 *   sandboxNote?: string
 * }} props
 */
export function buildSalesEmailHtml(props) {
  const { subject, message, recipientName, siteUrl, forBrowserPreview = false, sandboxNote } = props
  const logoSrc = emailLogoUrl(siteUrl, { forBrowserPreview: Boolean(forBrowserPreview) })
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : 'Hi there,'
  const bodyHtml = escapeHtml(message || '')
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#e7e5e4">${para.replace(/\n/g, '<br/>')}</p>`)
    .join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0c0a09;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0a09;padding:24px 0">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#1c1917;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:28px">
            <tr>
              <td align="center" style="padding-bottom:18px">
                <img src="${escapeHtml(logoSrc)}" alt="ShowSkills Rewards" width="156" height="auto" style="display:block;margin:0 auto 12px;max-width:156px;height:auto;border:0" />
              </td>
            </tr>
            <tr>
              <td>
                <p style="margin:0 0 14px;font-size:16px;color:#e7e5e4">${greeting}</p>
                ${bodyHtml}
                ${
                  sandboxNote
                    ? `<p style="margin:16px 0 0;font-size:11px;color:#fbbf24;background:#292524;border-radius:6px;padding:8px 10px">${escapeHtml(sandboxNote)}</p>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="padding-top:22px;border-top:1px solid rgba(255,255,255,0.08);margin-top:18px">
                <p style="margin:18px 0 0;font-size:12px;color:#78716c">
                  ShowSkills Rewards · <a href="${escapeHtml(siteUrl)}" style="color:#a8a29e">showskills.co.uk</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function buildSalesEmailText(props) {
  const { message, recipientName, siteUrl } = props
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,'
  return `${greeting}\n\n${message || ''}\n\n— ShowSkills Rewards\n${siteUrl}`
}
