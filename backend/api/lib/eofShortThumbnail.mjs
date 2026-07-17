/**
 * YouTube Shorts custom thumbnail adapter for EOF.
 *
 * 1) Choose the best scene still (hook / studio meta index)
 * 2) Adapt portrait 9:16 → YouTube 1280×720 JPEG (upper-weighted crop)
 * 3) Return path + base64 for Studio / thumbnails.set
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runFfmpeg } from './eofFfmpeg.mjs'
import { getEofProductionJob } from './eofProductionJobs.mjs'
import { ensureEofSceneImageOnDisk } from './eofProductionArtifacts.mjs'
import { fetchEofSceneImage, eofSceneImageAbsPath } from './eofSceneImages.mjs'
import { eofProductionWorkDir } from './eofSceneTts.mjs'
import { composeEofStudioMeta } from './eofStudioMeta.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')

export const EOF_YT_THUMB_WIDTH = 1280
export const EOF_YT_THUMB_HEIGHT = 720

/**
 * Pick 0-based scene index for the Shorts thumbnail.
 * Prefers explicit override → script.thumbnailSceneIndex → studio meta → hook (0).
 */
export function chooseEofThumbnailSceneIndex(job, { preferredIndex, meta } = {}) {
  const sceneCount = Math.max(1, job?.script?.scenes?.length || 1)
  const candidates = [
    preferredIndex,
    meta?.thumbnailSceneIndex,
    job?.script?.thumbnailSceneIndex,
    0,
  ]
  for (const raw of candidates) {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0 && n < sceneCount) return Math.floor(n)
  }
  return 0
}

/**
 * Adapt a scene still into a YouTube custom thumbnail (1280×720 JPEG).
 * Upper-weighted crop so faces/action from vertical Shorts land in frame.
 */
export async function adaptEofShortThumbnail({
  sourcePath,
  outPath,
  title = '',
} = {}) {
  if (!sourcePath || !existsSync(sourcePath)) {
    throw new Error('Thumbnail source image missing')
  }
  mkdirSync(dirname(outPath), { recursive: true })

  const w = EOF_YT_THUMB_WIDTH
  const h = EOF_YT_THUMB_HEIGHT
  const vf = [
    `scale=${w}:${h}:force_original_aspect_ratio=increase`,
    `crop=${w}:${h}:(iw-ow)/2:max(0\\,min((ih-oh)*0.28\\,ih-oh))`,
  ]

  const wantTitle = String(process.env.EOF_THUMBNAIL_TITLE || '').trim() === '1'
  const safeTitle = String(title || '')
    .replace(/[\\:[\]'=,;]/g, ' ')
    .trim()
    .slice(0, 42)
  if (wantTitle && safeTitle) {
    const fontCandidates = [
      process.env.EOF_CAPTION_FONT,
      join(ROOT, 'assets/fonts/EofCaptionBold.ttf'),
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    ].filter(Boolean)
    const font = fontCandidates.find((p) => existsSync(p))
    if (font) {
      const fontEsc = font.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''")
      vf.push(
        `drawtext=fontfile='${fontEsc}':text='${safeTitle}':fontsize=48:fontcolor=white:borderw=4:bordercolor=black@0.85:x=(w-text_w)/2:y=h-h*0.14`,
      )
    }
  }

  await runFfmpeg(
    ['-y', '-i', sourcePath, '-vf', vf.join(','), '-frames:v', '1', '-q:v', '3', outPath],
    { maxBuffer: 16 * 1024 * 1024 },
  )
  if (!existsSync(outPath)) throw new Error('Thumbnail adapt produced no file')
  return outPath
}

async function ensureSceneStill(job, sceneNumber) {
  let imagePath = await ensureEofSceneImageOnDisk(job.id, sceneNumber)
  if (imagePath && existsSync(imagePath)) return imagePath

  const manifest = Array.isArray(job.narrationManifest) ? job.narrationManifest : []
  const entry = manifest.find((row) => Number(row.index) === sceneNumber - 1) || manifest[sceneNumber - 1]
  const imageQuery =
    entry?.imageQueryUsed || entry?.imageQuery || job.script?.scenes?.[sceneNumber - 1]?.imageQuery
  if (!imageQuery) return null

  const outPath = eofSceneImageAbsPath(eofProductionWorkDir(job.id), sceneNumber)
  await fetchEofSceneImage({
    topic: job.topic,
    imageQuery,
    outPath,
    index: sceneNumber - 1,
    refresh: true,
  })
  return existsSync(outPath) ? outPath : null
}

/**
 * Choose + adapt a thumbnail for a production job.
 * @returns {Promise<{ base64: string, sceneIndex: number, path: string, bytes: number, mime: 'image/jpeg' }>}
 */
export async function buildEofShortThumbnailForJob(jobId, { sceneIndex, title, refreshMeta = false } = {}) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  let meta = null
  if (refreshMeta || job.script?.thumbnailSceneIndex == null) {
    try {
      meta = await composeEofStudioMeta({
        topic: job.topic,
        script: job.script,
        format: job.script?.format,
      })
    } catch (e) {
      console.warn('[eof-thumb] studio meta skipped', e instanceof Error ? e.message : e)
    }
  }

  const index = chooseEofThumbnailSceneIndex(job, { preferredIndex: sceneIndex, meta })
  const sceneNumber = index + 1
  const sourcePath = await ensureSceneStill(job, sceneNumber)
  if (!sourcePath) {
    throw new Error(`No scene still for thumbnail (scene ${sceneNumber}). Re-run Build Short.`)
  }

  const workDir = eofProductionWorkDir(jobId)
  const outPath = join(workDir, 'youtube-thumb.jpg')
  const thumbTitle = title || meta?.title || job.script?.title || job.topic || ''
  await adaptEofShortThumbnail({
    sourcePath,
    outPath,
    title: String(thumbTitle).split(/\s+/).slice(0, 6).join(' '),
  })

  const buf = readFileSync(outPath)
  if (buf.length < 8_000) throw new Error('Adapted thumbnail looks empty')
  if (buf.length > 1_900_000) {
    const slim = join(workDir, 'youtube-thumb-slim.jpg')
    await runFfmpeg(['-y', '-i', outPath, '-q:v', '6', '-frames:v', '1', slim], {
      maxBuffer: 16 * 1024 * 1024,
    })
    const slimBuf = readFileSync(slim)
    return {
      base64: slimBuf.toString('base64'),
      sceneIndex: index,
      path: slim,
      bytes: slimBuf.length,
      mime: 'image/jpeg',
      title: thumbTitle,
    }
  }

  return {
    base64: buf.toString('base64'),
    sceneIndex: index,
    path: outPath,
    bytes: buf.length,
    mime: 'image/jpeg',
    title: thumbTitle,
  }
}
