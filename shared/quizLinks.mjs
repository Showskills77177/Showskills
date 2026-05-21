/** Public URL to reopen the post-payment skill quiz panel. */
export function buildCompleteQuizUrl(siteUrl) {
  const base = String(siteUrl || 'https://showskills.co.uk').replace(/\/$/, '')
  return `${base}/competitions?complete-quiz=1`
}
