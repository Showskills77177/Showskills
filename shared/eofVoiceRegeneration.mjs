/** ElevenLabs playground allows slider-only regenerations without extra charge (we mirror that limit). */
export const EOF_ELEVENLABS_FREE_SETTING_REGENS = 3

/**
 * Stable fingerprint of spoken lines — browser + Node safe (no node:crypto).
 * Not cryptographic; only used to detect caption edits for free regen eligibility.
 */
export function hashEofNarrationLines(script) {
  const lines = (script?.scenes || [])
    .map((s) => String(s?.narration || s?.caption || '').trim())
    .filter(Boolean)
  const input = lines.join('\n')
  // FNV-1a 32-bit, hex-padded — stable across runtimes
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  const a = (h >>> 0).toString(16).padStart(8, '0')
  // second pass with different seed for more bits
  let h2 = 0x811c9dc5 ^ input.length
  for (let i = 0; i < input.length; i += 1) {
    h2 ^= input.charCodeAt(i)
    h2 = Math.imul(h2, 0x01000193)
    h2 ^= i
  }
  const b = (h2 >>> 0).toString(16).padStart(8, '0')
  return `${a}${b}${a}${b}`.slice(0, 32)
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
