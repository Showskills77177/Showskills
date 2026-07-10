import { createHash } from 'node:crypto'

/** ElevenLabs playground allows slider-only regenerations without extra charge (we mirror that limit). */
export const EOF_ELEVENLABS_FREE_SETTING_REGENS = 3

/** Stable hash of spoken lines — voice-only regen requires an unchanged script. */
export function hashEofNarrationLines(script) {
  const lines = (script?.scenes || [])
    .map((s) => String(s?.narration || s?.caption || '').trim())
    .filter(Boolean)
  return createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 32)
}

/**
 * @param {{
 *   voiceRegenerationCount?: number,
 *   voiceNarrationHash?: string | null,
 *   script?: { scenes?: Array<{ narration?: string, caption?: string }> } | null,
 * }} job
 */
export function eofVoiceRegenerationStatus(job) {
  const limit = EOF_ELEVENLABS_FREE_SETTING_REGENS
  const used = Math.max(0, Number(job?.voiceRegenerationCount) || 0)
  const remaining = Math.max(0, limit - used)
  const currentHash = hashEofNarrationLines(job?.script)
  const baselineHash = job?.voiceNarrationHash || null
  const scriptUnchanged = Boolean(baselineHash && baselineHash === currentHash)

  let blockedReason = null
  if (!baselineHash) {
    blockedReason = 'Build the Short once so we have a narration baseline.'
  } else if (!scriptUnchanged) {
    blockedReason = 'Captions changed — use Rebuild Short (uses ElevenLabs credits).'
  } else if (remaining <= 0) {
    blockedReason = `All ${limit} free voice-setting regenerations used — Rebuild Short for a fresh generation.`
  }

  return {
    limit,
    used,
    remaining,
    scriptUnchanged,
    canRegenerate: !blockedReason,
    blockedReason,
  }
}
