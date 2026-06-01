import { query, dbIsPostgres } from './db.mjs'
import { DRAW_COMPETITION_SLUG, DRAW_COMPETITION_LABEL } from '../../../shared/competitionPeriods.mjs'
import {
  MJ_COMPETITION_SLUG,
  MJ_COMPETITION_LABEL,
} from '../../../shared/adminCompetitions.mjs'
import { TICKET_BUNDLES, getStandardCompetitionBundleTemplates } from '../../../shared/ticketBundles.mjs'
import { COMPETITION_SHIRT_GIVEAWAY } from '../../../shared/freeEntryLimits.mjs'
import {
  ensureDefaultCompetitionPeriod,
  getOpenCompetitionPeriod,
  getCountdownPeriodForDisplay,
} from './competitionPeriods.mjs'
import {
  legacyEntryMethods,
  mapEntryMethodsFromDbRow,
  normalizeEntryMethods,
} from '../../../shared/competitionEntryMethods.mjs'
import { COMPETITION_NAME_POSTAL } from '../../../shared/competitionCopy.mjs'
import { defaultPostalName } from '../../../shared/competitionEntryMethods.mjs'

export const COMPETITION_STATUS = {
  draft: 'draft',
  published: 'published',
  archived: 'archived',
}

export const COMPETITION_KIND = {
  mainDraw: 'main_draw',
  giveaway: 'giveaway',
}

let schemaEnsured = false

export async function ensureCompetitionCatalogSchema() {
  if (schemaEnsured) return

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS competitions (
        slug TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        rules_markdown TEXT NOT NULL DEFAULT '',
        hero_image_ref TEXT,
        gallery_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        status TEXT NOT NULL DEFAULT 'draft',
        kind TEXT NOT NULL DEFAULT 'main_draw',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS competition_bundles (
        id TEXT PRIMARY KEY NOT NULL,
        competition TEXT NOT NULL,
        bundle_key TEXT NOT NULL,
        qty INTEGER NOT NULL CHECK (qty > 0),
        total_pence INTEGER NOT NULL CHECK (total_pence >= 0),
        title TEXT NOT NULL DEFAULT '',
        line1 TEXT,
        line2 TEXT,
        bullets_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        featured BOOLEAN NOT NULL DEFAULT false,
        test_only BOOLEAN NOT NULL DEFAULT false,
        active BOOLEAN NOT NULL DEFAULT true,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (competition, bundle_key)
      )
    `)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS competitions (
        slug TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        rules_markdown TEXT NOT NULL DEFAULT '',
        hero_image_ref TEXT,
        gallery_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'draft',
        kind TEXT NOT NULL DEFAULT 'main_draw',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS competition_bundles (
        id TEXT PRIMARY KEY NOT NULL,
        competition TEXT NOT NULL,
        bundle_key TEXT NOT NULL,
        qty INTEGER NOT NULL CHECK (qty > 0),
        total_pence INTEGER NOT NULL CHECK (total_pence >= 0),
        title TEXT NOT NULL DEFAULT '',
        line1 TEXT,
        line2 TEXT,
        bullets_json TEXT NOT NULL DEFAULT '[]',
        featured INTEGER NOT NULL DEFAULT 0,
        test_only INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (competition, bundle_key)
      )
    `)
  }
  await query(`CREATE INDEX IF NOT EXISTS idx_comp_bundles_comp ON competition_bundles (competition, sort_order)`)

  await ensureCompetitionEntryMethodColumns()

  schemaEnsured = true
  await ensureBuiltinCompetitions()
  await backfillLegacyEntryMethods()
}

const BUILTIN_MAIN_DRAWS = [
  {
    slug: DRAW_COMPETITION_SLUG,
    title: DRAW_COMPETITION_LABEL,
    summary:
      'Pay for ticket bundles or enter free by post, then answer three skill questions. All correct to qualify for the main random draw.',
    rulesMarkdown: `## How to enter\n\n- Buy a ticket bundle online or use free postal entry.\n- Answer all three skill questions correctly in one attempt.\n- Qualified ticket numbers enter the random draw for this competition period.\n\n## Consolation\n\nWrong answers on a qualifying spend may receive automatic entries into the separate Free Ronaldo Shirt Giveaway.`,
    status: COMPETITION_STATUS.published,
    kind: COMPETITION_KIND.mainDraw,
    sortOrder: 0,
    seedBundles: true,
  },
  {
    slug: MJ_COMPETITION_SLUG,
    title: MJ_COMPETITION_LABEL,
    summary:
      'Win a signed Michael Jackson album. Runs in parallel with other main prize draws — separate timeline and draw pool.',
    rulesMarkdown: `## How to enter\n\n- Purchase a ticket bundle for this competition when live on site.\n- Complete the skill quiz for this prize draw.\n- Only entries within the active competition period are eligible.`,
    status: COMPETITION_STATUS.draft,
    kind: COMPETITION_KIND.mainDraw,
    sortOrder: 1,
    seedBundles: true,
  },
]

