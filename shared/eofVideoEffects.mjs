/**
 * CapCut-style free local FFmpeg effects for Eyes Of Football Production Shorts.
 *
 * Stacking rule (enforced by normalizeEofVideoEffects):
 *   at most 1 motion + 1 light + 1 colour (or a preset bundle that fills those slots).
 * Effects run on the composed footage plate after enhance/color-match and overlays,
 * before burned captions so text stays sharp.
 */

/** @typedef {'none' | 'shake_subtle' | 'shake_strong' | 'blur_soft' | 'blur_motion' | 'wave_gentle' | 'wave_rgb'} EofMotionEffectId */
/** @typedef {'none' | 'light_leak' | 'flash' | 'glow_pulse'} EofLightEffectId */
/** @typedef {'none' | 'cold' | 'warm' | 'contrast_punch' | 'noir' | 'teal_orange' | 'hdr_pop' | 'hdr_glow' | 'hdr_crisp'} EofColourEffectId */
/** @typedef {'none' | 'handheld_warm' | 'night_glow' | 'drama_noir' | 'hype_split' | 'hdr_feed'} EofEffectPresetId */

/**
 * @typedef {object} EofVideoEffects
 * @property {EofMotionEffectId} motion
 * @property {EofLightEffectId} light
 * @property {EofColourEffectId} colour
 * @property {EofEffectPresetId} [preset]
 */

export const EOF_DEFAULT_VIDEO_EFFECTS = Object.freeze({
  motion: 'none',
  light: 'none',
  colour: 'none',
  preset: 'none',
})

export const EOF_EFFECT_STACKING_RULE =
  'Stack at most 1 motion + 1 light + 1 colour. Presets fill those slots; picking a card replaces its slot.'

/** @type {Array<{ id: EofMotionEffectId, category: 'motion', label: string, detail: string, vibe: string, preview: string }>} */
export const EOF_MOTION_EFFECTS = [
  {
    id: 'none',
    category: 'motion',
    label: 'None',
    detail: 'No shake, blur, or wave motion.',
    vibe: 'Off',
    preview: 'motion-none',
  },
  {
    id: 'shake_subtle',
    category: 'motion',
    label: 'Shake soft',
    detail: 'Subtle handheld jitter — CapCut soft shake.',
    vibe: 'Handheld · soft',
    preview: 'shake-soft',
  },
  {
    id: 'shake_strong',
    category: 'motion',
    label: 'Shake hard',
    detail: 'Stronger handheld shake for hype beats.',
    vibe: 'Handheld · hard',
    preview: 'shake-hard',
  },
  {
    id: 'blur_soft',
    category: 'motion',
    label: 'Soft blur',
    detail: 'Gentle Gaussian blur on the plate.',
    vibe: 'Dreamy',
    preview: 'blur-soft',
  },
  {
    id: 'blur_motion',
    category: 'motion',
    label: 'Motion blur',
    detail: 'Temporal mix for a slight motion-blur feel.',
    vibe: 'Speed',
    preview: 'blur-motion',
  },
  {
    id: 'wave_gentle',
    category: 'motion',
    label: 'Wave',
    detail: 'Gentle rotate ripple — keep performant.',
    vibe: 'Ripple',
    preview: 'wave',
  },
  {
    id: 'wave_rgb',
    category: 'motion',
    label: 'RGB wave',
    detail: 'RGB channel split wave — CapCut glitch-lite.',
    vibe: 'Split',
    preview: 'wave-rgb',
  },
]

/** @type {Array<{ id: EofLightEffectId, category: 'light', label: string, detail: string, vibe: string, preview: string }>} */
export const EOF_LIGHT_EFFECTS = [
  {
    id: 'none',
    category: 'light',
    label: 'None',
    detail: 'No light leak, flash, or glow.',
    vibe: 'Off',
    preview: 'light-none',
  },
  {
    id: 'light_leak',
    category: 'light',
    label: 'Light leak',
    detail: 'Warm leak + soft pulse — stadium flood feel.',
    vibe: 'Warm leak',
    preview: 'leak',
  },
  {
    id: 'flash',
    category: 'light',
    label: 'Flash',
    detail: 'Quick brightness flashes for impact cuts.',
    vibe: 'Strobe-lite',
    preview: 'flash',
  },
  {
    id: 'glow_pulse',
    category: 'light',
    label: 'Soft glow',
    detail: 'Slow glow pulse — soft CapCut light breathe.',
    vibe: 'Breathe',
    preview: 'glow',
  },
]

