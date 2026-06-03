import { isDbConfigured } from './lib/db.mjs'
import { json } from './lib/http.mjs'
import { getPublicSitePages } from './lib/siteLayoutStore.mjs'
import {
  defaultSiteShell,
  defaultCompetitionsPageLayout,
  defaultFaqPageLayout,
  defaultContactPageLayout,
  defaultShirtGiveawayPageLayout,
  SITE_SHELL_ID,
  COMPETITIONS_PAGE_ID,
  FAQ_PAGE_ID,
  CONTACT_PAGE_ID,
  SHIRT_GIVEAWAY_PAGE_ID,
} from '../../shared/sitePageLayout.mjs'

function defaultsFallback() {
  return {
    [SITE_SHELL_ID]: defaultSiteShell(),
    [COMPETITIONS_PAGE_ID]: defaultCompetitionsPageLayout(),
    [FAQ_PAGE_ID]: defaultFaqPageLayout(),
    [CONTACT_PAGE_ID]: defaultContactPageLayout(),
    [SHIRT_GIVEAWAY_PAGE_ID]: defaultShirtGiveawayPageLayout(),
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  res.setHeader('Cache-Control', 'private, no-store, must-revalidate')

  try {
    if (!isDbConfigured()) {
      return json(res, 200, { ok: true, pages: defaultsFallback(), source: 'defaults' })
    }
    const pages = await getPublicSitePages()
    return json(res, 200, { ok: true, pages, source: 'database' })
  } catch (e) {
    console.error(e)
    console.error('[site-pages] Falling back to defaults:', e)
    return json(res, 200, { ok: true, pages: defaultsFallback(), source: 'defaults' })
  }
}
