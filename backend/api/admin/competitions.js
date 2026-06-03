import { requireAdmin } from '../lib/adminAuth.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { parseJsonBody, json } from '../lib/http.mjs'
import {
  createCompetition,
  deleteCompetitionBundle,
  ensureCompetitionCatalogSchema,
  getCompetitionBySlug,
  listCompetitionBundles,
  listCompetitions,
  updateCompetition,
  upsertCompetitionBundle,
  competitionImagePublicUrl,
} from '../lib/competitionCatalog.mjs'
import {
  countCompetitionTransactionalData,
  deleteCompetition,
  purgeCompetitionTransactionalData,
} from '../lib/competitionDeletion.mjs'
import {
  createCompetitionPeriod,
  listCompetitionPeriods,
  updateCompetitionPeriod,
  updateCompetitionPeriodStatus,
} from '../lib/competitionPeriods.mjs'
import { PERIOD_STATUS } from '../../../shared/competitionPeriods.mjs'
import {
  listCompetitionSkillQuestions,
  replaceCompetitionSkillQuestions,
} from '../lib/competitionSkillQuestions.mjs'
import {
  assertPeriodCompetitionSlug,
  getLegacyShirtGiveawayAdminDetail,
  isLegacyShirtGiveawaySlug,
} from '../lib/legacyShirtGiveaway.mjs'

async function enrichCompetition(row, siteOrigin) {
  if (!row) return null
  const [bundles, periods, skillQuestions] = await Promise.all([
    listCompetitionBundles(row.slug),
    listCompetitionPeriods(row.slug),
    listCompetitionSkillQuestions(row.slug),
  ])
  return {
    ...row,
    heroImageUrl: competitionImagePublicUrl(row.heroImageRef, siteOrigin),
    galleryUrls: row.gallery.map((ref) => competitionImagePublicUrl(ref, siteOrigin)),
    bundles,
    skillQuestions,
    periods: periods.map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      entryOpensAt: p.entryOpensAt,
      entryClosesAt: p.entryClosesAt,
      status: p.status,
    })),
  }
}