/** @type {Array<{ id: EofColourEffectId, category: 'colour', label: string, detail: string, vibe: string, preview: string, subgroup?: 'hdr' }>} */
export const EOF_COLOUR_EFFECTS = [
  {
    id: 'none',
    category: 'colour',
    label: 'None',
    detail: 'No FX colour grade (scene Color match still applies separately).',
    vibe: 'Off',
    preview: 'colour-none',
  },
  {
    id: 'cold',
    category: 'colour',
    label: 'Cold',
    detail: 'Cool blue night grade — football under floodlights.',
    vibe: 'Night cool',
    preview: 'cold',
  },
  {
    id: 'warm',
    category: 'colour',
    label: 'Warm',
    detail: 'Warm amber grade — late-afternoon pitch.',
    vibe: 'Golden',
    preview: 'warm',
  },
  {
    id: 'contrast_punch',
    category: 'colour',
    label: 'Punch',
    detail: 'Contrast + sat punch for feed energy.',
    vibe: 'Feed punch',
    preview: 'punch',
  },
  {
    id: 'noir',
    category: 'colour',
    label: 'Noir',
    detail: 'Desaturated drama / documentary look.',
    vibe: 'B&W drama',
    preview: 'noir',
  },
  {
    id: 'teal_orange',
    category: 'colour',
    label: 'Teal–orange',
    detail: 'Lite teal-orange cinema grade (not purple AI slop).',
    vibe: 'Cinema lite',
    preview: 'teal',
  },
  {
    id: 'hdr_pop',
    category: 'colour',
    label: 'HDR Pop',
    detail: 'TikTok-style HDR punch — lifted highlights, deeper shadows, mild sat (not true HDR10).',
    vibe: 'HDR · pop',
    preview: 'hdr-pop',
    subgroup: 'hdr',
  },
  {
    id: 'hdr_glow',
    category: 'colour',
    label: 'HDR Glow',
    detail: 'Soft highlight bloom / glow — CapCut HDR-lite, still SDR encode.',
    vibe: 'HDR · bloom',
    preview: 'hdr-glow',
    subgroup: 'hdr',
  },
  {
    id: 'hdr_crisp',
    category: 'colour',
    label: 'HDR Crisp',
    detail: 'Contrast + slight sharpen / clarity for feed punch.',
    vibe: 'HDR · crisp',
    preview: 'hdr-crisp',
    subgroup: 'hdr',
  },
]

/**
 * One-tap bundles — still only fill the three slots (never stack extras).
 * @type {Array<{ id: EofEffectPresetId, label: string, detail: string, vibe: string, motion: EofMotionEffectId, light: EofLightEffectId, colour: EofColourEffectId }>}
 */
export const EOF_EFFECT_PRESETS = [
  {
    id: 'none',
    label: 'Custom / off',
    detail: 'No bundle — pick cards below (or leave all Off).',
    vibe: 'Manual',
    motion: 'none',
    light: 'none',
    colour: 'none',
  },
  {
    id: 'handheld_warm',
    label: 'Handheld warm',
    detail: 'Soft shake + warm grade + light leak.',
    vibe: 'Bundle',
    motion: 'shake_subtle',
    light: 'light_leak',
    colour: 'warm',
  },
  {
    id: 'night_glow',
    label: 'Night glow',
    detail: 'Soft blur + cold grade + glow pulse.',
    vibe: 'Bundle',
    motion: 'blur_soft',
    light: 'glow_pulse',
    colour: 'cold',
  },
  {
    id: 'drama_noir',
    label: 'Drama noir',
    detail: 'Gentle wave + noir + soft flash.',
    vibe: 'Bundle',
    motion: 'wave_gentle',
    light: 'flash',
    colour: 'noir',
  },
  {
    id: 'hype_split',
    label: 'Hype split',
    detail: 'Hard shake + RGB wave energy + punch colour.',
    vibe: 'Bundle',
    motion: 'shake_strong',
    light: 'none',
    colour: 'contrast_punch',
  },
  {
    id: 'hdr_feed',
    label: 'HDR feed',
    detail: 'Soft shake + HDR pop grade (TikTok HDR look).',
    vibe: 'Bundle · HDR',
    motion: 'shake_subtle',
    light: 'none',
    colour: 'hdr_pop',
  },
]

