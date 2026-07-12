/**
 * CapCut-class caption styles for Eyes Of Football Shorts.
 * Three production looks — local ffmpeg drawtext always works;
 * optional ZapCap templates when ZAPCAP_API_KEY is set.
 */

export const EOF_DEFAULT_CAPTION_STYLE = 'pop'

/** @typedef {'pop' | 'karaoke' | 'beast'} EofCaptionStyleId */

/**
 * @type {Array<{
 *   id: EofCaptionStyleId,
 *   label: string,
 *   detail: string,
 *   vibe: string,
 *   displayWords: number,
 *   zapcapTemplateEnv: string,
 *   zapcapTemplateDefault: string,
 * }>}
 */
export const EOF_CAPTION_STYLES = [
  {
    id: 'pop',
    label: 'Pop (Hormozi)',
    detail: '1–2 words at a time, yellow flash then bold white — CapCut / Hormozi classic.',
    vibe: 'Punchy hooks & hot takes',
    displayWords: 2,
    zapcapTemplateEnv: 'ZAPCAP_TEMPLATE_POP',
    zapcapTemplateDefault: 'ca050348-e2d0-49a7-9c75-7a5e8335c67d',
  },
  {
    id: 'karaoke',
    label: 'Karaoke fill',
    detail: 'Phrase on screen; active word lights yellow as it is spoken — CapCut karaoke.',
    vibe: 'Story beats & news VO',
    displayWords: 4,
    zapcapTemplateEnv: 'ZAPCAP_TEMPLATE_KARAOKE',
    zapcapTemplateDefault: '21327a45-df89-46bc-8d56-34b8d29d3a0e',
  },
  {
    id: 'beast',
    label: 'Beast bounce',
    detail: 'Single huge word pops with neon energy — MrBeast / high-retention Shorts.',
    vibe: 'Lists, reveals, hype',
    displayWords: 1,
    zapcapTemplateEnv: 'ZAPCAP_TEMPLATE_BEAST',
    zapcapTemplateDefault: '46d20d67-255c-4c6a-b971-31fddcfea7f0',
  },
]

const STYLE_IDS = new Set(EOF_CAPTION_STYLES.map((s) => s.id))

export function resolveEofCaptionStyle(style) {
  const id = String(style || EOF_DEFAULT_CAPTION_STYLE).trim().toLowerCase()
  return STYLE_IDS.has(id) ? id : EOF_DEFAULT_CAPTION_STYLE
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
  }))
}
