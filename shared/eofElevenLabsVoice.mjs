/** ElevenLabs Brian voice tuning — shared between API, UI, and TTS. */

export const EOF_ELEVENLABS_VOICE_LIMITS = {
  speed: { min: 0.7, max: 1.2, step: 0.05, default: 1.0 },
  stability: { min: 0, max: 1, step: 0.05, default: 0.45 },
  similarityBoost: { min: 0, max: 1, step: 0.05, default: 0.75 },
  style: { min: 0, max: 1, step: 0.05, default: 0.35 },
}

/** UI copy aligned with ElevenLabs web app labels. */
export const EOF_ELEVENLABS_VOICE_FIELDS = [
  {
    key: 'speed',
    label: 'Speed',
    hint: '1.0 = normal. Lower slows Brian down; higher speeds up (0.7–1.2).',
  },
  {
    key: 'stability',
    label: 'Stability',
    hint: 'Higher = steadier tone. Lower = more emotional variation.',
  },
  {
    key: 'similarityBoost',
    label: 'Similarity',
    hint: 'How closely Brian matches the original voice sample.',
  },
  {
    key: 'style',
    label: 'Style exaggeration',
    hint: 'Amplifies Brian’s character. Higher can reduce stability.',
  },
]

function clampNum(value, { min, max, fallback }) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n * 100) / 100))
}

/**
 * Normalize user / preset / env voice settings.
 * @param {Record<string, unknown> | null | undefined} input
 */
export function normalizeElevenLabsVoiceSettings(input) {
  const L = EOF_ELEVENLABS_VOICE_LIMITS
  const src = input && typeof input === 'object' ? input : {}
  return {
    speed: clampNum(src.speed, { ...L.speed, fallback: L.speed.default }),
    stability: clampNum(src.stability, { ...L.stability, fallback: L.stability.default }),
    similarityBoost: clampNum(
      src.similarityBoost ?? src.similarity_boost,
      { ...L.similarityBoost, fallback: L.similarityBoost.default },
    ),
    style: clampNum(src.style, { ...L.style, fallback: L.style.default }),
  }
}

/** Defaults from env (server) — optional global Brian tuning on Vercel. */
export function elevenLabsVoiceSettingsFromEnv() {
  const env = typeof process !== 'undefined' ? process.env : {}
  const raw = {}
  if (env.ELEVENLABS_SPEED || env.EOF_ELEVENLABS_SPEED) {
    raw.speed = env.ELEVENLABS_SPEED || env.EOF_ELEVENLABS_SPEED
  }
  if (env.ELEVENLABS_STABILITY || env.EOF_ELEVENLABS_STABILITY) {
    raw.stability = env.ELEVENLABS_STABILITY || env.EOF_ELEVENLABS_STABILITY
  }
  if (env.ELEVENLABS_SIMILARITY || env.EOF_ELEVENLABS_SIMILARITY) {
    raw.similarityBoost = env.ELEVENLABS_SIMILARITY || env.EOF_ELEVENLABS_SIMILARITY
  }
  if (env.ELEVENLABS_STYLE || env.EOF_ELEVENLABS_STYLE) {
    raw.style = env.ELEVENLABS_STYLE || env.EOF_ELEVENLABS_STYLE
  }
  return normalizeElevenLabsVoiceSettings(raw)
}

/**
 * Merge preset → env → job overrides (job wins).
 * @param {{ stability?: number, similarityBoost?: number, style?: number, speed?: number } | null} preset
 * @param {Record<string, unknown> | null | undefined} jobSettings
 */
export function resolveElevenLabsVoiceSettings(preset, jobSettings) {
  const base = normalizeElevenLabsVoiceSettings({
    speed: preset?.speed,
    stability: preset?.stability,
    similarityBoost: preset?.similarityBoost,
    style: preset?.style,
  })
  const fromEnv = elevenLabsVoiceSettingsFromEnv()
  const merged = normalizeElevenLabsVoiceSettings({
    ...base,
    ...fromEnv,
    ...(jobSettings && typeof jobSettings === 'object' ? jobSettings : {}),
  })
  return merged
}
