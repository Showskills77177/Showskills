/**
 * 9:16 scene-still framing for EOF Production Shorts.
 *
 * No face detection — blind but aspect-aware:
 * - Tall / portrait → cover-crop with upper (face-safe) Y bias so heads stay in frame
 * - Near 9:16 / mild landscape → cover (mostly X crop after scale=increase)
 * - Very wide / panoramic OR low-res → fit + pad (letterbox) so we don't slice the
 *   subject out of a thin vertical window or mush up a Serp thumbnail
 *
 * Used by Production scene encode, YouTube thumb adapt, and pop-inset cover.
 */

export const EOF_SCENE_FRAME_W = 1080
export const EOF_SCENE_FRAME_H = 1920
/** Target Short aspect (w/h). */
export const EOF_SCENE_ASPECT = EOF_SCENE_FRAME_W / EOF_SCENE_FRAME_H

/**
 * Y bias into vertical excess after cover-scale.
 * Lower = closer to top (keeps heads). History: dead-center (0.5) chopped faces;
 * glued-to-top (0) left awkward pitch bands; 0.20 still felt aggressive on hooks.
 */
export const EOF_CROP_Y_BIAS_FACE_SAFE = 0.12
export const EOF_CROP_Y_BIAS_BALANCED = 0.18

/** Source w/h above this → letterbox instead of a thin cover slice. */
export const EOF_WIDE_ASPECT_THRESHOLD = 1.55

/** Min edge (px) below this → letterbox (avoid soft upscale-cover). */
export const EOF_LOWRES_MIN_EDGE = 480

/** Dark pad behind letterboxed stills (reads as intentional, not broken). */
export const EOF_LETTERBOX_PAD_COLOR = '0x0a0a12'

/**
 * @param {{ width?: number, height?: number }} [dims]
 * @returns {{
 *   mode: 'cover' | 'letterbox',
 *   yBias: number,
 *   reason: 'unknown_dims' | 'low_res' | 'wide' | 'tall' | 'cover',
 *   aspect: number | null,
 * }}
 */
export function classifyEofSceneFraming({ width, height } = {}) {
  const w = Number(width) || 0
  const h = Number(height) || 0
  if (!(w > 0 && h > 0)) {
    return {
      mode: 'cover',
      yBias: EOF_CROP_Y_BIAS_FACE_SAFE,
      reason: 'unknown_dims',
      aspect: null,
    }
  }
  const aspect = w / h
  const minEdge = Math.min(w, h)
  if (minEdge < EOF_LOWRES_MIN_EDGE) {
    return { mode: 'letterbox', yBias: 0.5, reason: 'low_res', aspect }
  }
  if (aspect >= EOF_WIDE_ASPECT_THRESHOLD) {
    return { mode: 'letterbox', yBias: 0.5, reason: 'wide', aspect }
  }
  // Narrower than 9:16 → cover will crop Y; keep heads with a conservative upper bias.
  if (aspect < EOF_SCENE_ASPECT * 0.98) {
    return { mode: 'cover', yBias: EOF_CROP_Y_BIAS_FACE_SAFE, reason: 'tall', aspect }
  }
  return { mode: 'cover', yBias: EOF_CROP_Y_BIAS_BALANCED, reason: 'cover', aspect }
}

/**
 * ffmpeg crop Y expression (commas escaped for filtergraphs).
 * @param {number} [yBias]
 */
export function buildEofSceneCropYExpr(yBias = EOF_CROP_Y_BIAS_FACE_SAFE) {
  const b = Math.max(0, Math.min(1, Number(yBias) || EOF_CROP_Y_BIAS_FACE_SAFE))
  return `max(0\\,min((ih-oh)*${b.toFixed(2)}\\,ih-oh))`
}

/**
 * Scale + crop (or letterbox pad) head filters for a 9:16 plate.
 * Pure — no I/O. Pass known source width/height when available.
 *
 * @param {{
 *   width?: number,
 *   height?: number,
 *   frameW?: number,
 *   frameH?: number,
 *   padColor?: string,
 *   yBias?: number,
 * }} [opts]
 * @returns {{ framing: ReturnType<typeof classifyEofSceneFraming>, filters: string[] }}
 */
export function buildEofSceneScaleCropFilters(opts = {}) {
  const frameW = Math.max(16, Math.round(Number(opts.frameW) || EOF_SCENE_FRAME_W))
  const frameH = Math.max(16, Math.round(Number(opts.frameH) || EOF_SCENE_FRAME_H))
  const padColor = String(opts.padColor || EOF_LETTERBOX_PAD_COLOR).trim() || EOF_LETTERBOX_PAD_COLOR
  const framing = classifyEofSceneFraming({ width: opts.width, height: opts.height })
  const yBias =
    opts.yBias != null && Number.isFinite(Number(opts.yBias))
      ? Math.max(0, Math.min(1, Number(opts.yBias)))
      : framing.yBias

  if (framing.mode === 'letterbox') {
    return {
      framing,
      filters: [
        `scale=${frameW}:${frameH}:force_original_aspect_ratio=decrease`,
        `pad=${frameW}:${frameH}:(ow-iw)/2:(oh-ih)/2:color=${padColor}`,
        'setsar=1',
      ],
    }
  }

  return {
    framing,
    filters: [
      `scale=${frameW}:${frameH}:force_original_aspect_ratio=increase`,
      `crop=${frameW}:${frameH}:(iw-ow)/2:${buildEofSceneCropYExpr(yBias)}`,
      'setsar=1',
    ],
  }
}

/**
 * Mild Ken Burns zoompan fragment (applied after crop to an already 9:16 frame).
 * Hook / first scene should pass mild=true so the push-in doesn't cut the subject.
 *
 * @param {{ frames: number, fps?: number, mild?: boolean, frameW?: number, frameH?: number }} opts
 */
export function buildEofSceneKenBurnsFragment({
  frames,
  fps = 24,
  mild = false,
  frameW = EOF_SCENE_FRAME_W,
  frameH = EOF_SCENE_FRAME_H,
} = {}) {
  const d = Math.max(1, Math.round(Number(frames) || 1))
  const f = Math.max(1, Math.round(Number(fps) || 24))
  const maxZ = mild ? 1.06 : 1.1
  const step = mild ? 0.0007 : 0.001
  const yBias = mild ? 0.18 : 0.2
  return (
    `zoompan=z='min(zoom+${step}\\,${maxZ})'` +
    `:x='iw/2-(iw/zoom/2)'` +
    `:y='max(0\\,min(ih-ih/zoom\\,(ih-ih/zoom)*${yBias}))'` +
    `:d=${d}:s=${frameW}x${frameH}:fps=${f}`
  )
}
