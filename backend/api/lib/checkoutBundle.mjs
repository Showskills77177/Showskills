import { DRAW_COMPETITION_SLUG } from '../../../shared/competitionPeriods.mjs'
import { isValidCompetitionSlug } from '../../../shared/adminCompetitions.mjs'
import {
  assertMainDrawCompetitionSlug,
  getCompetitionBySlug,
  resolveTicketBundle,
} from './competitionCatalog.mjs'

export async function parseCheckoutCompetition(body) {
  const raw = typeof body?.competition === 'string' ? body.competition.trim() : ''
  if (raw && isValidCompetitionSlug(raw)) {
    const check = await assertMainDrawCompetitionSlug(raw)
    if (check.ok) return raw
  }
  return DRAW_COMPETITION_SLUG
}

export async function resolveCheckoutBundle(competition, bundleId) {
  const check = await assertMainDrawCompetitionSlug(competition)
  if (!check.ok) return { ok: false, error: check.error }

  const bundle = await resolveTicketBundle(competition, bundleId, { includeTest: false })
  if (!bundle) return { ok: false, error: 'Invalid or missing bundleId' }

  const catalog = check.competition
  if (catalog.status !== 'published') {
    return { ok: false, error: 'This competition is not open for entry.' }
  }

  return { ok: true, bundle, competition, competitionTitle: catalog.title }
}

/** Resolve competition slug for admin/draw APIs — any catalog main_draw row. */
export async function resolveAdminMainDrawCompetition(competitionParam) {
  const raw = String(competitionParam || '').trim()
  if (!raw) {
    const legacy = await getCompetitionBySlug(DRAW_COMPETITION_SLUG)
    if (legacy) return { ok: true, competition: legacy, slug: DRAW_COMPETITION_SLUG }
    return { ok: false, error: 'No competition configured.' }
  }
  const check = await assertMainDrawCompetitionSlug(raw)
  if (!check.ok) return check
  return { ok: true, competition: check.competition, slug: check.competition.slug }
}
