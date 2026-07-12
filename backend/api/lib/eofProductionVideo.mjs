import { existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runFfmpeg } from './eofFfmpeg.mjs'
import { eofProductionJobDirPath } from './eofSceneTts.mjs'
import { mapWithConcurrency } from './eofAsyncPool.mjs'
import { buildCaptionDrawtextFilters } from './eofTikTokCaptions.mjs'
import { resolveEofCaptionStyle, captionsEnabledForStyle } from '../../../shared/eofCaptionStyles.mjs'
import { resolveCaptionEngine, burnZapcapCaptions } from './eofZapcapCaptions.mjs'

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
const USE_KEN_BURNS = process.env.EOF_VIDEO_KEN_BURNS === '1'

function resolveCaptionFont() {
  for (const path of CAPTION_FONT_CANDIDATES) {
    if (path && existsSync(path)) return path
  }
  return null
}

export function eofProductionVideoRelPath(jobId) {
  if (process.env.VERCEL) return `tmp/showskills-eof/jobs/${jobId}/short.mp4`
  return `storage/eof/jobs/${jobId}/short.mp4`
}

export function eofProductionVideoAbsPath(jobId) {
  return join(eofProductionJobDirPath(jobId), 'short.mp4')
}

/**
 * CapCut-class captions via drawtext (or clean plate when ZapCap will burn later).
 */
function buildSceneVideoFilter({ frames, caption, durationSec, captionFont, captionStyle, burnCaptions }) {
  const base = [
    'scale=1080:1920:force_original_aspect_ratio=increase',
    'crop=1080:1920',
  ]

  if (USE_KEN_BURNS) {
    base.push(`zoompan=z='min(zoom+0.0018,1.28)':d=${frames}:s=1080x1920:fps=${VIDEO_FPS}`)
  } else {
    base.push(`fps=${VIDEO_FPS}`)
  }

  if (burnCaptions) {
    // Soft mid vignette — captions sit mid-frame like CapCut / TikTok
    base.push('drawbox=x=0:y=ih*0.42:w=iw:h=ih*0.28:color=black@0.28:t=fill')
    if (captionFont) {
      base.push(
        ...buildCaptionDrawtextFilters({
          caption,
          durationSec,
          captionFont,
          style: captionStyle,
        }),
      )
    }
  }

  return base.join(',')
}

async function encodeSceneClip({ scene, workDir, captionFont, captionStyle, burnCaptions }) {
  const dur = Math.max(2, Number(scene.durationSec) || 3)
  const frames = Math.max(1, Math.ceil(dur * VIDEO_FPS))
  const clipPath = join(workDir, `clip-${scene.index + 1}.mp4`)
  const caption = String(scene.caption || '').trim().slice(0, 140) || `Scene ${scene.index + 1}`

  const vf = buildSceneVideoFilter({
    frames,
    caption,
    durationSec: dur,
    captionFont,
    captionStyle,
    burnCaptions,
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

/**
 * Concatenate scene image clips into a 9:16 Short.
 * Audio is optional — muxed when mixedAudioPath is present.
 * @param {{
 *   jobId: string,
 *   scenes: Array<{ index: number, durationSec: number, caption?: string, imagePath: string }>,
 *   mixedAudioPath?: string | null,
 *   outputPath?: string,
 *   captionStyle?: string,
 *   onSceneProgress?: (index: number, total: number) => Promise<void> | void,
 * }} opts
 */
export async function renderEofProductionVideo({
  jobId,
  scenes,
  mixedAudioPath = null,
  outputPath,
  captionStyle,
  onSceneProgress,
}) {
  const sorted = [...scenes].sort((a, b) => a.index - b.index)
  if (!sorted.length) throw new Error('No scenes to render.')

  const out = outputPath || eofProductionVideoAbsPath(jobId)
  const workDir = dirname(out)
  mkdirSync(workDir, { recursive: true })
  const style = resolveEofCaptionStyle(captionStyle)
  let engine
  if (!captionsEnabledForStyle(style)) {
    engine = 'none'
  } else {
    try {
      engine = resolveCaptionEngine()
    } catch (e) {
      throw e
    }
  }
  // Only burn local drawtext when explicitly requested — never as silent ZapCap fallback.
  const burnCaptions = engine === 'local'
  const captionFont = burnCaptions ? resolveCaptionFont() : null
  if (burnCaptions && !captionFont) {
    console.warn('[eof-video] No caption font found — captions will be missing from the Short.')
  }
  if (style === 'off') {
    console.info('[eof-video] captions off — clean plate')
  } else if (engine === 'none') {
    console.warn(
      '[eof-video] No ZapCap key — rendering clean plate without captions. Set ZAPCAP_API_KEY for CapCut-class burn.',
    )
  }
  console.info('[eof-video] caption style', style, 'engine', engine)

  let clipsDone = 0
  const clipPaths = await mapWithConcurrency(sorted, CLIP_CONCURRENCY, async (scene) => {
    if (!scene.imagePath || !existsSync(scene.imagePath)) {
      throw new Error(`Scene ${scene.index + 1} image is missing.`)
    }
    const clipPath = await encodeSceneClip({
      scene,
      workDir,
      captionFont,
      captionStyle: style,
      burnCaptions,
    })
    clipsDone += 1
    if (onSceneProgress) await onSceneProgress(clipsDone, sorted.length)
    return clipPath
  })

  const listFile = join(workDir, 'video-concat.txt')
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

  if (!existsSync(out)) throw new Error('Video render produced no output file.')

  let captionEngine = burnCaptions ? 'local' : engine === 'zapcap' ? 'pending-zapcap' : 'none'
  let zapcapTemplateId = null
  if (engine === 'zapcap') {
    const z = await burnZapcapCaptions({
      videoPath: out,
      style,
      scenes: sorted.map((s) => ({
        caption: s.caption,
        narration: s.narration || s.caption,
        durationSec: s.durationSec,
      })),
    })
    captionEngine = z.engine
    zapcapTemplateId = z.templateId || null
  }

  return {
    outputPath: out,
    relPath: eofProductionVideoRelPath(jobId),
    hasAudio,
    captionStyle: style,
    captionEngine,
    zapcapTemplateId,
  }
}
