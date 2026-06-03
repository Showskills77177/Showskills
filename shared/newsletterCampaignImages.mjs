import { escapeHtml } from './purchaseConfirmationEmail.mjs'

export const CAMPAIGN_IMAGE_PLACEMENTS = ['above', 'below', 'left', 'right']

const DEFAULT_WIDTH = {
  above: 472,
  below: 472,
  left: 168,
  right: 168,
}

/** @typedef {{ url: string, width?: number, placement?: string }} CampaignImageInput */

export function defaultCampaignImage(url, placement = 'above') {
  const p = CAMPAIGN_IMAGE_PLACEMENTS.includes(placement) ? placement : 'above'
  return {
    url: String(url || '').trim(),
    width: DEFAULT_WIDTH[p],
    placement: p,
  }
}

export function normalizeCampaignImageWidth(width, placement = 'above') {
  const p = CAMPAIGN_IMAGE_PLACEMENTS.includes(placement) ? placement : 'above'
  const n = Number(width)
  const max = p === 'above' || p === 'below' ? 472 : 220
  const min = p === 'above' || p === 'below' ? 160 : 80
  if (!Number.isFinite(n)) return DEFAULT_WIDTH[p]
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Accept legacy string URLs or image objects from the admin UI. */
export function normalizeCampaignImages(input) {
  if (!Array.isArray(input)) return []
  const out = []
  for (const raw of input) {
    let img = null
    if (typeof raw === 'string') {
      const url = raw.trim()
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('cid:')) continue
      img = defaultCampaignImage(url)
    } else if (raw && typeof raw === 'object') {
      const url = String(raw.url || raw.src || '').trim()
      if (!url) continue
      const placement = CAMPAIGN_IMAGE_PLACEMENTS.includes(raw.placement) ? raw.placement : 'above'
      img = {
        url,
        width: normalizeCampaignImageWidth(raw.width, placement),
        placement,
      }
    }
    if (!img) continue
    const key = `${img.url}|${img.placement}|${img.width}`
    if (out.some((x) => `${x.url}|${x.placement}|${x.width}` === key)) continue
    out.push(img)
    if (out.length >= 5) break
  }
  return out
}

export function campaignImageUrls(images) {
  return normalizeCampaignImages(images).map((img) => img.url)
}

function buildCampaignImageTag({ url, width, placement }) {
  const w = normalizeCampaignImageWidth(width, placement)
  const align = placement === 'left' ? 'left' : placement === 'right' ? 'right' : 'center'
  return `<img src="${escapeHtml(url)}" alt="" width="${w}" style="display:block;max-width:100%;width:${w}px;height:auto;border:0;border-radius:12px;margin:0${align === 'center' ? ' auto' : ''}" />`
}

function wrapImageBlock(html, { centered = false, gap = '16px' } = {}) {
  if (!html) return ''
  const align = centered ? 'center' : 'left'
  return `<p style="margin:0 0 ${gap};text-align:${align}">${html}</p>`
}

function buildStackedImagesHtml(images, { centered = false } = {}) {
  return images.map((img) => wrapImageBlock(buildCampaignImageTag(img), { centered })).join('')
}

function buildSideColumnHtml(images) {
  return images.map((img) => wrapImageBlock(buildCampaignImageTag(img), { gap: '12px' })).join('')
}

/**
 * Compose body text + images for email-safe table layout.
 * @param {string} bodyHtml
 * @param {CampaignImageInput[]} imageInput
 */
export function buildCampaignContentLayout(bodyHtml, imageInput) {
  const images = normalizeCampaignImages(imageInput)
  const body = String(bodyHtml || '')
  if (!images.length) return body

  const above = images.filter((img) => img.placement === 'above')
  const below = images.filter((img) => img.placement === 'below')
  const left = images.filter((img) => img.placement === 'left')
  const right = images.filter((img) => img.placement === 'right')

  const aboveHtml = buildStackedImagesHtml(above, { centered: true })
  const belowHtml = buildStackedImagesHtml(below, { centered: true })

  let middle = body
  if (left.length || right.length) {
    const leftWidth = left.length ? Math.max(...left.map((img) => normalizeCampaignImageWidth(img.width, 'left'))) : 0
    const rightWidth = right.length ? Math.max(...right.map((img) => normalizeCampaignImageWidth(img.width, 'right'))) : 0
    middle = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0">
      <tr>
        ${
          left.length
            ? `<td width="${leftWidth}" valign="top" style="width:${leftWidth}px;padding:0 16px 0 0;vertical-align:top">${buildSideColumnHtml(left)}</td>`
            : ''
        }
        <td valign="top" style="vertical-align:top">${body}</td>
        ${
          right.length
            ? `<td width="${rightWidth}" valign="top" style="width:${rightWidth}px;padding:0 0 0 16px;vertical-align:top">${buildSideColumnHtml(right)}</td>`
            : ''
        }
      </tr>
    </table>`
  }

  return `${aboveHtml}${middle}${belowHtml}`
}
