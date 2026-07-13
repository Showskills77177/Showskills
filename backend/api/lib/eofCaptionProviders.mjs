/**
 * Caption provider adapter surface — ZapCap today; Reap/Rendobar/local later.
 * Implementations should expose: configured check, listTemplates (optional), burnCaptions.
 *
 * @typedef {'local' | 'zapcap' | 'reap' | 'rendobar'} EofCaptionProviderId
 *
 * @typedef {object} EofCaptionBurnInput
 * @property {string} videoPath absolute path to assembled MP4 (no animated captions yet for paid providers)
 * @property {string} style resolved caption style id
 * @property {string} [templateId] provider template uuid / preset id
 * @property {Array<{ caption?: string, narration?: string, durationSec?: number }>} scenes
 *
 * @typedef {object} EofCaptionBurnResult
 * @property {string} engine provider id used
 * @property {string} [templateId]
 * @property {string} [style]
 */

/** @type {Record<EofCaptionProviderId, { label: string, paid: boolean }>} */
export const EOF_CAPTION_PROVIDERS = {
  local: { label: 'Free live subs (ffmpeg)', paid: false },
  zapcap: { label: 'ZapCap', paid: true },
  reap: { label: 'Reap', paid: true },
  rendobar: { label: 'Rendobar', paid: true },
}

/**
 * Resolve which paid provider to use (env-driven; ZapCap default).
 * @returns {EofCaptionProviderId}
 */
export function resolveEofCaptionProviderId() {
  const raw = String(process.env.EOF_CAPTION_PROVIDER || 'zapcap')
    .trim()
    .toLowerCase()
  if (raw in EOF_CAPTION_PROVIDERS) return /** @type {EofCaptionProviderId} */ (raw)
  return 'zapcap'
}
