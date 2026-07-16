/**
 * CapCut-style transitions + color-match grades for Eyes Of Football Shorts.
 * Auto picks a pack from the script format (news cooler/faster, debate punchier, etc.).
 */

export const EOF_DEFAULT_TRANSITION_STYLE = 'auto'
export const EOF_DEFAULT_COLOR_GRADE = 'auto'
export const EOF_DEFAULT_ENHANCE_STYLE = 'auto'

/** @typedef {'auto' | 'cut' | 'fade' | 'fadeblack' | 'dissolve' | 'slideleft' | 'slideright' | 'slideup' | 'wipeleft' | 'circleopen' | 'radial' | 'pixelize'} EofTransitionStyleId */
/** @typedef {'auto' | 'off' | 'match' | 'punchy' | 'cinematic' | 'warm' | 'cool'} EofColorGradeId */
/** @typedef {'auto' | 'off' | 'hd' | 'soft' | 'crisp' | 'clean'} EofEnhanceStyleId */

/**
 * ffmpeg xfade transition names that ship in modern ffmpeg builds.
 * @type {Array<{ id: EofTransitionStyleId, label: string, detail: string, xfade: string | null, vibe: string }>}
 */
export const EOF_TRANSITION_STYLES = [
  {
    id: 'auto',
    label: 'Auto (CapCut pack)',
    detail: 'AI picks CapCut-typical cuts from the Short format — mix of fades, slides, wipes.',
    xfade: null,
    vibe: 'Auto · best for format',
  },
  {
    id: 'cut',
    label: 'Hard cut',
    detail: 'No transition — instant cut between scenes.',
    xfade: null,
    vibe: 'Clean · newsroom',
  },
  {
    id: 'fade',
    label: 'Cross fade',
    detail: 'Classic CapCut dissolve between scenes.',
    xfade: 'fade',
    vibe: 'CapCut · smooth',
  },
  {
    id: 'fadeblack',
    label: 'Dip to black',
    detail: 'Quick black dip — typical for news beats and reveals.',
    xfade: 'fadeblack',
    vibe: 'CapCut · news',
  },
  {
    id: 'dissolve',
    label: 'Dissolve',
    detail: 'Softer CapCut dissolve (distance blend).',
    xfade: 'dissolve',
    vibe: 'CapCut · soft',
  },
  {
    id: 'slideleft',
    label: 'Slide left',
    detail: 'Punchy CapCut slide — great for debate / list beats.',
    xfade: 'slideleft',
    vibe: 'CapCut · punch',
  },
  {
    id: 'slideright',
    label: 'Slide right',
    detail: 'CapCut slide from the right.',
    xfade: 'slideright',
    vibe: 'CapCut · punch',
  },
  {
    id: 'slideup',
    label: 'Slide up',
    detail: 'CapCut vertical push — listicle energy.',
    xfade: 'slideup',
    vibe: 'CapCut · lists',
  },
  {
    id: 'wipeleft',
    label: 'Wipe left',
    detail: 'Sharp CapCut wipe.',
    xfade: 'wipeleft',
    vibe: 'CapCut · sharp',
  },
  {
    id: 'circleopen',
    label: 'Circle open',
    detail: 'CapCut iris open — reveal moments.',
    xfade: 'circleopen',
    vibe: 'CapCut · reveal',
  },
  {
    id: 'radial',
    label: 'Radial',
    detail: 'CapCut radial wipe.',
    xfade: 'radial',
    vibe: 'CapCut · hype',
  },
  {
    id: 'pixelize',
    label: 'Pixelize',
    detail: 'CapCut pixel dissolve — modern social cut.',
    xfade: 'pixelize',
    vibe: 'CapCut · social',
  },
]

/**
 * Color-match / grade presets applied per scene so mixed stock stills look like one edit.
 * @type {Array<{ id: EofColorGradeId, label: string, detail: string, filters: string[], vibe: string }>}
 */
