import { existsSync, mkdirSync } from 'node:fs'
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
  isLocalCaptionStyle,
  isZapcapCaptionStyle,
} from '../../../shared/eofCaptionStyles.mjs'
import {
  autoTuneVideoLook,
  buildXfadeFilterComplex,
  colorGradeFilterChain,
  resolveEofColorGrade,
  resolveEofTransitionStyle,
} from '../../../shared/eofVideoLook.mjs'
import { burnZapcapCaptions } from './eofZapcapCaptions.mjs'
import { applyEofWatermark } from './eofWatermark.mjs'

const BUNDLED_CAPTION_FONT = join(
  dirname(fileURLToPath(import.meta.url)),
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
 * - free: iteration (Build/Rebuild/voiceover) — local live preview, never ZapCap
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
  if (forceFreeCaptions) style = 'live'
  else if (zapcapOnly) style = 'off'

  let engine = 'none'
  if (zapcapOnly) {
    engine = 'zapcap'
  } else if (!captionsEnabledForStyle(style)) {
    engine = 'none'
  } else if (isLocalCaptionStyle(style)) {
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
 * Local caption burn: live = bottom bar; CapCut styles = mid vignette (escape hatch only).
 * Color grade sits after crop so every stock still matches the CapCut pack look.
 */
function buildSceneVideoFilter({
  frames,
  caption,
  durationSec,
  captionFont,
  captionStyle,
  burnCaptions,
  colorFilters = [],
  kenBurns = false,
  textDir,
}) {
  const base = [
    'scale=1080:1920:force_original_aspect_ratio=increase',
    'crop=1080:1920',
  ]

  if (colorFilters?.length) {
    base.push(...colorFilters)
  }

  if (kenBurns) {
    base.push(`zoompan=z='min(zoom+0.0018,1.28)':d=${frames}:s=1080x1920:fps=${VIDEO_FPS}`)
  } else {
    base.push(`fps=${VIDEO_FPS}`)
  }

  if (burnCaptions) {
    const live = isLocalCaptionStyle(captionStyle)
    if (live) {
      base.push('drawbox=x=0:y=ih*0.74:w=iw:h=ih*0.14:color=black@0.45:t=fill')
    } else {
      base.push('drawbox=x=0:y=ih*0.42:w=iw:h=ih*0.28:color=black@0.28:t=fill')
    }
    if (captionFont) {
      base.push(
        ...buildCaptionDrawtextFilters({
          caption,
          durationSec,
          captionFont,
          style: captionStyle,
          textDir,
        }),
      )
    }
  }

  return base.join(',')
}

async function encodeSceneClip({
  scene,
  workDir,
  captionFont,
  captionStyle,
  burnCaptions,
  colorFilters,
  kenBurns,
  encodeDurationSec,
}) {
  const contentDur = Math.max(2, Number(scene.durationSec) || 3)
  const dur = Math.max(contentDur, Number(encodeDurationSec) || contentDur)
  const frames = Math.max(1, Math.ceil(dur * VIDEO_FPS))
  const clipPath = join(workDir, `clip-${scene.index + 1}.mp4`)
  const caption = String(scene.caption || '').trim().slice(0, 140) || `Scene ${scene.index + 1}`
  const textDir = join(workDir, `caption-text-${scene.index + 1}`)
  mkdirSync(textDir, { recursive: true })

  const vf = buildSceneVideoFilter({
    frames,
    caption,
    durationSec: contentDur,
    captionFont,
    captionStyle,
    burnCaptions,
    colorFilters,
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
 *   zapcapTemplateId?: string | null,
 *   transitionStyle?: string,
 *   colorGrade?: string,
 *   format?: string,
 *   captionMode?: 'auto' | 'free' | 'zapcap-only',
 *   onSceneProgress?: (index: number, total: number) => Promise<void> | void,
 * }} opts
 */
export async function renderEofProductionVideo({
  jobId,
  scenes,
  mixedAudioPath = null,
  outputPath,
  captionStyle,
  zapcapTemplateId: preferredZapcapTemplateId,
  transitionStyle,
  colorGrade,
  format,
  captionMode = 'auto',
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
    sceneCount: sorted.length,
  })
  const colorFilters = colorGradeFilterChain(look.colorGrade)
  const useXfade = look.perCutTransitions.length > 0 && sorted.length > 1
  const kenBurns = Boolean(look.kenBurns) || process.env.EOF_VIDEO_KEN_BURNS === '1'

  console.info(
    '[eof-video] look',
    'transition',
    look.transitionStyle,
    'cuts',
    look.perCutTransitions.join(',') || 'hard',
    'color',
    look.colorGrade,
    'td',
    look.transitionSec,
    'kenBurns',
    kenBurns,
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
  } else if (style === 'live') {
    console.info(
      '[eof-video] live bottom subtitles (free)',
      forceFreeCaptions ? `(previewing ZapCap template ${preferredZapcapTemplateId || 'n/a'} without billing)` : '',
    )
  } else if (engine === 'none') {
    console.warn(
      '[eof-video] No ZapCap key — pick Live subs (free) or set ZAPCAP_API_KEY for CapCut-class burn.',
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
    const clipPath = await encodeSceneClip({
      scene,
      workDir,
      captionFont,
      captionStyle: style,
      burnCaptions,
      colorFilters,
      kenBurns,
      encodeDurationSec: encodeDurs[i] ?? contentDurs[i],
    })
    clipsDone += 1
    if (onSceneProgress) await onSceneProgress(clipsDone, sorted.length)
    return { index: scene.index, clipPath }
  })

  clipPaths.sort((a, b) => a.index - b.index)
  const orderedClips = clipPaths.map((c) => c.clipPath)

  const targetDurationSec = contentDurs.reduce((a, b) => a + b, 0)
  let hasAudio
  if (graph) {
    try {
      hasAudio = await stitchWithXfade({
        clipPaths: orderedClips,
        mixedAudioPath,
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
            burnCaptions,
            colorFilters,
            kenBurns,
            encodeDurationSec: contentDurs[i],
          }),
        )
      }
      hasAudio = await stitchWithConcat({ clipPaths: plainClips, mixedAudioPath, out })
    }
  } else {
    hasAudio = await stitchWithConcat({ clipPaths: orderedClips, mixedAudioPath, out })
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
      perCutTransitions: look.perCutTransitions,
      transitionSec: look.transitionSec,
      kenBurns,
      xfade: Boolean(graph),
    },
  }
}
