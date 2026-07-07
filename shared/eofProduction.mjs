/** Eyes Of Football — automated production pipeline (staging). */

export const EOF_PRODUCTION_JOB_STATUS = {
  DRAFT: 'draft',
  SCRIPTING: 'scripting',
  READY_SCRIPT: 'ready_script',
  RENDERING: 'rendering',
  RENDERED: 'rendered',
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
    rendering: 'Rendering…',
    rendered: 'Audio rendered',
    failed: 'Failed',
    published: 'Published',
  }
  return map[status] || status || '—'
}

export const EOF_RENDER_STACK = {
  tts: {
    id: 'edge-tts',
    label: 'Microsoft Edge TTS (neural voices)',
    detail: 'Free online speech API used via the node-edge-tts package — not OpenAI or ElevenLabs.',
  },
  audio: {
    id: 'ffmpeg',
    label: 'ffmpeg (bundled on staging)',
    detail: 'Concatenates scene MP3s and mixes your music bed locally on the ShowSkills API server.',
  },
  host: {
    id: 'vercel',
    label: 'ShowSkills staging API (Vercel serverless)',
    detail: 'Audio render runs in the background with progress polling. Video clips need a provider like Luma Dream Machine API.',
  },
  video: {
    id: 'luma',
    label: 'Luma Dream Machine API (planned for B-roll)',
    detail: 'Official API at docs.lumalabs.ai — text/image to video. Not an autonomous agent; we orchestrate script → TTS → clips → ffmpeg.',
  },
}

/** Rough pre-render estimate from narration length + scene count. */
export function estimateEofRenderDurationSec(script) {
  const scenes = script?.scenes || []
  if (!scenes.length) return 30
  let ttsSec = 0
  for (const scene of scenes) {
    const chars = String(scene.narration || '').trim().length
    ttsSec += Math.max(6, chars * 0.055)
  }
  const mixSec = 10 + scenes.length * 1.5
  return Math.ceil(ttsSec + mixSec)
}

/**
 * @param {{
 *   stage: 'tts' | 'mix' | 'done',
 *   sceneIndex?: number,
 *   sceneCount: number,
 *   startedAt: string,
 *   estimatedTotalSec?: number,
 * }} input
 */
export function buildEofRenderProgress(input) {
  const sceneCount = Math.max(1, input.sceneCount || 1)
  const sceneIndex = Math.max(0, input.sceneIndex ?? 0)
  const startedMs = new Date(input.startedAt).getTime()
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedMs) / 1000))

  let percent = 0
  let message = 'Starting render…'

  if (input.stage === 'tts') {
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

  const estimatedTotalSec = Math.max(
    elapsedSeconds + 1,
    input.estimatedTotalSec || estimateEofRenderDurationSec({ scenes: Array.from({ length: sceneCount }) }),
  )
  const pacePercent = Math.max(percent, 1)
  const etaSeconds =
    percent >= 100
      ? 0
      : Math.max(0, Math.round((elapsedSeconds / pacePercent) * (100 - percent)))

  const etaMinutes = Math.floor(etaSeconds / 60)
  const etaRemSec = etaSeconds % 60

  return {
    percent,
    stage: input.stage,
    sceneIndex,
    sceneCount,
    message,
    startedAt: input.startedAt,
    elapsedSeconds,
    estimatedTotalSec,
    etaSeconds,
    etaLabel:
      percent >= 100
        ? '0:00 left'
        : etaMinutes > 0
          ? `~${etaMinutes}m ${etaRemSec}s left`
          : `~${etaRemSec}s left`,
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
  })
}

/** Client estimate when the server has not written progress yet (or render is orphaned). */
export function buildFallbackRenderProgress(job, script) {
  const sceneCount = script?.scenes?.length || job?.renderProgress?.sceneCount || 5
  const startedAt = job?.renderProgress?.startedAt || job?.updatedAt || new Date().toISOString()
  const estimatedTotalSec = estimateEofRenderDurationSec(script || { scenes: Array.from({ length: sceneCount }) })
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))
  const percent = Math.min(92, Math.max(4, Math.round((elapsedSeconds / Math.max(estimatedTotalSec, 1)) * 100)))
  const etaSeconds = Math.max(0, estimatedTotalSec - elapsedSeconds)
  const etaMinutes = Math.floor(etaSeconds / 60)
  const etaRemSec = etaSeconds % 60

  return {
    percent,
    stage: job?.renderProgress?.stage || 'tts',
    sceneIndex: job?.renderProgress?.sceneIndex ?? 0,
    sceneCount,
    message:
      job?.renderProgress?.stage === 'mix'
        ? 'Mixing narration with music bed (ffmpeg)…'
        : `Rendering… narrating up to ${sceneCount} scenes (Edge TTS)`,
    startedAt,
    elapsedSeconds,
    estimatedTotalSec,
    etaSeconds,
    etaLabel:
      etaSeconds > 0
        ? etaMinutes > 0
          ? `~${etaMinutes}m ${etaRemSec}s left`
          : `~${etaRemSec}s left`
        : 'finishing…',
    fallback: !job?.renderProgress,
  }
}
