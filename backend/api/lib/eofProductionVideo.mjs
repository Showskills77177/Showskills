import { existsSync, mkdirSync, readdirSync, rmSync, unlinkSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runFfmpeg, runFfprobe } from './eofFfmpeg.mjs'
import { eofProductionJobDirPath } from './eofSceneTts.mjs'
import { mapWithConcurrency } from './eofAsyncPool.mjs'
import {
  buildEofSceneScaleCropFilters,
  buildEofSceneKenBurnsFragment,
} from '../../../shared/eofSceneCrop.mjs'
import { buildCaptionDrawtextFilters } from './eofTikTokCaptions.mjs'
import {
  resolveEofCaptionStyle,
  captionsEnabledForStyle,
  captionBottomPlateMode,
  isBottomBarCaptionStyle,
  isLocalCaptionStyle,
  isZapcapCaptionStyle,
  resolveFreeLocalBurnStyle,
} from '../../../shared/eofCaptionStyles.mjs'
import { normalizeEofCaptionLayout } from '../../../shared/eofCaptionLayout.mjs'
import {
  autoTuneVideoLook,
  buildXfadeFilterComplex,
  sceneLookFilterChain,
  resolveEofColorGrade,
  resolveEofEnhanceStyle,
  resolveEofTransitionStyle,
} from '../../../shared/eofVideoLook.mjs'
import {
  buildOverlayPopFilterFragments,
  planEofOverlayMoments,
  resolveEofOverlayMoments,
} from '../../../shared/eofOverlayMoments.mjs'
import {
  stillNeedsNewsAgencyLogoBlur,
  buildNewsAgencyLogoBlurFilterFragment,
} from '../../../shared/eofNewsAgencyLogoBlur.mjs'
import {
  normalizeEofVideoEffects,
  videoEffectsFilterChain,
  eofVideoEffectIds,
} from '../../../shared/eofVideoEffects.mjs'
import {
  normalizeEofStickers,
  eofStickersActive,
  eofStickerIds,
  chainStickersThenCaptions,
} from './eofProductionStickers.mjs'
import { burnZapcapCaptions } from './eofZapcapCaptions.mjs'
import { applyEofWatermark } from './eofWatermark.mjs'
import { mixOverlaySfxIntoAudio, resolveEofWhooshSfxPath } from './eofAudioMix.mjs'
import { isEofForceSlim, isEofVercelRuntime, resolveEofProEncodeCaps } from './eofProductionServerless.mjs'

const __eofLibDir = dirname(fileURLToPath(import.meta.url))

const BUNDLED_CAPTION_FONT = join(
  __eofLibDir,
  '../../../assets/fonts/EofCaptionBold.ttf',
)

const CAPTION_FONT_CANDIDATES = [
  process.env.EOF_CAPTION_FONT,
  BUNDLED_CAPTION_FONT,
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
].filter(Boolean)

const VIDEO_FPS = Number(process.env.EOF_VIDEO_FPS) || 24
const VIDEO_PRESET = process.env.EOF_VIDEO_PRESET || 'ultrafast'
const VIDEO_CRF = process.env.EOF_VIDEO_CRF || '28'
const CLIP_CONCURRENCY_DEFAULT = Number(process.env.EOF_VIDEO_CLIP_CONCURRENCY) || 2
/** Cap threads on Vercel — `-threads 0` can thrash/hang serverless encodes (UI stuck ~42%). */
const VIDEO_THREADS =
  process.env.EOF_FFMPEG_THREADS ||
  (isEofVercelRuntime() ? '2' : '0')
/** Per-scene clip: hard cap so one hung ffmpeg cannot burn the whole 280s budget. */
const SCENE_CLIP_TIMEOUT_MS =
  Number(process.env.EOF_SCENE_CLIP_TIMEOUT_MS) ||
  (isEofForceSlim() ? 45_000 : isEofVercelRuntime() ? 40_000 : 60_000)
const MUX_TIMEOUT_MS =
  Number(process.env.EOF_MUX_TIMEOUT_MS) ||
  (isEofForceSlim() ? 90_000 : isEofVercelRuntime() ? 60_000 : 120_000)

function clipConcurrency(slim = false) {
  if (process.env.EOF_VIDEO_CLIP_CONCURRENCY) return Math.max(1, CLIP_CONCURRENCY_DEFAULT)
  // Serial clips on Hobby slim — parallel ffmpeg fights for CPU and hangs more often.
  if (slim || isEofForceSlim()) return 1
  // Pro serverless: concurrency 2 with capped threads — biggest wall-clock win under 300s.
  if (isEofVercelRuntime()) return Math.min(2, Math.max(1, CLIP_CONCURRENCY_DEFAULT))
  return Math.max(1, CLIP_CONCURRENCY_DEFAULT)
}

function resolveCaptionFont() {
  for (const path of CAPTION_FONT_CANDIDATES) {
    if (path && existsSync(path)) return path
  }
  return null
}

