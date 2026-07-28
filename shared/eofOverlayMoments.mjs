/**
 * Image-over-image “moment” overlays for Eyes Of Football Production Shorts.
 * CapCut-like pop card + optional whoosh SFX — off | auto | always.
 *
 * Placement rule (critical): never cover the lead subject’s face.
 * Default sits in the mid/lower safe band — below face/eyes, above bottom captions,
 * clear of the top-left watermark.
 */

import { isCaptionContaminatedStill } from './eofStockImageFilter.mjs'
import { buildNewsAgencyLogoBlurFilterFragment } from './eofNewsAgencyLogoBlur.mjs'
import { EOF_CROP_Y_BIAS_FACE_SAFE, buildEofSceneCropYExpr } from './eofSceneCrop.mjs'

/** @typedef {'off' | 'auto' | 'always'} EofOverlayMomentsMode */

export const EOF_DEFAULT_OVERLAY_MOMENTS = 'auto'

export const EOF_OVERLAY_MOMENTS_OPTIONS = [
  {
    id: 'off',
    label: 'Off',
    detail: 'Never place an inset image over a scene still.',
    vibe: 'Clean · full frame',
  },
  {
    id: 'auto',
    label: 'Auto',
    detail:
      'Occasionally pop a secondary still on one middle beat — mid/lower safe zone (never over the face). Skips captioned thumbnails.',
    vibe: 'Smart · face-safe',
  },
  {
    id: 'always',
    label: 'Always',
    detail:
      'Force one inset moment whenever two distinct clean stills exist — placed mid/lower, not over eyes.',
    vibe: 'Every Short · 1 moment',
  },
]

const MODE_IDS = new Set(EOF_OVERLAY_MOMENTS_OPTIONS.map((o) => o.id))

/**
 * @param {unknown} raw
 * @returns {EofOverlayMomentsMode}
 */
export function resolveEofOverlayMoments(raw) {
  const id = String(raw || EOF_DEFAULT_OVERLAY_MOMENTS)
    .trim()
    .toLowerCase()
  return MODE_IDS.has(id) ? /** @type {EofOverlayMomentsMode} */ (id) : EOF_DEFAULT_OVERLAY_MOMENTS
}

export function listEofOverlayMomentsOptions() {
  return EOF_OVERLAY_MOMENTS_OPTIONS.map((o) => ({ ...o }))
}

/**
 * Typical 9:16 portrait face band (eyes / forehead) — pop must not intersect this.
 * Fractions of frame height.
 */
export const EOF_OVERLAY_FACE_ZONE = Object.freeze({
  yMin: 0.1,
  yMax: 0.42,
})

/** Allowed range for the top edge of the pop card (below face, above captions). */
export const EOF_OVERLAY_SAFE_Y = Object.freeze({
  min: 0.44,
  max: 0.58,
})

/** Caption clearance — pop bottom should stay above this band. */
export const EOF_OVERLAY_CAPTION_CLEAR_Y = 0.74

/**
 * Mid/lower pop card — wider + readable, below the face, above bottom captions.
 * (Previous yFrac 0.13 / widthFrac 0.68 sat on the eyes as a tiny dark plate.)
 */
export const EOF_OVERLAY_LAYOUT = {
  /** Max inset width as fraction of 1080 — larger for readability */
  widthFrac: 0.78,
  /** Card height as fraction of card width — fits under face band + above captions */
  heightFrac: 0.58,
  /** Top of card as fraction of frame height — lower-third safe zone (not upper-center face) */
  yFrac: 0.48,
  /** CapCut-like rounded corner radius (px at card size, before pop scale) */
  cornerRadiusPx: 44,
  /** Soft mask feather at edges / corners (px) — blurry mask, not a hard frame */
  featherPx: 20,
  /** Soft under-shadow offset (px) */
  shadowOffsetX: 0,
  shadowOffsetY: 12,
  /** Soft under-shadow blur */
  shadowBlur: 16,
  /** Soft under-shadow alpha (0–1) */
  shadowAlpha: 0.5,
  /** Pop-in duration (seconds) */
  popInSec: 0.32,
  /** Soft fade-out at end (seconds) */
  fadeOutSec: 0.18,
}

/**
 * Axis-aligned pop card rect in normalized frame coords (0–1).
 * @param {{ widthFrac?: number, heightFrac?: number, yFrac?: number }} [layout]
 * @param {{ frameW?: number, frameH?: number }} [frame]
 */
