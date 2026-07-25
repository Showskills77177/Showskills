/**
 * Free football article sourcing for EOF scripts / Quote Shorts.
 * No Perplexity required.
 *
 * 1) NewsData.io (newsdata.io — NEWSDATA_API_KEY)
 * 2) The Guardian Open Platform (free developer key — open-platform.theguardian.com)
 * 3) Public RSS (BBC / Guardian / Sky) — no key
 *
 * Env:
 *   NEWSDATA_API_KEY / EOF_NEWSDATA_API_KEY
 *   GUARDIAN_API_KEY / EOF_GUARDIAN_API_KEY
 */
function envKey(...names) {
  for (const name of names) {
    const v = (process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

export function getNewsdataApiKey() {
  return envKey('NEWSDATA_API_KEY', 'EOF_NEWSDATA_API_KEY')
}

export function isNewsdataConfigured() {
  return Boolean(getNewsdataApiKey())
}

export function getGuardianApiKey() {
  return envKey('GUARDIAN_API_KEY', 'EOF_GUARDIAN_API_KEY', 'THE_GUARDIAN_API_KEY')
}

export function isGuardianConfigured() {
  return Boolean(getGuardianApiKey())
}

/**
 * Latest football/sports articles from NewsData.io.
 * Tries topic+football / sports category first, then looser retries (free tier often
 * returns [] when category+q is too tight).
 * @returns {Promise<Array<{ desk: string, title: string, description: string, link: string, body: string }>>}
 */
export async function fetchNewsdataFootballArticles({ topic = '', limit = 8 } = {}) {
  const key = getNewsdataApiKey()
  if (!key) return []

  const raw = String(topic || '').trim() || 'football'
  const attempts = [
    { q: `${raw} football`.slice(0, 100), category: 'sports' },
    { q: raw.slice(0, 100), category: 'sports' },
    { q: raw.slice(0, 100), category: '' },
  ]

  let lastErr = null
  for (const attempt of attempts) {
    try {
      const rows = await fetchNewsdataOnce({ key, q: attempt.q, category: attempt.category, limit })
      if (rows.length) return rows
    } catch (e) {
      lastErr = e
      console.warn(
        '[eof-free-news] NewsData attempt failed',
        attempt.q.slice(0, 40),
        e instanceof Error ? e.message : e,
      )
    }
  }
  if (lastErr) throw lastErr
  return []
}

async function fetchNewsdataOnce({ key, q, category, limit }) {
  const url = new URL('https://newsdata.io/api/1/latest')
  url.searchParams.set('apikey', key)
  url.searchParams.set('q', q)
  url.searchParams.set('language', envKey('NEWSDATA_LANGUAGE', 'EOF_NEWSDATA_LANGUAGE') || 'en')
  if (category) {
    url.searchParams.set('category', category)
  } else {
    const cat = envKey('NEWSDATA_CATEGORY', 'EOF_NEWSDATA_CATEGORY')
    if (cat) url.searchParams.set('category', cat)
  }
  url.searchParams.set('size', String(Math.min(10, Math.max(3, limit))))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'X-ACCESS-KEY': key,
      },
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`NewsData ${res.status}: ${errText.slice(0, 180)}`)
    }
    const data = await res.json()
    if (data?.status && String(data.status).toLowerCase() === 'error') {
      throw new Error(`NewsData error: ${String(data.results?.message || data.message || 'unknown').slice(0, 180)}`)
    }
    const results = Array.isArray(data?.results) ? data.results : []
    return results
      .map((item) => {
        const title = String(item?.title || '').trim()
        const description = String(item?.description || item?.content || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 320)
        const body = String(item?.content || item?.description || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 1200)
        const link = String(item?.link || item?.url || '').trim()
        const desk =
          String(item?.source_name || item?.source_id || 'NewsData')
            .trim()
            .slice(0, 60) || 'NewsData'
        if (title.length < 8) return null
        return {
          desk,
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
 * Free research pack: NewsData (if keyed) + Guardian (if keyed) + RSS headlines.
 */
export async function fetchFreeFootballDeskPack({ topic = '', limit = 8 } = {}) {
  const { fetchFootballDeskHeadlines, filterDeskItemsToTopic } = await import(
    './eofFootballDeskResearch.mjs'
  )
  const [newsdataRaw, guardianRaw, rssRaw] = await Promise.all([
    fetchNewsdataFootballArticles({ topic, limit: Math.max(limit, 12) }).catch((e) => {
      console.warn('[eof-free-news] NewsData failed', e instanceof Error ? e.message : e)
      return []
    }),
    fetchGuardianFootballArticles({ topic, limit: Math.max(limit, 12) }).catch((e) => {
      console.warn('[eof-free-news] Guardian failed', e instanceof Error ? e.message : e)
      return []
    }),
    fetchFootballDeskHeadlines({ topic, limit: Math.max(limit, 12) }).catch(() => []),
  ])

  // Drop cross-sport / off-topic rows before they enter the writer brief or judge source.
  const newsdata = filterDeskItemsToTopic(newsdataRaw, topic, { limit })
  const guardian = filterDeskItemsToTopic(guardianRaw, topic, { limit })
  const rss = filterDeskItemsToTopic(rssRaw, topic, { limit })

  const seen = new Set()
  const merged = []
  // Prefer NewsData editorial hits first, then Guardian, then RSS
  for (const item of [...newsdata, ...guardian, ...rss]) {
    const key = String(item.title || '')
      .toLowerCase()
      .slice(0, 80)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(item)
    if (merged.length >= limit) break
  }

  const textParts = []
  if (newsdata.length) {
    textParts.push('NEWSDATA.IO (prefer these facts):\n' + formatArticlesForPrompt(newsdata))
  }
  if (guardian.length) {
    textParts.push('THE GUARDIAN:\n' + formatArticlesForPrompt(guardian))
  }
  const rssOnly = rss.filter((r) => {
    const k = String(r.title || '')
      .toLowerCase()
      .slice(0, 80)
    return !newsdata.some((n) => String(n.title || '').toLowerCase().slice(0, 80) === k)
  })
  if (rssOnly.length) {
    textParts.push('DESK RSS:\n' + formatArticlesForPrompt(rssOnly.slice(0, limit)))
  }

  return {
    articles: merged,
    text: textParts.join('\n\n') || formatArticlesForPrompt(merged),
    sources: {
      newsdata: newsdata.length,
      guardian: guardian.length,
      rss: rss.length,
      newsdataConfigured: isNewsdataConfigured(),
      guardianConfigured: isGuardianConfigured(),
    },
  }
}
