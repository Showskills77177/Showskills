import { json, readJsonBody } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofSession, requireEofOwner, eofSessionInfo } from '../lib/eofYoutubeAuth.mjs'
import {
  listEofProductionJobs,
  createEofProductionJob,
  getEofProductionJob,
  updateEofProductionJob,
  regenerateEofProductionScript,
  regenerateEofProductionDraft,
  adaptEofProductionDraftToScenes,
  deleteEofProductionJob,
  cancelEofProductionRender,
} from '../lib/eofProductionJobs.mjs'
import { startEofProductionVideoRenderBackground, startEofProductionFullBuildBackground, startEofProductionVoiceoverRegenerationBackground } from '../lib/eofProductionRenderRunner.mjs'
import { isFfmpegAvailable } from '../lib/eofAudioMix.mjs'
import { eofImageSourceStatus, eofImagesConfigurationNote } from '../lib/eofSceneImages.mjs'
import { EOF_VOICE_PRESETS, EOF_RENDER_STACK, EOF_DEFAULT_VOICE_PRESET } from '../../../shared/eofProduction.mjs'
import { EOF_SCRIPT_FORMATS, EOF_DEFAULT_SCRIPT_FORMAT } from '../../../shared/eofScriptTemplates.mjs'
import { isEofOpenAiScriptConfigured, eofScriptProviderStatus, preferredEofScriptProvider, eofScriptProviderLabel, buildEofScriptWarning, listEofScriptProviderOptions } from '../lib/eofScriptWriter.mjs'
import { isEofElevenLabsConfigured } from '../lib/eofElevenLabsTts.mjs'
import {
  EOF_ELEVENLABS_VOICE_FIELDS,
  EOF_ELEVENLABS_VOICE_LIMITS,
  normalizeElevenLabsVoiceSettings,
  resolveElevenLabsVoiceSettings,
} from '../../../shared/eofElevenLabsVoice.mjs'
import { eofVoiceRegenerationStatus } from '../../../shared/eofVoiceRegeneration.mjs'

