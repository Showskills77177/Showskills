/** Admin/test summaries that must not appear on the public site. */
const HIDDEN_PUBLIC_SUMMARIES = new Set([
  'updated from catalog test',
  'created from catalog test',
])

export function publicCompetitionSummary(competition, fallback) {
  const raw = (competition?.summary || '').trim()
  if (!raw || HIDDEN_PUBLIC_SUMMARIES.has(raw.toLowerCase())) return fallback
  return raw
}
