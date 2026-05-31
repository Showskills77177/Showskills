import { query } from './db.mjs'
import { ensureCompetitionPeriodsSchema } from './competitionPeriods.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'
import { ensureDrawSchema } from './qualifiedDrawPool.mjs'
import { getCompetitionBySlug } from './competitionCatalog.mjs'
import { deleteLocalCompetitionImageFromRef } from './competitionUploads.mjs'

async function ticketIdsForCompetition(slug) {
  await ensureTicketSchema()
  await ensureCompetitionPeriodsSchema()
  const r = await query(
    `SELECT t.id
     FROM tickets t
     LEFT JOIN competition_periods cp ON cp.id = t.period_id
     WHERE t.competition = $1 OR cp.competition = $1`,
    [slug],
  )
  return r.rows.map((row) => row.id).filter(Boolean)
}

export async function countCompetitionTransactionalData(slug) {
  await ensureTicketSchema()
  await ensureCompetitionPeriodsSchema()
  await ensureDrawSchema()

  const ticketIds = await ticketIdsForCompetition(slug)
  const [entries, drawRuns, payments] = await Promise.all([
    query(`SELECT COUNT(*)::int AS c FROM competition_entries WHERE competition = $1`, [slug]),
    query(`SELECT COUNT(*)::int AS c FROM draw_runs WHERE competition = $1`, [slug]).catch(() => ({
      rows: [{ c: 0 }],
    })),
    ticketIds.length
      ? query(
          `SELECT COUNT(*)::int AS c FROM payments WHERE ticket_id IN (${ticketIds.map((_, i) => `$${i + 1}`).join(', ')})`,
          ticketIds,
        )
      : Promise.resolve({ rows: [{ c: 0 }] }),
  ])

  return {
    tickets: ticketIds.length,
    payments: payments.rows[0]?.c ?? 0,
    entries: entries.rows[0]?.c ?? 0,
    drawRuns: drawRuns.rows[0]?.c ?? 0,
  }
}

/** Removes tickets, payments, quiz entries, and draw audit rows for one competition. */
export async function purgeCompetitionTransactionalData(slug) {
  const existing = await getCompetitionBySlug(slug)
  if (!existing) return { ok: false, error: 'Competition not found.' }

  await ensureTicketSchema()
  await ensureCompetitionPeriodsSchema()
  await ensureDrawSchema()

  const ticketIds = await ticketIdsForCompetition(slug)
  let paymentsDeleted = 0
  let ticketsDeleted = 0

  if (ticketIds.length) {
    const placeholders = ticketIds.map((_, i) => `$${i + 1}`).join(', ')
    const payDel = await query(`DELETE FROM payments WHERE ticket_id IN (${placeholders})`, ticketIds)
    paymentsDeleted = payDel.rowCount ?? ticketIds.length
    await query(`DELETE FROM ticket_numbers WHERE ticket_id IN (${placeholders})`, ticketIds)
    const ticketDel = await query(`DELETE FROM tickets WHERE id IN (${placeholders})`, ticketIds)
    ticketsDeleted = ticketDel.rowCount ?? ticketIds.length
  }

  const entriesDel = await query(`DELETE FROM competition_entries WHERE competition = $1`, [slug])
  const drawDel = await query(`DELETE FROM draw_runs WHERE competition = $1`, [slug]).catch(() => ({
    rowCount: 0,
  }))

  return {
    ok: true,
    purged: {
      tickets: ticketsDeleted,
      payments: paymentsDeleted,
      entries: entriesDel.rowCount ?? 0,
      drawRuns: drawDel.rowCount ?? 0,
    },
  }
}

function deleteCompetitionImages(row) {
  if (row?.heroImageRef) deleteLocalCompetitionImageFromRef(row.heroImageRef)
  for (const ref of row?.gallery || []) {
    deleteLocalCompetitionImageFromRef(ref)
  }
}

/** Deletes catalog rows (and optionally transactional data). Requires confirmSlug === slug. */
export async function deleteCompetition(slug, { purgeData = false, confirmSlug = '' } = {}) {
  const existing = await getCompetitionBySlug(slug)
  if (!existing) return { ok: false, error: 'Competition not found.' }
  if (confirmSlug.trim() !== slug) {
    return { ok: false, error: 'Type the competition slug exactly to confirm deletion.' }
  }

  const counts = await countCompetitionTransactionalData(slug)
  const hasData =
    counts.tickets > 0 || counts.entries > 0 || counts.payments > 0 || counts.drawRuns > 0

  if (hasData && !purgeData) {
    return {
      ok: false,
      error:
        'This competition still has tickets, entries, or draw records. Purge that data first, or confirm permanent delete with purgeData.',
      counts,
    }
  }

  let purged = null
  if (purgeData && hasData) {
    const purgeResult = await purgeCompetitionTransactionalData(slug)
    if (!purgeResult.ok) return purgeResult
    purged = purgeResult.purged
  }

  deleteCompetitionImages(existing)

  await query(`DELETE FROM competition_bundles WHERE competition = $1`, [slug])
  await query(`DELETE FROM competition_periods WHERE competition = $1`, [slug])
  await query(`DELETE FROM competitions WHERE slug = $1`, [slug])

  return { ok: true, deletedSlug: slug, purged }
}
