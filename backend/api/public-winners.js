import { json } from './lib/http.mjs'
import { isDbConfigured } from './lib/db.mjs'
import { listPublicWinners } from './lib/publicWinners.mjs'
import { getHomepageLayout } from './lib/homepageLayout.mjs'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!isDbConfigured()) {
    return json(res, 200, { ok: true, winners: [], enabled: false })
  }

  try {
    const layout = await getHomepageLayout()
    const enabled = layout?.blocks?.winners_panel?.visible !== false
    if (!enabled) return json(res, 200, { ok: true, winners: [], enabled: false })
    const winners = await listPublicWinners()
    return json(res, 200, {
      ok: true,
      enabled: true,
      title: layout.blocks?.winners_panel?.title || 'Recent winners',
      subtitle: layout.blocks?.winners_panel?.subtitle || '',
      winners,
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not load winners.' })
  }
}
