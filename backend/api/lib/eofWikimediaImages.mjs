/**
 * Free Wikimedia Commons image search (no API key).
 * Used as a last real-image fallback before solid-color placeholders.
 */

const UA = 'ShowSkillsEOF/1.0 (https://showskills.co.uk; eof-production@showskills.co.uk)'

/**
 * @param {string} query
 * @param {number} index
 * @returns {Promise<{ imgUrl: string, title: string, queryUsed: string } | null>}
 */
export async function searchWikimediaCommonsImages(query, index = 0) {
  const q = String(query || '').trim()
  if (q.length < 2) return null

  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrnamespace: '6',
      gsrlimit: '12',
      gsrsearch: q,
      prop: 'imageinfo',
      iiprop: 'url|mime|size',
      iiurlwidth: '1280',
      origin: '*',
    }).toString()

  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) return null

  const data = await res.json()
  const pages = Object.values(data?.query?.pages || {})
  const usable = pages
    .map((page) => {
      const info = page?.imageinfo?.[0]
      if (!info) return null
      const mime = String(info.mime || '')
      if (!mime.startsWith('image/')) return null
      if (mime.includes('svg')) return null
      const imgUrl = info.thumburl || info.url
      if (!imgUrl) return null
      if (Number(info.size) > 0 && Number(info.size) < 20_000 && !info.thumburl) return null
      return {
        imgUrl,
        title: String(page.title || '').replace(/^File:/, ''),
        queryUsed: q,
      }
    })
    .filter(Boolean)

  if (!usable.length) return null
  return usable[Math.abs(index) % usable.length]
}
