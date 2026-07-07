import { json, readJsonBody } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofOwner } from '../lib/eofYoutubeAuth.mjs'
import {
  listEofMusicTracks,
  createEofMusicTrack,
  updateEofMusicTrack,
} from '../lib/eofMusicTracks.mjs'
import { EOF_MUSIC_MOODS, EOF_MUSIC_SOURCE_YOUTUBE_LIBRARY } from '../../../shared/eofProduction.mjs'

/** GET tracks · POST register track · PATCH update track */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  if (!isShowSkillsStagingServerEnabled()) {
    return json(res, 404, { error: 'Eyes Of Football music library is only available on staging.' })
  }

  try {
    await requireEofOwner(req)
  } catch (e) {
    return json(res, e.statusCode || 403, { error: 'Only the channel owner can manage music.' })
  }

  if (req.method === 'GET') {
    const tracks = await listEofMusicTracks({ activeOnly: false })
    return json(res, 200, { ok: true, tracks, moods: EOF_MUSIC_MOODS })
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    try {
      const track = await createEofMusicTrack({
        title: body.title,
        mood: body.mood || 'neutral',
        source: body.source || EOF_MUSIC_SOURCE_YOUTUBE_LIBRARY,
        publicUrl: body.publicUrl || null,
        storagePath: body.storagePath || null,
        durationSeconds: body.durationSeconds ?? null,
        isDefault: body.isDefault === true,
        licenseNote: body.licenseNote || 'YouTube Audio Library — for use on YouTube only.',
      })
      return json(res, 201, { ok: true, track })
    } catch (e) {
      return json(res, 400, { error: e instanceof Error ? e.message : 'Could not add track' })
    }
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req)
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) return json(res, 400, { error: 'id is required.' })
    try {
      const track = await updateEofMusicTrack(id, {
        title: body.title,
        mood: body.mood,
        active: body.active,
        isDefault: body.isDefault,
        licenseNote: body.licenseNote,
      })
      return json(res, 200, { ok: true, track })
    } catch (e) {
      return json(res, 400, { error: e instanceof Error ? e.message : 'Could not update track' })
    }
  }

  res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS')
  return json(res, 405, { error: 'Method not allowed' })
}
