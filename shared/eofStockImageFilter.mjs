/**
 * Block watermarked / banner stock hosts (Getty, Shutterstock, …)
 * and meme/quote graphics that already have captions burned into the pixels
 * (those stack under our ffmpeg drawtext and look like “doubled captions”).
 * Titles alone lie; host + title cues are the cheap pre-vision gate.
 */

const BLOCKED_HOST =
  /\b(gettyimages|media\.gettyimages|static\.gettyimages|shutterstock|alamy|istockphoto|istock\.com|depositphotos|adobestock|stock\.adobe|dreamstime|123rf|foap\.com|imagebank\.|getty\.)\b/i

const BLOCKED_TITLE =
  /\b(getty\s*images?|shutterstock|alamy|iStock|depositphotos|adobe\s*stock|watermark|rights[\s-]?managed|editorial\s*use\s*only\s*banner)\b/i

/** Meme generators + quote-card CDNs — always caption-contaminated. */
const MEME_HOST =
  /\b(imgflip\.com|memegenerator\.net|makeameme\.org|memecenter\.com|memeful\.com|quickmeme\.com|livememe\.com|topeleven\.com\/meme)\b/i

/**
 * Titles/URLs that scream “already has big on-image text” (viral quote cards, memes).
 * Rooney staging double-caption: meme still “ROONEY HAS VERY STRONG SPERM!” + beast burn.
 */
const CAPTION_CONTAMINATED =
  /\b(meme|mematic|imgflip|make\s*a\s*meme|meme\s*generator|viral\s*quote|quote\s*card|quote\s*graphic|motivational\s*quote|instagram\s*quote|twitter\s*quote|tweet\s*screenshot|has\s+very\s+strong|strong\s+sperm|\bsperm\b|text\s*overlay\s*meme|captioned\s*meme|going\s+bananas|you\s+won'?t\s+believe|clickbait\s*thumbnail|thumbnail\s*text|with\s+text\s+overlay)\b/i

/** All-caps clickbait / YouTube-thumbnail titles with baked-in headline text. */
const ALL_CAPS_CLICKBAIT = /^[A-Z0-9][A-Z0-9\s!'?.,-]{18,}[!?]*$/

/**
 * True when the still is a meme/quote graphic likely to already contain burned-in captions.
 * @param {string} url
 * @param {string} [title]
 */
export function isCaptionContaminatedStill(url, title = '') {
  const u = String(url || '').trim()
  const t = String(title || '').trim()
  const hay = `${u} ${t}`
  if (!hay.trim()) return false
  if (MEME_HOST.test(u)) return true
  if (CAPTION_CONTAMINATED.test(hay)) return true
  // “THOMAS TUCHEL IS GOING BANANAS!”-style thumbnail plates
  if (t.length >= 20 && ALL_CAPS_CLICKBAIT.test(t)) return true
  return false
}

/**
 * @param {string} url
 * @param {string} [title]
 */
export function isBlockedStockImageUrl(url, title = '') {
  const u = String(url || '').trim()
  if (!u) return true
  if (BLOCKED_HOST.test(u)) return true
  if (BLOCKED_TITLE.test(String(title || ''))) return true
  if (isCaptionContaminatedStill(u, title)) return true
  return false
}

/**
 * Filter SERP rows; drops Getty/banner stock + caption-contaminated memes
 * before we burn download/vision time.
 * @template {{ url?: string, title?: string|null }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function filterBlockedStockImages(rows) {
  if (!Array.isArray(rows)) return []
  return rows.filter((row) => !isBlockedStockImageUrl(row?.url, row?.title))
}
