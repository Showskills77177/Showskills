/**
 * Free football article sourcing for EOF scripts / Quote Shorts.
 * No Perplexity required.
 *
 * 1) The Guardian Open Platform (free developer key — register at open-platform.theguardian.com)
 * 2) Public RSS (BBC / Guardian / Sky) — no key
 *
 * Env:
 *   GUARDIAN_API_KEY / EOF_GUARDIAN_API_KEY
 */
function envKey(...names) {
  for (const name of names) {
    const v = (process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

export function getGuardianApiKey() {
  return envKey('GUARDIAN_API_KEY', 'EOF_GUARDIAN_API_KEY', 'THE_GUARDIAN_API_KEY')
}

export function isGuardianConfigured() {
  return Boolean(getGuardianApiKey())
}

/**
 * Search Guardian football section (free developer tier).
 * @returns {Promise<Array<{ desk: string, title: string, description: string, link: string, body: string }>>}
 */
export async function fetchGuardianFootballArticles({ topic = '', limit = 8 } = {}) {
  const key = getGuardianApiKey()
  if (!key) return []

  const q = String(topic || 'football').trim() || 'football'
  const url = new URL('https://content.guardianapis.com/search')
  url.searchParams.set('api-key', key)
  url.searchParams.set('section', 'football')
  url.searchParams.set('q', q)
  url.searchParams.set('order-by', 'newest')
  url.searchParams.set('page-size', String(Math.min(20, Math.max(3, limit))))
  url.searchParams.set('show-fields', 'trailText,headline,bodyText,standfirst')
  url.searchParams.set('show-tags', 'contributor')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Guardian ${res.status}: ${errText.slice(0, 180)}`)
    }
    const data = await res.json()
    const results = Array.isArray(data?.response?.results) ? data.response.results : []
    return results
      .map((item) => {
        const fields = item?.fields || {}
        const title = String(fields.headline || item?.webTitle || '').trim()
        const description = String(fields.trailText || fields.standfirst || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 320)
        const body = String(fields.bodyText || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 1200)
        const link = String(item?.webUrl || '').trim()
        if (title.length < 8) return null
        return {
          desk: 'The Guardian',
          title: title.slice(0, 160),
          description,
          body,
          link: link.slice(0, 300),
        }
      })
      .filter(Boolean)
      .slice(0, limit)
  } finally {
    clearTimeout(timer)
  }
}

export function formatArticlesForPrompt(articles) {
  if (!Array.isArray(articles) || !articles.length) return ''
  return articles
    .map((a, i) => {
      const bits = [`${i + 1}. [${a.desk}] ${a.title}`]
      if (a.description) bits.push(`Summary: ${a.description}`)
      if (a.body) bits.push(`Excerpt: ${a.body.slice(0, 500)}`)
      if (a.link) bits.push(`URL: ${a.link}`)
      return bits.join('\n')
    })
    .join('\n\n')
}

/**
 * Free research pack: Guardian (if keyed) + RSS headlines.
 */
export async function fetchFreeFootballDeskPack({ topic = '', limit = 8 } = {}) {
  const { fetchFootballDeskHeadlines } = await import('./eofFootballDeskResearch.mjs')
  const [guardian, rss] = await Promise.all([
    fetchGuardianFootballArticles({ topic, limit }).catch((e) => {
      console.warn('[eof-free-news] Guardian failed', e instanceof Error ? e.message : e)
      return []
    }),
    fetchFootballDeskHeadlines({ topic, limit }).catch(() => []),
  ])

  const seen = new Set()
  const merged = []
  for (const item of [...guardian, ...rss]) {
    const key = String(item.title || '')
      .toLowerCase()
      .slice(0, 80)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(item)
    if (merged.length >= limit) break
  }

  return {
    articles: merged,
    text: formatArticlesForPrompt(merged),
    sources: {
      guardian: guardian.length,
      rss: rss.length,
      guardianConfigured: isGuardianConfigured(),
    },
  }
}
