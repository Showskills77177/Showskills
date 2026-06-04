import { query, dbIsPostgres } from './db.mjs'
import {
  EDITABLE_PAGE_IDS,
  mergePageLayout,
} from '../../../shared/sitePageLayout.mjs'
import { mergeHomepageLayout, defaultHomepageLayout } from '../../../shared/homepageLayout.mjs'
import { EMAIL_LAYOUT_PAGE_ID, mergeEmailLayout, defaultEmailLayout } from '../../../shared/emailLayout.mjs'
import { ensureHomepageLayoutSchema } from './homepageLayout.mjs'
import { migrateCompetitionDisplayNameInJson } from '../../../shared/competitionDisplayNameMigration.mjs'

export { ensureHomepageLayoutSchema as ensureSiteLayoutSchema }

let layoutDisplayNameBackfillDone = false

export async function backfillSiteLayoutDisplayNames() {
  if (layoutDisplayNameBackfillDone) return
  layoutDisplayNameBackfillDone = true
  await ensureHomepageLayoutSchema()
  const rows = await query(`SELECT id, config_json FROM site_layout_config`)
  const now = new Date().toISOString()
  for (const row of rows.rows || []) {
    let raw
    try {
      raw = typeof row.config_json === 'string' ? JSON.parse(row.config_json) : row.config_json
    } catch {
      continue
    }
    const migrated = migrateCompetitionDisplayNameInJson(raw)
    const before = JSON.stringify(raw)
    const after = JSON.stringify(migrated)
    if (before === after) continue
    const json = after
    if (dbIsPostgres()) {
      await query(
        `UPDATE site_layout_config SET config_json = $2::jsonb, updated_at = $3 WHERE id = $1`,
        [row.id, json, now],
      )
    } else {
      await query(`UPDATE site_layout_config SET config_json = $2, updated_at = $3 WHERE id = $1`, [
        row.id,
        json,
        now,
      ])
    }
  }
}

function parseRow(pageId, row) {
  if (!row?.config_json) {
    if (pageId === 'homepage') return defaultHomepageLayout()
    if (pageId === EMAIL_LAYOUT_PAGE_ID) return defaultEmailLayout()
    return mergePageLayout(pageId, null)
  }
  try {
    const raw = typeof row.config_json === 'string' ? JSON.parse(row.config_json) : row.config_json
    if (pageId === 'homepage') return mergeHomepageLayout(raw)
    if (pageId === EMAIL_LAYOUT_PAGE_ID) return mergeEmailLayout(raw)
    return mergePageLayout(pageId, raw)
  } catch {
    if (pageId === 'homepage') return defaultHomepageLayout()
    if (pageId === EMAIL_LAYOUT_PAGE_ID) return defaultEmailLayout()
    return mergePageLayout(pageId, null)
  }
}

export async function getSitePageLayout(pageId) {
  await ensureHomepageLayoutSchema()
  await backfillSiteLayoutDisplayNames()
  const r = await query(`SELECT config_json FROM site_layout_config WHERE id = $1 LIMIT 1`, [pageId])
  if (!r.rows?.length) {
    if (pageId === 'homepage') return defaultHomepageLayout()
    if (pageId === EMAIL_LAYOUT_PAGE_ID) return defaultEmailLayout()
    return mergePageLayout(pageId, null)
  }
  return parseRow(pageId, r.rows[0])
}

export async function saveSitePageLayout(pageId, config) {
  await ensureHomepageLayoutSchema()
  const merged =
    pageId === 'homepage'
      ? mergeHomepageLayout(config)
      : pageId === EMAIL_LAYOUT_PAGE_ID
        ? mergeEmailLayout(config)
        : mergePageLayout(pageId, config)
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