/**
 * Decide how captions are burned for a render pass.
 * - free: iteration (Build/Rebuild) — local ffmpeg burns (live/punch/CapCut looks), never ZapCap
 * - zapcap-only: Apply ZapCap — clean plate locally, then paid ZapCap burn
 * - auto: legacy full zapcap when style requests it
 * @param {{ captionStyle?: string, captionMode?: 'auto' | 'free' | 'zapcap-only' }} opts
 */
export function resolveCaptionRenderPlan({ captionStyle, captionMode = 'auto' }) {
  const requestedStyle = resolveEofCaptionStyle(captionStyle)
  const mode = captionMode === 'zapcap-only' ? 'zapcap-only' : captionMode === 'free' ? 'free' : 'auto'
  const forceFreeCaptions = mode === 'free' && isZapcapCaptionStyle(requestedStyle)
  const zapcapOnly = mode === 'zapcap-only' && isZapcapCaptionStyle(requestedStyle)

  let style = requestedStyle
  if (forceFreeCaptions) style = resolveFreeLocalBurnStyle(requestedStyle)
  else if (zapcapOnly) style = 'off'

  let engine = 'none'
  if (zapcapOnly) {
    engine = 'zapcap'
  } else if (!captionsEnabledForStyle(style)) {
    engine = 'none'
  } else if (forceFreeCaptions || isLocalCaptionStyle(style)) {
    engine = 'local'
  } else if (mode === 'auto' && isZapcapCaptionStyle(requestedStyle)) {
    engine = 'zapcap'
  }

  return {
    requestedStyle,
    style,
    engine,
    forceFreeCaptions,
    zapcapOnly,
    burnCaptions: engine === 'local',
    callZapcap: engine === 'zapcap',
  }
}

export function eofProductionVideoRelPath(jobId) {
  if (process.env.VERCEL) return `tmp/showskills-eof/jobs/${jobId}/short.mp4`
  return `storage/eof/jobs/${jobId}/short.mp4`
}

export function eofProductionVideoAbsPath(jobId) {
  return join(eofProductionJobDirPath(jobId), 'short.mp4')
}

/**
 * Drop prior scene clips + caption textfiles + concat lists so a remux cannot stitch
 * or burn against leftover captioned intermediates from the previous Short.
 * Also removes short.mp4 / compact temps in the work dir (belt-and-suspenders with
 * clearEofVideoOnlyArtifact) so encode never concatenates an old captioned plate.
 * @param {string} workDir
 */
