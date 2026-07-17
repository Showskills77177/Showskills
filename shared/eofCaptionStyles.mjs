/**
 * Caption styles for Eyes Of Football Shorts.
 *
 * Free local burns (ffmpeg drawtext, no ZapCap credits):
 * - live → classic bottom TV/CC bar
 * - punch → sports lower-third “match bar”
 * - classic / softbar / broadcast / desk / elegant → readable subtitle looks
 * - pop / karaoke / beast → CapCut-class local looks (Build/Rebuild)
 *
 * Paid ZapCap path (Apply ZapCap / auto mode when keyed):
 * - zapcap → pick any catalog templateId
 * - pop / karaoke / beast → named ZapCap template shortcuts
 *
 * off → clean plate
 */

export const EOF_DEFAULT_CAPTION_STYLE = 'live'

/** @typedef {'live' | 'punch' | 'classic' | 'softbar' | 'broadcast' | 'desk' | 'elegant' | 'zapcap' | 'pop' | 'karaoke' | 'beast' | 'off'} EofCaptionStyleId */

/**
 * @type {Array<{
 *   id: EofCaptionStyleId,
 *   label: string,
 *   detail: string,
 *   vibe: string,
 *   displayWords: number,
 *   engine: 'zapcap' | 'local' | 'none',
 *   free: boolean,
 *   zapcapTemplateEnv: string,
 *   zapcapTemplateDefault: string,
 * }>}
 */
export const EOF_CAPTION_STYLES = [
  {
    id: 'live',
    label: 'Live subs (free)',
    detail: 'High-contrast bottom captions — free ffmpeg burn, no ZapCap.',
    vibe: 'Free · TV / YouTube CC',
    displayWords: 5,
    engine: 'local',
    free: true,
    zapcapTemplateEnv: '',
    zapcapTemplateDefault: '',
  },
  {
    id: 'classic',
    label: 'Classic subs (free)',
    detail: 'Netflix-style lower-third: white text, soft black outline + shadow — clear on any pitch.',
    vibe: 'Free · Netflix / YouTube',
    displayWords: 6,
    engine: 'local',
    free: true,
    zapcapTemplateEnv: '',
    zapcapTemplateDefault: '',
  },
  {
    id: 'softbar',
    label: 'Soft bar (free)',
    detail: 'White sentence case on a soft semi-transparent black pill — readable without flash.',
    vibe: 'Free · soft subtitle bar',
    displayWords: 6,
    engine: 'local',
    free: true,
    zapcapTemplateEnv: '',
    zapcapTemplateDefault: '',
  },
  {
    id: 'broadcast',
    label: 'Broadcast (free)',
    detail: 'Bold white with a thin black stroke — clean sports-broadcast lower third.',
    vibe: 'Free · broadcast stroke',
    displayWords: 5,
    engine: 'local',
    free: true,
    zapcapTemplateEnv: '',
    zapcapTemplateDefault: '',
  },
  {
    id: 'desk',
    label: 'Desk VO (free)',
    detail: 'Slightly larger clear commentary subs — easy to read while the VO talks.',
    vibe: 'Free · desk commentary',
    displayWords: 6,
    engine: 'local',
    free: true,
    zapcapTemplateEnv: '',
    zapcapTemplateDefault: '',
  },
  {
    id: 'elegant',
    label: 'Gold trim (free)',
    detail: 'Soft cream/gold lower-third with a deep shadow — elegant, still readable on green.',
    vibe: 'Free · elegant lower third',
    displayWords: 5,
    engine: 'local',
    free: true,
    zapcapTemplateEnv: '',
    zapcapTemplateDefault: '',
  },
  {
    id: 'punch',
    label: 'Match bar (free)',
    detail: 'Sports lower-third: short uppercase lines with a yellow accent — free, football Shorts style.',
    vibe: 'Free · matchday graphic',
    displayWords: 4,
    engine: 'local',
    free: true,
    zapcapTemplateEnv: '',
    zapcapTemplateDefault: '',
  },
  {
    id: 'zapcap',
    label: 'ZapCap template',
    detail: 'Pick any CapCut-class template from your ZapCap catalog (credits / watermark on free ZapCap tier).',
    vibe: 'ZapCap · choose template',
    displayWords: 3,
    engine: 'zapcap',
    free: false,
    zapcapTemplateEnv: 'ZAPCAP_TEMPLATE_POP',
    zapcapTemplateDefault: 'ca050348-e2d0-49a7-9c75-7a5e8335c67d',
  },
  {
    id: 'pop',
    label: 'Pop punch (free)',
    detail: '1–2 words flash yellow then hold white — free local burn. Apply ZapCap for animated Hormozi.',
    vibe: 'Free · CapCut hooks',
    displayWords: 2,
    engine: 'zapcap',
    free: true,
    zapcapTemplateEnv: 'ZAPCAP_TEMPLATE_POP',
    zapcapTemplateDefault: 'ca050348-e2d0-49a7-9c75-7a5e8335c67d',
  },
  {
    id: 'karaoke',
    label: 'Word highlight (free)',
    detail: 'Phrase on screen; active word lights yellow — free local burn. Apply ZapCap for CapCut karaoke.',
    vibe: 'Free · story beats',
    displayWords: 4,
    engine: 'zapcap',
    free: true,
    zapcapTemplateEnv: 'ZAPCAP_TEMPLATE_KARAOKE',
    zapcapTemplateDefault: '21327a45-df89-46bc-8d56-34b8d29d3a0e',
  },
  {
    id: 'beast',
    label: 'Beast boom (free)',
    detail: 'One huge word pops neon — free local burn. Apply ZapCap for MrBeast-class animation.',
    vibe: 'Free · lists & hype',
    displayWords: 1,
    engine: 'zapcap',
    free: true,
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
    free: true,
    zapcapTemplateEnv: '',
    zapcapTemplateDefault: '',
  },
]

