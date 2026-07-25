/**
 * Fix common football name typos before desk research / image search.
 * Cuccorea / Cuccurella → Cucurella; Mark Cucurella → Marc Cucurella.
 * @param {string} topic
 */
export function normalizeFootballTopicQuery(topic) {
  let t = String(topic || '').trim()
  if (!t) return t
  t = t.replace(/\bcuccorea\b/gi, 'Cucurella')
  t = t.replace(/\bcuccorella\b/gi, 'Cucurella')
  t = t.replace(/\bcuccurella\b/gi, 'Cucurella')
  t = t.replace(/\bmark\s+(cucurella)\b/gi, 'Marc $1')
  return t
}