export const EOF_COLOR_GRADES = [
  {
    id: 'auto',
    label: 'Auto (color match)',
    detail: 'AI picks a CapCut-style grade so every scene matches the pack look.',
    filters: [],
    vibe: 'Auto · match scenes',
  },
  {
    id: 'off',
    label: 'Off',
    detail: 'No color grade — raw stock frames.',
    filters: [],
    vibe: 'Raw',
  },
  {
    id: 'match',
    label: 'Color match',
    detail: 'Normalize contrast + saturation so AP/Pexels/Wikimedia stills sit together.',
    filters: ['eq=contrast=1.06:brightness=0.015:saturation=1.08:gamma=0.98'],
    vibe: 'CapCut · match',
  },
  {
    id: 'punchy',
    label: 'Punchy social',
    detail: 'Higher sat + contrast — typical CapCut Shorts look.',
    filters: ['eq=contrast=1.12:brightness=0.02:saturation=1.22:gamma=0.96'],
    vibe: 'CapCut · feed',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    detail: 'Slightly crushed blacks, filmic contrast.',
    filters: ['eq=contrast=1.1:brightness=-0.02:saturation=1.05:gamma=1.05'],
    vibe: 'CapCut · film',
  },
  {
    id: 'warm',
    label: 'Warm floodlight',
    detail: 'Warm stadium grade.',
    filters: [
      'eq=contrast=1.07:brightness=0.02:saturation=1.12',
      'colorbalance=rs=0.06:gs=0.02:bs=-0.05:rm=0.03:bm=-0.03',
    ],
    vibe: 'CapCut · warm',
  },
  {
    id: 'cool',
    label: 'Cool night',
    detail: 'Cooler blue grade for night / drama.',
    filters: [
      'eq=contrast=1.08:brightness=0.01:saturation=1.1',
      'colorbalance=rs=-0.04:bs=0.06:rm=-0.02:bm=0.04',
    ],
    vibe: 'CapCut · cool',
  },
]

/**
 * CapCut-like HD / enhance looks — subtle clarify after 9:16 crop (not plastic AI faces).
 * Applied after scale+crop so framing stays face-safe; stacks with color grade.
 * @type {Array<{ id: EofEnhanceStyleId, label: string, detail: string, filters: string[], vibe: string }>}
 */
export const EOF_ENHANCE_STYLES = [
  {
    id: 'auto',
    label: 'Auto enhance',
    detail: 'Picks a gentle CapCut-style clarify from the Short format.',
    filters: [],
    vibe: 'Auto · natural HD',
  },
  {
    id: 'off',
    label: 'Off',
    detail: 'No sharpen / denoise — grade only.',
    filters: [],
    vibe: 'Raw stock',
  },
  {
    id: 'hd',
    label: 'Enhance / HD',
    detail: 'Mild denoise + soft unsharp + light contrast/sat — CapCut HD without the plastic look.',
    filters: [
      'hqdn3d=1.2:1.2:2.5:2.5',
      'unsharp=5:5:0.4:5:5:0.0',
      'eq=contrast=1.04:brightness=0.008:saturation=1.05',
    ],
    vibe: 'CapCut · HD',
  },
  {
    id: 'soft',
    label: 'Soft clarify',
    detail: 'Light denoise and a whisper of contrast — flattering for portraits.',
    filters: ['hqdn3d=1.8:1.8:3:3', 'eq=contrast=1.02:brightness=0.01:saturation=1.03'],
    vibe: 'CapCut · soft',
  },
  {
    id: 'crisp',
    label: 'Crisp social',
    detail: 'A touch more edge for feed clarity — still natural, not over-sharpened.',
    filters: ['unsharp=5:5:0.55:5:5:0.0', 'eq=contrast=1.05:saturation=1.06'],
    vibe: 'CapCut · crisp',
  },
  {
    id: 'clean',
    label: 'Clean noise',
    detail: 'Denoise-first for compressed Google/AP stills, then a tiny clarify.',
    filters: ['hqdn3d=2.2:2.2:4:4', 'unsharp=3:3:0.3:3:3:0.0', 'eq=contrast=1.03:saturation=1.04'],
    vibe: 'CapCut · clean',
  },
]

const TRANSITION_IDS = new Set(EOF_TRANSITION_STYLES.map((t) => t.id))
const COLOR_IDS = new Set(EOF_COLOR_GRADES.map((g) => g.id))
const ENHANCE_IDS = new Set(EOF_ENHANCE_STYLES.map((e) => e.id))

/** CapCut packs cycled when transition = auto / mix */
const AUTO_PACKS = {
  news: ['fadeblack', 'fade', 'wipeleft', 'fadeblack', 'fade'],
  quote: ['fade', 'dissolve', 'fadeblack', 'fade'],
  debate: ['slideleft', 'wipeleft', 'slideright', 'fadeblack', 'slideleft'],
  listicle: ['slideup', 'slideleft', 'fade', 'wipeleft', 'pixelize', 'slideup'],
  timeline: ['wipeleft', 'fade', 'slideleft', 'fadeblack'],
  hook_reveal: ['fadeblack', 'circleopen', 'radial', 'fadeblack'],
  default: ['fade', 'slideleft', 'fadeblack', 'wipeleft', 'dissolve'],
}