export function clearEofSceneClipCache(workDir) {
  if (!workDir || !existsSync(workDir)) return
  try {
    for (const name of readdirSync(workDir)) {
      if (
        /^clip-\d+\.mp4$/i.test(name) ||
        /^caption-text-\d+$/i.test(name) ||
        /^short(\.compact)?\.mp4$/i.test(name) ||
        /^video-concat\.txt$/i.test(name)
      ) {
        const abs = join(workDir, name)
        try {
          rmSync(abs, { recursive: true, force: true })
        } catch {
          try {
            unlinkSync(abs)
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Replace Captions / remux must encode from still images only — never an MP4 plate
 * that may already have burned captions.
 * @param {string} imagePath
 */
export function assertEofCleanPlateImagePath(imagePath) {
  const p = String(imagePath || '')
  if (!p) throw new Error('Scene image path is missing (clean plate required).')
  if (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(p)) {
    throw new Error(
      'Replace Captions refused a video plate as a scene still — rebuild from clean JPGs only.',
    )
  }
}

/**
 * Probe still width×height (best-effort). Missing ffprobe → {0,0} → blind face-safe cover.
 * @param {string} imagePath
 * @returns {Promise<{ width: number, height: number }>}
 */
async function probeSceneStillSize(imagePath) {
  if (!imagePath || !existsSync(imagePath)) return { width: 0, height: 0 }
  try {
    const { stdout } = await runFfprobe(
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height',
        '-of',
        'csv=p=0:s=x',
        imagePath,
      ],
      { timeoutMs: 8_000, maxBuffer: 256 * 1024 },
    )
    const parts = String(stdout || '')
      .trim()
      .split(/[x,\s]+/)
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (parts.length >= 2) return { width: parts[0], height: parts[1] }
  } catch {
    /* ffprobe often absent on slim/serverless — fall through */
  }
  return { width: 0, height: 0 }
}

/**
 * Cover-scale (or letterbox) + look (+ optional Ken Burns). Captions applied separately
 * so overlays can sit under text.
 *
 * Framing (shared/eofSceneCrop.mjs — no face detection):
 * - Tall / portrait → cover + upper face-safe Y bias (heads stay in frame)
 * - Mild landscape → cover (mostly X after scale=increase)
 * - Very wide / low-res → letterbox pad (don't thin-slice or mush-upscale)
 *
 * Ken Burns is skipped on letterbox plates and softened on the hook (scene 0).
 * News/agency plates optionally get corner boxblur after crop.
 * Returns a filtergraph string (may include `;` when logo blur is active).
 */
function buildSceneBaseFilters({
  frames,
  lookFilters = [],
  kenBurns = false,
  mildKenBurns = false,
  logoBlur = false,
  logoBlurLabelPrefix = 'mlb',
  sourceWidth = 0,
  sourceHeight = 0,
}) {
  const { framing, filters: head } = buildEofSceneScaleCropFilters({
    width: sourceWidth,
    height: sourceHeight,
  })
  if (lookFilters?.length) head.push(...lookFilters)

  let chain = head.join(',')
  if (logoBlur) {
    const blur = buildNewsAgencyLogoBlurFilterFragment({
      frameW: 1080,
      frameH: 1920,
      labelPrefix: logoBlurLabelPrefix,
    })
    if (blur) chain = `${chain},${blur}`
  }

  // Zoompan on letterboxed pads zooms into empty bars — skip. Hook gets a milder push-in.
  const allowKenBurns = kenBurns && framing.mode === 'cover'
  if (allowKenBurns) {
    chain += `,${buildEofSceneKenBurnsFragment({
      frames,
      fps: VIDEO_FPS,
      mild: Boolean(mildKenBurns),
    })}`
  } else {
    chain += `,fps=${VIDEO_FPS}`
  }
  return chain
}

/**
 * Local caption burn: live = bottom bar; CapCut styles = mid vignette (escape hatch only).
 */
function buildSceneCaptionFilters({
  caption,
  durationSec,
  captionFont,
  captionStyle,
  captionLayout,
  burnCaptions,
  textDir,
}) {
  if (!burnCaptions) return []
  const filters = []
  const lay = normalizeEofCaptionLayout(captionLayout, captionStyle)
  if (isBottomBarCaptionStyle(captionStyle)) {
    const plate = captionBottomPlateMode(captionStyle)
    if (plate === 'full' || plate === 'punch') {
      const boxY = Math.max(0.35, lay.yNorm - 0.06)
      filters.push(`drawbox=x=0:y=ih*${boxY.toFixed(3)}:w=iw:h=ih*0.16:color=black@0.5:t=fill`)
    } else if (plate === 'soft') {
      const boxY = Math.max(0.35, lay.yNorm - 0.05)
      filters.push(`drawbox=x=0:y=ih*${boxY.toFixed(3)}:w=iw:h=ih*0.14:color=black@0.32:t=fill`)
    }
    if (plate === 'punch') {
      const barY = Math.min(0.92, lay.yNorm + 0.08)
      filters.push(
        `drawbox=x=iw*0.12:y=ih*${barY.toFixed(3)}:w=iw*0.76:h=5:color=0xFFE566@0.95:t=fill`,
      )
    }
  } else {
    const boxY = Math.max(0.2, lay.yNorm - 0.12)
    filters.push(`drawbox=x=0:y=ih*${boxY.toFixed(3)}:w=iw:h=ih*0.28:color=black@0.28:t=fill`)
  }
  if (captionFont) {
    filters.push(
      ...buildCaptionDrawtextFilters({
        caption,
        durationSec,
        captionFont,
        style: captionStyle,
        textDir,
        layout: lay,
      }),
    )
  }
  return filters
}

/**
 * Local caption burn: live = bottom bar; CapCut styles = mid vignette (escape hatch only).
 * Enhance + color grade sit after crop so 9:16 faces stay framed, then CapCut pack look.
 */
function buildSceneVideoFilter({
  frames,
  caption,
  durationSec,
  captionFont,
  captionStyle,
  captionLayout,
  burnCaptions,
  lookFilters = [],
  effectFilters = [],
  kenBurns = false,
  mildKenBurns = false,
  textDir,
  logoBlur = false,
  sourceWidth = 0,
  sourceHeight = 0,
}) {
  const base = buildSceneBaseFilters({
    frames,
    lookFilters,
    kenBurns,
    mildKenBurns,
    logoBlur,
    sourceWidth,
    sourceHeight,
  })
  const tail = [
    ...(effectFilters?.length ? effectFilters : []),
    ...buildSceneCaptionFilters({
      caption,
      durationSec,
      captionFont,
      captionStyle,
      captionLayout,
      burnCaptions,
      textDir,
    }),
  ]
  return tail.length ? `${base},${tail.join(',')}` : base
}

/**
 * Base still + inset pop card (lower-third safe zone) via filter_complex; captions burn on top.
 */
function buildSceneOverlayFilterComplex({
  frames,
  caption,
  durationSec,
  captionFont,
  captionStyle,
  captionLayout,
  burnCaptions,
  lookFilters = [],
  effectFilters = [],
  kenBurns = false,
  mildKenBurns = false,
  textDir,
  overlayMoment,
  stickers = null,
  logoBlur = false,
  overlayLogoBlur = false,
  sourceWidth = 0,
  sourceHeight = 0,
}) {
  const baseChain = buildSceneBaseFilters({
    frames,
    lookFilters,
    kenBurns,
    mildKenBurns,
    logoBlur,
    logoBlurLabelPrefix: 'mlb',
    sourceWidth,
    sourceHeight,
  })
  const pop = buildOverlayPopFilterFragments({
    startSec: overlayMoment.startSec,
    endSec: overlayMoment.endSec,
    agencyLogoBlur: overlayLogoBlur,
  })
  const fxChain = effectFilters?.length ? effectFilters.join(',') : ''
  const captionChain = buildSceneCaptionFilters({
    caption,
    durationSec,
    captionFont,
    captionStyle,
    captionLayout,
    burnCaptions,
    textDir,
  })
  // Effects on whole composed frame, then stickers, then captions on top (sharp text).
  // CapCut-style: soft under-shadow first, then feathered rounded card (alpha via format=auto).
  const overlay =
    `[0:v]${baseChain}[base];` +
    `[1:v]${pop.overlayPrep}[ov];` +
    `[ov]split[ovmain][ovsh];` +
    `[ovsh]${pop.shadowPrep}[shadow];` +
    `[base][shadow]overlay=${pop.shadowXy}:format=auto:enable='${pop.enableExpr}'[shbase];` +
    `[shbase][ovmain]overlay=${pop.overlayXy}:format=auto:enable='${pop.enableExpr}'`

  let label = 'comp'
  let graph = `${overlay}[${label}]`
  if (fxChain) {
    graph += `;[${label}]${fxChain}[vfx]`
    label = 'vfx'
  }

  if (eofStickersActive(stickers)) {
    const chained = chainStickersThenCaptions(label, stickers, captionChain)
    if (chained.missing?.length) {
      console.warn('[eof-video] sticker assets missing', chained.missing.join(','))
    }
    return `${graph};${chained.filter}`
  }

  if (captionChain.length) {
    return `${graph};[${label}]${captionChain.join(',')}[vout]`
  }
  if (label !== 'vout') {
    return `${graph};[${label}]null[vout]`
  }
  return graph
}

/**
 * Full-frame scene with stickers (movie overlays) — filter_complex.
 * Order: base + look → effects → stickers → captions.
 */
function buildSceneStickerFilterComplex({
  frames,
  caption,
  durationSec,
  captionFont,
  captionStyle,
  captionLayout,
  burnCaptions,
  lookFilters = [],
  effectFilters = [],
  kenBurns = false,
  mildKenBurns = false,
  textDir,
  stickers = null,
  logoBlur = false,
  sourceWidth = 0,
  sourceHeight = 0,
}) {
  const baseChain = buildSceneBaseFilters({
    frames,
    lookFilters,
    kenBurns,
    mildKenBurns,
    logoBlur,
    logoBlurLabelPrefix: 'mlb',
    sourceWidth,
    sourceHeight,
  })
  const fxChain = effectFilters?.length ? effectFilters.join(',') : ''
  const captionChain = buildSceneCaptionFilters({
    caption,
    durationSec,
    captionFont,
    captionStyle,
    captionLayout,
    burnCaptions,
    textDir,
  })
  let label = 'vbase'
  let graph = `[0:v]${baseChain}[${label}]`
  if (fxChain) {
    graph += `;[${label}]${fxChain}[vfx]`
    label = 'vfx'
  }
  const chained = chainStickersThenCaptions(label, stickers, captionChain)
  if (chained.missing?.length) {
    console.warn('[eof-video] sticker assets missing', chained.missing.join(','))
  }
  return `${graph};${chained.filter}`
}

function sceneStillLogoBlurMeta(scene) {
  return {
    imageUrl: scene?.imageUrl || null,
    imageKey: scene?.imageKey || null,
    imageTitle: scene?.imageTitle || null,
    sourcePage: scene?.sourcePage || null,
    imageSource: scene?.imageSource || null,
  }
}

async function encodeSceneClip({
  scene,
  workDir,
  captionFont,
  captionStyle,
  captionLayout,
  burnCaptions,
  lookFilters,
  effectFilters = [],
  kenBurns,
  encodeDurationSec,
  overlayMoment = null,
  stickers = null,
  skipLogoBlur = false,
  onHeartbeat = null,
}) {
  const contentDur = Math.max(2, Number(scene.durationSec) || 3)
  const dur = Math.max(contentDur, Number(encodeDurationSec) || contentDur)
  const frames = Math.max(1, Math.ceil(dur * VIDEO_FPS))
  const clipPath = join(workDir, `clip-${scene.index + 1}.mp4`)
  const caption = String(scene.caption || '').trim().slice(0, 140) || `Scene ${scene.index + 1}`
  const textDir = join(workDir, `caption-text-${scene.index + 1}`)
  mkdirSync(textDir, { recursive: true })
  const useStickers = eofStickersActive(stickers)
  const logoBlur =
    !skipLogoBlur && stillNeedsNewsAgencyLogoBlur(sceneStillLogoBlurMeta(scene))
  const overlayLogoBlur = !skipLogoBlur && Boolean(overlayMoment?.overlayLogoBlur)
  if (logoBlur || overlayLogoBlur) {
    console.info(
      '[eof-video] news-agency logo blur',
      `scene=${scene.index + 1}`,
      logoBlur ? 'base' : '',
      overlayLogoBlur ? 'pop' : '',
    )
  }

  // Hook (scene 0) gets milder Ken Burns; probe still size for aspect-aware crop.
  const mildKenBurns = Number(scene.index) === 0
  const probed = await probeSceneStillSize(scene.imagePath)
  const sourceWidth = Number(scene.imageWidth) || probed.width || 0
  const sourceHeight = Number(scene.imageHeight) || probed.height || 0
  if (sourceWidth && sourceHeight) {
    console.info(
      '[eof-video] scene still size',
      `scene=${scene.index + 1}`,
      `${sourceWidth}x${sourceHeight}`,
    )
  }

  const framingOpts = { mildKenBurns, sourceWidth, sourceHeight }
  const ffmpegHb = typeof onHeartbeat === 'function' ? { onHeartbeat } : {}

  const overlayPath = overlayMoment?.overlayImagePath
  const useOverlay =
    Boolean(overlayMoment) &&
    Boolean(overlayPath) &&
    existsSync(overlayPath) &&
    overlayPath !== scene.imagePath

  if (useOverlay) {
    const filterComplex = buildSceneOverlayFilterComplex({
      frames,
      caption,
      durationSec: contentDur,
      captionFont,
      captionStyle,
      captionLayout,
      burnCaptions,
      lookFilters,
      effectFilters,
      kenBurns,
      textDir,
      overlayMoment,
      stickers,
      logoBlur,
      overlayLogoBlur,
      ...framingOpts,
    })
    try {
      await runFfmpeg(
        [
          '-y',
          '-loop',
          '1',
          '-i',
          scene.imagePath,
          '-loop',
          '1',
          '-i',
          overlayPath,
          '-filter_complex',
          filterComplex,
          '-map',
          '[vout]',
          '-t',
          String(dur),
          '-c:v',
          'libx264',
          '-preset',
          VIDEO_PRESET,
          '-crf',
          VIDEO_CRF,
          '-threads',
          VIDEO_THREADS,
          '-pix_fmt',
          'yuv420p',
          '-an',
          clipPath,
        ],
        { maxBuffer: 16 * 1024 * 1024, timeoutMs: SCENE_CLIP_TIMEOUT_MS, ...ffmpegHb },
      )
      return clipPath
    } catch (e) {
      console.warn(
        '[eof-video] overlay moment failed, falling back to full-frame scene',
        e instanceof Error ? e.message : e,
      )
    }
  }

  if (useStickers) {
    const filterComplex = buildSceneStickerFilterComplex({
      frames,
      caption,
      durationSec: contentDur,
      captionFont,
      captionStyle,
      captionLayout,
      burnCaptions,
      lookFilters,
      effectFilters,
      kenBurns,
      textDir,
      stickers,
      logoBlur,
      ...framingOpts,
    })
    await runFfmpeg(
      [
        '-y',
        '-loop',
        '1',
        '-i',
        scene.imagePath,
        '-filter_complex',
        filterComplex,
        '-map',
        '[vout]',
        '-t',
        String(dur),
        '-c:v',
        'libx264',
        '-preset',
        VIDEO_PRESET,
        '-crf',
        VIDEO_CRF,
        '-threads',
        VIDEO_THREADS,
        '-pix_fmt',
        'yuv420p',
        '-an',
        clipPath,
      ],
      { maxBuffer: 16 * 1024 * 1024, timeoutMs: SCENE_CLIP_TIMEOUT_MS, ...ffmpegHb },
    )
    return clipPath
  }

  const vf = buildSceneVideoFilter({
    frames,
    caption,
    durationSec: contentDur,
    captionFont,
    captionStyle,
    captionLayout,
    burnCaptions,
    lookFilters,
    effectFilters,
    kenBurns,
    textDir,
    logoBlur,
    ...framingOpts,
  })

  await runFfmpeg(
    [
      '-y',
      '-loop',
      '1',
      '-i',
      scene.imagePath,
      '-vf',
      vf,
      '-t',
      String(dur),
      '-c:v',
      'libx264',
      '-preset',
      VIDEO_PRESET,
      '-crf',
      VIDEO_CRF,
      '-threads',
      VIDEO_THREADS,
      '-pix_fmt',
      'yuv420p',
      '-an',
      clipPath,
    ],
    { maxBuffer: 16 * 1024 * 1024, timeoutMs: SCENE_CLIP_TIMEOUT_MS, ...ffmpegHb },
  )

  return clipPath
}

async function stitchWithConcat({ clipPaths, mixedAudioPath, out, onHeartbeat = null }) {
  const listFile = join(dirname(out), 'video-concat.txt')
  const listBody = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  await writeFile(listFile, listBody, 'utf8')
  const hasAudio = Boolean(mixedAudioPath && existsSync(mixedAudioPath))
  const args = hasAudio
    ? [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFile,
        '-i',
        mixedAudioPath,
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-movflags',
        '+faststart',
        '-shortest',
        out,
      ]
    : [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFile,
        '-c:v',
        'copy',
        '-an',
        '-movflags',
        '+faststart',
        out,
      ]
  await runFfmpeg(args, {
    maxBuffer: 16 * 1024 * 1024,
    timeoutMs: MUX_TIMEOUT_MS,
    ...(typeof onHeartbeat === 'function' ? { onHeartbeat } : {}),
  })
  return hasAudio
}

/**
 * CapCut-style xfade stitch. Clips must already be padded (first n-1 longer by transitionSec).
 */
async function stitchWithXfade({
  clipPaths,
  mixedAudioPath,
  out,
  graph,
  targetDurationSec,
  onHeartbeat = null,
}) {
  const hasAudio = Boolean(mixedAudioPath && existsSync(mixedAudioPath))
  const inputs = ['-y']
  for (const p of clipPaths) {
    inputs.push('-i', p)
  }
  if (hasAudio) inputs.push('-i', mixedAudioPath)

  const args = [
    ...inputs,
    '-filter_complex',
    graph.filterComplex,
    '-map',
    `[${graph.outputLabel}]`,
  ]
  if (hasAudio) {
    args.push('-map', `${clipPaths.length}:a:0`, '-c:a', 'aac', '-b:a', '192k')
  } else {
    args.push('-an')
  }
  args.push(
    '-c:v',
    'libx264',
    '-preset',
    VIDEO_PRESET,
    '-crf',
    VIDEO_CRF,
    '-pix_fmt',
    'yuv420p',
    '-t',
    String(targetDurationSec),
    '-movflags',
    '+faststart',
    out,
  )
  await runFfmpeg(args, {
    maxBuffer: 32 * 1024 * 1024,
    timeoutMs: MUX_TIMEOUT_MS,
    ...(typeof onHeartbeat === 'function' ? { onHeartbeat } : {}),
  })
  return hasAudio
}

/**
 * Concatenate scene image clips into a 9:16 Short.
 * Auto CapCut transitions + color match when transitionStyle/colorGrade are auto.
 * @param {{
 *   jobId: string,
 *   scenes: Array<{ index: number, durationSec: number, caption?: string, imagePath: string }>,
 *   mixedAudioPath?: string | null,
 *   outputPath?: string,
 *   captionStyle?: string,
 *   captionLayout?: object | null,
 *   zapcapTemplateId?: string | null,
 *   transitionStyle?: string,
 *   colorGrade?: string,
 *   enhanceStyle?: string,
 *   format?: string,
 *   captionMode?: 'auto' | 'free' | 'zapcap-only',
 *   overlayMoments?: 'off' | 'auto' | 'always',
 *   videoEffects?: object | null,
 *   stickers?: object | null,
 *   hasSecondarySubject?: boolean,
 *   secondarySceneIndex?: number | null,
 *   onSceneProgress?: (index: number, total: number) => Promise<void> | void,
 * }} opts
 */
export async function renderEofProductionVideo({
  jobId,
  scenes,
  mixedAudioPath = null,
  outputPath,
  captionStyle,
  captionLayout = null,
  zapcapTemplateId: preferredZapcapTemplateId,
  transitionStyle,
  colorGrade,
  enhanceStyle,
  format,
  captionMode = 'auto',
  overlayMoments: overlayMomentsMode,
  videoEffects: videoEffectsRaw = null,
  stickers: stickersRaw = null,
  hasSecondarySubject = false,
  secondarySceneIndex = null,
  onSceneProgress,
  forceSlim = undefined,
}) {
  const sorted = [...scenes].sort((a, b) => a.index - b.index)
  if (!sorted.length) throw new Error('No scenes to render.')

  const out = outputPath || eofProductionVideoAbsPath(jobId)
  const workDir = dirname(out)
  mkdirSync(workDir, { recursive: true })
  const plan = resolveCaptionRenderPlan({ captionStyle, captionMode })
  const { requestedStyle, style, forceFreeCaptions, zapcapOnly, burnCaptions, callZapcap } = plan
  const look = autoTuneVideoLook({
    format: format || 'news',
    transitionStyle: resolveEofTransitionStyle(transitionStyle),
    colorGrade: resolveEofColorGrade(colorGrade),
    enhanceStyle: resolveEofEnhanceStyle(enhanceStyle),
    sceneCount: sorted.length,
  })
  const lookFilters = sceneLookFilterChain({
    enhanceStyle: look.enhanceStyle,
    colorGrade: look.colorGrade,
  })
  const videoEffects = normalizeEofVideoEffects(videoEffectsRaw)
  const effectFilters = videoEffectsFilterChain(videoEffects)
  const stickers = normalizeEofStickers(stickersRaw)
  const serverlessSlim = forceSlim === undefined ? isEofForceSlim() : Boolean(forceSlim)
  const encodeCaps = resolveEofProEncodeCaps({
    sceneCount: sorted.length,
    vercel: isEofVercelRuntime(),
    slim: serverlessSlim,
  })
  // Hobby slim OR Pro-reliable on Vercel: hard cuts — xfade filtergraphs blow the time budget.
  const useXfade =
    !serverlessSlim &&
    !encodeCaps.skipXfade &&
    look.perCutTransitions.length > 0 &&
    sorted.length > 1
  const kenBurns =
    !serverlessSlim &&
    !encodeCaps.skipKenBurns &&
    (Boolean(look.kenBurns) || process.env.EOF_VIDEO_KEN_BURNS === '1')
  const overlayMode =
    serverlessSlim || encodeCaps.skipOverlays
      ? 'off'
      : resolveEofOverlayMoments(overlayMomentsMode)
  const overlayPlan = planEofOverlayMoments({
    mode: overlayMode,
    scenes: sorted,
    hasSecondarySubject,
    secondarySceneIndex,
  })
  const overlayByScene = new Map()
  for (const m of overlayPlan) {
    const overlayScene = sorted.find((s) => s.index === m.overlaySceneIndex)
    if (!overlayScene?.imagePath || !existsSync(overlayScene.imagePath)) continue
    overlayByScene.set(m.sceneIndex, {
      ...m,
      overlayImagePath: overlayScene.imagePath,
      overlayLogoBlur:
        !encodeCaps.skipLogoBlur &&
        stillNeedsNewsAgencyLogoBlur(sceneStillLogoBlurMeta(overlayScene)),
    })
  }

  if (encodeCaps.threatenBudget && !serverlessSlim) {
    console.info(
      '[eof-video] Pro reliable encode profile',
      `scenes=${sorted.length}`,
      encodeCaps.profile || 'pro-reliable',
      encodeCaps.skipXfade ? 'hardCuts' : 'xfade',
      encodeCaps.skipKenBurns ? 'skipKenBurns' : '',
      encodeCaps.skipLogoBlur ? 'skipLogoBlur' : '',
      encodeCaps.skipOverlays ? 'skipOverlays' : '',
    )
  }

  console.info(
    '[eof-video] look',
    'transition',
    serverlessSlim ? 'cut' : look.transitionStyle,
    'cuts',
    useXfade ? look.perCutTransitions.join(',') || 'hard' : 'hard',
    'enhance',
    look.enhanceStyle,
    'color',
    look.colorGrade,
    'td',
    useXfade ? look.transitionSec : 0,
    'kenBurns',
    kenBurns,
    'overlayMoments',
    overlayMode,
    overlayByScene.size ? `n=${overlayByScene.size}` : 'none',
    'effects',
    eofVideoEffectIds(videoEffects).join(',') || 'none',
    'stickers',
    eofStickerIds(stickers).join(',') || 'none',
    serverlessSlim ? 'serverlessSlim=1' : 'serverlessSlim=0',
    `clipConcurrency=${clipConcurrency(serverlessSlim)}`,
  )

  const engine = plan.engine
  const captionFont = burnCaptions ? resolveCaptionFont() : null
  if (burnCaptions && !captionFont) {
    console.warn('[eof-video] No caption font found — captions will be missing from the Short.')
  }
  if (style === 'off' && zapcapOnly) {
    console.info('[eof-video] clean plate — paid ZapCap burn follows')
  } else if (style === 'off') {
    console.info('[eof-video] captions off — clean plate')
  } else if (engine === 'local') {
    console.info(
      '[eof-video] free local captions',
      style,
      forceFreeCaptions
        ? `(ZapCap style ${requestedStyle} → local burn; template ${preferredZapcapTemplateId || 'n/a'} kept for Apply)`
        : '',
    )
  } else if (engine === 'none') {
    console.warn(
      '[eof-video] No ZapCap key — pick a free caption style or set ZAPCAP_API_KEY for CapCut-class burn.',
    )
  }
  console.info('[eof-video] caption style', style, 'engine', engine)

  const contentDurs = sorted.map((s) => Math.max(2, Number(s.durationSec) || 3))
  const graph = useXfade
    ? buildXfadeFilterComplex({
        clipDurations: contentDurs,
        perCutTransitions: look.perCutTransitions,
        transitionSec: look.transitionSec,
      })
    : null
  const encodeDurs = graph?.paddedDurations || contentDurs

  let clipsDone = 0
  const concurrency = clipConcurrency(serverlessSlim)
  const clipHeartbeat = async () => {
    if (onSceneProgress) await onSceneProgress(clipsDone, sorted.length)
  }
  const clipPaths = await mapWithConcurrency(sorted, concurrency, async (scene) => {
    const i = sorted.findIndex((s) => s.index === scene.index)
    if (!scene.imagePath || !existsSync(scene.imagePath)) {
      throw new Error(`Scene ${scene.index + 1} image is missing.`)
    }
    assertEofCleanPlateImagePath(scene.imagePath)
    const clipPath = await encodeSceneClip({
      scene,
      workDir,
      captionFont,
      captionStyle: style,
      captionLayout,
      burnCaptions,
      lookFilters,
      effectFilters,
      kenBurns,
      encodeDurationSec: encodeDurs[i] ?? contentDurs[i],
      overlayMoment: overlayByScene.get(scene.index) || null,
      stickers,
      skipLogoBlur: encodeCaps.skipLogoBlur,
      onHeartbeat: clipHeartbeat,
    })
    clipsDone += 1
    if (onSceneProgress) await onSceneProgress(clipsDone, sorted.length)
    return { index: scene.index, clipPath }
  })

  clipPaths.sort((a, b) => a.index - b.index)
  const orderedClips = clipPaths.map((c) => c.clipPath)

  const targetDurationSec = contentDurs.reduce((a, b) => a + b, 0)

  let audioForMux = mixedAudioPath
  if (audioForMux && existsSync(audioForMux) && overlayByScene.size > 0) {
    const sfxPath = resolveEofWhooshSfxPath()
    if (sfxPath) {
      const sfxOut = join(workDir, 'mixed-with-overlay-sfx.mp3')
      const events = []
      for (const m of overlayByScene.values()) {
        // Soft CapCut-style swish — keep under VO (old 0.55 read as a harsh click)
        events.push({ atSec: m.sfxAtSec, volume: 0.28 })
        if (m.sfxOutAtSec != null && m.sfxOutAtSec > m.sfxAtSec + 0.4) {
          events.push({ atSec: m.sfxOutAtSec, volume: 0.16 })
        }
      }
      try {
        audioForMux = await mixOverlaySfxIntoAudio({
          mixedAudioPath: audioForMux,
          sfxPath,
          events,
          outputPath: sfxOut,
        })
      } catch (e) {
        console.warn(
          '[eof-video] overlay whoosh mix skipped',
          e instanceof Error ? e.message : e,
        )
        audioForMux = mixedAudioPath
      }
    }
  }

  let hasAudio
  if (graph) {
    try {
      hasAudio = await stitchWithXfade({
        clipPaths: orderedClips,
        mixedAudioPath: audioForMux,
        out,
        graph,
        targetDurationSec,
        onHeartbeat: clipHeartbeat,
      })
    } catch (e) {
      console.warn(
        '[eof-video] xfade failed, falling back to hard cuts',
        e instanceof Error ? e.message : e,
      )
      // Re-encode without pad for clean concat lengths (parallel — serial doubled wall clock).
      const plainClips = await mapWithConcurrency(sorted, concurrency, async (scene) => {
        const i = sorted.findIndex((s) => s.index === scene.index)
        return encodeSceneClip({
          scene,
          workDir,
          captionFont,
          captionStyle: style,
          captionLayout,
          burnCaptions,
          lookFilters,
          effectFilters,
          kenBurns,
          encodeDurationSec: contentDurs[i],
          overlayMoment: overlayByScene.get(scene.index) || null,
          stickers,
          skipLogoBlur: encodeCaps.skipLogoBlur,
          onHeartbeat: clipHeartbeat,
        })
      })
      // mapWithConcurrency preserves input order
      hasAudio = await stitchWithConcat({
        clipPaths: plainClips,
        mixedAudioPath: audioForMux,
        out,
        onHeartbeat: clipHeartbeat,
      })
    }
  } else {
    hasAudio = await stitchWithConcat({
      clipPaths: orderedClips,
      mixedAudioPath: audioForMux,
      out,
      onHeartbeat: clipHeartbeat,
    })
  }

  if (!existsSync(out)) throw new Error('Video render produced no output file.')

  let captionEngine = burnCaptions ? 'local' : callZapcap ? 'pending-zapcap' : 'none'
  let zapcapTemplateId = null
  if (callZapcap) {
    try {
      const z = await burnZapcapCaptions({
        videoPath: out,
        style: requestedStyle,
        templateId: preferredZapcapTemplateId,
        scenes: sorted.map((s) => ({
          caption: s.caption,
          narration: s.narration || s.caption,
          durationSec: s.durationSec,
        })),
      })
      captionEngine = z.engine
      zapcapTemplateId = z.templateId || null
    } catch (e) {
      console.warn(
        '[eof-video] ZapCap failed — Short will export without animated captions',
        e instanceof Error ? e.message : e,
      )
      captionEngine = 'zapcap-failed'
      zapcapTemplateId = preferredZapcapTemplateId || null
    }
  } else if (engine === 'local' || style === 'live') {
    zapcapTemplateId = null
  } else {
    zapcapTemplateId = preferredZapcapTemplateId || null
  }

  let watermark = null
  try {
    watermark = await applyEofWatermark({ videoPath: out, durationSec: targetDurationSec })
  } catch (e) {
    console.warn('[eof-video] watermark skipped', e instanceof Error ? e.message : e)
    watermark = { applied: false, reason: e instanceof Error ? e.message : String(e) }
  }

  return {
    outputPath: out,
    relPath: eofProductionVideoRelPath(jobId),
    hasAudio,
    captionStyle: style,
    requestedStyle,
    freeCaptions: forceFreeCaptions,
    captionEngine,
    // Preserve the user's chosen template through free previews so "Apply ZapCap captions" still knows it.
    zapcapTemplateId: forceFreeCaptions ? preferredZapcapTemplateId || null : zapcapTemplateId,
    watermark,
    videoLook: {
      transitionStyle: look.transitionStyle,
      colorGrade: look.colorGrade,
      enhanceStyle: look.enhanceStyle,
      perCutTransitions: look.perCutTransitions,
      transitionSec: look.transitionSec,
      kenBurns,
      xfade: Boolean(graph),
      overlayMoments: overlayMode,
      overlayCount: overlayByScene.size,
      videoEffects,
      effectIds: eofVideoEffectIds(videoEffects),
      stickers,
      stickerIds: eofStickerIds(stickers),
    },
    overlayMoments: [...overlayByScene.values()].map((m) => ({
      sceneIndex: m.sceneIndex,
      overlaySceneIndex: m.overlaySceneIndex,
      absoluteStartSec: m.absoluteStartSec,
      absoluteEndSec: m.absoluteEndSec,
    })),
  }
}
