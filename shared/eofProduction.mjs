/** Eyes Of Football — automated production pipeline (staging). */

export const EOF_PRODUCTION_JOB_STATUS = {
  DRAFT: 'draft',
  SCRIPTING: 'scripting',
  READY_SCRIPT: 'ready_script',
  RENDERING: 'rendering',
  RENDERED: 'rendered',
  RENDERING_VIDEO: 'rendering_video',
  VIDEO_RENDERED: 'video_rendered',
  FAILED: 'failed',
  PUBLISHED: 'published',
}

export const EOF_VOICE_PRESETS = {
  british: {
    id: 'british',
    label: 'British narrator',
    engine: 'edge',
    voice: 'en-GB-RyanNeural',
    rate: '-8%',
  },
  british_calm: {
    id: 'british_calm',
    label: 'British (slower)',
    engine: 'edge',
    voice: 'en-GB-ThomasNeural',
    rate: '-12%',
  },
}

export const EOF_MUSIC_MOODS = [
  { id: 'neutral', label: 'Neutral / general' },
  { id: 'dramatic', label: 'Dramatic' },
  { id: 'upbeat', label: 'Upbeat' },
  { id: 'calm', label: 'Calm' },
]

/** Default music bed level under narration (0–1). */
export const EOF_DEFAULT_MUSIC_VOLUME = 0.22

export const EOF_MUSIC_SOURCE_YOUTUBE_LIBRARY = 'youtube_audio_library'

/**
 * @typedef {object} EofScriptScene
 * @property {string} id
 * @property {string} narration
 * @property {string} caption
 * @property {string} imageQuery
 * @property {number} [durationSec]
 */

/**
 * @typedef {object} EofProductionScript
 * @property {string} topic
 * @property {string} title
 * @property {string} description
 * @property {string[]} tags
 * @property {EofScriptScene[]} scenes
 */

export function parseProductionScript(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function productionJobStatusLabel(status) {
  const map = {
    draft: 'Draft',
    scripting: 'Writing script…',
    ready_script: 'Script ready',
    rendering: 'Building…',
    rendered: 'Script ready',
    rendering_video: 'Building video…',
    video_rendered: 'Video ready',
    failed: 'Failed',
    published: 'Published',
  }
  return map[status] || status || '—'
}

export const EOF_RENDER_STACK = {
  script: {
    id: 'template-openai',
    label: 'Script writer (templates + optional OpenAI)',
    detail:
      'Structured Short formats by default. Set OPENAI_API_KEY for AI captions/image queries (gpt-4o-mini).',
  },
  host: {
    id: 'vercel',
    label: 'ShowSkills staging API (Vercel serverless)',
    detail:
      'Image fetch + ffmpeg run in the background (waitUntil). Finished MP4 is stored in the database so previews work across instances.',
  },
  video: {
    id: 'ffmpeg-images',
    label: 'Images + captions → 9:16 Short (ffmpeg)',
    detail:
      'Google CSE, Pexels, Pinterest pin URL, or placeholders. Silent video — add music in YouTube Studio if you want.',
  },
}

/** Rough pre-render estimate from narration length + scene count. */
export function estimateEofRenderDurationSec(script) {
  const scenes = script?.scenes || []
  if (!scenes.length) return 45
  let ttsSec = 0
  for (const scene of scenes) {
    const chars = String(scene.narration || '').trim().length
    // Edge TTS on serverless: ~10–18s per scene including network latency.
    ttsSec += Math.max(10, Math.min(20, 8 + chars * 0.035))
  }
  const mixSec = 8 + scenes.length
  return Math.ceil(Math.min(150, ttsSec + mixSec))
}

/** Video assembly estimate (images + ffmpeg clips + mux). */
export function estimateEofVideoRenderDurationSec(sceneCount = 5) {
  const n = Math.max(1, sceneCount || 1)
  return Math.min(90, Math.max(20, Math.ceil(n * 5)))
}

function computeRenderEtaSeconds({ percent, elapsedSeconds, estimatedTotalSec }) {
  if (percent >= 100) return 0
  const budget = Math.max(20, estimatedTotalSec)
  const remainingByBudget = Math.max(0, budget - elapsedSeconds)
  // Early on, pace extrapolation blows up (4% + 60s elapsed → 24m). Stick to budget.
  if (percent < 18 || elapsedSeconds < 10) return remainingByBudget
  const remainingByPace = Math.round((elapsedSeconds / Math.max(percent, 18)) * (100 - percent))
  return Math.min(remainingByBudget, remainingByPace)
}

function formatEtaLabel(etaSeconds) {
  if (etaSeconds <= 0) return '0:00 left'
  const etaMinutes = Math.floor(etaSeconds / 60)
  const etaRemSec = etaSeconds % 60
  return etaMinutes > 0 ? `~${etaMinutes}m ${etaRemSec}s left` : `~${etaRemSec}s left`
}

/**
 * @param {{
 *   stage: 'tts' | 'mix' | 'images' | 'video' | 'mux' | 'done',
 *   sceneIndex?: number,
 *   sceneCount: number,
 *   startedAt: string,
 *   estimatedTotalSec?: number,
 *   pipeline?: 'audio' | 'video',
 * }} input
 */
export function buildEofRenderProgress(input) {
  const sceneCount = Math.max(1, input.sceneCount || 1)
  const sceneIndex = Math.max(0, input.sceneIndex ?? 0)
  const startedMs = new Date(input.startedAt).getTime()
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedMs) / 1000))
  const pipeline = input.pipeline || 'audio'

  let percent = 0
  let message = 'Starting render…'

  if (pipeline === 'video') {
    if (input.stage === 'images') {
      percent = Math.min(38, Math.round(((sceneIndex + 0.35) / sceneCount) * 38))
      message = `Fetching image ${Math.min(sceneIndex + 1, sceneCount)} of ${sceneCount}…`
    } else if (input.stage === 'video') {
      percent = 38 + Math.min(52, Math.round(((sceneIndex + 0.35) / sceneCount) * 52))
      message = `Building scene clip ${Math.min(sceneIndex + 1, sceneCount)} of ${sceneCount}…`
    } else if (input.stage === 'mux') {
      percent = 96
      message = 'Muxing final Short MP4…'
    } else if (input.stage === 'done') {
      percent = 100
      message = 'Video render complete'
    }
  } else if (input.stage === 'tts') {
    const ttsWeight = 0.86
    percent = Math.min(86, Math.round(((sceneIndex + 0.35) / sceneCount) * 100 * ttsWeight))
    message = `Narrating scene ${Math.min(sceneIndex + 1, sceneCount)} of ${sceneCount} (Edge TTS)…`
  } else if (input.stage === 'mix') {
    percent = 94
    message = 'Mixing narration with music bed (ffmpeg)…'
  } else if (input.stage === 'done') {
    percent = 100
    message = 'Render complete'
  }

  const estimatedTotalSec =
    pipeline === 'video'
      ? estimateEofVideoRenderDurationSec(sceneCount)
      : input.estimatedTotalSec ||
        estimateEofRenderDurationSec({ scenes: Array.from({ length: sceneCount }) })

  const etaSeconds = computeRenderEtaSeconds({ percent, elapsedSeconds, estimatedTotalSec })

  return {
    percent,
    stage: input.stage,
    sceneIndex,
    sceneCount,
    message,
    pipeline,
    startedAt: input.startedAt,
    elapsedSeconds,
    estimatedTotalSec,
    etaSeconds,
    etaLabel: formatEtaLabel(etaSeconds),
  }
}

