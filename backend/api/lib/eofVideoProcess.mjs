/**
 * Final processing step for a real-footage scene clip: crop to 9:16, cut to
 * the matched time window, speed-adjust to hit the scene's exact target
 * duration, and burn captions — producing a finished, standalone MP4 that
 * can be substituted directly into the stitch step's clipPaths array.
 * Reuses the same crop-math and caption-burn helpers the image pipeline uses
 * so video-sourced scenes look identical in framing/typography to stills.
 */
import { runFfmpeg } from './eofFfmpeg.mjs'
import { buildEofSceneScaleCropFilters, EOF_SCENE_FRAME_W, EOF_SCENE_FRAME_H } from '../../../shared/eofSceneCrop.mjs'
import { buildSceneCaptionFilters, resolveCaptionFont } from './eofProductionVideo.mjs'

const VIDEO_FPS = Number(process.env.EOF_VIDEO_FPS) || 24
const VIDEO_PRESET = process.env.EOF_VIDEO_PRESET || 'ultrafast'
const VIDEO_CRF = process.env.EOF_VIDEO_CRF || '28'

/**
 * @param {{
 *   inputPath: string,
 *   startSec: number,
 *   endSec: number,
 *   targetDurationSec: number,
 *   outPath: string,
 *   caption?: string,
 *   captionStyle?: string,
 *   captionLayout?: object,
 *   textDir?: string,
 *   burnCaptions?: boolean,
 *   sourceWidth?: number,
 *   sourceHeight?: number,
 * }} opts
 */
export async function processEofVideoSceneClip({
  inputPath,
  startSec,
  endSec,
  targetDurationSec,
  outPath,
  caption = '',
  captionStyle,
  captionLayout,
  textDir,
  burnCaptions = true,
  sourceWidth = 0,
  sourceHeight = 0,
}) {
  const clipDur = Math.max(0.2, Number(endSec) - Number(startSec))
  const targetDur = Math.max(0.5, Number(targetDurationSec) || clipDur)
  const speedFactor = clipDur / targetDur // >1 = speed up, <1 = slow down

  const { filters: cropFilters } = buildEofSceneScaleCropFilters({
    width: sourceWidth,
    height: sourceHeight,
    frameW: EOF_SCENE_FRAME_W,
    frameH: EOF_SCENE_FRAME_H,
  })

  let chain = cropFilters.join(',')
  // setpts stretches/compresses time so the cut window exactly fills the scene's duration.
  chain += `,setpts=PTS/${speedFactor.toFixed(4)}`
  chain += `,fps=${VIDEO_FPS}`

  const captionFont = burnCaptions ? resolveCaptionFont() : null
  if (captionFont && caption) {
    const captionFilters = buildSceneCaptionFilters({
      caption,
      durationSec: targetDur,
      captionFont,
      captionStyle,
      captionLayout,
      burnCaptions: true,
      textDir,
    })
    if (captionFilters.length) chain = `${chain},${captionFilters.join(',')}`
  }

  const args = [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-ss', String(Math.max(0, startSec)),
    '-t', String(clipDur),
    '-i', inputPath,
    '-vf', chain,
    '-an',
    '-c:v', 'libx264',
    '-preset', VIDEO_PRESET,
    '-crf', VIDEO_CRF,
    '-pix_fmt', 'yuv420p',
    '-r', String(VIDEO_FPS),
    '-t', String(targetDur),
    '-movflags', '+faststart',
    outPath,
  ]

  await runFfmpeg(args, { timeoutMs: 60_000 })
  return outPath
}
