/** YouTube Studio–style metadata options for Eyes Of Football. */

export const EOF_CONTENT_TYPES = [
  {
    id: 'short',
    label: 'Short',
    hint: 'Vertical or square (9:16) — length does not matter; YouTube treats vertical as Shorts',
  },
  { id: 'long', label: 'Long form', hint: 'Horizontal (16:9 etc.) — custom thumbnail supported' },
]

export const EOF_VISIBILITY_OPTIONS = [
  { id: 'private', label: 'Private', hint: 'Only you can see it' },
  { id: 'unlisted', label: 'Unlisted', hint: 'Anyone with the link' },
  { id: 'public', label: 'Public', hint: 'Everyone can find and watch' },
]

export const EOF_LICENSE_OPTIONS = [
  { id: 'youtube', label: 'Standard YouTube License' },
  { id: 'creativeCommon', label: 'Creative Commons — Attribution' },
]

export const EOF_LANGUAGE_OPTIONS = [
  { id: '', label: 'Default (none)' },
  { id: 'en', label: 'English' },
  { id: 'en-GB', label: 'English (UK)' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'es', label: 'Spanish' },
  { id: 'pt', label: 'Portuguese' },
  { id: 'it', label: 'Italian' },
  { id: 'ar', label: 'Arabic' },
  { id: 'hi', label: 'Hindi' },
  { id: 'ja', label: 'Japanese' },
]

/** Common YouTube categories (Sports = 17). */
export const EOF_YOUTUBE_CATEGORIES = [
  { id: '17', label: 'Sports' },
  { id: '22', label: 'People & Blogs' },
  { id: '24', label: 'Entertainment' },
  { id: '25', label: 'News & Politics' },
  { id: '26', label: 'Howto & Style' },
  { id: '27', label: 'Education' },
  { id: '28', label: 'Science & Technology' },
]

/**
 * Detect Short vs long from frame dimensions — NOT duration.
 * YouTube Shorts are vertical/square; long-form is typically landscape.
 */
export function detectVideoFormat({ width, height }) {
  if (!width || !height || width <= 0 || height <= 0) {
    return {
      formatId: 'long',
      isShort: false,
      isVertical: false,
      aspectRatio: null,
      aspectLabel: 'Unknown',
      width: width || 0,
      height: height || 0,
    }
  }

  const w = Math.round(width)
  const h = Math.round(height)
  const ratio = w / h
  const isVertical = h > w * 1.02
  const isSquare = ratio >= 0.92 && ratio <= 1.08
  const isShort = isVertical || isSquare

  let aspectLabel = `${w}×${h}`
  if (Math.abs(ratio - 9 / 16) < 0.08) aspectLabel = '9:16 Short'
  else if (Math.abs(ratio - 16 / 9) < 0.08) aspectLabel = '16:9 Long'
  else if (isSquare) aspectLabel = '1:1 Short'
  else if (isVertical) aspectLabel = `${w}×${h} vertical Short`
  else aspectLabel = `${w}×${h} landscape`

  return {
    formatId: isShort ? 'short' : 'long',
    isShort,
    isVertical: isVertical || isSquare,
    aspectRatio: Math.round(ratio * 1000) / 1000,
    aspectLabel,
    width: w,
    height: h,
  }
}

export function parseTagsInput(raw) {
  if (!raw || typeof raw !== 'string') return []
  return raw
    .split(/[,#]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((t) => t.slice(0, 100))
}

/** Append #Shorts for vertical uploads when enabled. */
export function applyShortsDescription(description, { isShort, addShortsHashtag }) {
  const base = String(description || '').trim()
  if (!isShort || !addShortsHashtag) return base
  if (/#shorts\b/i.test(base)) return base
  return base ? `${base}\n\n#Shorts` : '#Shorts'
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '—'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function calendarDayKey(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function projectCalendarDate(project) {
  return (
    calendarDayKey(project.scheduledAt) ||
    calendarDayKey(project.publishedAt) ||
    calendarDayKey(project.createdAt)
  )
}

export function gcd(a, b) {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

export function formatAspectRatio(width, height) {
  if (!width || !height) return '—'
  const d = gcd(width, height)
  return `${width / d}:${height / d}`
}
