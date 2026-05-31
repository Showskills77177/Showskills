import { parseAdminCompetitionFilter } from '../../../shared/adminCompetitions.mjs'

/** @param {URL} url */
export function parseAdminListQuery(url, { competitionKind } = {}) {
  const q = (url.searchParams.get('q') || '').trim()
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(
    100,
    Math.max(10, parseInt(url.searchParams.get('pageSize') || '40', 10) || 40),
  )
  const offset = (page - 1) * pageSize
  const competition = competitionKind
    ? parseAdminCompetitionFilter(url.searchParams, { kind: competitionKind })
    : null
  return { q, page, pageSize, offset, competition }
}

export function adminListMeta(total, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  }
}