const MOTION_IDS = new Set(EOF_MOTION_EFFECTS.map((e) => e.id))
const LIGHT_IDS = new Set(EOF_LIGHT_EFFECTS.map((e) => e.id))
const COLOUR_IDS = new Set(EOF_COLOUR_EFFECTS.map((e) => e.id))
const PRESET_IDS = new Set(EOF_EFFECT_PRESETS.map((p) => p.id))

/** Flat catalog for UI grids / API (includes Off cards). */
export function listEofVideoEffects() {
  return [
    ...EOF_MOTION_EFFECTS.map((e) => ({ ...e })),
    ...EOF_LIGHT_EFFECTS.map((e) => ({ ...e })),
    ...EOF_COLOUR_EFFECTS.map((e) => ({ ...e })),
  ]
}

export function listEofEffectPresets() {
  return EOF_EFFECT_PRESETS.map(({ id, label, detail, vibe, motion, light, colour }) => ({
    id,
    label,
    detail,
    vibe,
    motion,
    light,
    colour,
  }))
}

/**
 * @param {unknown} raw
 * @returns {EofMotionEffectId}
 */
export function resolveEofMotionEffect(raw) {
  const id = String(raw || 'none')
    .trim()
    .toLowerCase()
  return MOTION_IDS.has(id) ? /** @type {EofMotionEffectId} */ (id) : 'none'
}

/**
 * @param {unknown} raw
 * @returns {EofLightEffectId}
 */
export function resolveEofLightEffect(raw) {
  const id = String(raw || 'none')
    .trim()
    .toLowerCase()
  return LIGHT_IDS.has(id) ? /** @type {EofLightEffectId} */ (id) : 'none'
}

/**
 * @param {unknown} raw
 * @returns {EofColourEffectId}
 */
export function resolveEofColourEffect(raw) {
  const id = String(raw || 'none')
    .trim()
    .toLowerCase()
  return COLOUR_IDS.has(id) ? /** @type {EofColourEffectId} */ (id) : 'none'
}

/**
 * @param {unknown} raw
 * @returns {EofEffectPresetId}
 */
export function resolveEofEffectPreset(raw) {
  const id = String(raw || 'none')
    .trim()
    .toLowerCase()
  return PRESET_IDS.has(id) ? /** @type {EofEffectPresetId} */ (id) : 'none'
}

/**
 * Normalize persisted / API video effects. Enforces 1+1+1 stacking.
 * Accepts object `{ motion, light, colour, preset }` or legacy `{ effectIds: string[] }`.
 * @param {unknown} raw
 * @returns {EofVideoEffects}
 */
export function normalizeEofVideoEffects(raw) {
  if (raw == null || raw === '') {
    return { ...EOF_DEFAULT_VIDEO_EFFECTS }
  }
  let obj = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return { ...EOF_DEFAULT_VIDEO_EFFECTS }
    }
  }
  if (typeof obj !== 'object' || !obj) {
    return { ...EOF_DEFAULT_VIDEO_EFFECTS }
  }

  /** @type {Record<string, unknown>} */
  const row = obj

  // Legacy: effectIds array — map first of each category into slots.
  if (Array.isArray(row.effectIds) || Array.isArray(row.effect_ids)) {
    const ids = /** @type {unknown[]} */ (row.effectIds || row.effect_ids)
    let motion = 'none'
    let light = 'none'
    let colour = 'none'
    for (const rawId of ids) {
      const id = String(rawId || '')
        .trim()
        .toLowerCase()
      if (MOTION_IDS.has(id) && id !== 'none' && motion === 'none') motion = id
      else if (LIGHT_IDS.has(id) && id !== 'none' && light === 'none') light = id
      else if (COLOUR_IDS.has(id) && id !== 'none' && colour === 'none') colour = id
    }
    return {
      motion: /** @type {EofMotionEffectId} */ (motion),
      light: /** @type {EofLightEffectId} */ (light),
      colour: /** @type {EofColourEffectId} */ (colour),
      preset: 'none',
    }
  }

  const preset = resolveEofEffectPreset(row.preset)
  if (preset !== 'none') {
    const pack = EOF_EFFECT_PRESETS.find((p) => p.id === preset)
    if (pack) {
      return {
        motion: pack.motion,
        light: pack.light,
        colour: pack.colour,
        preset,
      }
    }
  }

  return {
    motion: resolveEofMotionEffect(row.motion),
    light: resolveEofLightEffect(row.light),
    colour: resolveEofColourEffect(row.colour),
    preset: 'none',
  }
}

