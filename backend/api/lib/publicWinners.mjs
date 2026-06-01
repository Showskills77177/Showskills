import { query } from './db.mjs'
import { maskWinnerName } from '../../../shared/homepageLayout.mjs'
import { getHomepageLayout } from './homepageLayout.mjs'

export async function listPublicWinners({ limit = 6 } = {}) {
  const layout = await getHomepageLayout()
  const maxItems = Math.min(
    20,
    Math.max(1, Number(layout?.blocks?.winners_panel?.maxItems) || limit),
  )
  const manual = Array.isArray(layout?.blocks?.winners_panel?.manualWinners)
    ? layout.blocks.winners_panel.manualWinners
        .filter((w) => w?.name && w?.prize)
        .map((w) => ({
          name: String(w.name).trim(),
          prize: String(w.prize).trim(),
          drawnAt: w.drawnAt || null,
          source: 'manual',
        }))
    : []

  let fromDraws = []
  try {
    const r = await query(
      `SELECT dr.winner_full_name, dr.competition, dr.drawn_at, c.title AS competition_title
       FROM draw_runs dr
       LEFT JOIN competitions c ON c.slug = dr.competition
       ORDER BY dr.drawn_at DESC
       LIMIT $1`,
      [maxItems],
    )
    fromDraws = (r.rows || []).map((row) => ({
      name: maskWinnerName(row.winner_full_name),
      prize: row.competition_title || row.competition || 'Prize draw',
      drawnAt: row.drawn_at,
      source: 'draw',
    }))
  } catch {
    fromDraws = []
  }

  const combined = [...manual, ...fromDraws].slice(0, maxItems)
  return combined
}
