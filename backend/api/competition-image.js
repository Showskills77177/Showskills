import { json } from './lib/http.mjs'
import { resolveCompetitionImagePathFromRef, streamCompetitionImage } from './lib/competitionUploads.mjs'

function contentTypeForPath(filePath) {
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.webp')) return 'image/webp'
  if (filePath.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

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

  const url = new URL(req.url || '/', 'http://local')
  const ref = (url.searchParams.get('ref') || '').trim()
  if (!ref.startsWith('local:')) {
    return json(res, 400, { error: 'Invalid image reference' })
  }

  const filePath = resolveCompetitionImagePathFromRef(ref)
  if (!filePath) {
    return json(res, 404, { error: 'Image not found' })
  }

  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.setHeader('Content-Type', contentTypeForPath(filePath))
  if (typeof res.sendFile === 'function') {
    return res.sendFile(filePath)
  }
  streamCompetitionImage(filePath, res)
}
