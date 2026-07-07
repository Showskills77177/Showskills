import { json, readJsonBody } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofSession, requireEofOwner, eofSessionInfo } from '../lib/eofYoutubeAuth.mjs'
import { ensureEofMusicCatalogSeeded, listEofMusicTracks } from '../lib/eofMusicTracks.mjs'
import {
  listEofProductionJobs,
  createEofProductionJob,
  getEofProductionJob,
  updateEofProductionJob,
  regenerateEofProductionScript,
  deleteEofProductionJob,
  cancelEofProductionRender,
} from '../lib/eofProductionJobs.mjs'
import { renderEofProductionAudio, readEofMixedAudioInline } from '../lib/eofProductionRender.mjs'
import { startEofProductionRenderBackground, startEofProductionVideoRenderBackground } from '../lib/eofProductionRenderRunner.mjs'
import { isFfmpegAvailable } from '../lib/eofAudioMix.mjs'
import { EOF_VOICE_PRESETS, EOF_RENDER_STACK } from '../../../shared/eofProduction.mjs'

/** GET hub data · POST create/render/update production jobs */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
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
        renderStack: EOF_RENDER_STACK,
        session: info,
      })
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      const action = typeof body.action === 'string' ? body.action : 'create'

      if (action === 'render') {
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const existing = await getEofProductionJob(jobId)
        if (!existing) return json(res, 404, { error: 'Job not found.' })
        if (existing.status === 'rendering') {
          return json(res, 202, { ok: true, accepted: true, job: existing })
        }

        const asyncRender = body.wait !== true
        if (asyncRender) {
          try {
            await startEofProductionRenderBackground(jobId)
            const job = await getEofProductionJob(jobId)
            return json(res, 202, { ok: true, accepted: true, job })
          } catch (e) {
            return json(res, 500, { error: e instanceof Error ? e.message : 'Render failed' })
          }
        }

        try {
          const job = await renderEofProductionAudio(jobId)
          const audioDataUrl = await readEofMixedAudioInline(jobId)
          return json(res, 200, { ok: true, job, audioDataUrl })
        } catch (e) {
          return json(res, 500, { error: e instanceof Error ? e.message : 'Render failed' })
        }
      }

      if (action === 'render-video') {
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const existing = await getEofProductionJob(jobId)
        if (!existing) return json(res, 404, { error: 'Job not found.' })
        if (existing.status === 'rendering_video') {
          return json(res, 202, { ok: true, accepted: true, job: existing })
        }
        if (!existing.mixedAudioPath && existing.status !== 'rendered' && existing.status !== 'video_rendered') {
          return json(res, 400, { error: 'Render audio first before building the video.' })
        }

        try {
          await startEofProductionVideoRenderBackground(jobId)
          const job = await getEofProductionJob(jobId)
          return json(res, 202, { ok: true, accepted: true, job })
        } catch (e) {
          return json(res, 500, { error: e instanceof Error ? e.message : 'Video render failed' })
        }
      }

      if (action === 'delete') {
        try {
          await requireEofOwner(req)
        } catch (e) {
          return json(res, e.statusCode || 403, { error: 'Only the channel owner can delete production jobs.' })
        }
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const deleted = await deleteEofProductionJob(jobId)
        if (!deleted) return json(res, 404, { error: 'Job not found.' })
        return json(res, 200, { ok: true, deletedId: jobId })
      }

      if (action === 'regenerate-script') {
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const job = await regenerateEofProductionScript(jobId)
        return json(res, 200, { ok: true, job })
      }

      if (action === 'cancel-render') {
        try {
          await requireEofOwner(req)
        } catch (e) {
          return json(res, e.statusCode || 403, { error: 'Only the channel owner can cancel renders.' })
        }
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const job = await cancelEofProductionRender(jobId)
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

    if (req.method === 'DELETE') {
      try {
        await requireEofOwner(req)
      } catch (e) {
        return json(res, e.statusCode || 403, { error: 'Only the channel owner can delete production jobs.' })
      }

      const body = await readJsonBody(req)
      let jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
      if (!jobId) {
        try {
          const raw = typeof req.url === 'string' ? req.url : '/'
          const url = new URL(raw, 'http://localhost')
          jobId = (url.searchParams.get('jobId') || '').trim()
        } catch {
          jobId = ''
        }
      }
      if (!jobId) return json(res, 400, { error: 'jobId is required.' })

      const deleted = await deleteEofProductionJob(jobId)
      if (!deleted) return json(res, 404, { error: 'Job not found.' })
      return json(res, 200, { ok: true, deletedId: jobId })
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error('[eof-production] handler', e)
    const msg = e instanceof Error ? e.message : 'Could not load production'
    return json(res, 500, { error: msg })
  }
}