/**
 * Apply a card pick into the stacking slots (replaces its category).
 * Pass category when id is `none` (shared across slots) or for explicit slot writes.
 * @param {EofVideoEffects | null | undefined} current
 * @param {string} effectId
 * @param {'motion' | 'light' | 'colour' | 'preset'} [category]
 * @returns {EofVideoEffects}
 */
export function pickEofVideoEffect(current, effectId, category) {
  const base = normalizeEofVideoEffects(current)
  const id = String(effectId || '')
    .trim()
    .toLowerCase()
  const cat = String(category || '')
    .trim()
    .toLowerCase()
  if (cat === 'preset' || PRESET_IDS.has(id)) {
    return normalizeEofVideoEffects({ preset: id === 'none' && cat !== 'preset' ? 'none' : id })
  }
  if (cat === 'motion' || (MOTION_IDS.has(id) && cat !== 'light' && cat !== 'colour')) {
    if (cat === 'motion' || MOTION_IDS.has(id)) {
      return {
        motion: resolveEofMotionEffect(id),
        light: base.light,
        colour: base.colour,
        preset: 'none',
      }
    }
  }
  if (cat === 'light' || LIGHT_IDS.has(id)) {
    if (cat === 'light' || (LIGHT_IDS.has(id) && id !== 'none')) {
      return {
        motion: base.motion,
        light: resolveEofLightEffect(id),
        colour: base.colour,
        preset: 'none',
      }
    }
  }
  if (cat === 'colour' || COLOUR_IDS.has(id)) {
    if (cat === 'colour' || (COLOUR_IDS.has(id) && id !== 'none')) {
      return {
        motion: base.motion,
        light: base.light,
        colour: resolveEofColourEffect(id),
        preset: 'none',
      }
    }
  }
  // Bare `none` without category → clear motion (first slot).
  if (id === 'none') {
    return { motion: 'none', light: base.light, colour: base.colour, preset: 'none' }
  }
  return base
}

export function eofVideoEffectsActive(effects) {
  const e = normalizeEofVideoEffects(effects)
  return e.motion !== 'none' || e.light !== 'none' || e.colour !== 'none'
}

/** Stable list of non-none effect ids for logging / UI chips. */
export function eofVideoEffectIds(effects) {
  const e = normalizeEofVideoEffects(effects)
  /** @type {string[]} */
  const ids = []
  if (e.motion !== 'none') ids.push(e.motion)
  if (e.light !== 'none') ids.push(e.light)
  if (e.colour !== 'none') ids.push(e.colour)
  return ids
}

/** @param {EofMotionEffectId} id */
export function motionEffectFilterChain(id) {
  const motion = resolveEofMotionEffect(id)
  switch (motion) {
    case 'shake_subtle':
      // Crop jitter then re-scale so edges stay filled.
      return [
        "crop=w=1044:h=1856:x='18+10*sin(2*PI*t*2.5)':y='32+8*cos(2*PI*t*2.1)'",
        'scale=1080:1920',
      ]
    case 'shake_strong':
      return [
        "crop=w=1008:h=1792:x='36+22*sin(2*PI*t*3.1)':y='64+18*cos(2*PI*t*2.7)'",
        'scale=1080:1920',
      ]
    case 'blur_soft':
      return ['gblur=sigma=1.6']
    case 'blur_motion':
      return ["tmix=frames=3:weights='1 2 1'", 'gblur=sigma=0.8']
    case 'wave_gentle':
      return ["rotate=a='0.010*sin(2*PI*t*1.15)':ow=1080:oh=1920:c=black"]
    case 'wave_rgb':
      return [
        "rgbashift=rh='7*sin(2*PI*t*1.25)':bh='-7*sin(2*PI*t*1.25)':rv=0:bv=0",
        "rotate=a='0.006*sin(2*PI*t*0.9)':ow=1080:oh=1920:c=black",
      ]
    default:
      return []
  }
}

