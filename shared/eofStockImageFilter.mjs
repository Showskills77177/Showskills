/**
 * Block watermarked / banner stock hosts (Getty, Shutterstock, …).
 * Titles alone lie; host + title cues are the cheap pre-vision gate.
 */

const BLOCKED_HOST =
  /\b(gettyimages|media\.gettyimages|static\.gettyimages|shutterstock|alamy|istockphoto|istock\.com|depositphotos|adobestock|stock\.adobe|dreamstime|123rf|foap\.com|imagebank\.|getty\.)\b/i

const BLOCKED_TITLE =
  /\b(getty\s*images?|shutterstock|alamy|iStock|depositphotos|adobe\s*stock|watermark|rights[\s-]?managed|editorial\s*use\s*only\s*banner)\b/i

/**
 * @param {string} url
 * @param {string} [title]
 */
export function isBlockedStockImageUrl(url, title = '') {
  const u = String(url || '').trim()
  if (!u) return true
  if (BLOCKED_HOST.test(u)) return true
  if (BLOCKED_TITLE.test(String(title || ''))) return true
  return false
}

/**
 * Filter SERP rows; drops Getty/banner stock before we burn download/vision time.
 * @template {{ url?: string, title?: string|null }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function filterBlockedStockImages(rows) {
  if (!Array.isArray(rows)) return []
  return rows.filter((row) => !isBlockedStockImageUrl(row?.url, row?.title))
}