export function eofOverlayCardRect(layout = EOF_OVERLAY_LAYOUT, frame = {}) {
  const frameW = Math.max(320, Number(frame.frameW) || 1080)
  const frameH = Math.max(480, Number(frame.frameH) || 1920)
  const rawW = Number(layout.widthFrac)
  const rawH = Number(layout.heightFrac)
  const rawY = Number(layout.yFrac)
  // Zero / NaN / non-finite → defaults; negatives clamp into a usable positive band.
  const widthFrac = Math.min(
    1,
    Math.max(0.05, Number.isFinite(rawW) && rawW > 0 ? rawW : EOF_OVERLAY_LAYOUT.widthFrac),
  )
  const heightFrac = Math.min(
    1.5,
    Math.max(0.05, Number.isFinite(rawH) && rawH > 0 ? rawH : EOF_OVERLAY_LAYOUT.heightFrac),
  )
  const yFrac = Math.min(
    0.95,
    Math.max(0, Number.isFinite(rawY) ? rawY : EOF_OVERLAY_LAYOUT.yFrac),
  )
  const cardW = frameW * widthFrac
  const cardH = cardW * heightFrac
  const x = (1 - widthFrac) / 2
  const y = yFrac
  return {
    x,
    y,
    w: widthFrac,
    h: cardH / frameH,
    bottom: y + cardH / frameH,
    frameW,
    frameH,
  }
}

/**
 * True when the pop card intersects the portrait face/eyes band.
 * @param {{ widthFrac?: number, heightFrac?: number, yFrac?: number }} [layout]
 */
export function eofOverlayCoversFaceZone(layout = EOF_OVERLAY_LAYOUT) {
  const rect = eofOverlayCardRect(layout)
  return rect.y < EOF_OVERLAY_FACE_ZONE.yMax && rect.bottom > EOF_OVERLAY_FACE_ZONE.yMin
}

/**
 * True when layout keeps the card under the face and above caption clearance.
 * @param {{ widthFrac?: number, heightFrac?: number, yFrac?: number }} [layout]
 */
export function eofOverlayLayoutIsFaceSafe(layout = EOF_OVERLAY_LAYOUT) {
  const rect = eofOverlayCardRect(layout)
  if (eofOverlayCoversFaceZone(layout)) return false
  if (rect.y < EOF_OVERLAY_SAFE_Y.min - 0.02) return false
  if (rect.bottom > EOF_OVERLAY_CAPTION_CLEAR_Y + 0.04) return false
  return true
}

const MIN_EOF_OVERLAY_PIXELS = { width: 300, height: 300 }

/**
 * Reject meme / clickbait / baked-caption plates as pop inset sources, and reject
 * stills we know are too small/low-res to look good scaled up into the card (Cucurella
 * bug: a tiny CDN thumbnail popped in blurry and undersized). Only rejects on KNOWN
 * dimensions — missing width/height never blind-fails a still.
 * @param {{ imagePath?: string, imageKey?: string | null, imageSource?: string, imageTitle?: string | null, imageQuery?: string | null, imageWidth?: number, imageHeight?: number }} scene
 */
export function isBadEofOverlayStill(scene) {
  if (!scene) return true
  const src = String(scene.imageSource || '')
  if (src.startsWith('placeholder')) return true
  const url = String(scene.imagePath || scene.imageKey || '').trim()
  const title = String(scene.imageTitle || scene.imageQuery || '').trim()
  if (isCaptionContaminatedStill(url, title)) return true
  // Extra clickbait / dark thumbnail cues beyond the stock filter.
  if (/\b(going\s+bananas|thumbnail|clickbait|with\s+text|text\s+box)\b/i.test(title)) return true
  const w = Number(scene.imageWidth) || 0
  const h = Number(scene.imageHeight) || 0
  if (w > 0 && h > 0 && (w < MIN_EOF_OVERLAY_PIXELS.width || h < MIN_EOF_OVERLAY_PIXELS.height)) {
    return true
  }
  return false
}

/**
 * ffmpeg geq alpha for a soft rounded-rect mask (CapCut-style).
 * Signed distance → feathered alpha; no hard white/colored border.
 * @param {{ radius: number, feather: number }} opts
 */
export function softRoundedRectAlphaExpr({ radius, feather }) {
  const r = Math.max(4, Math.round(Number(radius) || 36))
  const f = Math.max(2, Math.round(Number(feather) || 14))
  // Classic rounded-box SDF; alpha falls off over `feather` px near the edge.
  return [
    `a='st(0\\,${r})`,
    `st(1\\,${f})`,
    `st(2\\,W/2-ld(0))`,
    `st(3\\,H/2-ld(0))`,
    `st(4\\,abs(X-W/2)-ld(2))`,
    `st(5\\,abs(Y-H/2)-ld(3))`,
    `st(6\\,hypot(max(ld(4)\\,0)\\,max(ld(5)\\,0))+min(max(ld(4)\\,ld(5))\\,0)-ld(0))`,
    `255*clip((-ld(6))/ld(1)\\,0\\,1)'`,
  ].join(';')
}

