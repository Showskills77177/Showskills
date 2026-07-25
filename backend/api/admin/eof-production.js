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
import { withEofArtifactFlags } from '../lib/eofProductionArtifacts.mjs'
import {
  startEofProductionVideoRenderBackground,
  startEofProductionFullBuildBackground,
  startEofProductionVoiceoverRegenerationBackground,
  startApplyEofProductionZapcapBackground,
  startEofProductionMusicRemixBackground,
  startEofProductionCaptionReplaceBackground,
  startEofProductionEffectsApplyBackground,
  startEofProductionStickersApplyBackground,
} from '../lib/eofProductionRenderRunner.mjs'
import { EofQualityGateBlockedError } from '../lib/eofShortQualityGateApply.mjs'
import { normalizeEofCaptionLayout } from '../../../shared/eofCaptionLayout.mjs'
import { isFfmpegAvailable } from '../lib/eofAudioMix.mjs'
import { eofImageSourceStatus, eofImagesConfigurationNote } from '../lib/eofSceneImages.mjs'
import {
  getEofImageProviderSettings,
  updateEofImageProviderSettings,
  listEofImageProviderOptions,
  normalizeEofImageProvider,
  listEofImageGenModeOptions,
  listEofImageGenProviderOptions,
  eofImageGenConfigurationNote,
  normalizeEofImageGenMode,
  normalizeEofImageGenProvider,
} from '../lib/eofImageProviderSettings.mjs'
import {
  EOF_VOICE_PRESETS,
  EOF_RENDER_STACK,
  EOF_DEFAULT_VOICE_PRESET,
  EOF_DEFAULT_MUSIC_VOLUME,
  listEofFreeVoicePresets,
} from '../../../shared/eofProduction.mjs'
import { eofCaptionEngineStatus, listZapcapTemplates } from '../lib/eofZapcapCaptions.mjs'
import { probeEofPinterestApi } from '../lib/eofPinterestImages.mjs'
import { probeEofOxylabsApi } from '../lib/eofOxylabsImages.mjs'
import { probeEofSerpApi } from '../lib/eofSerpApiImages.mjs'
import {
  EOF_DEFAULT_CAPTION_STYLE,
  listEofCaptionStyles,
  resolveEofCaptionStyle,
  normalizeZapcapTemplateId,
  isZapcapCaptionStyle,
} from '../../../shared/eofCaptionStyles.mjs'
import {
  EOF_DEFAULT_TRANSITION_STYLE,
  EOF_DEFAULT_COLOR_GRADE,
  EOF_DEFAULT_ENHANCE_STYLE,
  listEofTransitionStyles,
  listEofColorGrades,
  listEofEnhanceStyles,
  resolveEofTransitionStyle,
  resolveEofColorGrade,
  resolveEofEnhanceStyle,
} from '../../../shared/eofVideoLook.mjs'
import {
  EOF_DEFAULT_OVERLAY_MOMENTS,
  listEofOverlayMomentsOptions,
  resolveEofOverlayMoments,
} from '../../../shared/eofOverlayMoments.mjs'
import {
  EOF_DEFAULT_VIDEO_EFFECTS,
  EOF_EFFECT_STACKING_RULE,
  listEofVideoEffects,
  listEofEffectPresets,
  normalizeEofVideoEffects,
  EOF_MOTION_EFFECTS,
  EOF_LIGHT_EFFECTS,
  EOF_COLOUR_EFFECTS,
} from '../../../shared/eofVideoEffects.mjs'
import {
  EOF_DEFAULT_STICKERS,
  EOF_STICKERS_STACKING_RULE,
  EOF_MAX_STICKERS,
  listEofStickersCatalog,
  listEofStickerPositions,
  listEofStickersByCategory,
  normalizeEofStickers,
} from '../../../shared/eofStickersElements.mjs'
import {
  ensureEofMusicCatalogSeeded,
  listEofMusicTracks,
  listEofDefaultMusicBeds,
} from '../lib/eofMusicTracks.mjs'
import { EOF_SCRIPT_FORMATS, EOF_DEFAULT_SCRIPT_FORMAT } from '../../../shared/eofScriptTemplates.mjs'
import {
  isEofOpenAiScriptConfigured,
  eofScriptProviderStatus,
  preferredEofScriptProvider,
  eofScriptProviderLabel,
  buildEofScriptWarning,
  listEofScriptProviderOptions,
} from '../lib/eofScriptWriter.mjs'
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
  if (v === 'claude') return 'anthropic'
  return v === 'groq' || v === 'xai' || v === 'openai' || v === 'anthropic' || v === 'auto' ? v : null
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
        jobs = await withEofArtifactFlags(await listEofProductionJobs())
      } catch (e) {
        console.error('[eof-production] jobs', e)
      }

      try {
        ffmpeg = await isFfmpegAvailable()
      } catch {
        ffmpeg = false
      }

      const zapcapCatalog = await listZapcapTemplates().catch((e) => ({
        templates: [],
        error: e instanceof Error ? e.message : String(e),
        configured: false,
      }))

      const pinterestProbe = await probeEofPinterestApi().catch((e) => ({
        configured: false,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      }))

      const oxylabsProbe = await probeEofOxylabsApi().catch((e) => ({
        configured: false,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      }))

      const serpapiProbe = await probeEofSerpApi().catch((e) => ({
        configured: false,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      }))

      let tracks = []
      try {
        tracks = await ensureEofMusicCatalogSeeded()
      } catch (e) {
        console.error('[eof-production] music tracks', e)
        tracks = await listEofMusicTracks({ activeOnly: false }).catch(() => [])
      }

      const imageProviderSettings = await getEofImageProviderSettings().catch(() => ({
        imageProvider: 'auto',
        imageGenMode: 'auto',
        imageGenProvider: 'auto',
        updatedAt: null,
      }))

      return json(res, 200, {
        ok: true,
        jobs,
        tracks,
        defaultMusicBeds: listEofDefaultMusicBeds(),
        defaultMusicVolume: EOF_DEFAULT_MUSIC_VOLUME,
        voicePresets: Object.values(EOF_VOICE_PRESETS),
        freeVoicePresets: listEofFreeVoicePresets(),
        defaultVoicePreset: EOF_DEFAULT_VOICE_PRESET,
        elevenLabsConfigured: isEofElevenLabsConfigured(),
        elevenLabsVoiceFields: EOF_ELEVENLABS_VOICE_FIELDS,
        elevenLabsVoiceLimits: EOF_ELEVENLABS_VOICE_LIMITS,
        elevenLabsVoiceDefaults: resolveElevenLabsVoiceSettings(EOF_VOICE_PRESETS.brian, null),
        scriptFormats: EOF_SCRIPT_FORMATS,
        defaultScriptFormat: EOF_DEFAULT_SCRIPT_FORMAT,
        captionStyles: listEofCaptionStyles(),
        defaultCaptionStyle: EOF_DEFAULT_CAPTION_STYLE,
        transitionStyles: listEofTransitionStyles(),
        defaultTransitionStyle: EOF_DEFAULT_TRANSITION_STYLE,
        colorGrades: listEofColorGrades(),
        defaultColorGrade: EOF_DEFAULT_COLOR_GRADE,
        enhanceStyles: listEofEnhanceStyles(),
        defaultEnhanceStyle: EOF_DEFAULT_ENHANCE_STYLE,
        overlayMomentsOptions: listEofOverlayMomentsOptions(),
        defaultOverlayMoments: EOF_DEFAULT_OVERLAY_MOMENTS,
        videoEffectsCatalog: listEofVideoEffects(),
        videoEffectPresets: listEofEffectPresets(),
        videoEffectsMotion: EOF_MOTION_EFFECTS.map(({ id, label, detail, vibe, preview }) => ({
          id,
          label,
          detail,
          vibe,
          preview,
        })),
        videoEffectsLight: EOF_LIGHT_EFFECTS.map(({ id, label, detail, vibe, preview }) => ({
          id,
          label,
          detail,
          vibe,
          preview,
        })),
        videoEffectsColour: EOF_COLOUR_EFFECTS.map((e) => ({
          id: e.id,
          label: e.label,
          detail: e.detail,
          vibe: e.vibe,
          preview: e.preview,
          subgroup: e.subgroup || null,
        })),
        defaultVideoEffects: EOF_DEFAULT_VIDEO_EFFECTS,
        videoEffectsStackingRule: EOF_EFFECT_STACKING_RULE,
        stickersCatalog: listEofStickersCatalog(),
        stickersButtons: listEofStickersByCategory('buttons'),
        stickersShapes: listEofStickersByCategory('shapes'),
        stickersArrows: listEofStickersByCategory('arrows'),
        stickersExtras: listEofStickersByCategory('stickers'),
        stickerPositions: listEofStickerPositions(),
        defaultStickers: EOF_DEFAULT_STICKERS,
        stickersStackingRule: EOF_STICKERS_STACKING_RULE,
        stickersMax: EOF_MAX_STICKERS,
        captionEngine: eofCaptionEngineStatus(),
        zapcapTemplates: zapcapCatalog.templates,
        zapcapTemplatesError: zapcapCatalog.error,
        openAiScriptEnabled: isEofOpenAiScriptConfigured(),
        scriptProviders: eofScriptProviderStatus(),
        scriptProviderOptions: listEofScriptProviderOptions(),
        preferredScriptProvider: preferredEofScriptProvider(),
        scriptProviderLabel: eofScriptProviderLabel(preferredEofScriptProvider()),
        scriptBillingNote: (() => {
          const s = eofScriptProviderStatus()
          if (s.groq && (s.newsdata || s.guardian)) {
            return 'Free stack ready: NewsData/Guardian + RSS sourcing, Groq writes the Short.'
          }
          if (s.groq && !s.newsdata && !s.guardian) {
            return 'Groq is ready. Add NEWSDATA_API_KEY (newsdata.io) or GUARDIAN_API_KEY for richer article sourcing; RSS still works without them.'
          }
          if (s.newsdata && !s.groq) {
            return 'NewsData key is set, but scripts still need GROQ_API_KEY (or OpenAI/Claude/xAI) to write the voiceover.'
          }
          if ((s.newsdata || s.guardian) && !s.groq && !s.openai && !s.xai && !s.anthropic) {
            return 'Article sourcing is set, but you still need free GROQ_API_KEY to write the Short.'
          }
          if (s.anthropic && !s.openai && !s.groq && !s.xai) {
            return 'Claude Sonnet 5 (Anthropic) is ready for Script AI. Pick Claude in the Script AI dropdown, or set EOF_SCRIPT_PROVIDER=anthropic.'
          }
          if (s.xai && !s.openai && !s.groq && !s.anthropic) {
            return 'xAI key is set but needs credits (console.x.ai). Add free GROQ_API_KEY on Vercel for AI scripts without xAI billing.'
          }
          if (!s.openai && !s.xai && !s.groq && !s.anthropic) {
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
        imageProvider: imageProviderSettings.imageProvider || 'auto',
        imageProviderOptions: listEofImageProviderOptions(),
        imageProviderUpdatedAt: imageProviderSettings.updatedAt || null,
        imageGenMode: imageProviderSettings.imageGenMode || 'auto',
        imageGenProvider: imageProviderSettings.imageGenProvider || 'auto',
        imageGenModeOptions: listEofImageGenModeOptions(),
        imageGenProviderOptions: listEofImageGenProviderOptions(),
        imagesNote: eofImagesConfigurationNote(imageProviderSettings.imageProvider),
        imageGenNote: eofImageGenConfigurationNote({
          mode: imageProviderSettings.imageGenMode,
          provider: imageProviderSettings.imageGenProvider,
        }),
        pinterest: pinterestProbe,
        serpapi: serpapiProbe,
        oxylabs: oxylabsProbe,
        renderStack: EOF_RENDER_STACK,
        session: info,
      })
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      const action = typeof body.action === 'string' ? body.action : 'create'

      if (action === 'update-image-provider' || action === 'image-provider') {
        try {
          await requireEofOwner(req)
        } catch (e) {
          return json(res, e.statusCode || 403, {
            error: 'Only the channel owner can change the Google Images provider.',
          })
        }
        const raw =
          body.imageProvider !== undefined
            ? body.imageProvider
            : body.provider !== undefined
              ? body.provider
              : body.serpProvider
        if (raw === undefined || raw === null || String(raw).trim() === '') {
          return json(res, 400, { error: 'imageProvider is required (auto | serpapi | oxylabs).' })
        }
        const imageProvider = normalizeEofImageProvider(raw)
        const settings = await updateEofImageProviderSettings({ imageProvider })
        return json(res, 200, {
          ok: true,
          settings,
          imageProvider: settings.imageProvider,
          imageGenMode: settings.imageGenMode,
          imageGenProvider: settings.imageGenProvider,
          imageProviderOptions: listEofImageProviderOptions(),
          imageGenModeOptions: listEofImageGenModeOptions(),
          imageGenProviderOptions: listEofImageGenProviderOptions(),
          imagesNote: eofImagesConfigurationNote(settings.imageProvider),
          imageGenNote: eofImageGenConfigurationNote({
            mode: settings.imageGenMode,
            provider: settings.imageGenProvider,
          }),
        })
      }

      if (action === 'update-image-gen' || action === 'image-gen') {
        try {
          await requireEofOwner(req)
        } catch (e) {
          return json(res, e.statusCode || 403, {
            error: 'Only the channel owner can change image generation settings.',
          })
        }
        const patch = {}
        if (body.imageGenMode !== undefined) {
          patch.imageGenMode = normalizeEofImageGenMode(body.imageGenMode)
        }
        if (body.imageGenProvider !== undefined) {
          patch.imageGenProvider = normalizeEofImageGenProvider(body.imageGenProvider)
        }
        if (!Object.keys(patch).length) {
          return json(res, 400, {
            error: 'imageGenMode (off|auto|always) and/or imageGenProvider (auto|grok|free) required.',
          })
        }
        const settings = await updateEofImageProviderSettings(patch)
        return json(res, 200, {
          ok: true,
          settings,
          imageProvider: settings.imageProvider,
          imageGenMode: settings.imageGenMode,
          imageGenProvider: settings.imageGenProvider,
          imageGenModeOptions: listEofImageGenModeOptions(),
          imageGenProviderOptions: listEofImageGenProviderOptions(),
          imageGenNote: eofImageGenConfigurationNote({
            mode: settings.imageGenMode,
            provider: settings.imageGenProvider,
          }),
        })
      }

      if (action === 'apply-zapcap-captions') {
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const existing = await getEofProductionJob(jobId)
        if (!existing) return json(res, 404, { error: 'Job not found.' })
        if (!(existing.script?.scenes?.length >= 1)) {
          return json(res, 400, { error: 'Job has no script scenes.' })
        }
        if (existing.status === 'rendering' || existing.status === 'rendering_video') {
          return json(res, 202, { ok: true, accepted: true, job: existing })
        }
        const style = resolveEofCaptionStyle(existing.captionStyle)
        if (!isZapcapCaptionStyle(style)) {
          return json(res, 400, {
            error: 'Pick a ZapCap caption template first, then click Apply ZapCap captions.',
          })
        }
        const catalog = await listZapcapTemplates().catch(() => ({ configured: false }))
        if (!catalog.configured) {
          return json(res, 400, { error: 'ZAPCAP_API_KEY is not set — cannot apply ZapCap captions.' })
        }

        try {
          if (body.captionStyle !== undefined || body.zapcapTemplateId !== undefined) {
            await updateEofProductionJob(jobId, {
              captionStyle:
                body.captionStyle !== undefined ? resolveEofCaptionStyle(body.captionStyle) : undefined,
              zapcapTemplateId:
                body.zapcapTemplateId !== undefined
                  ? normalizeZapcapTemplateId(body.zapcapTemplateId) || null
                  : undefined,
            })
          }
          await startApplyEofProductionZapcapBackground(jobId)
          const job = await getEofProductionJob(jobId)
          return json(res, 202, { ok: true, accepted: true, job })
        } catch (e) {
          return json(res, 500, { error: e instanceof Error ? e.message : 'ZapCap apply failed' })
        }
      }

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

        // Optional per-build override of Google Images provider (auto | serpapi | oxylabs).
        const imageProvider =
          body.imageProvider !== undefined && body.imageProvider !== null && String(body.imageProvider).trim()
            ? normalizeEofImageProvider(body.imageProvider)
            : undefined

        try {
          if (action === 'render-video') {
            await startEofProductionVideoRenderBackground(jobId, { imageProvider })
          } else {
            await startEofProductionFullBuildBackground(jobId, { imageProvider })
          }
          const job = await getEofProductionJob(jobId)
          return json(res, 202, { ok: true, accepted: true, job, imageProvider: imageProvider || null })
        } catch (e) {
          if (e instanceof EofQualityGateBlockedError) {
            const job = await getEofProductionJob(jobId)
            return json(res, 422, {
              error: e.message,
              qualityGate: e.gate,
              job,
            })
          }
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

      if (action === 'remix-music') {
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const existing = await getEofProductionJob(jobId)
        if (!existing) return json(res, 404, { error: 'Job not found.' })
        if (!(existing.script?.scenes?.length >= 1)) {
          return json(res, 400, { error: 'Job has no script scenes.' })
        }
        if (existing.status === 'rendering' || existing.status === 'rendering_video') {
          return json(res, 202, { ok: true, accepted: true, job: existing })
        }

        try {
          await updateEofProductionJob(jobId, {
            musicTrackId:
              body.musicTrackId !== undefined
                ? body.musicTrackId === null || body.musicTrackId === ''
                  ? null
                  : String(body.musicTrackId)
                : undefined,
            musicVolume:
              body.musicVolume !== undefined ? Number(body.musicVolume) : undefined,
            musicStartSec:
              body.musicStartSec !== undefined ? Number(body.musicStartSec) : undefined,
            musicEndSec:
              body.musicEndSec !== undefined
                ? body.musicEndSec === null || body.musicEndSec === ''
                  ? null
                  : Number(body.musicEndSec)
                : undefined,
          })
          await startEofProductionMusicRemixBackground(jobId)
          const job = await getEofProductionJob(jobId)
          return json(res, 202, { ok: true, accepted: true, job })
        } catch (e) {
          return json(res, 500, { error: e instanceof Error ? e.message : 'Music remix failed' })
        }
      }

      if (action === 'apply-effects') {
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const existing = await getEofProductionJob(jobId)
        if (!existing) return json(res, 404, { error: 'Job not found.' })
        if (!(existing.script?.scenes?.length >= 1)) {
          return json(res, 400, { error: 'Job has no script scenes.' })
        }
        if (existing.status === 'rendering' || existing.status === 'rendering_video') {
          return json(res, 409, {
            error:
              'This Short is already rendering. Wait until it finishes, then click Apply effects again.',
          })
        }

        try {
          await updateEofProductionJob(jobId, {
            videoEffects:
              body.videoEffects !== undefined
                ? normalizeEofVideoEffects(body.videoEffects)
                : undefined,
          })
          await startEofProductionEffectsApplyBackground(jobId)
          const job = await getEofProductionJob(jobId)
          return json(res, 202, { ok: true, accepted: true, job })
        } catch (e) {
          return json(res, 500, {
            error: e instanceof Error ? e.message : 'Apply effects failed',
          })
        }
      }

      if (action === 'apply-stickers') {
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const existing = await getEofProductionJob(jobId)
        if (!existing) return json(res, 404, { error: 'Job not found.' })
        if (!(existing.script?.scenes?.length >= 1)) {
          return json(res, 400, { error: 'Job has no script scenes.' })
        }
        if (existing.status === 'rendering' || existing.status === 'rendering_video') {
          return json(res, 409, {
            error:
              'This Short is already rendering. Wait until it finishes, then click Apply stickers again.',
          })
        }

        try {
          await updateEofProductionJob(jobId, {
            stickers:
              body.stickers !== undefined ? normalizeEofStickers(body.stickers) : undefined,
          })
          await startEofProductionStickersApplyBackground(jobId)
          const job = await getEofProductionJob(jobId)
          return json(res, 202, { ok: true, accepted: true, job })
        } catch (e) {
          return json(res, 500, {
            error: e instanceof Error ? e.message : 'Apply stickers failed',
          })
        }
      }

      if (action === 'replace-captions') {
        const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
        if (!jobId) return json(res, 400, { error: 'jobId is required.' })
        const existing = await getEofProductionJob(jobId)
        if (!existing) return json(res, 404, { error: 'Job not found.' })
        if (!(existing.script?.scenes?.length >= 1)) {
          return json(res, 400, { error: 'Job has no script scenes.' })
        }
        if (existing.status === 'rendering' || existing.status === 'rendering_video') {
          return json(res, 409, {
            error:
              'This Short is already rendering. Wait until it finishes, then click Replace Captions again.',
          })
        }

        try {
          let script = existing.script
          if (Array.isArray(body.sceneCaptions) && body.sceneCaptions.length) {
            const byIndex = new Map(
              body.sceneCaptions.map((row) => [
                Number(row?.index),
                String(row?.caption || '').trim().slice(0, 140),
              ]),
            )
            script = {
              ...script,
              scenes: (script.scenes || []).map((scene, i) => {
                const idx = scene.index != null ? Number(scene.index) : i
                const next = byIndex.has(idx) ? byIndex.get(idx) : byIndex.has(i) ? byIndex.get(i) : null
                if (!next) return scene
                return { ...scene, caption: next, narration: next }
              }),
            }
          }
          await updateEofProductionJob(jobId, {
            script,
            captionStyle:
              body.captionStyle !== undefined ? String(body.captionStyle) : undefined,
            captionLayout:
              body.captionLayout !== undefined
                ? normalizeEofCaptionLayout(body.captionLayout, body.captionStyle || existing.captionStyle)
                : undefined,
            zapcapTemplateId:
              body.zapcapTemplateId !== undefined
                ? body.zapcapTemplateId
                : undefined,
          })
          await startEofProductionCaptionReplaceBackground(jobId)
          const job = await getEofProductionJob(jobId)
          return json(res, 202, { ok: true, accepted: true, job })
        } catch (e) {
          return json(res, 500, {
            error: e instanceof Error ? e.message : 'Caption replace failed',
          })
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
        const directorNote =
          typeof body.directorNote === 'string'
            ? body.directorNote
            : typeof body.chatPrompt === 'string'
              ? body.chatPrompt
              : typeof body.instruction === 'string'
                ? body.instruction
                : ''
        try {
          const job = await regenerateEofProductionDraft(jobId, {
            format,
            scriptProvider,
            directorNote,
          })
          return json(res, 200, {
            ok: true,
            job,
            deskSources: job.deskSources || null,
            judge: job.judge || null,
            autoTuned: job.autoTuned || null,
            directorNote: String(directorNote || '').trim().slice(0, 200) || null,
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
      const captionStyle = resolveEofCaptionStyle(
        typeof body.captionStyle === 'string' ? body.captionStyle : EOF_DEFAULT_CAPTION_STYLE,
      )
      const zapcapTemplateId = isZapcapCaptionStyle(captionStyle)
        ? normalizeZapcapTemplateId(body.zapcapTemplateId)
        : ''
      const transitionStyle = resolveEofTransitionStyle(
        typeof body.transitionStyle === 'string' ? body.transitionStyle : EOF_DEFAULT_TRANSITION_STYLE,
      )
      const colorGrade = resolveEofColorGrade(
        typeof body.colorGrade === 'string' ? body.colorGrade : EOF_DEFAULT_COLOR_GRADE,
      )
      const enhanceStyle = resolveEofEnhanceStyle(
        typeof body.enhanceStyle === 'string' ? body.enhanceStyle : EOF_DEFAULT_ENHANCE_STYLE,
      )
      const overlayMoments = resolveEofOverlayMoments(
        typeof body.overlayMoments === 'string' ? body.overlayMoments : EOF_DEFAULT_OVERLAY_MOMENTS,
      )
      const videoEffects = normalizeEofVideoEffects(
        body.videoEffects !== undefined ? body.videoEffects : EOF_DEFAULT_VIDEO_EFFECTS,
      )
      const stickers = normalizeEofStickers(
        body.stickers !== undefined ? body.stickers : EOF_DEFAULT_STICKERS,
      )
      try {
        const job = await createEofProductionJob({
          topic,
          createdBy: info.username,
          format,
          voicePreset,
          scriptProvider,
          captionStyle,
          zapcapTemplateId,
          transitionStyle,
          colorGrade,
          enhanceStyle,
          overlayMoments,
          videoEffects,
          stickers,
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
        musicTrackId:
          body.musicTrackId !== undefined
            ? body.musicTrackId === null || body.musicTrackId === ''
              ? null
              : String(body.musicTrackId)
            : undefined,
        musicVolume: body.musicVolume,
        musicStartSec: body.musicStartSec !== undefined ? Number(body.musicStartSec) : undefined,
        musicEndSec:
          body.musicEndSec !== undefined
            ? body.musicEndSec === null || body.musicEndSec === ''
              ? null
              : Number(body.musicEndSec)
            : undefined,
        voicePreset: body.voicePreset,
        captionStyle: body.captionStyle !== undefined ? resolveEofCaptionStyle(body.captionStyle) : undefined,
        zapcapTemplateId:
          body.zapcapTemplateId !== undefined
            ? normalizeZapcapTemplateId(body.zapcapTemplateId)
            : body.captionStyle !== undefined && !isZapcapCaptionStyle(body.captionStyle)
              ? ''
              : undefined,
        transitionStyle:
          body.transitionStyle !== undefined
            ? resolveEofTransitionStyle(body.transitionStyle)
            : undefined,
        colorGrade: body.colorGrade !== undefined ? resolveEofColorGrade(body.colorGrade) : undefined,
        enhanceStyle:
          body.enhanceStyle !== undefined ? resolveEofEnhanceStyle(body.enhanceStyle) : undefined,
        overlayMoments:
          body.overlayMoments !== undefined
            ? resolveEofOverlayMoments(body.overlayMoments)
            : undefined,
        videoEffects:
          body.videoEffects !== undefined ? normalizeEofVideoEffects(body.videoEffects) : undefined,
        stickers: body.stickers !== undefined ? normalizeEofStickers(body.stickers) : undefined,
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
