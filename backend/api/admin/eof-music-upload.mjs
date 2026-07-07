import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { json } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofOwner } from '../lib/eofYoutubeAuth.mjs'
import { createEofMusicTrack } from '../lib/eofMusicTracks.mjs'
import { EOF_MUSIC_SOURCE_YOUTUBE_LIBRARY } from '../../../shared/eofProduction.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** POST multipart audio upload (local API / worker — not Vercel-friendly for large files). */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!isShowSkillsStagingServerEnabled()) {
    return json(res, 404, { error: 'Not available.' })
  }

  try {
    await requireEofOwner(req)
  } catch (e) {
    return json(res, e.statusCode || 403, { error: 'Only the channel owner can upload music.' })
  }

  const file = req.file
  if (!file?.buffer?.length) {
    return json(res, 400, { error: 'MP3 file is required (field name: audio).' })
  }

  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : file.originalname
  const mood = typeof req.body?.mood === 'string' ? req.body.mood : 'neutral'
  const isDefault = req.body?.isDefault === 'true' || req.body?.isDefault === true

  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  const relDir = 'storage/eof/music'
  mkdirSync(join(root, relDir), { recursive: true })
  const relPath = `${relDir}/${Date.now()}-${safeName}`

  await import('node:fs/promises').then((fs) => fs.writeFile(join(root, relPath), file.buffer))

  const track = await createEofMusicTrack({
    title,
    mood,
    source: EOF_MUSIC_SOURCE_YOUTUBE_LIBRARY,
    storagePath: relPath,
    isDefault,
    licenseNote: 'YouTube Audio Library — use only on YouTube.',
  })

  return json(res, 201, { ok: true, track })
}
