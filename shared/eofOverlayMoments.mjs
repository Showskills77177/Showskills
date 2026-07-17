/**
 * Image-over-image “moment” overlays for Eyes Of Football Production Shorts.
 * CapCut-like upper pop card + optional whoosh SFX — off | auto | always.
 */

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
      'Occasionally pop a secondary still (e.g. Tuchel over Rooney) on one middle beat when a distinct still exists.',
    vibe: 'Smart · occasional',
  },
  {
    id: 'always',
    label: 'Always',
    detail: 'Force one inset moment on a middle scene whenever two distinct stills exist.',
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

/** Upper-third pop card — clears default bottom subtitle zone on 9:16. */
export const EOF_OVERLAY_LAYOUT = {
  /** Max inset width as fraction of 1080 */
  widthFrac: 0.68,
  /** Card height as fraction of card width (landscape-leaning photo card) */
  heightFrac: 0.62,
  /** Top of card as fraction of frame height */
  yFrac: 0.13,
  /** CapCut-like rounded corner radius (px at card size, before pop scale) */
  cornerRadiusPx: 48,
  /** Soft mask feather at edges / corners (px) — blurry mask, not a hard frame */
  featherPx: 22,
  /** Soft under-shadow offset (px) */
  shadowOffsetX: 0,
  shadowOffsetY: 14,
  /** Soft under-shadow blur */
  shadowBlur: 18,
  /** Soft under-shadow alpha (0–1) */
  shadowAlpha: 0.55,
  /** Pop-in duration (seconds) */
  popInSec: 0.32,
  /** Soft fade-out at end (seconds) */
  fadeOutSec: 0.18,
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
 * Pick which scene gets the moment and which still is the inset.
 * Auto: only when ≥3 scenes and a distinct overlay still exists (prefer secondary subject beat).
 * Always: one moment when ≥2 distinct stills exist.
 *
 * @param {{
 *   mode?: unknown,
 *   scenes: Array<{ index: number, durationSec?: number, imagePath?: string, imageSource?: string, imageKey?: string | null }>,
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
      if (isDistinctStill(scenes[targetIndex], scenes[secondaryIdx])) {
        overlayFromIndex = secondaryIdx
      }
    }
  }

  if (overlayFromIndex == null) {
    targetIndex = middle
    for (const cand of [targetIndex + 1, targetIndex - 1, 0, n - 1]) {
      if (cand < 0 || cand >= n || cand === targetIndex) continue
      if (isDistinctStill(scenes[targetIndex], scenes[cand])) {
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
 * @param {{ startSec: number, endSec: number, frameW?: number }} opts
 */
export function buildOverlayPopFilterFragments({ startSec, endSec, frameW = 1080 }) {
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

  return {
    maxW,
    maxH,
    yFrac,
    shadowOffsetX: EOF_OVERLAY_LAYOUT.shadowOffsetX,
    shadowOffsetY: EOF_OVERLAY_LAYOUT.shadowOffsetY,
    shadowBlur: EOF_OVERLAY_LAYOUT.shadowBlur,
    shadowAlpha: EOF_OVERLAY_LAYOUT.shadowAlpha,
    overlayPrep: [
      // Cover-crop into the card so match stills / gen plates fill cleanly (no letterbox bars).
      `scale=${maxW}:${maxH}:force_original_aspect_ratio=increase`,
      `crop=${maxW}:${maxH}:(iw-ow)/2:(ih-oh)/2`,
      'setsar=1',
      'format=rgba',
      `geq=r='r(X\\,Y)':g='g(X\\,Y)':b='b(X\\,Y)':${softAlpha}`,
      // Keep full chroma on the soft edge — yuva420p fringes look greenish on pitch stills.
      'format=yuva444p',
      overlayScale,
      `fade=t=in:st=${fadeInSt}:d=0.12:alpha=1`,
      `fade=t=out:st=${fadeOutSt}:d=${fadeOut.toFixed(3)}:alpha=1`,
    ].join(','),
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
