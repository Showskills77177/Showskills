import { existsSync, mkdirSync, readdirSync, rmSync, unlinkSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runFfmpeg } from './eofFfmpeg.mjs'
import { eofProductionJobDirPath } from './eofSceneTts.mjs'
import { mapWithConcurrency } from './eofAsyncPool.mjs'
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
const CLIP_CONCURRENCY = Number(process.env.EOF_VIDEO_CLIP_CONCURRENCY) || 2

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
 * Cover-scale + look (+ optional Ken Burns). Captions applied separately so overlays can sit under text.
 *
 * Face-safe crop (not dead-center):
 * - Landscape match stills → only X is cropped → keep horizontal center
 * - Tall / portrait stills → Y is cropped → bias toward the upper band so heads stay in frame
 *   (dead-center was chopping Tuchel/faces; glued-to-top was chopping pitch awkwardly)
 */
function buildSceneBaseFilters({ frames, lookFilters = [], kenBurns = false }) {
  const base = [
    'scale=1080:1920:force_original_aspect_ratio=increase',
    'crop=1080:1920:(iw-ow)/2:max(0\\,min((ih-oh)*0.20\\,ih-oh))',
    'setsar=1',
  ]
  if (lookFilters?.length) base.push(...lookFilters)
  if (kenBurns) {
    // Mild zoom, anchored upper-center so the push-in doesn't cut faces off the top.
    base.push(
      `zoompan=z='min(zoom+0.0012\\,1.14)':x='iw/2-(iw/zoom/2)':y='max(0\\,min(ih-ih/zoom\\,(ih-ih/zoom)*0.22))':d=${frames}:s=1080x1920:fps=${VIDEO_FPS}`,
    )
  } else {
    base.push(`fps=${VIDEO_FPS}`)
  }
  return base
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
  textDir,
}) {
  return [
    ...buildSceneBaseFilters({ frames, lookFilters, kenBurns }),
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
  ].join(',')
}

/**
 * Base still + inset pop card (upper third) via filter_complex; captions burn on top.
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
  textDir,
  overlayMoment,
  stickers = null,
}) {
  const baseChain = buildSceneBaseFilters({ frames, lookFilters, kenBurns }).join(',')
  const pop = buildOverlayPopFilterFragments({
    startSec: overlayMoment.startSec,
    endSec: overlayMoment.endSec,
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
  textDir,
  stickers = null,
}) {
  const baseChain = buildSceneBaseFilters({ frames, lookFilters, kenBurns }).join(',')
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
}) {
  const contentDur = Math.max(2, Number(scene.durationSec) || 3)
  const dur = Math.max(contentDur, Number(encodeDurationSec) || contentDur)
  const frames = Math.max(1, Math.ceil(dur * VIDEO_FPS))
  const clipPath = join(workDir, `clip-${scene.index + 1}.mp4`)
  const caption = String(scene.caption || '').trim().slice(0, 140) || `Scene ${scene.index + 1}`
  const textDir = join(workDir, `caption-text-${scene.index + 1}`)
  mkdirSync(textDir, { recursive: true })
  const useStickers = eofStickersActive(stickers)

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
          '0',
          '-pix_fmt',
          'yuv420p',
          '-an',
          clipPath,
        ],
        { maxBuffer: 16 * 1024 * 1024 },
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
        '0',
        '-pix_fmt',
        'yuv420p',
        '-an',
        clipPath,
      ],
      { maxBuffer: 16 * 1024 * 1024 },
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
      '0',
      '-pix_fmt',
      'yuv420p',
      '-an',
      clipPath,
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  )

  return clipPath
}

async function stitchWithConcat({ clipPaths, mixedAudioPath, out }) {
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
  await runFfmpeg(args, { maxBuffer: 16 * 1024 * 1024 })
  return hasAudio
}

/**
 * CapCut-style xfade stitch. Clips must already be padded (first n-1 longer by transitionSec).
 */
async function stitchWithXfade({ clipPaths, mixedAudioPath, out, graph, targetDurationSec }) {
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
  await runFfmpeg(args, { maxBuffer: 32 * 1024 * 1024 })
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
  const useXfade = look.perCutTransitions.length > 0 && sorted.length > 1
  const kenBurns = Boolean(look.kenBurns) || process.env.EOF_VIDEO_KEN_BURNS === '1'
  const overlayMode = resolveEofOverlayMoments(overlayMomentsMode)
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
    })
  }

  console.info(
    '[eof-video] look',
    'transition',
    look.transitionStyle,
    'cuts',
    look.perCutTransitions.join(',') || 'hard',
    'enhance',
    look.enhanceStyle,
    'color',
    look.colorGrade,
    'td',
    look.transitionSec,
    'kenBurns',
    kenBurns,
    'overlayMoments',
    overlayMode,
    overlayByScene.size ? `n=${overlayByScene.size}` : 'none',
    'effects',
    eofVideoEffectIds(videoEffects).join(',') || 'none',
    'stickers',
    eofStickerIds(stickers).join(',') || 'none',
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
  const clipPaths = await mapWithConcurrency(sorted, CLIP_CONCURRENCY, async (scene) => {
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
      })
    } catch (e) {
      console.warn(
        '[eof-video] xfade failed, falling back to hard cuts',
        e instanceof Error ? e.message : e,
      )
      // Re-encode without pad for clean concat lengths
      const plainClips = []
      for (let i = 0; i < sorted.length; i += 1) {
        plainClips.push(
          await encodeSceneClip({
            scene: sorted[i],
            workDir,
            captionFont,
            captionStyle: style,
            captionLayout,
            burnCaptions,
            lookFilters,
            effectFilters,
            kenBurns,
            encodeDurationSec: contentDurs[i],
            overlayMoment: overlayByScene.get(sorted[i].index) || null,
            stickers,
          }),
        )
      }
      hasAudio = await stitchWithConcat({
        clipPaths: plainClips,
        mixedAudioPath: audioForMux,
        out,
      })
    }
  } else {
    hasAudio = await stitchWithConcat({
      clipPaths: orderedClips,
      mixedAudioPath: audioForMux,
      out,
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