/**
 * Within-scene timing for the inset (seconds from scene start).
 * @param {number} durationSec
 */
export function overlayTimingWithinScene(durationSec) {
  const dur = Math.max(2, Number(durationSec) || 3)
  const startSec = Math.min(Math.max(0.35, dur * 0.12), Math.max(0.25, dur - 1.1))
  const endSec = Math.min(dur - 0.12, Math.max(startSec + 1.05, dur * 0.82))
  return {
    startSec: Number(startSec.toFixed(3)),
    endSec: Number(endSec.toFixed(3)),
    popInSec: EOF_OVERLAY_LAYOUT.popInSec,
    fadeOutSec: EOF_OVERLAY_LAYOUT.fadeOutSec,
  }
}

/**
 * Absolute timeline offset for scene index 0…n (content durations, pre-xfade).
 * @param {number[]} contentDurations
 * @param {number} sceneIndex
 */
export function sceneTimelineOffsetSec(contentDurations, sceneIndex) {
  const idx = Math.max(0, Number(sceneIndex) || 0)
  let t = 0
  for (let i = 0; i < idx && i < contentDurations.length; i += 1) {
    t += Math.max(2, Number(contentDurations[i]) || 3)
  }
  return t
}

/**
 * Generic "different life beat" cues — family/personal-life content that isn't a
 * named football person but still means the still shown there should NOT be swapped
 * for a random other scene's plate (e.g. "his son", "off the pitch", "at home").
 */
const EOF_OVERLAY_PERSONAL_CUE_RE =
  /\b(his|her|their)\s+(son|daughter|wife|husband|girlfriend|boyfriend|family|kids?|children)\b|\bpersonal\s+life\b|\boff[\s-]the[\s-]pitch\b|\baway\s+from\s+football\b|\bat\s+home\s+with\b/i

/**
 * Find the scene whose OWN caption actually talks about a secondary subject (a named
 * teammate/rival, e.g. Tuchel, OR a personal-life beat like "his son") so the overlay
 * only ever pops in a still that matches what that specific scene is about.
 *
 * This replaces blind "always scene index 1" guessing — the prior heuristic could pop
 * an unrelated still (e.g. an old Chelsea action shot) onto a scene that had nothing to
 * do with it, or skip a real personal-life beat entirely because it only recognised
 * named footballers, never generic family mentions like "his son".
 *
 * @param {Array<{ index: number, caption?: string }>} scenes
 * @param {string[]} [secondarySubjects] known named people (Tuchel, Rooney, …)
 * @returns {number|null} scene index whose caption is the content match, or null if none found
 */
export function findEofOverlaySourceSceneIndex(scenes, secondarySubjects = []) {
  const list = Array.isArray(scenes) ? scenes : []
  const subs = (secondarySubjects || []).filter(Boolean)
  for (const scene of list) {
    const caption = String(scene?.caption || '').trim()
    if (!caption) continue
    if (EOF_OVERLAY_PERSONAL_CUE_RE.test(caption)) return scene.index
    for (const sub of subs) {
      const surname = String(sub || '')
        .trim()
        .split(/\s+/)
        .pop()
      if (surname && surname.length >= 3 && new RegExp(`\\b${surname}\\b`, 'i').test(caption)) {
        return scene.index
      }
    }
  }
  return null
}

/**
 * Pick which scene gets the moment and which still is the inset.
 * Auto: only when ≥3 scenes and a distinct overlay still exists (prefer secondary subject beat).
 * Always: one moment when ≥2 distinct stills exist.
 * Skips caption-contaminated / clickbait plates as the inset source.
 *
 * @param {{
 *   mode?: unknown,
 *   scenes: Array<{ index: number, durationSec?: number, imagePath?: string, imageSource?: string, imageKey?: string | null, imageTitle?: string | null }>,
 *   hasSecondarySubject?: boolean,
 *   secondarySceneIndex?: number | null,
 * }} opts
 * @returns {Array<{
 *   sceneIndex: number,
 *   overlaySceneIndex: number,
 *   startSec: number,
 *   endSec: number,
 *   absoluteStartSec: number,
 *   absoluteEndSec: number,
 *   sfxAtSec: number,
 *   sfxOutAtSec: number | null,
 * }>}
 */
