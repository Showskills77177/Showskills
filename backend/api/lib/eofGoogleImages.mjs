export function isEofGoogleCseConfigured() {
  const key = (
    process.env.GOOGLE_CSE_API_KEY ||
    process.env.EOF_GOOGLE_CSE_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim()
  const cx = (process.env.GOOGLE_CSE_ID || process.env.EOF_GOOGLE_CSE_ID || '').trim()
  return Boolean(key && cx)
}

function googleCseCredentials() {
  const key = (
    process.env.GOOGLE_CSE_API_KEY ||
    process.env.EOF_GOOGLE_CSE_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim()
  const cx = (process.env.GOOGLE_CSE_ID || process.env.EOF_GOOGLE_CSE_ID || '').trim()
  if (!key || !cx) return null
  return { key, cx }
}

/**
 * Image search via Google Programmable Search Engine (Custom Search JSON API).
 * This is the supported way to programmatically search Google Images — not HTML scraping.
 * @param {string} query
 * @param {number} index
 */
export async function searchGoogleCseImages(query, index = 0) {
  const creds = googleCseCredentials()
  if (!creds) return null

  const start = 1 + (index % 10)
  const url = new URL('https://customsearch.googleapis.com/customsearch/v1')
  url.searchParams.set('key', creds.key)
  url.searchParams.set('cx', creds.cx)
  url.searchParams.set('q', query)
  url.searchParams.set('searchType', 'image')
  url.searchParams.set('num', '10')
  url.searchParams.set('start', String(start))
  url.searchParams.set('imgSize', 'large')
  url.searchParams.set('imgType', 'photo')
  url.searchParams.set('safe', 'active')

  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
  if (!res.ok) return null

  const data = await res.json()
  const items = data.items || []
  if (!items.length) return null

  const pick = index % items.length
  const ordered = [...items.slice(pick), ...items.slice(0, pick)]

  for (const item of ordered.slice(0, 4)) {
    const imgUrl = item?.link
    if (!imgUrl || !/^https?:\/\//i.test(imgUrl)) continue
    return {
      imgUrl,
      title: item.title || null,
      sourcePage: item.image?.contextLink || item.displayLink || null,
      queryUsed: query,
    }
  }

  return null
}
