import { existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { runFfmpeg } from './eofFfmpeg.mjs'
import { eofProductionJobDirPath } from './eofSceneTts.mjs'

const CAPTION_FONT_CANDIDATES = [
  process.env.EOF_CAPTION_FONT,
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
].filter(Boolean)

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
 * @param {{
 *   jobId: string,
 *   scenes: Array<{ index: number, durationSec: number, caption?: string, imagePath: string }>,
 *   mixedAudioPath: string,
 *   outputPath?: string,
 *   onSceneProgress?: (index: number, total: number) => Promise<void> | void,
 * }} opts
 */
export async function renderEofProductionVideo({
  jobId,
  scenes,
  mixedAudioPath,
  outputPath,
  onSceneProgress,
}) {
  if (!existsSync(mixedAudioPath)) throw new Error('Mixed audio missing — render audio first.')
  const sorted = [...scenes].sort((a, b) => a.index - b.index)
  if (!sorted.length) throw new Error('No scenes to render.')

  const out = outputPath || eofProductionVideoAbsPath(jobId)
  const workDir = dirname(out)
  mkdirSync(workDir, { recursive: true })

  const clipPaths = []
  const fps = 30

  for (let i = 0; i < sorted.length; i += 1) {
    const scene = sorted[i]
    if (!scene.imagePath || !existsSync(scene.imagePath)) {
      throw new Error(`Scene ${scene.index + 1} image is missing.`)
    }
    const dur = Math.max(2, Number(scene.durationSec) || 3)
    const frames = Math.max(1, Math.ceil(dur * fps))
    const clipPath = join(workDir, `clip-${scene.index + 1}.mp4`)
    const captionFile = join(workDir, `caption-${scene.index + 1}.txt`)
    const caption = String(scene.caption || '').trim().slice(0, 120)
    await writeFile(captionFile, caption || `Scene ${scene.index + 1}`, 'utf8')

    const captionFont = resolveCaptionFont()
    const vfParts = [
      'scale=1080:1920:force_original_aspect_ratio=increase',
      'crop=1080:1920',
      `zoompan=z='min(zoom+0.0018,1.28)':d=${frames}:s=1080x1920:fps=${fps}`,
    ]
    if (captionFont) {
      const escapedFont = captionFont.replace(/'/g, "'\\''")
      const escapedCaption = captionFile.replace(/'/g, "'\\''")
      vfParts.push(
        `drawtext=fontfile='${escapedFont}':fontcolor=white:fontsize=44:borderw=4:bordercolor=black@0.55:x=(w-text_w)/2:y=h-200:textfile='${escapedCaption}'`,
      )
    }
    const vf = vfParts.join(',')

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
        'veryfast',
        '-pix_fmt',
        'yuv420p',
        '-an',
        clipPath,
      ],
      { maxBuffer: 16 * 1024 * 1024 },
    )
    clipPaths.push(clipPath)
    if (onSceneProgress) await onSceneProgress(i + 1, sorted.length)
  }

  const listFile = join(workDir, 'video-concat.txt')
  const listBody = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  await writeFile(listFile, listBody, 'utf8')

  await runFfmpeg(
    [
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
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  )

  if (!existsSync(out)) throw new Error('Video render produced no output file.')
  return { outputPath: out, relPath: eofProductionVideoRelPath(jobId) }
}
