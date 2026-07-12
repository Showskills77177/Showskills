/**
 * Caption styles for Eyes Of Football Shorts.
 * - zapcap / pop / karaoke / beast → ZapCap template burn when keyed
 * - live → free bottom subtitles (ffmpeg, no ZapCap)
 * - off → clean plate
 *
 * Prefer picking a concrete ZapCap templateId in Production; pop/karaoke/beast
 * remain named shortcuts when the catalog is unavailable.
 */

export const EOF_DEFAULT_CAPTION_STYLE = 'live'

/** @typedef {'live' | 'zapcap' | 'pop' | 'karaoke' | 'beast' | 'off'} EofCaptionStyleId */

/**
 * @type {Array<{
 *   id: EofCaptionStyleId,
 *   label: string,
 *   detail: string,
 *   vibe: string,
 *   displayWords: number,
 *   engine: 'zapcap' | 'local' | 'none',
 *   zapcapTemplateEnv: string,
 *   zapcapTemplateDefault: string,
 * }>}
 */
export const EOF_CAPTION_STYLES = [
  {
    id: 'live',
    label: 'Live subs (free)',
    detail: 'Classic bottom subtitles under the picture — free, no ZapCap.',
    vibe: 'Free · live TV style',
    displayWords: 6,
    engine: 'local',
    zapcapTemplateEnv: '',
    zapcapTemplateDefault: '',
  },
  {
    id: 'zapcap',
    label: 'ZapCap template',
    detail: 'Pick any CapCut-class template from your ZapCap catalog.',
    vibe: 'ZapCap · choose template',
    displayWords: 3,
    engine: 'zapcap',
    zapcapTemplateEnv: 'ZAPCAP_TEMPLATE_POP',
    zapcapTemplateDefault: 'ca050348-e2d0-49a7-9c75-7a5e8335c67d',
  },
  {
    id: 'pop',
    label: 'Pop (Hormozi)',
    detail: '1–2 words at a time, yellow flash then bold white — CapCut / Hormozi classic.',
    vibe: 'ZapCap · punchy hooks',
    displayWords: 2,
    engine: 'zapcap',
    zapcapTemplateEnv: 'ZAPCAP_TEMPLATE_POP',
    zapcapTemplateDefault: 'ca050348-e2d0-49a7-9c75-7a5e8335c67d',
  },
  {
    id: 'karaoke',
    label: 'Karaoke fill',
    detail: 'Phrase on screen; active word lights yellow as it is spoken — CapCut karaoke.',
    vibe: 'ZapCap · story beats',
    displayWords: 4,
    engine: 'zapcap',
    zapcapTemplateEnv: 'ZAPCAP_TEMPLATE_KARAOKE',
    zapcapTemplateDefault: '21327a45-df89-46bc-8d56-34b8d29d3a0e',
  },
  {
    id: 'beast',
    label: 'Beast bounce',
    detail: 'Single huge word pops with neon energy — MrBeast / high-retention Shorts.',
    vibe: 'ZapCap · lists & hype',
    displayWords: 1,
    engine: 'zapcap',
    zapcapTemplateEnv: 'ZAPCAP_TEMPLATE_BEAST',
    zapcapTemplateDefault: '46d20d67-255c-4c6a-b971-31fddcfea7f0',
  },
  {
    id: 'off',
    label: 'Off',
    detail: 'No on-screen captions — clean plate only.',
    vibe: 'Voiceover only',
    displayWords: 0,
    engine: 'none',
    zapcapTemplateEnv: '',
    zapcapTemplateDefault: '',
  },
]

const STYLE_IDS = new Set(EOF_CAPTION_STYLES.map((s) => s.id))

const ZAPCAP_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normalizeZapcapTemplateId(value) {
  const id = String(value || '').trim()
  return ZAPCAP_UUID_RE.test(id) ? id : ''
}

export function resolveEofCaptionStyle(style) {
  const id = String(style || EOF_DEFAULT_CAPTION_STYLE).trim().toLowerCase()
  if (id === 'none' || id === 'disabled' || id === 'off') return 'off'
  if (id === 'subs' || id === 'subtitles' || id === 'subtitle' || id === 'bottom') return 'live'
  if (id === 'zap' || id === 'capcut' || id === 'template') return 'zapcap'
  // Selecting a raw template UUID counts as ZapCap mode
  if (ZAPCAP_UUID_RE.test(id)) return 'zapcap'
  return STYLE_IDS.has(id) ? id : EOF_DEFAULT_CAPTION_STYLE
}

export function captionsEnabledForStyle(style) {
  return resolveEofCaptionStyle(style) !== 'off'
}

/** Free local burn (bottom live subs) — never sends to ZapCap. */
export function isLocalCaptionStyle(style) {
  return getEofCaptionStyle(style).engine === 'local'
}

/** Paid CapCut templates via ZapCap. */
export function isZapcapCaptionStyle(style) {
  return getEofCaptionStyle(style).engine === 'zapcap'
}

export function getEofCaptionStyle(style) {
  const id = resolveEofCaptionStyle(style)
  return EOF_CAPTION_STYLES.find((s) => s.id === id) || EOF_CAPTION_STYLES[0]
}

export function listEofCaptionStyles() {
  return EOF_CAPTION_STYLES.map((s) => ({
    id: s.id,
    label: s.label,
    detail: s.detail,
    vibe: s.vibe,
    engine: s.engine,
  }))
}