export function planEofOverlayMoments(opts = {}) {
  const mode = resolveEofOverlayMoments(opts.mode)
  if (mode === 'off') return []

  const scenes = Array.isArray(opts.scenes) ? [...opts.scenes].sort((a, b) => a.index - b.index) : []
  if (scenes.length < 2) return []

  const usable = scenes.filter((s) => {
    const path = String(s.imagePath || '').trim()
    if (!path) return false
    const src = String(s.imageSource || '')
    if (src.startsWith('placeholder')) return false
    return true
  })
  if (usable.length < 2) return []

  const n = scenes.length
  if (mode === 'auto' && n < 3 && !opts.hasSecondarySubject) return []

  const contentDurs = scenes.map((s) => Math.max(2, Number(s.durationSec) || 3))
  const middle = Math.floor((n - 1) / 2)
  const secondaryIdx =
    opts.secondarySceneIndex != null && Number.isFinite(Number(opts.secondarySceneIndex))
      ? Math.max(0, Math.min(n - 1, Number(opts.secondarySceneIndex)))
      : null

  // Prefer: lead beat as base, secondary still as the pop-up “moment” (Tuchel over Rooney).
  let targetIndex = middle
  let overlayFromIndex = null

  if (secondaryIdx != null) {
    const leadIndexes = scenes.map((_, i) => i).filter((i) => i !== secondaryIdx)
    if (leadIndexes.length) {
      targetIndex = leadIndexes.includes(middle)
        ? middle
        : leadIndexes[Math.floor(leadIndexes.length / 2)]
      if (
        isDistinctStill(scenes[targetIndex], scenes[secondaryIdx]) &&
        !isBadEofOverlayStill(scenes[secondaryIdx])
      ) {
        overlayFromIndex = secondaryIdx
      }
    }
  }

  if (overlayFromIndex == null) {
    targetIndex = middle
    for (const cand of [targetIndex + 1, targetIndex - 1, 0, n - 1]) {
      if (cand < 0 || cand >= n || cand === targetIndex) continue
      if (!isDistinctStill(scenes[targetIndex], scenes[cand])) continue
      if (isBadEofOverlayStill(scenes[cand])) continue
      overlayFromIndex = cand
      break
    }
  }

  // Last resort: any distinct non-contaminated pair (always mode).
  if (overlayFromIndex == null && mode === 'always') {
    for (let base = 0; base < n && overlayFromIndex == null; base += 1) {
      for (let cand = 0; cand < n; cand += 1) {
        if (cand === base) continue
        if (!isDistinctStill(scenes[base], scenes[cand])) continue
        if (isBadEofOverlayStill(scenes[cand])) continue
        targetIndex = base
        overlayFromIndex = cand
        break
      }
    }
  }

  if (overlayFromIndex == null) return []

  // Auto: require secondary subject OR at least 3 beats (avoid spammy 2-scene Shorts)
  if (mode === 'auto' && !opts.hasSecondarySubject && n < 3) return []

  const timing = overlayTimingWithinScene(contentDurs[targetIndex])
  const absBase = sceneTimelineOffsetSec(contentDurs, targetIndex)

  return [
    {
      sceneIndex: scenes[targetIndex].index,
      overlaySceneIndex: scenes[overlayFromIndex].index,
      startSec: timing.startSec,
      endSec: timing.endSec,
      absoluteStartSec: Number((absBase + timing.startSec).toFixed(3)),
      absoluteEndSec: Number((absBase + timing.endSec).toFixed(3)),
      sfxAtSec: Number((absBase + timing.startSec).toFixed(3)),
      sfxOutAtSec: Number((absBase + timing.endSec - EOF_OVERLAY_LAYOUT.fadeOutSec).toFixed(3)),
    },
  ]
}

function isDistinctStill(a, b) {
  if (!a || !b) return false
  const pa = String(a.imagePath || '').trim()
  const pb = String(b.imagePath || '').trim()
  if (!pa || !pb || pa === pb) return false
  const ka = String(a.imageKey || '').trim()
  const kb = String(b.imageKey || '').trim()
  if (ka && kb && ka === kb) return false
  const sa = String(a.imageSource || '')
  const sb = String(b.imageSource || '')
  if (sa.startsWith('placeholder') || sb.startsWith('placeholder')) return false
  return true
}

/**
 * ffmpeg scale+overlay expr helpers for a pop-up card (eval=frame on overlay stream).
 * Cover-crops into a rounded soft-masked card (CapCut mask look) — no hard white border.
 * @param {{ startSec: number, endSec: number, frameW?: number, agencyLogoBlur?: boolean }} opts
 */
