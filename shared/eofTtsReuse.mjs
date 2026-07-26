/**
 * EOF TTS reuse + ElevenLabs credit-guard decisions (pure, browser/Node safe).
 * Prevents silent rebuild/retry loops from burning the same narration many times.
 */
import { hashEofNarrationLines } from './eofVoiceRegeneration.mjs'
import { normalizeElevenLabsVoiceSettings } from './eofElevenLabsVoice.mjs'

/** Max ElevenLabs synthesizes per job for the same narration+voice fingerprint. */
export const EOF_TTS_MAX_SYNTHS_PER_HASH = 3

/** FNV-style fingerprint used for stable string hashing (not cryptographic). */
export function hashEofStableString(input) {
  const s = String(input || '')
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  const a = (h >>> 0).toString(16).padStart(8, '0')
  let h2 = 0x811c9dc5 ^ s.length
  for (let i = 0; i < s.length; i += 1) {
    h2 ^= s.charCodeAt(i)
    h2 = Math.imul(h2, 0x01000193)
    h2 ^= i
  }
  const b = (h2 >>> 0).toString(16).padStart(8, '0')
  return `${a}${b}${a}${b}`.slice(0, 32)
}

/**
 * Fingerprint of spoken lines + voice preset/settings (not music).
 * Same hash → durable VO may be reused; changing Brian sliders or captions forces new TTS.
 */
export function hashEofTtsFingerprint({
  script,
  voicePreset,
  voiceSettings,
} = {}) {
  const narration = hashEofNarrationLines(script)
  const preset = String(voicePreset || '').trim() || 'british'
  const settings = voiceSettings ? normalizeElevenLabsVoiceSettings(voiceSettings) : null
  const settingsPart = settings
    ? [
        settings.speed,
        settings.stability,
        settings.similarityBoost,
        settings.style,
      ].join(',')
    : ''
  return hashEofStableString(`tts|${narration}|${preset}|${settingsPart}`)
}

/** Per-scene line hash (text + voice) for disk reuse / dedupe. */
export function hashEofSceneTtsLine({
  text,
  voicePreset,
  voiceSettings,
} = {}) {
  const line = String(text || '').trim()
  const preset = String(voicePreset || '').trim() || 'british'
  const settings = voiceSettings ? normalizeElevenLabsVoiceSettings(voiceSettings) : null
  const settingsPart = settings
    ? [
        settings.speed,
        settings.stability,
        settings.similarityBoost,
        settings.style,
      ].join(',')
    : ''
  return hashEofStableString(`line|${preset}|${settingsPart}|${line}`)
}

/**
 * Skip entire audio step when durable mixed exists and fingerprint matches.
 */
export function shouldReuseEofDurableMixedAudio({
  hasDurableAudio = false,
  storedFingerprint = null,
  currentFingerprint = null,
  forceFreshAudio = false,
  voiceRegenerationMode = false,
} = {}) {
  if (forceFreshAudio || voiceRegenerationMode) return false
  if (!hasDurableAudio) return false
  const stored = String(storedFingerprint || '').trim()
  const current = String(currentFingerprint || '').trim()
  return Boolean(stored && current && stored === current)
}

/**
 * Skip per-scene ElevenLabs when scene mp3 already matches this line hash.
 */
export function shouldReuseEofSceneAudioFile({
  fileExists = false,
  storedLineHash = null,
  currentLineHash = null,
  reuseSceneAudio = false,
  forceFreshAudio = false,
  voiceRegenerationMode = false,
} = {}) {
  if (forceFreshAudio || voiceRegenerationMode) return false
  if (reuseSceneAudio && fileExists) return true
  if (!fileExists) return false
  const stored = String(storedLineHash || '').trim()
  const current = String(currentLineHash || '').trim()
  return Boolean(stored && current && stored === current)
}

/**
 * Group identical narration lines so one synthesize is copied to sibling scenes.
 * @param {Array<{ index: number, text: string, lineHash: string }>} scenes
 * @returns {Array<{ lineHash: string, text: string, indexes: number[] }>}
 */
export function planEofSceneTtsDedupe(scenes) {
  const order = []
  const byHash = new Map()
  for (const scene of scenes || []) {
    const lineHash = String(scene?.lineHash || '').trim()
    const text = String(scene?.text || '').trim()
    const index = Number(scene?.index)
    if (!lineHash || !text || !Number.isFinite(index)) continue
    const existing = byHash.get(lineHash)
    if (existing) {
      existing.indexes.push(index)
      continue
    }
    const row = { lineHash, text, indexes: [index] }
    byHash.set(lineHash, row)
    order.push(row)
  }
  return order
}

/**
 * Hard credit guard: refuse further ElevenLabs calls for this fingerprint.
 * Explicit voice regeneration bypasses (separate free-slider budget).
 */
export function eofTtsCreditGuardDecision({
  engine = 'edge',
  currentFingerprint = null,
  storedFingerprint = null,
  synthCount = 0,
  maxSynths = EOF_TTS_MAX_SYNTHS_PER_HASH,
  voiceRegenerationMode = false,
} = {}) {
  if (engine !== 'elevenlabs') {
    return { allow: true, blocked: false, reason: null, count: 0, limit: maxSynths }
  }
  if (voiceRegenerationMode) {
    return { allow: true, blocked: false, reason: null, count: Number(synthCount) || 0, limit: maxSynths }
  }
  const current = String(currentFingerprint || '').trim()
  const stored = String(storedFingerprint || '').trim()
  const count = stored && current && stored === current ? Math.max(0, Number(synthCount) || 0) : 0
  const limit = Math.max(1, Number(maxSynths) || EOF_TTS_MAX_SYNTHS_PER_HASH)
  // forceFreshAudio still counts against the budget — only explicit Regenerate voiceover bypasses.
  if (count >= limit) {
    return {
      allow: false,
      blocked: true,
      reason:
        `ElevenLabs credit guard: already synthesized ${count}/${limit} times for this narration+voice. ` +
        `Reuse the existing voiceover, or use Regenerate voiceover intentionally.`,
      count,
      limit,
    }
  }
  return { allow: true, blocked: false, reason: null, count, limit }
}
