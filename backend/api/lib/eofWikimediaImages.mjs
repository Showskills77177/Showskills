/**
 * Wikimedia Commons + Wikidata image search (no API key).
 * Sophisticated path for named people (Messi, Tuchel, …):
 *  1. Resolve the person on Wikidata → canonical portrait (P18) + Commons category
 *  2. Search Commons with year-biased queries
 *  3. Rank by subject relevance + photo date (reject stale / off-topic)
 *
 * This is identity-aware (Wikidata), not ML face-match — P18 is the curated
 * "face of this person" used by Wikipedia, which for Tuchel is the 2026 England photo.
 */

import { scoreImageRelevance, resolveImageSubject } from '../../../shared/eofSceneImageQueries.mjs'

const UA = 'ShowSkillsEOF/1.0 (https://showskills.co.uk; eof-production@showskills.co.uk)'
const CURRENT_YEAR = new Date().getFullYear()

/** Titles that are never useful football stills. */
const JUNK_TITLE_RE =
  /\b(prisoners?|war|pdf|newspaper|abendpost|daily\s*times|map|coat\s*of\s*arms|logo|flag|signature|autograph|chart|graph|svg|icon|diagram)\b/i

/**
 * @param {string} path
 * @param {Record<string, string>} params
 */
async function wikiApi(host, params) {
  const url = `${host}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`wiki ${res.status}`)
  return res.json()
}

function parseWikiDate(raw) {
  const s = String(raw || '')
  // ISO-ish or "2014-05-04 07:52:46" or "23 June 2026"
  const iso = s.match(/(20\d{2}|19\d{2})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const y = s.match(/\b(20\d{2}|19\d{2})\b/)
  if (y) return Date.UTC(Number(y[1]), 0, 1)
  return 0
}

function yearFromTitleOrMeta(title, metaDate) {
  const fromMeta = parseWikiDate(metaDate)
  if (fromMeta) return new Date(fromMeta).getUTCFullYear()
  const m = String(title || '').match(/\b(20\d{2}|19\d{2})\b/)
  return m ? Number(m[1]) : 0
}

/**
 * Resolve a person/club on Wikidata → primary Commons image (P18) + category.
 * @param {string} subject
 * @returns {Promise<{ id: string, label: string, p18File: string | null, commonsCategory: string | null } | null>}
 */
export async function resolveWikidataSubject(subject) {
  const q = String(subject || '').trim()
  if (q.length < 2) return null
  try {
    const search = await wikiApi('https://www.wikidata.org/w/api.php', {
      action: 'wbsearchentities',
      search: q,
      language: 'en',
      type: 'item',
      limit: '5',
    })
    const hit =
      (search.search || []).find((s) =>
        /football|soccer|manager|coach|player|association football/i.test(
          `${s.label || ''} ${s.description || ''}`,
        ),
      ) || search.search?.[0]
    if (!hit?.id) return null

    const entities = await wikiApi('https://www.wikidata.org/w/api.php', {
      action: 'wbgetentities',
      ids: hit.id,
      props: 'claims|sitelinks|labels',
      languages: 'en',
    })
    const ent = entities.entities?.[hit.id]
    if (!ent) return null
    const p18 = ent.claims?.P18?.[0]?.mainsnak?.datavalue?.value || null
    const commonsCategory = ent.sitelinks?.commonswiki?.title || null
    const label = ent.labels?.en?.value || hit.label || q
    return { id: hit.id, label, p18File: p18 ? String(p18) : null, commonsCategory }
  } catch (e) {
    console.warn('[eof-wikimedia] wikidata resolve failed', q, e instanceof Error ? e.message : e)
    return null
  }
}

/**
 * Fetch Commons file info for a File: title (or bare filename).
 * @param {string} fileTitle
 */
async function fetchCommonsFile(fileTitle) {
  const title = String(fileTitle || '').trim()
  if (!title) return null
  const pageTitle = title.startsWith('File:') ? title : `File:${title}`
  try {
    const data = await wikiApi('https://commons.wikimedia.org/w/api.php', {
      action: 'query',
      titles: pageTitle,
      prop: 'imageinfo',
      iiprop: 'url|mime|size|extmetadata|timestamp',
      iiurlwidth: '1280',
    })
    const page = Object.values(data?.query?.pages || {})[0]
    if (!page || page.missing != null) return null
    return normalizeCommonsPage(page)
  } catch {
    return null
  }
}

/**
 * List recent files in a Commons category (e.g. Category:Thomas Tuchel).
 * @param {string} categoryTitle
 * @param {number} [limit]
 */
async function listCommonsCategoryFiles(categoryTitle, limit = 24) {
  const cat = String(categoryTitle || '').trim()
  if (!cat) return []
  try {
    const data = await wikiApi('https://commons.wikimedia.org/w/api.php', {
      action: 'query',
      list: 'categorymembers',
      cmtitle: cat.startsWith('Category:') ? cat : `Category:${cat}`,
      cmtype: 'file',
      cmlimit: String(Math.min(50, Math.max(5, limit))),
      cmsort: 'timestamp',
      cmdir: 'desc',
    })
    const members = data?.query?.categorymembers || []
    if (!members.length) return []
    const titles = members.map((m) => m.title).filter(Boolean)
    const info = await wikiApi('https://commons.wikimedia.org/w/api.php', {
      action: 'query',
      titles: titles.join('|'),
      prop: 'imageinfo',
      iiprop: 'url|mime|size|extmetadata|timestamp',
      iiurlwidth: '1280',
    })
    return Object.values(info?.query?.pages || {})
      .map(normalizeCommonsPage)
      .filter(Boolean)
  } catch (e) {
    console.warn('[eof-wikimedia] category list failed', cat, e instanceof Error ? e.message : e)
    return []
  }
}

/**
 * Generator search on Commons with metadata (dates).
 * @param {string} query
 * @param {number} [limit]
 */
async function searchCommonsRaw(query, limit = 20) {
  const q = String(query || '').trim()
  if (q.length < 2) return []
  try {
    const data = await wikiApi('https://commons.wikimedia.org/w/api.php', {
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrlimit: String(Math.min(30, Math.max(8, limit))),
      gsrsearch: q,
      prop: 'imageinfo',
      iiprop: 'url|mime|size|extmetadata|timestamp',
      iiurlwidth: '1280',
    })
    return Object.values(data?.query?.pages || {})
      .map(normalizeCommonsPage)
      .filter(Boolean)
  } catch (e) {
    console.warn('[eof-wikimedia] search failed', q, e instanceof Error ? e.message : e)
    return []
  }
}

function normalizeCommonsPage(page) {
  const info = page?.imageinfo?.[0]
  if (!info) return null
  const mime = String(info.mime || '')
  if (!mime.startsWith('image/')) return null
  if (mime.includes('svg') || mime.includes('djvu')) return null
  const title = String(page.title || '').replace(/^File:/, '')
  if (JUNK_TITLE_RE.test(title)) return null
  const imgUrl = info.thumburl || info.url
  if (!imgUrl) return null
  if (Number(info.size) > 0 && Number(info.size) < 20_000 && !info.thumburl) return null

  const meta = info.extmetadata || {}
  const metaDate =
    meta.DateTimeOriginal?.value ||
    meta.DateTime?.value ||
    meta.DateTimeDigitized?.value ||
    info.timestamp ||
    ''
  const year = yearFromTitleOrMeta(title, metaDate)
  return {
    imgUrl,
    title,
    mime,
    year,
    dateMs: parseWikiDate(metaDate) || (year ? Date.UTC(year, 0, 1) : 0),
    queryUsed: '',
  }
}

/**
 * Rank candidates: identity relevance first, then recency.
 * @param {Array} candidates
 * @param {string} topic
 * @param {string} [imageQuery]
 */
export function rankWikimediaCandidates(candidates, topic, imageQuery = '') {
  const year = CURRENT_YEAR
  return [...candidates]
    .map((c, idx) => {
      let relevance = scoreImageRelevance(topic || imageQuery, c.title || '', imageQuery)
      // Recency bonuses / penalties on top of title scoring
      if (c.year === year) relevance += 12
      else if (c.year === year - 1) relevance += 8
      else if (c.year === year - 2) relevance += 4
      else if (c.year && c.year <= year - 8) relevance -= 18
      else if (c.year && c.year <= year - 5) relevance -= 10
      if (/\b(mainz|dortmund\s*201|young|childhood|throwback|archive)\b/i.test(c.title || '')) {
        relevance -= 8
      }
      return { ...c, relevance, idx }
    })
    .filter((c) => c.relevance >= 6)
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance
      if (b.dateMs !== a.dateMs) return b.dateMs - a.dateMs
      return a.idx - b.idx
    })
}

function subjectSearchQueries(subject, topic) {
  const year = CURRENT_YEAR
  const base = String(subject || topic || '').trim()
  if (!base) return []
  return [
    `${base} ${year}`,
    `${base} ${year - 1}`,
    `${base} England`,
    base,
    `filetype:bitmap ${base} ${year}`,
    `filetype:bitmap ${base}`,
  ].filter((q, i, arr) => q.length > 2 && arr.indexOf(q) === i)
}

/**
 * Best Commons photo for a football topic/person.
 * Uses Wikidata identity (P18 + category) then ranked Commons search.
 *
 * @param {string} query
 * @param {number} [index] rotation index (rebuilds pick next-best)
 * @param {{ topic?: string }} [opts]
 * @returns {Promise<{ imgUrl: string, title: string, queryUsed: string, relevance: number, year: number, sourceDetail: string } | null>}
 */
export async function searchWikimediaCommonsImages(query, index = 0, opts = {}) {
  const topic = String(opts.topic || query || '').trim()
  const subject = resolveImageSubject(topic) || String(query || '').trim()
  if (subject.length < 2) return null

  const byKey = new Map()
  const add = (c, queryUsed, sourceDetail) => {
    if (!c?.imgUrl || !c.title) return
    const key = c.title.toLowerCase()
    const prev = byKey.get(key)
    if (prev && (prev.dateMs || 0) >= (c.dateMs || 0)) return
    byKey.set(key, { ...c, queryUsed: queryUsed || c.queryUsed || subject, sourceDetail })
  }

  // 1) Wikidata identity → canonical face (P18) + recent category files
  const wd = await resolveWikidataSubject(subject)
  if (wd?.p18File) {
    const portrait = await fetchCommonsFile(wd.p18File)
    if (portrait) add(portrait, `wikidata:${wd.id}`, 'wikidata-p18')
  }
  if (wd?.commonsCategory) {
    const catFiles = await listCommonsCategoryFiles(wd.commonsCategory, 30)
    for (const f of catFiles) add(f, wd.commonsCategory, 'wikidata-category')
  }

  // 2) Year-biased Commons search (never rely on unranked "Thomas Tuchel" alone)
  const queries = [
    ...subjectSearchQueries(subject, topic),
    String(query || '').trim() && String(query).trim() !== subject ? String(query).trim() : '',
  ].filter(Boolean)

  for (const q of queries.slice(0, 5)) {
    const hits = await searchCommonsRaw(q, 20)
    for (const h of hits) add(h, q, 'commons-search')
  }

  const ranked = rankWikimediaCandidates([...byKey.values()], topic || subject, '')
  if (!ranked.length) {
    console.warn('[eof-wikimedia] no on-topic recent hits for', subject)
    return null
  }

  const pick = ranked[Math.abs(Number(index) || 0) % ranked.length]
  console.info(
    '[eof-wikimedia] pick',
    pick.title,
    'year',
    pick.year || '?',
    'score',
    pick.relevance,
    'via',
    pick.sourceDetail,
    `(${ranked.length} candidates)`,
  )
  return {
    imgUrl: pick.imgUrl,
    title: pick.title,
    queryUsed: pick.queryUsed || subject,
    relevance: pick.relevance,
    year: pick.year || 0,
    sourceDetail: pick.sourceDetail || 'commons',
  }
}