export function buildOverlayPopFilterFragments({
  startSec,
  endSec,
  frameW = 1080,
  agencyLogoBlur = false,
}) {
  const start = Math.max(0, Number(startSec) || 0)
  const end = Math.max(start + 0.4, Number(endSec) || start + 1.2)
  const pop = EOF_OVERLAY_LAYOUT.popInSec
  const fadeOut = EOF_OVERLAY_LAYOUT.fadeOutSec
  const maxW = Math.round(frameW * EOF_OVERLAY_LAYOUT.widthFrac)
  const maxH = Math.max(120, Math.round(maxW * EOF_OVERLAY_LAYOUT.heightFrac))
  const yFrac = EOF_OVERLAY_LAYOUT.yFrac
  const radius = EOF_OVERLAY_LAYOUT.cornerRadiusPx
  const feather = EOF_OVERLAY_LAYOUT.featherPx
  const softAlpha = softRoundedRectAlphaExpr({ radius, feather })

  // Scale: 0.55 → 1.08 → 1.0 over pop window (CapCut overshoot)
  const scaleW = [
    `min(${maxW}\\,iw)*`,
    `if(lt(t\\,${start.toFixed(3)})\\,0.55\\,`,
    `if(lt(t\\,${(start + pop * 0.55).toFixed(3)})\\,0.55+0.53*(t-${start.toFixed(3)})/${(pop * 0.55).toFixed(3)}\\,`,
    `if(lt(t\\,${(start + pop).toFixed(3)})\\,1.08-0.08*(t-${(start + pop * 0.55).toFixed(3)})/${(pop * 0.45).toFixed(3)}\\,1)))`,
  ].join('')

  const overlayScale = `scale=w='${scaleW}':h=-1:eval=frame`
  const enable = `between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})`
  const fadeInSt = start.toFixed(3)
  const fadeOutSt = Math.max(start, end - fadeOut).toFixed(3)

  const head = [
    // Cover-crop into the card — face-safe Y (upper bias) so heads aren't chopped.
    `scale=${maxW}:${maxH}:force_original_aspect_ratio=increase`,
    `crop=${maxW}:${maxH}:(iw-ow)/2:${buildEofSceneCropYExpr(EOF_CROP_Y_BIAS_FACE_SAFE)}`,
    'setsar=1',
  ].join(',')
  const logoBlur = agencyLogoBlur
    ? buildNewsAgencyLogoBlurFilterFragment({
        frameW: maxW,
        frameH: maxH,
        labelPrefix: 'plb',
      })
    : ''
  const cropped = logoBlur ? `${head},${logoBlur}` : head
  const overlayPrep = [
    cropped,
    'format=rgba',
    `geq=r='r(X\\,Y)':g='g(X\\,Y)':b='b(X\\,Y)':${softAlpha}`,
    // Keep full chroma on the soft edge — yuva420p fringes look greenish on pitch stills.
    'format=yuva444p',
    overlayScale,
    `fade=t=in:st=${fadeInSt}:d=0.12:alpha=1`,
    `fade=t=out:st=${fadeOutSt}:d=${fadeOut.toFixed(3)}:alpha=1`,
  ].join(',')

  return {
    maxW,
    maxH,
    yFrac,
    shadowOffsetX: EOF_OVERLAY_LAYOUT.shadowOffsetX,
    shadowOffsetY: EOF_OVERLAY_LAYOUT.shadowOffsetY,
    shadowBlur: EOF_OVERLAY_LAYOUT.shadowBlur,
    shadowAlpha: EOF_OVERLAY_LAYOUT.shadowAlpha,
    overlayPrep,
    /** Soft black under-shadow from the masked card (CapCut-style depth). */
    shadowPrep: [
      `format=rgba`,
      `geq=r='0':g='0':b='0':a='alpha(X\\,Y)*${EOF_OVERLAY_LAYOUT.shadowAlpha}'`,
      `boxblur=${EOF_OVERLAY_LAYOUT.shadowBlur}:${Math.max(1, Math.round(EOF_OVERLAY_LAYOUT.shadowBlur / 2))}`,
      'format=yuva444p',
    ].join(','),
    overlayXy: `x=(W-w)/2:y=H*${yFrac.toFixed(3)}`,
    shadowXy: `x=(W-w)/2+${EOF_OVERLAY_LAYOUT.shadowOffsetX}:y=H*${yFrac.toFixed(3)}+${EOF_OVERLAY_LAYOUT.shadowOffsetY}`,
    enableExpr: enable,
    startSec: start,
    endSec: end,
  }
}