const AUTO_COLOR_BY_FORMAT = {
  news: 'match',
  quote: 'cinematic',
  debate: 'punchy',
  listicle: 'punchy',
  timeline: 'match',
  hook_reveal: 'cinematic',
  default: 'match',
}

/** Format-aware CapCut enhance — HD for punchy formats, softer for quote/news portraits. */
const AUTO_ENHANCE_BY_FORMAT = {
  news: 'hd',
  quote: 'soft',
  debate: 'crisp',
  listicle: 'hd',
  timeline: 'clean',
  hook_reveal: 'hd',
  default: 'hd',
}

export function listEofTransitionStyles() {
  return EOF_TRANSITION_STYLES.map(({ id, label, detail, vibe }) => ({ id, label, detail, vibe }))
}

export function listEofColorGrades() {
  return EOF_COLOR_GRADES.map(({ id, label, detail, vibe }) => ({ id, label, detail, vibe }))
}

export function listEofEnhanceStyles() {
  return EOF_ENHANCE_STYLES.map(({ id, label, detail, vibe }) => ({ id, label, detail, vibe }))
}

export function resolveEofTransitionStyle(raw) {
  const id = String(raw || EOF_DEFAULT_TRANSITION_STYLE)
    .trim()
    .toLowerCase()
  return TRANSITION_IDS.has(id) ? /** @type {EofTransitionStyleId} */ (id) : EOF_DEFAULT_TRANSITION_STYLE
}

export function resolveEofColorGrade(raw) {
  const id = String(raw || EOF_DEFAULT_COLOR_GRADE)
    .trim()
    .toLowerCase()
  return COLOR_IDS.has(id) ? /** @type {EofColorGradeId} */ (id) : EOF_DEFAULT_COLOR_GRADE
}

export function resolveEofEnhanceStyle(raw) {
  const id = String(raw || EOF_DEFAULT_ENHANCE_STYLE)
    .trim()
    .toLowerCase()
  return ENHANCE_IDS.has(id) ? /** @type {EofEnhanceStyleId} */ (id) : EOF_DEFAULT_ENHANCE_STYLE
}

export function isAutoTransitionStyle(style) {
  return resolveEofTransitionStyle(style) === 'auto'
}

export function isAutoColorGrade(grade) {
  return resolveEofColorGrade(grade) === 'auto'
}

export function isAutoEnhanceStyle(style) {
  return resolveEofEnhanceStyle(style) === 'auto'
}

/**
 * Format-aware CapCut look (mirrors script autoTune).
 * @param {{ format?: string, transitionStyle?: string, colorGrade?: string, enhanceStyle?: string, sceneCount?: number }} opts
 */
export function autoTuneVideoLook({
  format = 'news',
  transitionStyle = EOF_DEFAULT_TRANSITION_STYLE,
  colorGrade = EOF_DEFAULT_COLOR_GRADE,
  enhanceStyle = EOF_DEFAULT_ENHANCE_STYLE,
  sceneCount = 5,
} = {}) {
  const fmt = String(format || 'news')
    .trim()
    .toLowerCase()
  const transitionPick = resolveEofTransitionStyle(transitionStyle)
  const colorPick = resolveEofColorGrade(colorGrade)
  const enhancePick = resolveEofEnhanceStyle(enhanceStyle)

  const pack = AUTO_PACKS[fmt] || AUTO_PACKS.default
  const resolvedColor =
    colorPick === 'auto' ? AUTO_COLOR_BY_FORMAT[fmt] || AUTO_COLOR_BY_FORMAT.default : colorPick
  const resolvedEnhance =
    enhancePick === 'auto' ? AUTO_ENHANCE_BY_FORMAT[fmt] || AUTO_ENHANCE_BY_FORMAT.default : enhancePick

  /** @type {string[]} */
  let perCut = []
  if (transitionPick === 'auto') {
    const n = Math.max(0, Number(sceneCount) - 1)
    for (let i = 0; i < n; i += 1) perCut.push(pack[i % pack.length])
  } else if (transitionPick === 'cut') {
    perCut = []
  } else {
    const n = Math.max(0, Number(sceneCount) - 1)
    perCut = Array.from({ length: n }, () => transitionPick)
  }

  let transitionSec = 0.3
  if (fmt === 'news' || fmt === 'quote') transitionSec = 0.26
  else if (fmt === 'debate' || fmt === 'listicle') transitionSec = 0.34
  else if (fmt === 'hook_reveal') transitionSec = 0.42

  const envTd = Number(process.env.EOF_VIDEO_TRANSITION_SEC)
  if (Number.isFinite(envTd) && envTd > 0) {
    transitionSec = Math.min(0.8, Math.max(0.15, envTd))
  }

  return {
    format: fmt,
    transitionStyle: transitionPick,
    colorGrade: resolvedColor,
    enhanceStyle: resolvedEnhance,
    perCutTransitions: perCut,
    transitionSec,
    // Ken Burns only when explicitly enabled — keeps serverless builds fast.
    kenBurns: process.env.EOF_VIDEO_KEN_BURNS === '1',
  }
}