/** @param {EofLightEffectId} id */
export function lightEffectFilterChain(id) {
  const light = resolveEofLightEffect(id)
  switch (light) {
    case 'light_leak':
      return [
        'colorbalance=rs=0.1:gs=0.035:bs=-0.07:rm=0.05:bm=-0.04',
        "hue=h='8*sin(2*PI*t*0.35)':s=1.05:b='0.015+0.03*sin(2*PI*t*0.35)'",
        'vignette=angle=PI/5',
      ]
    case 'flash':
      // max() needs escaped comma inside filtergraph.
      return ["hue=h=0:s=1:b='0.01+0.11*pow(max(0\\,sin(2*PI*t*1.9))\\,6)'"]
    case 'glow_pulse':
      return ["hue=h=0:s=1.04:b='0.02+0.035*sin(2*PI*t*0.7)'", 'eq=gamma=0.98']
    default:
      return []
  }
}

/** @param {EofColourEffectId} id */
export function colourEffectFilterChain(id) {
  const colour = resolveEofColourEffect(id)
  switch (colour) {
    case 'cold':
      return [
        'eq=contrast=1.06:brightness=0.01:saturation=1.08',
        'colorbalance=rs=-0.05:bs=0.08:rm=-0.03:bm=0.05',
      ]
    case 'warm':
      return [
        'eq=contrast=1.05:brightness=0.015:saturation=1.1',
        'colorbalance=rs=0.07:gs=0.02:bs=-0.06:rm=0.04:bm=-0.03',
      ]
    case 'contrast_punch':
      return ['eq=contrast=1.16:brightness=0.015:saturation=1.2:gamma=0.96']
    case 'noir':
      return ['hue=s=0', 'eq=contrast=1.18:brightness=-0.02:gamma=1.05']
    case 'teal_orange':
      return [
        'eq=contrast=1.08:saturation=1.12',
        'colorbalance=rs=0.06:bs=-0.04:rm=0.04:bm=-0.02:rh=-0.03:bh=0.05',
      ]
    case 'hdr_pop':
      // SDR “HDR” punch: crush shadows a touch, lift mids/highlights, mild sat.
      return [
        "curves=all='0/0 0.22/0.14 0.55/0.58 0.82/0.9 1/1'",
        'eq=contrast=1.1:brightness=-0.01:saturation=1.14:gamma=0.94',
      ]
    case 'hdr_glow':
      // Soft bloom approximation without filter_complex split.
      return [
        'eq=contrast=1.06:brightness=0.03:saturation=1.1:gamma=0.9',
        'gblur=sigma=0.9',
        'unsharp=7:7:0.45:7:7:0.0',
        'eq=brightness=0.015',
      ]
    case 'hdr_crisp':
      return [
        'eq=contrast=1.14:brightness=0.008:saturation=1.1:gamma=0.96',
        'unsharp=5:5:0.7:5:5:0.0',
      ]
    default:
      return []
  }
}

/**
 * Ordered FFmpeg filter fragments for a normalized effects selection.
 * Order: motion → colour → light (geometry first, grade, then light overlays).
 * @param {unknown} raw
 * @returns {string[]}
 */
export function videoEffectsFilterChain(raw) {
  const e = normalizeEofVideoEffects(raw)
  return [
    ...motionEffectFilterChain(e.motion),
    ...colourEffectFilterChain(e.colour),
    ...lightEffectFilterChain(e.light),
  ]
}

/**
 * Human-readable summary for admin UI / logs.
 * @param {unknown} raw
 */
export function summarizeEofVideoEffects(raw) {
  const e = normalizeEofVideoEffects(raw)
  if (!eofVideoEffectsActive(e)) return 'Off'
  const parts = []
  if (e.preset && e.preset !== 'none') {
    const p = EOF_EFFECT_PRESETS.find((row) => row.id === e.preset)
    if (p) return p.label
  }
  if (e.motion !== 'none') {
    parts.push(EOF_MOTION_EFFECTS.find((m) => m.id === e.motion)?.label || e.motion)
  }
  if (e.light !== 'none') {
    parts.push(EOF_LIGHT_EFFECTS.find((m) => m.id === e.light)?.label || e.light)
  }
  if (e.colour !== 'none') {
    parts.push(EOF_COLOUR_EFFECTS.find((m) => m.id === e.colour)?.label || e.colour)
  }
  return parts.join(' · ') || 'Off'
}
