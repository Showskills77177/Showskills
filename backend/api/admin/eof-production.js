import { json, readJsonBody } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofSession, eofSessionInfo } from '../lib/eofYoutubeAuth.mjs'
import { ensureEofMusicCatalogSeeded, listEofMusicTracks } from '../lib/eofMusicTracks.mjs'
import {
  listEofProductionJobs,
  createEofProductionJob,
  getEofProductionJob,
  updateEofProductionJob,
  regenerateEofProductionScript,
} from '../lib/eofProductionJobs.mjs'
import { renderEofProductionAudio } from '../lib/eofProductionRender.mjs'
import { isFfmpegAvailable } from '../lib/eofAudioMix.mjs'
import { EOF_VOICE_PRESETS } from '../../../shared/eofProduction.mjs'

/** GET hub data · POST create/render/update production jobs */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  if (!isShowSkillsStagingServerEnabled()) {
    return json(res, 404, { error: 'Eyes Of Football production is only available on staging.' })
  }

  let session
  try {
    session = await requireEofSession(req)
  } catch (e) {
    return json(res, e.statusCode || 401, { error: 'Unauthorized' })
  }

  const info = eofSessionInfo(session)

  try {
    if (req.method === 'GET') {
      await ensureEofMusicCatalogSeeded()

      let jobs = []
      let tracks = []
      let ffmpeg = false

      try {
        jobs = await listEofProductionJobs()
      } catch (e) {
        console.error('[eof-production] jobs', e)
      }

      try {
        tracks = await listEofMusicTracks()
      } catch (e) {
        console.error('[eof-production] tracks', e)
      }

      try {
        ffmpeg = await isFfmpegAvailable()
      } catch {
        ffmpeg = false
      }

      return json(res, 200, {
        ok: true,
        jobs,
        tracks,
        voicePresets: Object.values(EOF_VOICE_PRESETS),
        ffmpegAvailable: ffmpeg,
        renderNote: ffmpeg
          ? null
          : 'Audio render needs ffmpeg (bundled ffmpeg-static on deploy, or FFMPEG_PATH locally).',
        session: info,
      })
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      const action = typeof body.action === 'string' ? body.action : 'create'

      if (action === 'render') {
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        try {
          const job = await renderEofProductionAudio(jobId)
          return json(res, 200, { ok: true, job })
        } catch (e) {
          return json(res, 500, { error: e instanceof Error ? e.message : 'Render failed' })
        }
      }

      if (action === 'regenerate-script') {
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const job = await regenerateEofProductionScript(jobId)
        return json(res, 200, { ok: true, job })
      }

      const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
      const voicePreset = typeof body.voicePreset === 'string' ? body.voicePreset : 'british'
      const musicTrackId = typeof body.musicTrackId === 'string' ? body.musicTrackId.trim() : null
      try {
        const job = await createEofProductionJob({
          topic,
          createdBy: info.username,
          voicePreset,
          musicTrackId,
        })
        return json(res, 201, { ok: true, job })
      } catch (e) {
        return json(res, 400, { error: e instanceof Error ? e.message : 'Could not create job' })
      }
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req)
      const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
      if (!jobId) return json(res, 400, { error: 'jobId is required.' })

      const existing = await getEofProductionJob(jobId)
      if (!existing) return json(res, 404, { error: 'Job not found.' })

      const job = await updateEofProductionJob(jobId, {
        script: body.script,
        title: body.title,
        topic: body.topic,
        musicTrackId: body.musicTrackId,
        musicVolume: body.musicVolume,
        voicePreset: body.voicePreset,
      })
      return json(res, 200, { ok: true, job })
    }

    res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error('[eof-production] handler', e)
    const msg = e instanceof Error ? e.message : 'Could not load production'
    return json(res, 500, { error: msg })
  }
}