function siteOriginFromReq(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000'
  return `${proto}://${host}`.replace(/\/$/, '')
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  try {
    await requireAdmin(req)
  } catch {
    return json(res, 401, { error: 'Unauthorized' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  await ensureCompetitionCatalogSchema()
  const siteOrigin = siteOriginFromReq(req)

  try {
    const url = new URL(req.url || '/', 'http://local')
    const slug = (url.searchParams.get('slug') || '').trim()

    if (req.method === 'GET') {
      if (slug) {
        if (isLegacyShirtGiveawaySlug(slug)) {
          return json(res, 200, { ok: true, competition: await getLegacyShirtGiveawayAdminDetail() })
        }
        const row = await getCompetitionBySlug(slug)
        if (!row) return json(res, 404, { error: 'Competition not found.' })
        return json(res, 200, { ok: true, competition: await enrichCompetition(row, siteOrigin) })
      }
      const kindFilter = (url.searchParams.get('kind') || '').trim()
      const rows = await listCompetitions(
        kindFilter === 'giveaway' || kindFilter === 'main_draw' ? { kind: kindFilter } : {},
      )
      const enriched = await Promise.all(rows.map((r) => enrichCompetition(r, siteOrigin)))
      return json(res, 200, { ok: true, competitions: enriched })
    }

    if (req.method === 'POST') {
      const body = parseJsonBody(req)
      if (body.action === 'upsertBundle') {
        const compSlug = typeof body.competition === 'string' ? body.competition.trim() : ''
        if (!compSlug) return json(res, 400, { error: 'competition required' })
        const result = await upsertCompetitionBundle(compSlug, body.bundle || body)
        if (!result.ok) return json(res, 400, { error: result.error })
        return json(res, 200, result)
      }
      if (body.action === 'transactionCounts') {
        const compSlug = typeof body.competition === 'string' ? body.competition.trim() : ''
        if (!compSlug) return json(res, 400, { error: 'competition required' })
        const counts = await countCompetitionTransactionalData(compSlug)
        return json(res, 200, { ok: true, counts })
      }
      if (body.action === 'purgeCompetitionData') {
        const compSlug = typeof body.competition === 'string' ? body.competition.trim() : ''
        const confirmSlug = typeof body.confirmSlug === 'string' ? body.confirmSlug.trim() : ''
        if (!compSlug || confirmSlug !== compSlug) {
          return json(res, 400, { error: 'Type the competition slug exactly to confirm purge.' })
        }
        const result = await purgeCompetitionTransactionalData(compSlug)
        if (!result.ok) return json(res, 400, { error: result.error })
        return json(res, 200, result)
      }
      if (body.action === 'deleteCompetition') {
        const compSlug = typeof body.competition === 'string' ? body.competition.trim() : ''
        const confirmSlug = typeof body.confirmSlug === 'string' ? body.confirmSlug.trim() : ''
        const purgeData = body.purgeData === true
        const result = await deleteCompetition(compSlug, { purgeData, confirmSlug })
        if (!result.ok) return json(res, 400, { error: result.error, counts: result.counts })
        return json(res, 200, result)
      }
      if (body.action === 'updatePeriod') {
        const periodId = typeof body.periodId === 'string' ? body.periodId.trim() : ''
        if (!periodId) return json(res, 400, { error: 'periodId required' })
        const updated = await updateCompetitionPeriod(periodId, {
          title: body.title,
          summary: body.summary,
          entryOpensAt: body.entryOpensAt,
          entryClosesAt: body.entryClosesAt,
        })
        if (!updated.ok) return json(res, 400, { error: updated.error })
        const compSlug = updated.period.competition
        const competition = isLegacyShirtGiveawaySlug(compSlug)
          ? await getLegacyShirtGiveawayAdminDetail()
          : await enrichCompetition(await getCompetitionBySlug(compSlug), siteOrigin)
        return json(res, 200, {
          ok: true,
          period: updated.period,
          competition,
        })
      }
      if (body.action === 'saveSkillQuestions') {
        const compSlug = typeof body.competition === 'string' ? body.competition.trim() : ''
        if (!compSlug) return json(res, 400, { error: 'competition required' })
        const result = await replaceCompetitionSkillQuestions(compSlug, body.questions)
        if (!result.ok) return json(res, 400, { error: result.error })
        const row = await getCompetitionBySlug(compSlug)
        return json(res, 200, {
          ok: true,
          skillQuestions: result.questions,
          competition: await enrichCompetition(row, siteOrigin),
        })
      }
      if (body.action === 'createPeriod') {
        const compSlug = typeof body.competition === 'string' ? body.competition.trim() : ''
        const check = await assertPeriodCompetitionSlug(compSlug)
        if (!check.ok) return json(res, 400, { error: check.error })
        const title = typeof body.title === 'string' ? body.title.trim() : ''
        const summary = typeof body.summary === 'string' ? body.summary.trim() : ''
        const entryOpensAt = body.entryOpensAt || body.entry_opens_at
        const entryClosesAt = body.entryClosesAt || body.entry_closes_at
        const status =
          typeof body.status === 'string' && Object.values(PERIOD_STATUS).includes(body.status)
            ? body.status
            : PERIOD_STATUS.draft
        if (!title || !entryOpensAt || !entryClosesAt) {
          return json(res, 400, { error: 'title, entryOpensAt, and entryClosesAt are required.' })
        }
        const created = await createCompetitionPeriod({
          competition: compSlug,
          title,
          summary,
          entryOpensAt,
          entryClosesAt,
          status,
        })
        if (!created.ok) return json(res, 400, { error: created.error })
        const competition = check.legacyShirt
          ? await getLegacyShirtGiveawayAdminDetail()
          : await enrichCompetition(check.competition, siteOrigin)
        return json(res, 201, { ok: true, period: created.period || null, competition })
      }

      const title = typeof body.title === 'string' ? body.title.trim() : ''
      if (!title) return json(res, 400, { error: 'title is required' })
      const created = await createCompetition({
        slug: body.slug,
        title,
        summary: body.summary,
        rulesMarkdown: body.rulesMarkdown,
        status: body.status,
        sortOrder: body.sortOrder,
        entryOpensAt: body.entryOpensAt,
        entryClosesAt: body.entryClosesAt,
        periodTitle: body.periodTitle,
        openPeriod: body.openPeriod === true,
        bundles: Array.isArray(body.bundles) ? body.bundles : undefined,
        skillQuestions: Array.isArray(body.skillQuestions) ? body.skillQuestions : undefined,
        kind: body.kind === 'giveaway' ? 'giveaway' : 'main_draw',
        allowPaidEntry: body.allowPaidEntry,
        allowFreeOnline: body.allowFreeOnline,
        allowPostalEntry: body.allowPostalEntry,
        postalCompetitionName: body.postalCompetitionName,
        featuredOnHomepage: body.featuredOnHomepage === true,
      })
      if (!created.ok) return json(res, 400, { error: created.error })
      return json(res, 201, {
        ok: true,
        competition: await enrichCompetition(created.competition, siteOrigin),
      })
    }

    if (req.method === 'PATCH') {
      const body = parseJsonBody(req)
      const compSlug = typeof body.slug === 'string' ? body.slug.trim() : slug
      if (!compSlug) return json(res, 400, { error: 'slug required' })

      if (body.action === 'periodStatus') {
        const periodId = typeof body.periodId === 'string' ? body.periodId.trim() : ''
        const status = typeof body.status === 'string' ? body.status.trim() : ''
        if (!periodId || !status) return json(res, 400, { error: 'periodId and status required' })
        const updated = await updateCompetitionPeriodStatus(periodId, status)
        if (!updated.ok) return json(res, 400, { error: updated.error })
        const competition = isLegacyShirtGiveawaySlug(compSlug)
          ? await getLegacyShirtGiveawayAdminDetail()
          : await enrichCompetition(await getCompetitionBySlug(compSlug), siteOrigin)
        return json(res, 200, { ...updated, competition })
      }

      const updated = await updateCompetition(compSlug, body)
      if (!updated.ok) return json(res, 400, { error: updated.error })
      return json(res, 200, {
        ok: true,
        competition: await enrichCompetition(updated.competition, siteOrigin),
      })
    }

    if (req.method === 'DELETE') {
      const body = parseJsonBody(req)
      const compSlug = typeof body.competition === 'string' ? body.competition.trim() : slug
      const bundleKey = typeof body.bundleKey === 'string' ? body.bundleKey.trim() : ''
      if (!compSlug || !bundleKey) {
        return json(res, 400, { error: 'competition and bundleKey required' })
      }
      await deleteCompetitionBundle(compSlug, bundleKey)
      return json(res, 200, { ok: true })
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not update competition.' })
  }
}
