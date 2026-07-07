import assert from 'node:assert/strict'
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

process.env.SQLITE_PATH = process.env.SQLITE_PATH || 'db/iphone17-pro-bundle-test.sqlite'

const { IPHONE_17_PRO_COMPETITION_SLUG, IPHONE_17_PRO_COMPETITION_ACTIVE } = await import(
  '../shared/iphone17ProCompetition.mjs'
)
const {
  ensureCompetitionCatalogSchema,
  getCompetitionBySlug,
  getPublicCompetitionDetail,
  listCompetitionBundles,
  resolveTicketBundle,
} = await import('../backend/api/lib/competitionCatalog.mjs')
const { resolveCheckoutBundle } = await import('../backend/api/lib/checkoutBundle.mjs')
const { resolveSkillValidation } = await import('../backend/api/lib/competitionSkillQuestions.mjs')
const { getOpenCompetitionPeriodForEntry } = await import('../backend/api/lib/competitionPeriods.mjs')
const { listCompetitionSkillQuestions } = await import('../backend/api/lib/competitionSkillQuestions.mjs')

await ensureCompetitionCatalogSchema()

const slug = IPHONE_17_PRO_COMPETITION_SLUG
const comp = await getCompetitionBySlug(slug)
assert.ok(comp, 'iPhone competition exists')
assert.equal(comp.status, IPHONE_17_PRO_COMPETITION_ACTIVE ? 'published' : 'draft')
assert.equal(comp.allowPaidEntry, true)
assert.equal(comp.allowFreeOnline, true)
assert.equal(comp.allowPostalEntry, true)

const bundles = await listCompetitionBundles(slug, { activeOnly: true })
assert.equal(bundles.length, 6)

const single = await resolveTicketBundle(slug, 'single')
assert.ok(single)
assert.equal(single.totalPence, 29)
assert.equal(single.qty, 1)

const value10 = await resolveTicketBundle(slug, 'value10')
assert.ok(value10)
assert.equal(value10.totalPence, 270)
assert.equal(value10.qty, 10)

const checkout = await resolveCheckoutBundle(slug, 'single')
if (IPHONE_17_PRO_COMPETITION_ACTIVE) {
  assert.ok(checkout.ok, checkout.error || 'checkout bundle failed')
  assert.equal(checkout.bundle.totalPence, 29)
  assert.equal(checkout.competition, slug)
} else {
  assert.equal(checkout.ok, false, 'inactive iPhone draw cannot checkout')
}

const legacySingle = await resolveCheckoutBundle(slug, 'medium10')
assert.equal(legacySingle.ok, false, 'legacy bundle ids must not work on iPhone draw')

const detail = await getPublicCompetitionDetail(slug)
if (IPHONE_17_PRO_COMPETITION_ACTIVE) {
  assert.ok(detail)
  assert.ok(detail.bundles.length >= 5)
  assert.equal(detail.bundles[0].totalPence, 29)
  assert.equal(detail.skillQuestions.length, 3)
} else {
  assert.equal(detail, null, 'inactive iPhone draw is not public')
}

const skillRows = await listCompetitionSkillQuestions(slug, { includeAnswers: true })
assert.equal(skillRows.length, 3)

const pass = await resolveSkillValidation(slug, {
  q1: '£1,099',
  q2: 'A19 Pro',
  q3: 'Silver',
})
assert.equal(pass.allCorrect, true, pass.error || 'expected quiz pass')

const fail = await resolveSkillValidation(slug, {
  q1: '999',
  q2: 'A19 Pro',
  q3: 'Silver',
})
assert.equal(fail.allCorrect, false)

const period = await getOpenCompetitionPeriodForEntry(slug)
assert.ok(period.ok, period.error || 'entry period should be open for tests')

console.log('iphone 17 pro bundle tests passed')