export function parseRenderProgress(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Recompute elapsed time + ETA from a stored progress snapshot. */
export function refreshEofRenderProgress(progress) {
  if (!progress) return null
  if (!progress.startedAt) return progress
  return buildEofRenderProgress({
    stage: progress.stage || 'tts',
    sceneIndex: progress.sceneIndex ?? 0,
    sceneCount: progress.sceneCount || 1,
    startedAt: progress.startedAt,
    estimatedTotalSec: progress.estimatedTotalSec,
    pipeline: progress.pipeline || 'audio',
  })
}

/** Client estimate when the server has not written progress yet (or render is orphaned). */
export function buildFallbackRenderProgress(job, script, pipeline = 'audio') {
  const sceneCount = script?.scenes?.length || job?.renderProgress?.sceneCount || 5
  const startedAt = job?.renderProgress?.startedAt || null
  const estimatedTotalSec =
    pipeline === 'video'
      ? estimateEofVideoRenderDurationSec(sceneCount)
      : estimateEofRenderDurationSec(script || { scenes: Array.from({ length: sceneCount }) })
  const elapsedSeconds = startedAt
    ? Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))
    : 0
  const percent = startedAt
    ? Math.min(88, Math.max(4, Math.round((elapsedSeconds / Math.max(estimatedTotalSec, 1)) * 100)))
    : 4
  const etaSeconds = computeRenderEtaSeconds({ percent, elapsedSeconds, estimatedTotalSec })

  const message =
    pipeline === 'video'
      ? job?.renderProgress?.message || `Building Short video (${sceneCount} scenes)…`
      : job?.renderProgress?.stage === 'mix'
        ? 'Mixing narration with music bed (ffmpeg)…'
        : `Rendering… narrating up to ${sceneCount} scenes (Edge TTS)`

  return {
    percent,
    stage: job?.renderProgress?.stage || (pipeline === 'video' ? 'images' : 'tts'),
    sceneIndex: job?.renderProgress?.sceneIndex ?? 0,
    sceneCount,
    message,
    pipeline,
    startedAt: startedAt || new Date().toISOString(),
    elapsedSeconds,
    estimatedTotalSec,
    etaSeconds,
    etaLabel: formatEtaLabel(etaSeconds),
    fallback: !job?.renderProgress,
  }
}
