import { escapeHtml, emailLogoUrl, resolvePublicSiteUrlForEmail } from './purchaseConfirmationEmail.mjs'
import { mergeEmailLayout } from './emailLayout.mjs'
import {
  buildCampaignContentLayout,
  campaignImageUrls,
  normalizeCampaignImages,
} from './newsletterCampaignImages.mjs'

export const NEWSLETTER_EMAIL_SAMPLE = {
  siteUrl: 'https://showskills.co.uk',
  preferencesUrl: 'https://showskills.co.uk/newsletter/preferences?token=PREVIEW_TOKEN',
  unsubscribeUrl: 'https://showskills.co.uk/newsletter/unsubscribe?token=PREVIEW_TOKEN',
}

const SHELL_FOOTER = 'ShowSkills Rewards — skill-based promotion (UK).'
const CAMPAIGN_TEXT_COLOR = '#d6d3d1'
const CAMPAIGN_TEXT_STYLE = `color:${CAMPAIGN_TEXT_COLOR};font-size:15px;line-height:1.55`

function ctaButtonHtml(href, label) {
  if (!href || !label) return ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px">
    <tr><td style="border-radius:12px;background:linear-gradient(90deg,#65a30d,#059669)">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${escapeHtml(label)}</a>
    </td></tr>
  </table>`
}

function manageLinksHtml(preferencesUrl, unsubscribeUrl, { centered = false } = {}) {
  const pref = preferencesUrl ? escapeHtml(preferencesUrl) : ''
  const unsub = unsubscribeUrl ? escapeHtml(unsubscribeUrl) : ''
  if (!pref && !unsub) return ''
  const align = centered ? 'center' : 'left'
  return `<p style="margin:0;font-size:12px;line-height:1.55;color:#78716c;text-align:${align}">
    ${pref ? `<a href="${pref}" style="color:#6ee7b7;text-decoration:underline">Email preferences</a>` : ''}
    ${pref && unsub ? ' · ' : ''}
    ${unsub ? `<a href="${unsub}" style="color:#6ee7b7;text-decoration:underline">Unsubscribe</a>` : ''}
  </p>`
}

function looksLikeHtml(value) {
  return /<\s*[a-z][^>]*>/i.test(String(value || ''))
}

/** Add light text color to HTML blocks that do not already set one (email clients ignore inheritance). */
function ensureCampaignHtmlTextColor(html) {
  return String(html || '').replace(/<(p|div|span|li|td|h[1-6])(\s[^>]*)?>/gi, (match, tag, attrs = '') => {
    const chunk = attrs || ''
    if (/color\s*:/i.test(chunk)) return match
    const styleMatch = /style\s*=\s*["']([^"']*)["']/i.exec(chunk)
    if (styleMatch) {
      return match.replace(styleMatch[0], `style="${styleMatch[1]};color:${CAMPAIGN_TEXT_COLOR}"`)
    }
    return `<${tag}${chunk} style="color:${CAMPAIGN_TEXT_COLOR}">`
  })
}

/** Preserve plain-text line breaks; ensure HTML body text is readable on the dark panel. */
export function normalizeCampaignBodyHtml(bodyHtml) {
  const raw = String(bodyHtml || '').trim()
  if (!raw) return ''
  if (looksLikeHtml(raw)) {
    return `<div style="${CAMPAIGN_TEXT_STYLE}">${ensureCampaignHtmlTextColor(raw)}</div>`
  }

  const paragraphs = escapeHtml(raw).split(/\n{2,}/)
  return `<div style="${CAMPAIGN_TEXT_STYLE}">${paragraphs
    .map((block) => {
      const lines = block.split(/\n/).join('<br />')
      return `<p style="margin:0 0 14px;${CAMPAIGN_TEXT_STYLE}">${lines}</p>`
    })
    .join('')}</div>`
}

/**
 * Branded email shell matching ticket confirmation emails (dark green card, logo header).
 * Campaign emails: logo only, content panel, manage links below the panel.
 */
export function wrapNewsletterEmailDocument({
  siteUrl,
  title,
  headline = '',
  subtitle = '',
  innerHtml,
  preferencesUrl,
  unsubscribeUrl,
  accent = 'lime',
  showShellFooter = true,
  manageLinksBelowPanel = false,
  headerMode = 'full',
}) {
  const logoSrc = emailLogoUrl(siteUrl)
  const borderColor = accent === 'lime' ? 'rgba(132,204,22,0.45)' : 'rgba(52,211,153,0.35)'
  const headlineColor = accent === 'lime' ? '#ecfccb' : '#f5f5f4'
  const showHeaderText =
    headerMode !== 'logo-only' && Boolean(String(headline || '').trim() || String(subtitle || '').trim())
  const manageLinks = manageLinksHtml(preferencesUrl, unsubscribeUrl, { centered: manageLinksBelowPanel })
  const panelInner = manageLinksBelowPanel ? innerHtml : `${innerHtml}${manageLinks}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0c1a16;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1a16;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
          <tr>
            <td style="padding:0 0 ${showHeaderText ? '20px' : '16px'};text-align:center">
              <img src="${escapeHtml(logoSrc)}" alt="ShowSkills Rewards" width="156" height="auto" style="display:block;margin:0 auto;max-width:156px;height:auto;border:0" />
              ${showHeaderText && headline ? `<div style="margin-top:12px;font-size:22px;font-weight:700;color:${headlineColor};line-height:1.25">${escapeHtml(headline)}</div>` : ''}
              ${showHeaderText && subtitle ? `<div style="margin-top:6px;font-size:14px;color:#a8a29e">${escapeHtml(subtitle)}</div>` : ''}
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(180deg,#0f2922 0%,#0a1f19 100%);border:1px solid ${borderColor};border-radius:16px;padding:28px 24px;${CAMPAIGN_TEXT_STYLE}">
              ${panelInner}
            </td>
          </tr>
          ${manageLinksBelowPanel && manageLinks ? `<tr><td style="padding:16px 8px 0">${manageLinks}</td></tr>` : ''}
          ${showShellFooter ? `<tr>
            <td style="padding:28px 12px 0;text-align:center;font-size:11px;line-height:1.5;color:#57534e">
              ${escapeHtml(SHELL_FOOTER)}
            </td>
          </tr>` : ''}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildWelcomeEmailHtml(layoutInput, urls = {}) {
  const layout = mergeEmailLayout(layoutInput)
  const w = layout.welcome
  const siteUrl = String(urls.siteUrl || NEWSLETTER_EMAIL_SAMPLE.siteUrl).replace(/\/$/, '')
  const ctaHref = `${siteUrl}${w.ctaPath.startsWith('/') ? w.ctaPath : `/${w.ctaPath}`}`

  const inner = `
    <p style="margin:0 0 14px;font-size:16px;color:#e7e5e4">${escapeHtml(w.greeting)}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#d6d3d1">${escapeHtml(w.paragraph1)}</p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:#d6d3d1">${escapeHtml(w.paragraph2)}</p>
    ${ctaButtonHtml(ctaHref, w.ctaLabel)}
  `

  return wrapNewsletterEmailDocument({
    siteUrl,
    title: w.subject,
    headline: w.headline,
    subtitle: w.subtitle,
    innerHtml: inner,
    preferencesUrl: urls.preferencesUrl,
    unsubscribeUrl: urls.unsubscribeUrl,
    accent: 'lime',
  })
}

export function buildWelcomeEmailText(layoutInput, urls = {}) {
  const layout = mergeEmailLayout(layoutInput)
  const w = layout.welcome
  const siteUrl = String(urls.siteUrl || NEWSLETTER_EMAIL_SAMPLE.siteUrl).replace(/\/$/, '')
  const ctaHref = `${siteUrl}${w.ctaPath.startsWith('/') ? w.ctaPath : `/${w.ctaPath}`}`
  const lines = [
    w.headline,
    w.subtitle,
    '',
    w.greeting,
    '',
    w.paragraph1,
    '',
    w.paragraph2,
    '',
    `${w.ctaLabel}: ${ctaHref}`,
    '',
  ]
  if (urls.preferencesUrl) lines.push(`Preferences: ${urls.preferencesUrl}`, '')
  if (urls.unsubscribeUrl) lines.push(`Unsubscribe: ${urls.unsubscribeUrl}`, '')
  lines.push(SHELL_FOOTER)
  return lines.join('\n')
}

export function welcomeEmailSubject(layoutInput) {
  return mergeEmailLayout(layoutInput).welcome.subject
}

/** @deprecated Use normalizeCampaignImages — kept for plain-text exports. */
export function normalizeCampaignImageUrls(input) {
  return campaignImageUrls(input)
}

export { normalizeCampaignImages, defaultCampaignImage, CAMPAIGN_IMAGE_PLACEMENTS } from './newsletterCampaignImages.mjs'

/** Campaign shell — logo + panel only. No headline, subtitle, or footer tagline. */
function buildCampaignEmailDocument({ siteUrl, title, innerHtml, preferencesUrl, unsubscribeUrl }) {
  const logoSrc = emailLogoUrl(siteUrl)
  const manageLinks = manageLinksHtml(preferencesUrl, unsubscribeUrl, { centered: true })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0c1a16;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1a16;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
          <tr>
            <td style="background:linear-gradient(180deg,#0f2922 0%,#0a1f19 100%);border:1px solid rgba(132,204,22,0.45);border-radius:16px;padding:28px 24px;${CAMPAIGN_TEXT_STYLE}">
              <p style="margin:0 0 20px;text-align:center">
                <img src="${escapeHtml(logoSrc)}" alt="" width="156" height="auto" style="display:block;margin:0 auto;max-width:156px;height:auto;border:0" />
              </p>
              ${innerHtml}
            </td>
          </tr>
          ${manageLinks ? `<tr><td style="padding:16px 8px 0">${manageLinks}</td></tr>` : ''}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Campaign: editable inner content inside branded panel (no letterhead text). */
export function buildCampaignEmailHtml(
  layoutInput,
  { siteUrl, bodyHtml, imageUrls, campaignImages, preferencesUrl, unsubscribeUrl } = {},
) {
  const layout = mergeEmailLayout(layoutInput)
  const c = layout.campaign
  const site = resolvePublicSiteUrlForEmail(siteUrl || NEWSLETTER_EMAIL_SAMPLE.siteUrl)
  const innerBody = normalizeCampaignBodyHtml(bodyHtml ?? c.bodyHtml)
  const images = normalizeCampaignImages(campaignImages ?? imageUrls)
  const inner = buildCampaignContentLayout(innerBody, images)

  return buildCampaignEmailDocument({
    siteUrl: site,
    title: c.defaultSubject,
    innerHtml: inner,
    preferencesUrl,
    unsubscribeUrl,
  })
}

export function buildCampaignEmailText(
  layoutInput,
  { bodyHtml, imageUrls, campaignImages, preferencesUrl, unsubscribeUrl } = {},
) {
  const layout = mergeEmailLayout(layoutInput)
  const c = layout.campaign
  const inner = stripHtml(String(bodyHtml ?? c.bodyHtml))
  const urls = campaignImageUrls(campaignImages ?? imageUrls)
  const lines = []
  if (urls.length) {
    lines.push(...urls, '')
  }
  lines.push(inner, '')
  if (preferencesUrl) lines.push(`Preferences: ${preferencesUrl}`, '')
  if (unsubscribeUrl) lines.push(`Unsubscribe: ${unsubscribeUrl}`, '')
  return lines.join('\n').trim()
}

export function campaignDefaultSubject(layoutInput) {
  return mergeEmailLayout(layoutInput).campaign.defaultSubject
}

function stripHtml(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