async function ensureCompetitionEntryMethodColumns() {
  const addCol = async (sqlPg, sqlLite) => {
    try {
      await query(dbIsPostgres() ? sqlPg : sqlLite)
    } catch {
      /* column exists */
    }
  }
  if (dbIsPostgres()) {
    await addCol(
      `ALTER TABLE competitions ADD COLUMN IF NOT EXISTS allow_paid_entry BOOLEAN NOT NULL DEFAULT true`,
      '',
    )
    await addCol(
      `ALTER TABLE competitions ADD COLUMN IF NOT EXISTS allow_free_online BOOLEAN NOT NULL DEFAULT false`,
      '',
    )
    await addCol(
      `ALTER TABLE competitions ADD COLUMN IF NOT EXISTS allow_postal_entry BOOLEAN NOT NULL DEFAULT false`,
      '',
    )
    await addCol(`ALTER TABLE competitions ADD COLUMN IF NOT EXISTS postal_competition_name TEXT`, '')
    await addCol(
      `ALTER TABLE competitions ADD COLUMN IF NOT EXISTS featured_on_homepage BOOLEAN NOT NULL DEFAULT false`,
      '',
    )
  } else {
    await addCol('', `ALTER TABLE competitions ADD COLUMN allow_paid_entry INTEGER NOT NULL DEFAULT 1`)
    await addCol('', `ALTER TABLE competitions ADD COLUMN allow_free_online INTEGER NOT NULL DEFAULT 0`)
    await addCol('', `ALTER TABLE competitions ADD COLUMN allow_postal_entry INTEGER NOT NULL DEFAULT 0`)
    await addCol('', `ALTER TABLE competitions ADD COLUMN postal_competition_name TEXT`)
    await addCol('', `ALTER TABLE competitions ADD COLUMN featured_on_homepage INTEGER NOT NULL DEFAULT 0`)
  }
}

async function backfillLegacyEntryMethods() {
  const legacy = legacyEntryMethods()
  const paidVal = dbIsPostgres() ? true : 1
  const freeVal = dbIsPostgres() ? true : 1
  const postalVal = dbIsPostgres() ? true : 1
  await query(
    `UPDATE competitions SET
      allow_paid_entry = $2,
      allow_free_online = $3,
      allow_postal_entry = $4,
      postal_competition_name = COALESCE(NULLIF(postal_competition_name, ''), $5),
      featured_on_homepage = $6
     WHERE slug = $1`,
    [
      DRAW_COMPETITION_SLUG,
      paidVal,
      freeVal,
      postalVal,
      legacy.postalCompetitionName,
      paidVal,
    ],
  ).catch(() => {})
}

function parseJsonArray(val) {
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function mapCompetitionRow(row) {
  if (!row) return null
  const entryMethods = mapEntryMethodsFromDbRow(row)
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary || '',
    rulesMarkdown: row.rules_markdown || '',
    heroImageRef: row.hero_image_ref || null,
    gallery: parseJsonArray(row.gallery_json),
    status: row.status,
    kind: row.kind || COMPETITION_KIND.mainDraw,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...entryMethods,
    featuredOnHomepage: dbIsPostgres()
      ? Boolean(row.featured_on_homepage)
      : Boolean(Number(row.featured_on_homepage ?? 0)),
  }
}

function mapBundleRow(row) {
  if (!row) return null
  const featured = dbIsPostgres() ? Boolean(row.featured) : Boolean(Number(row.featured))
  const testOnly = dbIsPostgres() ? Boolean(row.test_only) : Boolean(Number(row.test_only))
  const active = dbIsPostgres() ? Boolean(row.active) : Boolean(Number(row.active ?? 1))
  return {
    id: row.id,
    competition: row.competition,
    bundleKey: row.bundle_key,
    bundleId: row.bundle_key,
    qty: Number(row.qty),
    totalPence: Number(row.total_pence),
    title: row.title || '',
    line1: row.line1 || null,
    line2: row.line2 || null,
    bullets: parseJsonArray(row.bullets_json),
    featured,
    testOnly,
    active,
    sortOrder: Number(row.sort_order ?? 0),
  }
}

export function competitionImagePublicUrl(ref, siteOrigin = '') {
  if (!ref) return null
  if (ref.startsWith('http://') || ref.startsWith('https://')) return ref
  if (ref.startsWith('local:')) {
    return `${siteOrigin}/api/competition-image?ref=${encodeURIComponent(ref)}`
  }
  return ref
}

