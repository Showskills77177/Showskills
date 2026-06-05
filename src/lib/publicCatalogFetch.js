import { apiFetch } from './api'
import {
  getCachedCompetition,
  getCachedFeaturedHomepageCompetition,
  getCachedPublishedCompetitions,
  getCachedPublishedGiveaways,
  setCachedCompetition,
  setCachedFeaturedHomepageCompetition,
  setCachedPublishedCompetitions,
  setCachedPublishedGiveaways,
} from './publicDataCache.js'

const SESSION_KEY = 'ss-public-competition-v1'
const inFlight = new Map()

function readSessionStore() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeSessionCompetition(slug, competition) {
  try {
    const store = readSessionStore()
    store[slug] = competition ?? null
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(store))
  } catch {
    /* ignore quota / private mode */
  }
}

/** Restore last-known competition payloads synchronously before the first paint. */
export function hydrateCompetitionCache(slug) {
  if (getCachedCompetition(slug) !== undefined) return
  const fromSession = readSessionStore()[slug]
  if (fromSession !== undefined) setCachedCompetition(slug, fromSession)
}

export function hydrateFeaturedHomepageCompetitionCache() {
  if (getCachedFeaturedHomepageCompetition() !== undefined) return
  hydrateCompetitionCache('__featured_homepage__')
  const featured = getCachedCompetition('__featured_homepage__')
  if (featured !== undefined) setCachedFeaturedHomepageCompetition(featured)
}

function dedupeFetch(key, factory) {
  if (inFlight.has(key)) return inFlight.get(key)
  const promise = factory().finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, promise)
  return promise
}

export function fetchPublicCompetitionBySlug(slug) {
  const cacheKey = String(slug || '').trim()
  if (!cacheKey) return Promise.resolve(null)

  return dedupeFetch(`competition:${cacheKey}`, () =>
    apiFetch(`/api/competitions?slug=${encodeURIComponent(cacheKey)}`)
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Failed to load competition')
        return j.competition || null
      })
      .then((competition) => {
        setCachedCompetition(cacheKey, competition)
        writeSessionCompetition(cacheKey, competition)
        return competition
      }),
  )
}

export function fetchFeaturedHomepageCompetition() {
  return dedupeFetch('competition:featured:homepage', () =>
    apiFetch('/api/competitions?featured=homepage')
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Failed to load featured competition')
        return j.competition || null
      })
      .then((competition) => {
        setCachedFeaturedHomepageCompetition(competition)
        writeSessionCompetition('__featured_homepage__', competition)
        if (competition?.slug) {
          setCachedCompetition(competition.slug, competition)
          writeSessionCompetition(competition.slug, competition)
        }
        return competition
      }),
  )
}

export function fetchPublishedCompetitions() {
  return dedupeFetch('competitions:list', () =>
    apiFetch('/api/competitions')
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Failed to load competitions')
        return j.competitions || []
      })
      .then((competitions) => {
        setCachedPublishedCompetitions(competitions)
        for (const competition of competitions) {
          if (!competition?.slug) continue
          if (getCachedCompetition(competition.slug) === undefined) {
            setCachedCompetition(competition.slug, competition)
            writeSessionCompetition(competition.slug, competition)
          }
        }
        return competitions
      }),
  )
}

export function fetchPublishedGiveaways() {
  return dedupeFetch('giveaways:list', () =>
    apiFetch('/api/giveaways')
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Failed to load giveaways')
        return j.giveaways || []
      })
      .then((giveaways) => {
        setCachedPublishedGiveaways(giveaways)
        return giveaways
      }),
  )
}
