import { escapeHtml, emailLogoUrl } from './purchaseConfirmationEmail.mjs'

/**
 * @param {{
 *   customerFullName: string
 *   allCorrect: boolean
 *   siteUrl: string
 * }} props
 */
export function buildQuizResultHtml(props) {
  const { customerFullName, allCorrect, siteUrl } = props
  const logoSrc = emailLogoUrl(siteUrl)

  if (allCorrect) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0c1a16;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1a16;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="padding:0 0 20px;text-align:center">
          <img src="${escapeHtml(logoSrc)}" alt="ShowSkills Rewards" width="156" style="display:block;margin:0 auto 12px;max-width:156px;height:auto;border:0" />
          <div style="font-size:22px;font-weight:700;color:#ecfdf5">You qualify for the draw</div>
          <div style="margin-top:6px;font-size:14px;color:#a8a29e">Ronaldo Legacy Bundle</div>
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#0f2922 0%,#0a1f19 100%);border:1px solid rgba(52,211,153,0.45);border-radius:16px;padding:28px 24px">
          <p style="margin:0 0 14px;font-size:16px;color:#e7e5e4">Hi ${escapeHtml(customerFullName || 'there')},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#d6d3d1">We checked your three skill answers: <strong style="color:#6ee7b7">all correct</strong>.</p>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#d6d3d1">You are in the pool for the random winner selection, subject to the site terms.</p>
        </td></tr>
        <tr><td style="padding:28px 12px 0;text-align:center;font-size:11px;line-height:1.5;color:#57534e">
          ShowSkills Rewards — skill-based promotion (UK).
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0c1a16;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1a16;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="padding:0 0 20px;text-align:center">
          <img src="${escapeHtml(logoSrc)}" alt="ShowSkills Rewards" width="156" style="display:block;margin:0 auto 12px;max-width:156px;height:auto;border:0" />
          <div style="font-size:22px;font-weight:700;color:#f5f5f4">Answers not correct</div>
          <div style="margin-top:6px;font-size:14px;color:#a8a29e">Ronaldo Legacy Bundle</div>
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#1c1412 0%,#0a1f19 100%);border:1px solid rgba(245,158,11,0.35);border-radius:16px;padding:28px 24px">
          <p style="margin:0 0 14px;font-size:16px;color:#e7e5e4">Hi ${escapeHtml(customerFullName || 'there')},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#d6d3d1">We checked your three skill answers: <strong style="color:#fbbf24">one or more were incorrect</strong>.</p>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#d6d3d1">Under the promotion terms you are not eligible for the prize draw on this entry. Your ticket purchase is not refunded.</p>
        </td></tr>
        <tr><td style="padding:28px 12px 0;text-align:center;font-size:11px;line-height:1.5;color:#57534e">
          ShowSkills Rewards — skill-based promotion (UK).
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export function buildQuizResultText(props) {
  const { customerFullName, allCorrect, siteUrl } = props
  if (allCorrect) {
    return [
      `Hi ${customerFullName || 'there'},`,
      '',
      'Ronaldo Legacy Bundle — skill question result',
      '',
      'All three of your answers were correct.',
      'You qualify for the random winner selection, subject to the site terms.',
      '',
      siteUrl,
    ].join('\n')
  }
  return [
    `Hi ${customerFullName || 'there'},`,
    '',
    'Ronaldo Legacy Bundle — skill question result',
    '',
    'One or more of your answers were incorrect.',
    'You are not eligible for the prize draw on this entry under the promotion terms.',
    'Your ticket purchase is not refunded.',
    '',
    siteUrl,
  ].join('\n')
}

export function quizResultSubject(allCorrect) {
  return allCorrect
    ? 'ShowSkills — you qualify for the Ronaldo Legacy Bundle draw'
    : 'ShowSkills — skill answers not correct'
}
