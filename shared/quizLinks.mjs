/**
 * Public URL to reopen the post-payment skill quiz panel.
 * @param {string} [siteUrl]
 * @param {string} [resumeToken] — per-ticket secret; works on any device until quiz is submitted.
 */
export function buildCompleteQuizUrl(siteUrl, resumeToken) {
  const base = String(siteUrl || 'https://showskills.co.uk').replace(/\/$/, '')
  const params = new URLSearchParams({ 'complete-quiz': '1' })
  const token = typeof resumeToken === 'string' ? resumeToken.trim() : ''
  if (token.length >= 20) params.set('resume', token)
  return `${base}/competitions?${params.toString()}`
}