/** ffmpeg eq/colorbalance chain for a resolved grade id (not auto/off). */
export function colorGradeFilterChain(gradeId) {
  const id = resolveEofColorGrade(gradeId)
  if (id === 'auto' || id === 'off') return []
  const row = EOF_COLOR_GRADES.find((g) => g.id === id)
  return row?.filters?.length ? [...row.filters] : []
}

/** ffmpeg denoise/unsharp/eq chain for a resolved enhance id (not auto/off). */
export function enhanceFilterChain(enhanceId) {
  const id = resolveEofEnhanceStyle(enhanceId)
  if (id === 'auto' || id === 'off') return []
  const row = EOF_ENHANCE_STYLES.find((e) => e.id === id)
  return row?.filters?.length ? [...row.filters] : []
}

/**
 * Scene look chain after 9:16 crop: enhance first (clarify framed pixels), then color grade.
 * @param {{ enhanceStyle?: string, colorGrade?: string }} opts
 */
export function sceneLookFilterChain({ enhanceStyle, colorGrade } = {}) {
  return [...enhanceFilterChain(enhanceStyle), ...colorGradeFilterChain(colorGrade)]
}

/** Map style id → xfade name (null = hard cut). */
export function xfadeNameForTransition(styleId) {
  const id = String(styleId || '')
    .trim()
    .toLowerCase()
  if (!id || id === 'cut' || id === 'auto') return null
  const row = EOF_TRANSITION_STYLES.find((t) => t.id === id)
  return row?.xfade || null
}

/**
 * Build ffmpeg xfade filter_complex for ordered clip labels [0:v]… with per-cut styles.
 * Pads first n-1 clips conceptually via caller durations; offsets use pad-aware lengths.
 * @param {{
 *   clipDurations: number[],
 *   perCutTransitions: string[],
 *   transitionSec: number,
 * }} opts
 * @returns {{ filterComplex: string, outputLabel: string, outputDurationSec: number } | null}
 */
export function buildXfadeFilterComplex({ clipDurations, perCutTransitions, transitionSec }) {
  const durs = (clipDurations || []).map((d) => Math.max(0.5, Number(d) || 3))
  if (durs.length < 2) return null
  const td = Math.min(0.8, Math.max(0.12, Number(transitionSec) || 0.3))
  const cuts = Array.isArray(perCutTransitions) ? perCutTransitions : []

  // Pad first n-1 clips by td so final length ≈ sum(original)
  const padded = durs.map((d, i) => (i < durs.length - 1 ? d + td : d))

  /** @type {string[]} */
  const parts = []
  let last = '0:v'
  let timeline = padded[0]
  let outDur = padded[0]

  for (let i = 1; i < padded.length; i += 1) {
    const styleId = cuts[i - 1] || 'fade'
    const xfade = xfadeNameForTransition(styleId) || 'fade'
    const offset = Math.max(0, timeline - td)
    const outLabel = i === padded.length - 1 ? 'vout' : `vxf${i}`
    parts.push(
      `[${last}][${i}:v]xfade=transition=${xfade}:duration=${td.toFixed(3)}:offset=${offset.toFixed(3)}[${outLabel}]`,
    )
    last = outLabel
    outDur = timeline + padded[i] - td
    timeline = outDur
  }

  const target = durs.reduce((a, b) => a + b, 0)
  return {
    filterComplex: parts.join(';'),
    outputLabel: 'vout',
    outputDurationSec: target,
    paddedDurations: padded,
    transitionSec: td,
  }
}
