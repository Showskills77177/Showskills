import assert from 'node:assert/strict'
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

process.env.SQLITE_PATH = process.env.SQLITE_PATH || 'db/competition-catalog-test.sqlite'

const { query } = await import('../backend/api/lib/db.mjs')
const {
  ensureCompetitionCatalogSchema,
  getCompetitionBySlug,
  listCompetitionBundles,
  resolveTicketBundle,
  upsertCompetitionBundle,
  updateCompetition,
  createCompetition,
} = await import('../backend/api/lib/competitionCatalog.mjs')
const { DRAW_COMPETITION_SLUG, RONALDO_LEGACY_BUNDLE_ACTIVE } = await import('../shared/competitionPeriods.mjs')
const { IPHONE_17_PRO_COMPETITION_SLUG, IPHONE_17_PRO_COMPETITION_ACTIVE } = await import(
  '../shared/iphone17ProCompetition.mjs'
)
const { TICKET_BUNDLES } = await import('../shared/ticketBundles.mjs')
const { listCompetitionPeriods } = await import('../backend/api/lib/competitionPeriods.mjs')
const { resolveAdminMainDrawCompetition } = await import('../backend/api/lib/checkoutBundle.mjs')

try {
  await query(`DELETE FROM competition_bundles`)
  await query(`DELETE FROM competition_periods`)
  await query(`DELETE FROM competitions`)
} catch {
  /* fresh file */
}

await ensureCompetitionCatalogSchema()

const legacy = await getCompetitionBySlug(DRAW_COMPETITION_SLUG)
assert.ok(legacy, 'legacy competition seeded')
assert.equal(legacy.status, RONALDO_LEGACY_BUNDLE_ACTIVE ? 'published' : 'draft')

const bundles = await listCompetitionBundles(DRAW_COMPETITION_SLUG, { activeOnly: true })
assert.ok(bundles.length >= 5, 'bundles seeded from static catalog')

const medium = await resolveTicketBundle(DRAW_COMPETITION_SLUG, 'medium10')
assert.ok(medium)
assert.equal(medium.qty, 10)

const updated = await upsertCompetitionBundle(DRAW_COMPETITION_SLUG, {
  bundleKey: 'catalogtestmedium',
  title: 'Medium bundle (catalog test)',
  qty: 10,
  totalPence: 599,
  line1: '10 tickets = £5.99',
  active: true,
})
assert.ok(updated.ok)
const medium2 = await resolveTicketBundle(DRAW_COMPETITION_SLUG, 'catalogtestmedium')
assert.equal(medium2.totalPence, 599)

const canonicalMedium = TICKET_BUNDLES.find((b) => b.id === 'medium10')
assert.ok(canonicalMedium)
await upsertCompetitionBundle(DRAW_COMPETITION_SLUG, {
  bundleKey: canonicalMedium.id,
  title: canonicalMedium.title,
  qty: canonicalMedium.qty,
  totalPence: canonicalMedium.totalPence,
  line1: canonicalMedium.line1,
  line2: canonicalMedium.line2,
  featured: canonicalMedium.featured,
  active: true,
})

await updateCompetition(DRAW_COMPETITION_SLUG, {
  summary: 'Updated from catalog test',
})
const legacy2 = await getCompetitionBySlug(DRAW_COMPETITION_SLUG)
assert.equal(legacy2.summary, 'Updated from catalog test')

const iphone = await getCompetitionBySlug(IPHONE_17_PRO_COMPETITION_SLUG)
assert.ok(iphone, 'iPhone 17 Pro competition seeded')
assert.equal(iphone.status, IPHONE_17_PRO_COMPETITION_ACTIVE ? 'published' : 'draft')
assert.equal(iphone.allowPaidEntry, true)
assert.equal(iphone.allowFreeOnline, true)
assert.equal(iphone.allowPostalEntry, true)

const iphoneBundles = await listCompetitionBundles(IPHONE_17_PRO_COMPETITION_SLUG, { activeOnly: true })
assert.equal(iphoneBundles.length, 6)
const iphoneSingle = await resolveTicketBundle(IPHONE_17_PRO_COMPETITION_SLUG, 'single')
assert.ok(iphoneSingle)
assert.equal(iphoneSingle.totalPence, 29)
assert.equal(iphoneSingle.qty, 1)

await updateCompetition(IPHONE_17_PRO_COMPETITION_SLUG, { status: 'draft' })
await ensureCompetitionCatalogSchema()
const iphoneAfterSchema = await getCompetitionBySlug(IPHONE_17_PRO_COMPETITION_SLUG)
assert.equal(
  iphoneAfterSchema.status,
  IPHONE_17_PRO_COMPETITION_ACTIVE ? 'published' : 'draft',
  IPHONE_17_PRO_COMPETITION_ACTIVE
    ? 'iPhone draw re-published after draft'
    : 'iPhone draw stays inactive after schema ensure',
)

const opens = new Date('2026-06-01T10:00:00.000Z').toISOString()
const closes = new Date('2026-07-01T22:00:00.000Z').toISOString()
const created = await createCompetition({
  title: 'Test Admin Prize Draw',
  slug: 'test_admin_prize',
  summary: 'Created from catalog test',
  status: 'draft',
  entryOpensAt: opens,
  entryClosesAt: closes,
  periodTitle: 'Summer 2026',
  openPeriod: true,
  bundles: [
    { bundleKey: 'single', title: 'Single', qty: 1, totalPence: 80, active: true },
    { bundleKey: 'medium10', title: 'Medium', qty: 10, totalPence: 650, featured: true, active: true },
  ],
})
assert.ok(created.ok, created.error || 'create failed')
assert.equal(created.competition.slug, 'test_admin_prize')
const createdBundles = await listCompetitionBundles('test_admin_prize')
assert.equal(createdBundles.length, 2)
assert.equal(createdBundles.find((b) => b.bundleKey === 'medium10')?.totalPence, 650)

const periods = await listCompetitionPeriods('test_admin_prize')
assert.equal(periods.length, 1)
assert.equal(periods[0].status, 'open')

const second = await createCompetition({
  title: 'Second Parallel Draw',
  summary: 'Another isolated competition',
})
assert.ok(second.ok, second.error || 'second create failed')
assert.notEqual(second.competition.slug, 'test_admin_prize')
const secondBundles = await listCompetitionBundles(second.competition.slug)
assert.ok(secondBundles.length >= 5, 'default standard bundle tiers seeded')
const secondPeriods = await listCompetitionPeriods(second.competition.slug)
assert.equal(secondPeriods.length, 1)

const resolved = await resolveAdminMainDrawCompetition('test_admin_prize')
assert.ok(resolved.ok)
assert.equal(resolved.slug, 'test_admin_prize')

console.log('competition catalog tests passed')