/** Ensures Ronaldo Legacy + Michael Jackson rows exist even when other competitions were created first. */
async function ensureBuiltinCompetitions() {
  const now = new Date().toISOString()

  for (const c of BUILTIN_MAIN_DRAWS) {
    const existing = await query(`SELECT slug, status FROM competitions WHERE slug = $1`, [c.slug])
    if (!existing.rows[0]) {
      await query(
        `INSERT INTO competitions (
          slug, title, summary, rules_markdown, status, kind, sort_order, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [c.slug, c.title, c.summary, c.rulesMarkdown, c.status, c.kind, c.sortOrder, now],
      )
    } else if (
      c.slug === DRAW_COMPETITION_SLUG &&
      existing.rows[0].status !== COMPETITION_STATUS.archived &&
      existing.rows[0].status !== COMPETITION_STATUS.published
    ) {
      await query(`UPDATE competitions SET status = $2, updated_at = $3 WHERE slug = $1`, [
        c.slug,
        COMPETITION_STATUS.published,
        now,
      ])
    }

    await ensureDefaultCompetitionPeriod(c.slug, { title: c.title })

    if (c.slug === DRAW_COMPETITION_SLUG) {
      await query(
        `UPDATE competitions SET summary = $1, updated_at = $2
         WHERE slug = $3 AND summary IN ($4, $5)`,
        [c.summary, now, DRAW_COMPETITION_SLUG, 'Updated from catalog test', 'Created from catalog test'],
      )
    }

    if (c.seedBundles) {
      const bundleCount = await query(
        `SELECT COUNT(*)::int AS c FROM competition_bundles WHERE competition = $1`,
        [c.slug],
      )
      if ((bundleCount.rows[0]?.c ?? 0) === 0) {
        for (let i = 0; i < TICKET_BUNDLES.length; i++) {
          await upsertCompetitionBundleRow(c.slug, TICKET_BUNDLES[i], i)
        }
      }
    }
  }

  const { ensureCompetitionSkillQuestionsSchema } = await import('./competitionSkillQuestions.mjs')
  await ensureCompetitionSkillQuestionsSchema()
}

async function upsertCompetitionBundleRow(competition, bundle, sortOrder) {
  const id = `${competition}:${bundle.id}`
  const bulletsJson = JSON.stringify(bundle.bullets || [])
  const featuredVal = dbIsPostgres() ? Boolean(bundle.featured) : bundle.featured ? 1 : 0
  const testOnlyVal = dbIsPostgres() ? Boolean(bundle.testOnly) : bundle.testOnly ? 1 : 0
  const now = new Date().toISOString()

  await query(
    `INSERT INTO competition_bundles (
      id, competition, bundle_key, qty, total_pence, title, line1, line2,
      bullets_json, featured, test_only, active, sort_order, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (competition, bundle_key) DO UPDATE SET
      qty = EXCLUDED.qty,
      total_pence = EXCLUDED.total_pence,
      title = EXCLUDED.title,
      line1 = EXCLUDED.line1,
      line2 = EXCLUDED.line2,
      bullets_json = EXCLUDED.bullets_json,
      featured = EXCLUDED.featured,
      test_only = EXCLUDED.test_only,
      sort_order = EXCLUDED.sort_order,
      updated_at = EXCLUDED.updated_at`,
    [
      id,
      competition,
      bundle.id,
      bundle.qty,
      bundle.totalPence,
      bundle.title,
      bundle.line1,
      bundle.line2,
      bulletsJson,
      featuredVal,
      testOnlyVal,
      dbIsPostgres() ? true : 1,
      sortOrder,
      now,
    ],
  )
}

export async function listCompetitions({ status, kind } = {}) {
  await ensureCompetitionCatalogSchema()
  let sql = `SELECT * FROM competitions WHERE 1=1`
  const params = []
  if (status) {
    params.push(status)
    sql += ` AND status = $${params.length}`
  }
  if (kind) {
    params.push(kind)
    sql += ` AND kind = $${params.length}`
  }
  sql += ` ORDER BY sort_order ASC, title ASC`
  const r = await query(sql, params)
  return r.rows.map(mapCompetitionRow)
}

export async function getCompetitionBySlug(slug) {
  await ensureCompetitionCatalogSchema()
  const r = await query(`SELECT * FROM competitions WHERE slug = $1`, [slug])
  return mapCompetitionRow(r.rows[0])
}

export async function listCompetitionBundles(competition, { activeOnly = false } = {}) {
  await ensureCompetitionCatalogSchema()
  let sql = `SELECT * FROM competition_bundles WHERE competition = $1`
  const params = [competition]
  if (activeOnly) {
    sql += ` AND active = ${dbIsPostgres() ? 'true' : '1'}`
  }
  sql += ` ORDER BY sort_order ASC, bundle_key ASC`
  const r = await query(sql, params)
  return r.rows.map(mapBundleRow)
}

export async function getCompetitionBundle(competition, bundleKey) {
  await ensureCompetitionCatalogSchema()
  const r = await query(
    `SELECT * FROM competition_bundles WHERE competition = $1 AND bundle_key = $2 LIMIT 1`,
    [competition, bundleKey],
  )
  return mapBundleRow(r.rows[0])
}

export async function resolveTicketBundle(competition, bundleKey, { includeTest = false } = {}) {
  const fromDb = await getCompetitionBundle(competition, bundleKey)
  if (fromDb && fromDb.active && (!fromDb.testOnly || includeTest)) {
    return {
      id: fromDb.bundleKey,
      qty: fromDb.qty,
      totalPence: fromDb.totalPence,
      title: fromDb.title,
      line1: fromDb.line1,
      line2: fromDb.line2,
      bullets: fromDb.bullets,
      featured: fromDb.featured,
      testOnly: fromDb.testOnly,
    }
  }
  const staticBundle = TICKET_BUNDLES.find((b) => b.id === bundleKey)
  if (staticBundle && competition === DRAW_COMPETITION_SLUG) {
    if (staticBundle.testOnly && !includeTest) return null
    return staticBundle
  }
  return null
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

/** Validates a main-prize competition slug against the catalog (supports admin-created competitions). */
export async function assertMainDrawCompetitionSlug(slug) {
  await ensureCompetitionCatalogSchema()
  const s = String(slug || '').trim()
  if (!s) return { ok: false, error: 'Competition slug required.' }
  const competition = await getCompetitionBySlug(s)
  if (!competition) return { ok: false, error: 'Competition not found.' }
  if (competition.kind !== COMPETITION_KIND.mainDraw) {
    return { ok: false, error: 'Not a main prize draw competition.' }
  }
  return { ok: true, competition }
}

const ENTRY_METHOD_ERRORS = {
  paid: 'Paid ticket entry is not enabled for this competition.',
  free_online: 'Free online entry is not enabled for this competition.',
  postal: 'Free postal entry is not enabled for this competition.',
}

/** Validates a main draw slug and that the requested entry route is enabled in admin. */
export async function assertCompetitionEntryMethod(slug, method) {
  const check = await assertMainDrawCompetitionSlug(slug)
  if (!check.ok) return check
  const c = check.competition
  if (method === 'paid' && !c.allowPaidEntry) return { ok: false, error: ENTRY_METHOD_ERRORS.paid }
  if (method === 'free_online' && !c.allowFreeOnline) {
    return { ok: false, error: ENTRY_METHOD_ERRORS.free_online }
  }
  if (method === 'postal' && !c.allowPostalEntry) return { ok: false, error: ENTRY_METHOD_ERRORS.postal }
  return { ok: true, competition: c, slug: c.slug }
}

function normalizeCreateBundle(raw, index) {
  const bundleKey =
    slugify(raw.bundleKey || raw.id || raw.title) ||
    `bundle_${index + 1}`
  const qty = Math.max(1, parseInt(String(raw.qty), 10) || 1)
  const totalPence = Math.max(0, parseInt(String(raw.totalPence), 10) || 0)
  const title = String(raw.title || bundleKey).trim() || bundleKey
  const line1 = typeof raw.line1 === 'string' ? raw.line1.trim() : null
  const autoLine1 =
    line1 ||
    (qty === 1
      ? `1 ticket = ${formatBundlePriceShort(totalPence)}`
      : `${qty} tickets = ${formatBundlePriceShort(totalPence)}`)
  return {
    id: bundleKey,
    qty,
    totalPence,
    title,
    line1: autoLine1,
    line2: typeof raw.line2 === 'string' && raw.line2.trim() ? raw.line2.trim() : null,
    bullets: Array.isArray(raw.bullets) ? raw.bullets : [],
    featured: Boolean(raw.featured),
    testOnly: false,
    active: raw.active !== false,
  }
}

function formatBundlePriceShort(totalPence) {
  const pounds = totalPence / 100
  if (Number.isInteger(pounds)) return `£${pounds}`
  return `£${pounds.toFixed(2)}`
}

export async function createCompetition({
  slug: rawSlug,
  title,
  summary = '',
  rulesMarkdown = '',
  status = COMPETITION_STATUS.draft,
  kind = COMPETITION_KIND.mainDraw,
  sortOrder = 0,
  entryOpensAt,
  entryClosesAt,
  periodTitle,
  openPeriod = false,
  bundles,
  skillQuestions,
  allowPaidEntry,
  allowFreeOnline,
  allowPostalEntry,
  postalCompetitionName,
  featuredOnHomepage = false,
}) {
  await ensureCompetitionCatalogSchema()
  const slug = slugify(rawSlug || title)
  if (!slug) return { ok: false, error: 'Valid slug or title required.' }
  if (slug === COMPETITION_SHIRT_GIVEAWAY) {
    return { ok: false, error: 'That slug is reserved for the shirt giveaway.' }
  }

  const entryMethods = normalizeEntryMethods(
    {
      allowPaidEntry: kind === COMPETITION_KIND.giveaway ? false : allowPaidEntry,
      allowFreeOnline,
      allowPostalEntry,
      postalCompetitionName:
        postalCompetitionName ||
        defaultPostalName(title.trim()) ||
        COMPETITION_NAME_POSTAL,
    },
    { title: title.trim() },
  )
  if (kind === COMPETITION_KIND.giveaway) {
    entryMethods.allowPaidEntry = false
  }
  if (!entryMethods.allowPaidEntry && !entryMethods.allowFreeOnline && !entryMethods.allowPostalEntry) {
    return { ok: false, error: 'Enable at least one entry route (free online or postal for giveaways; paid, free online, or postal for competitions).' }
  }

  const dup = await query(`SELECT slug FROM competitions WHERE slug = $1`, [slug])
  if (dup.rows[0]) return { ok: false, error: 'A competition with this slug already exists.' }

  const now = new Date().toISOString()
  const paidVal = dbIsPostgres() ? entryMethods.allowPaidEntry : entryMethods.allowPaidEntry ? 1 : 0
  const freeVal = dbIsPostgres() ? entryMethods.allowFreeOnline : entryMethods.allowFreeOnline ? 1 : 0
  const postalVal = dbIsPostgres() ? entryMethods.allowPostalEntry : entryMethods.allowPostalEntry ? 1 : 0
  const featuredVal = dbIsPostgres() ? Boolean(featuredOnHomepage) : featuredOnHomepage ? 1 : 0
  const featuredForInsert = kind === COMPETITION_KIND.giveaway ? false : featuredOnHomepage
  const featuredInsertVal = dbIsPostgres() ? Boolean(featuredForInsert) : featuredForInsert ? 1 : 0
  try {
    if (featuredForInsert) {
      await clearFeaturedOnHomepageExcept(null)
    }
    await query(
      `INSERT INTO competitions (
        slug, title, summary, rules_markdown, status, kind, sort_order,
        allow_paid_entry, allow_free_online, allow_postal_entry, postal_competition_name,
        featured_on_homepage, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        slug,
        title.trim(),
        summary.trim(),
        rulesMarkdown.trim(),
        status,
        kind,
        sortOrder,
        paidVal,
        freeVal,
        postalVal,
        entryMethods.postalCompetitionName,
        featuredInsertVal,
        now,
      ],
    )

    const { createCompetitionPeriod } = await import('./competitionPeriods.mjs')
    const { PERIOD_STATUS } = await import('../../../shared/competitionPeriods.mjs')

    if (entryOpensAt && entryClosesAt) {
      const createdPeriod = await createCompetitionPeriod({
        competition: slug,
        title: periodTitle?.trim() || `${title.trim()} — Entry window`,
        summary: '',
        entryOpensAt,
        entryClosesAt,
        status: openPeriod ? PERIOD_STATUS.open : PERIOD_STATUS.draft,
      })
      if (!createdPeriod.ok) throw new Error(createdPeriod.error)
    } else {
      await ensureDefaultCompetitionPeriod(slug, { title: title.trim() })
    }

    const bundleRows =
      entryMethods.allowPaidEntry && Array.isArray(bundles) && bundles.length
        ? bundles.map(normalizeCreateBundle)
        : entryMethods.allowPaidEntry
          ? getStandardCompetitionBundleTemplates().map((b, i) =>
              normalizeCreateBundle({ ...b, bundleKey: b.bundleKey }, i),
            )
          : []

    for (let i = 0; i < bundleRows.length; i++) {
      if (bundleRows[i].active === false) continue
      await upsertCompetitionBundleRow(slug, bundleRows[i], i)
    }
    if (entryMethods.allowPaidEntry && !bundleRows.some((b) => b.active !== false)) {
      throw new Error('At least one active ticket bundle is required when paid entry is enabled.')
    }

    const { replaceCompetitionSkillQuestions, defaultSkillQuestionsForNewCompetition } =
      await import('./competitionSkillQuestions.mjs')
    const skillInput =
      Array.isArray(skillQuestions) && skillQuestions.length
        ? skillQuestions
        : kind === COMPETITION_KIND.giveaway
          ? [{ questionKey: 'q1', prompt: '', acceptedAnswers: [] }]
          : defaultSkillQuestionsForNewCompetition()
    const skillResult = await replaceCompetitionSkillQuestions(slug, skillInput)
    if (!skillResult.ok) throw new Error(skillResult.error)
  } catch (err) {
    const { deleteCompetitionSkillQuestions } = await import('./competitionSkillQuestions.mjs')
    await deleteCompetitionSkillQuestions(slug).catch(() => {})
    await query(`DELETE FROM competition_bundles WHERE competition = $1`, [slug]).catch(() => {})
    await query(`DELETE FROM competition_periods WHERE competition = $1`, [slug]).catch(() => {})
    await query(`DELETE FROM competitions WHERE slug = $1`, [slug]).catch(() => {})
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not create competition.',
    }
  }

  return { ok: true, competition: await getCompetitionBySlug(slug) }
}

export async function updateCompetition(slug, patch) {
  await ensureCompetitionCatalogSchema()
  const existing = await getCompetitionBySlug(slug)
  if (!existing) return { ok: false, error: 'Competition not found.' }

  const fields = []
  const vals = []
  let i = 1

  const setText = (col, val) => {
    if (typeof val !== 'string') return
    fields.push(`${col} = $${i++}`)
    vals.push(val.trim())
  }

  setText('title', patch.title)
  if (typeof patch.summary === 'string') setText('summary', patch.summary)
  if (typeof patch.rulesMarkdown === 'string') setText('rules_markdown', patch.rulesMarkdown)
  if (typeof patch.heroImageRef === 'string' || patch.heroImageRef === null) {
    fields.push(`hero_image_ref = $${i++}`)
    vals.push(patch.heroImageRef)
  }
  if (Array.isArray(patch.gallery)) {
    fields.push(`gallery_json = $${i++}`)
    vals.push(JSON.stringify(patch.gallery))
  }
  if (typeof patch.status === 'string' && Object.values(COMPETITION_STATUS).includes(patch.status)) {
    fields.push(`status = $${i++}`)
    vals.push(patch.status)
  }
  if (typeof patch.sortOrder === 'number' && Number.isFinite(patch.sortOrder)) {
    fields.push(`sort_order = $${i++}`)
    vals.push(patch.sortOrder)
  }

  const setBool = (col, val) => {
    if (typeof val !== 'boolean') return
    fields.push(`${col} = $${i++}`)
    vals.push(dbIsPostgres() ? val : val ? 1 : 0)
  }
  if (typeof patch.allowPaidEntry === 'boolean') {
    setBool('allow_paid_entry', existing.kind === COMPETITION_KIND.giveaway ? false : patch.allowPaidEntry)
  }
  if (typeof patch.allowFreeOnline === 'boolean') setBool('allow_free_online', patch.allowFreeOnline)
  if (typeof patch.allowPostalEntry === 'boolean') setBool('allow_postal_entry', patch.allowPostalEntry)
  if (typeof patch.postalCompetitionName === 'string') setText('postal_competition_name', patch.postalCompetitionName)
  if (typeof patch.featuredOnHomepage === 'boolean') {
    if (patch.featuredOnHomepage) {
      await clearFeaturedOnHomepageExcept(slug)
    }
    setBool('featured_on_homepage', patch.featuredOnHomepage)
  }

  if (!fields.length) return { ok: false, error: 'No valid fields to update.' }

  fields.push(`updated_at = $${i++}`)
  vals.push(new Date().toISOString())
  vals.push(slug)

  await query(`UPDATE competitions SET ${fields.join(', ')} WHERE slug = $${i}`, vals)
  return { ok: true, competition: await getCompetitionBySlug(slug) }
}

export async function upsertCompetitionBundle(competition, bundleInput) {
  await ensureCompetitionCatalogSchema()
  const comp = await getCompetitionBySlug(competition)
  if (!comp) return { ok: false, error: 'Competition not found.' }

  const bundleKey = slugify(bundleInput.bundleKey || bundleInput.id || bundleInput.title)
  if (!bundleKey) return { ok: false, error: 'Bundle key required.' }

  const qty = Math.max(1, parseInt(String(bundleInput.qty), 10) || 1)
  const totalPence = Math.max(0, parseInt(String(bundleInput.totalPence), 10) || 0)
  const id = `${competition}:${bundleKey}`
  const bulletsJson = JSON.stringify(Array.isArray(bundleInput.bullets) ? bundleInput.bullets : [])
  const featuredVal = dbIsPostgres() ? Boolean(bundleInput.featured) : bundleInput.featured ? 1 : 0
  const testOnlyVal = dbIsPostgres() ? Boolean(bundleInput.testOnly) : bundleInput.testOnly ? 1 : 0
  const activeVal = dbIsPostgres()
    ? bundleInput.active !== false
    : bundleInput.active !== false
      ? 1
      : 0
  const now = new Date().toISOString()

  await query(
    `INSERT INTO competition_bundles (
      id, competition, bundle_key, qty, total_pence, title, line1, line2,
      bullets_json, featured, test_only, active, sort_order, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (competition, bundle_key) DO UPDATE SET
      qty = EXCLUDED.qty,
      total_pence = EXCLUDED.total_pence,
      title = EXCLUDED.title,
      line1 = EXCLUDED.line1,
      line2 = EXCLUDED.line2,
      bullets_json = EXCLUDED.bullets_json,
      featured = EXCLUDED.featured,
      test_only = EXCLUDED.test_only,
      active = EXCLUDED.active,
      sort_order = EXCLUDED.sort_order,
      updated_at = EXCLUDED.updated_at`,
    [
      id,
      competition,
      bundleKey,
      qty,
      totalPence,
      String(bundleInput.title || bundleKey).trim(),
      bundleInput.line1 || null,
      bundleInput.line2 || null,
      bulletsJson,
      featuredVal,
      testOnlyVal,
      activeVal,
      Number(bundleInput.sortOrder ?? 0),
      now,
    ],
  )

  return { ok: true, bundle: await getCompetitionBundle(competition, bundleKey) }
}

export async function deleteCompetitionBundle(competition, bundleKey) {
  await query(`DELETE FROM competition_bundles WHERE competition = $1 AND bundle_key = $2`, [
    competition,
    bundleKey,
  ])
  return { ok: true }
}

async function clearFeaturedOnHomepageExcept(slug) {
  const falseVal = dbIsPostgres() ? false : 0
  if (slug) {
    await query(`UPDATE competitions SET featured_on_homepage = $1 WHERE slug <> $2`, [falseVal, slug])
  } else {
    await query(`UPDATE competitions SET featured_on_homepage = $1`, [falseVal])
  }
}

/** Published main draw flagged for the homepage live promotion panel. */
export async function getFeaturedHomepageCompetition({ siteOrigin = '' } = {}) {
  await ensureCompetitionCatalogSchema()
  const featuredVal = dbIsPostgres() ? true : 1
  const r = await query(
    `SELECT slug FROM competitions
     WHERE featured_on_homepage = $1 AND status = $2 AND kind = $3
     ORDER BY sort_order ASC, title ASC LIMIT 1`,
    [featuredVal, COMPETITION_STATUS.published, COMPETITION_KIND.mainDraw],
  )
  const slug = r.rows[0]?.slug || DRAW_COMPETITION_SLUG
  return getPublicCompetitionDetail(slug, { siteOrigin })
}

export async function getPublicCompetitionDetail(slug, { siteOrigin = '' } = {}) {
  const competition = await getCompetitionBySlug(slug)
  if (!competition || competition.status !== COMPETITION_STATUS.published) {
    return null
  }
  if (competition.kind !== COMPETITION_KIND.mainDraw) return null

  const { listCompetitionSkillQuestions } = await import('./competitionSkillQuestions.mjs')
  const [bundles, openPeriod, countdownPeriod, skillQuestions] = await Promise.all([
    listCompetitionBundles(slug, { activeOnly: true }),
    getOpenCompetitionPeriod(slug),
    getCountdownPeriodForDisplay(slug),
    listCompetitionSkillQuestions(slug, { includeAnswers: false }),
  ])

  const mapPeriod = (period) =>
    period
      ? {
          id: period.id,
          title: period.title,
          entryOpensAt: period.entryOpensAt,
          entryClosesAt: period.entryClosesAt,
          status: period.status,
        }
      : null

  return {
    ...competition,
    heroImageUrl: competitionImagePublicUrl(competition.heroImageRef, siteOrigin),
    galleryUrls: competition.gallery.map((ref) => competitionImagePublicUrl(ref, siteOrigin)),
    skillQuestions,
    bundles: bundles.filter((b) => !b.testOnly).map((b) => ({
      id: b.bundleKey,
      qty: b.qty,
      totalPence: b.totalPence,
      title: b.title,
      line1: b.line1,
      line2: b.line2,
      bullets: b.bullets,
      featured: b.featured,
    })),
    openPeriod: mapPeriod(openPeriod),
    countdownPeriod: mapPeriod(countdownPeriod),
  }
}

export async function getPublicGiveawayDetail(slug, { siteOrigin = '' } = {}) {
  const competition = await getCompetitionBySlug(slug)
  if (!competition || competition.status !== COMPETITION_STATUS.published) {
    return null
  }
  if (competition.kind !== COMPETITION_KIND.giveaway) return null

  const { listCompetitionSkillQuestions } = await import('./competitionSkillQuestions.mjs')
  const [openPeriod, skillQuestions] = await Promise.all([
    getOpenCompetitionPeriod(slug),
    listCompetitionSkillQuestions(slug, { includeAnswers: false }),
  ])

  return {
    slug: competition.slug,
    title: competition.title,
    summary: competition.summary,
    kind: competition.kind,
    heroImageUrl: competitionImagePublicUrl(competition.heroImageRef, siteOrigin),
    galleryUrls: competition.gallery.map((ref) => competitionImagePublicUrl(ref, siteOrigin)),
    allowPaidEntry: false,
    allowFreeOnline: competition.allowFreeOnline,
    allowPostalEntry: competition.allowPostalEntry,
    postalCompetitionName: competition.postalCompetitionName,
    skillQuestions,
    openPeriod: openPeriod
      ? {
          id: openPeriod.id,
          title: openPeriod.title,
          entryOpensAt: openPeriod.entryOpensAt,
          entryClosesAt: openPeriod.entryClosesAt,
          status: openPeriod.status,
        }
      : null,
  }
}

export async function listPublishedGiveawayCompetitions({ siteOrigin = '' } = {}) {
  const rows = await listCompetitions({ status: COMPETITION_STATUS.published, kind: COMPETITION_KIND.giveaway })
  const enriched = await Promise.all(
    rows.map(async (c) => {
      const openPeriod = await getOpenCompetitionPeriod(c.slug)
      return {
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        kind: c.kind,
        heroImageUrl: competitionImagePublicUrl(c.heroImageRef, siteOrigin),
        galleryUrls: c.gallery.map((ref) => competitionImagePublicUrl(ref, siteOrigin)),
        allowPaidEntry: false,
        allowFreeOnline: c.allowFreeOnline,
        allowPostalEntry: c.allowPostalEntry,
        postalCompetitionName: c.postalCompetitionName,
        openPeriod: openPeriod
          ? {
              entryOpensAt: openPeriod.entryOpensAt,
              entryClosesAt: openPeriod.entryClosesAt,
              status: openPeriod.status,
            }
          : null,
      }
    }),
  )
  return enriched
}

export async function listPublishedMainDrawCompetitions({ siteOrigin = '' } = {}) {
  const rows = await listCompetitions({ status: COMPETITION_STATUS.published, kind: COMPETITION_KIND.mainDraw })
  const enriched = await Promise.all(
    rows.map(async (c) => {
      const [openPeriod, countdownPeriod, bundles] = await Promise.all([
        getOpenCompetitionPeriod(c.slug),
        getCountdownPeriodForDisplay(c.slug),
        listCompetitionBundles(c.slug, { activeOnly: true }),
      ])
      const publicBundles = bundles.filter((b) => !b.testOnly)
      const minPence = publicBundles.length
        ? Math.min(...publicBundles.map((b) => b.totalPence))
        : null
      return {
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        heroImageUrl: competitionImagePublicUrl(c.heroImageRef, siteOrigin),
        galleryUrls: c.gallery.map((ref) => competitionImagePublicUrl(ref, siteOrigin)),
        featuredOnHomepage: c.featuredOnHomepage,
        allowPaidEntry: c.allowPaidEntry,
        allowFreeOnline: c.allowFreeOnline,
        allowPostalEntry: c.allowPostalEntry,
        postalCompetitionName: c.postalCompetitionName,
        minBundlePence: minPence,
        bundleCount: publicBundles.length,
        openPeriod: openPeriod
          ? {
              entryOpensAt: openPeriod.entryOpensAt,
              entryClosesAt: openPeriod.entryClosesAt,
              status: openPeriod.status,
            }
          : null,
        countdownPeriod: countdownPeriod
          ? {
              entryOpensAt: countdownPeriod.entryOpensAt,
              entryClosesAt: countdownPeriod.entryClosesAt,
              status: countdownPeriod.status,
            }
          : null,
      }
    }),
  )
  return enriched
}

export async function listMainDrawSlugsFromDb() {
  await ensureCompetitionCatalogSchema()
  const rows = await listCompetitions({ kind: COMPETITION_KIND.mainDraw })
  return rows.map((r) => ({ slug: r.slug, label: r.title }))
}