const STYLE_IDS = new Set(EOF_CAPTION_STYLES.map((s) => s.id))

/** Styles that use a bottom safe-zone bar (vs mid-frame CapCut pack). */
const BOTTOM_BAR_STYLES = new Set([
  'live',
  'punch',
  'classic',
  'softbar',
  'broadcast',
  'desk',
  'elegant',
])

/**
 * CapCut shortcuts + pure local burns available for free Build/Rebuild.
 * Catalog `zapcap` falls back to local `pop` in free mode.
 */
const LOCAL_FREE_BURN_STYLES = new Set([
  'live',
  'punch',
  'classic',
  'softbar',
  'broadcast',
  'desk',
  'elegant',
  'pop',
  'karaoke',
  'beast',
])

/**
 * Full-width dim plate behind bottom captions (drawbox in the video filter).
 * `softbar` uses per-phrase drawtext box instead; outline styles skip the plate.
 * @typedef {'full' | 'punch' | 'soft' | 'none'} EofCaptionPlateMode
 */

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
  if (id === 'netflix' || id === 'youtube' || id === 'cc') return 'classic'
  if (id === 'bar' || id === 'pill' || id === 'banner') return 'softbar'
  if (id === 'tv' || id === 'news' || id === 'stroke') return 'broadcast'
  if (id === 'vo' || id === 'commentary' || id === 'deskvo') return 'desk'
  if (id === 'gold' || id === 'cream' || id === 'trim') return 'elegant'
  if (id === 'match' || id === 'ticker' || id === 'scorebar' || id === 'sports') return 'punch'
  if (id === 'zap' || id === 'capcut' || id === 'template') return 'zapcap'
  // Selecting a raw template UUID counts as ZapCap mode
  if (ZAPCAP_UUID_RE.test(id)) return 'zapcap'
  return STYLE_IDS.has(id) ? id : EOF_DEFAULT_CAPTION_STYLE
}

export function captionsEnabledForStyle(style) {
  return resolveEofCaptionStyle(style) !== 'off'
}

/** Pure local engines (subtitle styles) — never ZapCap shortcuts. */
export function isLocalCaptionStyle(style) {
  return getEofCaptionStyle(style).engine === 'local'
}

/** Paid CapCut templates via ZapCap (including named shortcuts). */
export function isZapcapCaptionStyle(style) {
  return getEofCaptionStyle(style).engine === 'zapcap'
}

/** Bottom-bar layout (subtitle styles) vs mid-frame CapCut pack. */
export function isBottomBarCaptionStyle(style) {
  return BOTTOM_BAR_STYLES.has(resolveEofCaptionStyle(style))
}

/**
 * How the scene filter dims the plate behind bottom captions.
 * @param {string} [style]
 * @returns {EofCaptionPlateMode}
 */
export function captionBottomPlateMode(style) {
  const id = resolveEofCaptionStyle(style)
  if (id === 'punch') return 'punch'
  if (id === 'live') return 'full'
  if (id === 'desk') return 'soft'
  if (BOTTOM_BAR_STYLES.has(id)) return 'none'
  return 'none'
}

/**
 * Style id to burn with free local ffmpeg during Build/Rebuild.
 * Catalog ZapCap picks preview as punchy local `pop`.
 */
export function resolveFreeLocalBurnStyle(style) {
  const id = resolveEofCaptionStyle(style)
  if (id === 'off') return 'off'
  if (id === 'zapcap') return 'pop'
  if (LOCAL_FREE_BURN_STYLES.has(id)) return id
  return EOF_DEFAULT_CAPTION_STYLE
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
    free: Boolean(s.free),
  }))
}