function parseScriptProvider(body) {
  const v = typeof body?.scriptProvider === 'string' ? body.scriptProvider.trim().toLowerCase() : ''
  return v === 'groq' || v === 'xai' || v === 'openai' || v === 'auto' ? v : null
}

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
      let jobs = []
      let ffmpeg = false

      try {
        jobs = await listEofProductionJobs()
      } catch (e) {
        console.error('[eof-production] jobs', e)
      }

      try {
        ffmpeg = await isFfmpegAvailable()
      } catch {
        ffmpeg = false
      }

      return json(res, 200, {
        ok: true,
        jobs,
        tracks: [],
        voicePresets: Object.values(EOF_VOICE_PRESETS),
        defaultVoicePreset: EOF_DEFAULT_VOICE_PRESET,
        elevenLabsConfigured: isEofElevenLabsConfigured(),
        elevenLabsVoiceFields: EOF_ELEVENLABS_VOICE_FIELDS,
        elevenLabsVoiceLimits: EOF_ELEVENLABS_VOICE_LIMITS,
        elevenLabsVoiceDefaults: resolveElevenLabsVoiceSettings(EOF_VOICE_PRESETS.brian, null),
        scriptFormats: EOF_SCRIPT_FORMATS,
        defaultScriptFormat: EOF_DEFAULT_SCRIPT_FORMAT,
        openAiScriptEnabled: isEofOpenAiScriptConfigured(),
        scriptProviders: eofScriptProviderStatus(),
        scriptProviderOptions: listEofScriptProviderOptions(),
        preferredScriptProvider: preferredEofScriptProvider(),
        scriptProviderLabel: eofScriptProviderLabel(preferredEofScriptProvider()),
        scriptBillingNote: (() => {
          const s = eofScriptProviderStatus()
          if (s.perplexity && s.groq) {
            return 'Perplexity Sonar (live article sourcing) + Groq (Shorts writer) are ready.'
          }
          if (s.groq && !s.perplexity) {
            return 'Groq is ready for writing. Add PERPLEXITY_API_KEY for live web article sourcing (recommended).'
          }
          if (s.perplexity && !s.groq && !s.openai && !s.xai) {
            return 'Perplexity is set for research, but you still need GROQ_API_KEY (or OpenAI/xAI) to write the Short.'
          }
          if (s.xai && !s.openai && !s.groq) {
            return 'xAI key is set but needs credits (console.x.ai). Add free GROQ_API_KEY on Vercel for AI scripts without xAI billing.'
          }
          if (!s.openai && !s.xai && !s.groq) {
            return 'No script AI configured. Add free GROQ_API_KEY at console.groq.com → Vercel env → redeploy.'
          }
          return null
        })(),
        elevenLabsVoiceRegeneration: {
          limit: 3,
          note: 'Up to 3 free voice-setting regenerations per Short (same captions, slider tweaks only). Rebuild Short uses credits.',
        },
        ffmpegAvailable: ffmpeg,
        renderNote: ffmpeg
          ? null
          : 'Video build needs ffmpeg (bundled ffmpeg-static on deploy, or FFMPEG_PATH locally).',
        pexelsConfigured: eofImageSourceStatus().pexels,
        imageSources: eofImageSourceStatus(),
        imagesNote: eofImagesConfigurationNote(),
        renderStack: EOF_RENDER_STACK,
        session: info,
      })
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      const action = typeof body.action === 'string' ? body.action : 'create'

      if (action === 'build-short' || action === 'render-video' || action === 'render') {
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const existing = await getEofProductionJob(jobId)
        if (!existing) return json(res, 404, { error: 'Job not found.' })
        if (!(existing.script?.scenes?.length >= 1)) {
          return json(res, 400, {
            error: 'Adapt the plain-text script to scenes before building the Short.',
          })
        }
        if (existing.status === 'rendering' || existing.status === 'rendering_video') {
          return json(res, 202, { ok: true, accepted: true, job: existing })
        }

        try {
          if (action === 'render-video') {
            await startEofProductionVideoRenderBackground(jobId)
          } else {
            await startEofProductionFullBuildBackground(jobId)
          }
          const job = await getEofProductionJob(jobId)
          return json(res, 202, { ok: true, accepted: true, job })
        } catch (e) {
          return json(res, 500, { error: e instanceof Error ? e.message : 'Build failed' })
        }
      }

      if (action === 'regenerate-voiceover' || action === 'render-audio') {
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const existing = await getEofProductionJob(jobId)
        if (!existing) return json(res, 404, { error: 'Job not found.' })
        if (existing.status === 'rendering' || existing.status === 'rendering_video') {
          return json(res, 202, { ok: true, accepted: true, job: existing })
        }

        try {
          if (body.voicePreset !== undefined || body.voiceSettings !== undefined) {
            await updateEofProductionJob(jobId, {
              voicePreset: typeof body.voicePreset === 'string' ? body.voicePreset.trim() : undefined,
              voiceSettings:
                body.voiceSettings !== undefined
                  ? normalizeElevenLabsVoiceSettings(body.voiceSettings)
                  : undefined,
            })
          }

          const refreshed = await getEofProductionJob(jobId)
          const regen = eofVoiceRegenerationStatus(refreshed)
          if (!regen.canRegenerate) {
            return json(res, 400, { error: regen.blockedReason || 'Voice regeneration is not available.' })
          }

          await startEofProductionVoiceoverRegenerationBackground(jobId)
          const job = await getEofProductionJob(jobId)
          return json(res, 202, { ok: true, accepted: true, job })
        } catch (e) {
          return json(res, 500, { error: e instanceof Error ? e.message : 'Voiceover regeneration failed' })
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
        const format = typeof body.format === 'string' ? body.format.trim() : null
        const scriptProvider = parseScriptProvider(body)
        try {
          const job = await regenerateEofProductionScript(jobId, { format, scriptProvider })
          return json(res, 200, {
            ok: true,
            job,
            scriptWarning: buildEofScriptWarning(job),
          })
        } catch (e) {
          return json(res, 400, { error: e instanceof Error ? e.message : 'Could not rewrite script' })
        }
      }

      if (action === 'regenerate-draft') {
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const format = typeof body.format === 'string' ? body.format.trim() : null
        const scriptProvider = parseScriptProvider(body)
        try {
          const job = await regenerateEofProductionDraft(jobId, { format, scriptProvider })
          return json(res, 200, {
            ok: true,
            job,
            scriptProviderLabel: eofScriptProviderLabel(job.scriptSource || preferredEofScriptProvider()),
            scriptWarning: buildEofScriptWarning(job),
          })
        } catch (e) {
          return json(res, 400, { error: e instanceof Error ? e.message : 'Could not regenerate draft' })
        }
      }

      if (action === 'adapt-to-scenes') {
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const format = typeof body.format === 'string' ? body.format.trim() : null
        const plainTextDraft =
          typeof body.plainTextDraft === 'string' ? body.plainTextDraft : undefined
        const scriptProvider = parseScriptProvider(body)
        try {
          // Persist any unsaved draft text from the UI before adapting
          if (plainTextDraft !== undefined) {
            const existing = await getEofProductionJob(jobId)
            if (!existing) return json(res, 404, { error: 'Job not found.' })
            await updateEofProductionJob(jobId, {
              script: {
                ...(existing.script || {}),
                plainTextDraft,
                topic: existing.topic,
                format: format || existing.script?.format,
                scenes: existing.script?.scenes || [],
                title: existing.script?.title || existing.title || existing.topic,
                description: existing.script?.description || '',
                tags: existing.script?.tags || ['shortsfeed', 'football'],
              },
            })
          }
          const job = await adaptEofProductionDraftToScenes(jobId, { format, plainTextDraft, scriptProvider })
          return json(res, 200, {
            ok: true,
            job,
            scriptProviderLabel: eofScriptProviderLabel(job.scriptSource || preferredEofScriptProvider()),
          })
        } catch (e) {
          return json(res, 400, { error: e instanceof Error ? e.message : 'Could not adapt to scenes' })
        }
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
      const format = typeof body.format === 'string' ? body.format.trim() : EOF_DEFAULT_SCRIPT_FORMAT
      const voicePreset =
        typeof body.voicePreset === 'string' && body.voicePreset.trim()
          ? body.voicePreset.trim()
          : EOF_DEFAULT_VOICE_PRESET
      const scriptProvider = parseScriptProvider(body)
      try {
        const job = await createEofProductionJob({
          topic,
          createdBy: info.username,
          format,
          voicePreset,
          scriptProvider,
        })
        return json(res, 201, {
          ok: true,
          job,
          scriptSource: job.scriptSource || preferredEofScriptProvider(),
          scriptProviderLabel: eofScriptProviderLabel(job.scriptSource || preferredEofScriptProvider()),
          scriptWarning: buildEofScriptWarning(job),
        })
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
        voiceSettings:
          body.voiceSettings !== undefined
            ? normalizeElevenLabsVoiceSettings(body.voiceSettings)
            : undefined,
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
