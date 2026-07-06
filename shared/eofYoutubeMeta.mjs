/** YouTube Studio–style metadata options for Eyes Of Football. */

export const EOF_CONTENT_TYPES = [
  { id: 'short', label: 'Short', hint: 'Vertical, under 60 seconds' },
  { id: 'long', label: 'Long form', hint: 'Standard video — custom thumbnail supported' },
]

export const EOF_VISIBILITY_OPTIONS = [
  { id: 'private', label: 'Private', hint: 'Only you can see it' },
  { id: 'unlisted', label: 'Unlisted', hint: 'Anyone with the link' },
  { id: 'public', label: 'Public', hint: 'Everyone can find and watch' },
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

export function parseTagsInput(raw) {
  if (!raw || typeof raw !== 'string') return []
  return raw
    .split(/[,#]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((t) => t.slice(0, 100))
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

/** Calendar day key YYYY-MM-DD in local TZ. */
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
