import { query, dbIsPostgres } from './db.mjs'
import {
  EDITABLE_PAGE_IDS,
  mergePageLayout,
} from '../../../shared/sitePageLayout.mjs'
import { mergeHomepageLayout, defaultHomepageLayout } from '../../../shared/homepageLayout.mjs'
import { ensureHomepageLayoutSchema } from './homepageLayout.mjs'

export { ensureHomepageLayoutSchema as ensureSiteLayoutSchema }

function parseRow(pageId, row) {
  if (!row?.config_json) {
    if (pageId === 'homepage') return defaultHomepageLayout()
    return mergePageLayout(pageId, null)
  }
  try {
    const raw = typeof row.config_json === 'string' ? JSON.parse(row.config_json) : row.config_json
    if (pageId === 'homepage') return mergeHomepageLayout(raw)
    return mergePageLayout(pageId, raw)
  } catch {
    if (pageId === 'homepage') return defaultHomepageLayout()
    return mergePageLayout(pageId, null)
  }
}

export async function getSitePageLayout(pageId) {
  await ensureHomepageLayoutSchema()
  const r = await query(`SELECT config_json FROM site_layout_config WHERE id = $1 LIMIT 1`, [pageId])
  if (!r.rows?.length) {
    if (pageId === 'homepage') return defaultHomepageLayout()
    return mergePageLayout(pageId, null)
  }
  return parseRow(pageId, r.rows[0])
}

export async function saveSitePageLayout(pageId, config) {
  await ensureHomepageLayoutSchema()
  const merged =
    pageId === 'homepage' ? mergeHomepageLayout(config) : mergePageLayout(pageId, config)
  const now = new Date().toISOString()
  const json = JSON.stringify(merged)
  if (dbIsPostgres()) {
    await query(
      `INSERT INTO site_layout_config (id, config_json, updated_at)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (id) DO UPDATE SET config_json = EXCLUDED.config_json, updated_at = EXCLUDED.updated_at`,
      [pageId, json, now],
    )
  } else {
    await query(
      `INSERT INTO site_layout_config (id, config_json, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET config_json = excluded.config_json, updated_at = excluded.updated_at`,
      [pageId, json, now],
    )
  }
  return merged
}

export async function getAllSitePageLayouts() {
  const out = { homepage: await getSitePageLayout('homepage') }
  for (const pageId of EDITABLE_PAGE_IDS) {
    out[pageId] = await getSitePageLayout(pageId)
  }
  return out
}

export async function getPublicSitePages() {
  const pages = {}
  for (const pageId of EDITABLE_PAGE_IDS) {
    pages[pageId] = await getSitePageLayout(pageId)
  }
  return pages
}
