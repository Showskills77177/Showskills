import { json } from './lib/http.mjs'
import { isDbConfigured } from './lib/db.mjs'
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

  res.setHeader('Cache-Control', 'private, no-store, must-revalidate')

  if (!isDbConfigured()) {
    const { defaultHomepageLayout } = await import('../../shared/homepageLayout.mjs')
    return json(res, 200, { ok: true, layout: defaultHomepageLayout(), source: 'defaults' })
  }

  try {
    const layout = await getHomepageLayout()
    return json(res, 200, { ok: true, layout, source: 'database' })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not load homepage layout.' })
  }
}
