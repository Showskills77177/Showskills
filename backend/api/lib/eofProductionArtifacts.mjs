/**
 * Durable EOF render artifacts (audio / video / scene stills) stored in the DB.
 * Vercel serverless uses ephemeral /tmp — files vanish across instances.
 * Small Shorts fit in Postgres TEXT as base64 — oversize files must be recompressed
 * or the admin preview returns “Video is not available” on the next instance.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, renameSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { query, dbIsPostgres } from './db.mjs'
import { ensureEofProductionSchema } from './ensureEofProductionSchema.mjs'
import { eofProductionWorkDir } from './eofSceneTts.mjs'
import { eofProductionVideoAbsPath } from './eofProductionVideo.mjs'
import { eofSceneImageAbsPath } from './eofSceneImages.mjs'
import { runFfmpeg } from './eofFfmpeg.mjs'

/** ~12MB base64 (~9MB binary) — Shorts with Oxylabs stills often exceed the old 6MB cap. */
const MAX_ARTIFACT_BASE64_CHARS = 12_000_000
/** Scene stills pack — allow a bit more for 5 JPGs. */
const MAX_SCENE_IMAGES_JSON_CHARS = 12_000_000

/** Max binary size that still fits under MAX_ARTIFACT_BASE64_CHARS (with margin). */
export function eofVideoArtifactMaxBytes() {
  return Math.floor(MAX_ARTIFACT_BASE64_CHARS * 0.75) - 64_000
}

export async function saveEofMixedAudioArtifact(jobId, absPath) {
  return saveArtifactColumn(jobId, 'mixed_audio_base64', absPath)
}

export async function saveEofVideoArtifact(jobId, absPath) {
  return saveArtifactColumn(jobId, 'video_base64', absPath)
}

/**
 * Persist Short MP4; if over the DB cap, recompress in place (higher CRF) then retry.
 * @returns {Promise<{ saved: boolean, bytes: number, recompressed: boolean }>}
 */
export async function persistEofVideoArtifact(jobId, absPath) {
  if (!jobId || !absPath || !existsSync(absPath)) {
    return { saved: false, bytes: 0, recompressed: false }
  }
  let bytes = statSync(absPath).size
  let recompressed = false
  if (await saveEofVideoArtifact(jobId, absPath)) {
    return { saved: true, bytes, recompressed }
  }

  const maxBytes = eofVideoArtifactMaxBytes()
  console.warn(
    `[eof-production] video too large to store (${bytes} bytes) for job ${jobId} — recompressing under ${maxBytes}`,
  )
  const ok = await recompressEofVideoUnderLimit(absPath, maxBytes)
  recompressed = ok
  if (!ok) {
    return { saved: false, bytes: existsSync(absPath) ? statSync(absPath).size : bytes, recompressed }
  }
  bytes = statSync(absPath).size
  const saved = await saveEofVideoArtifact(jobId, absPath)
  return { saved, bytes, recompressed }
}

/**
 * Re-encode MP4 until under maxBytes (or CRF ladder exhausted).
 * @param {string} absPath
 * @param {number} maxBytes
 */
export async function recompressEofVideoUnderLimit(absPath, maxBytes) {
  if (!absPath || !existsSync(absPath)) return false
  if (statSync(absPath).size <= maxBytes) return true

  const tmp = absPath.replace(/\.mp4$/i, '.compact.mp4')
  for (const crf of [32, 35, 38, 42]) {
    try {
      await runFfmpeg(
        [
          '-y',
          '-i',
          absPath,
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          String(crf),
          '-c:a',
          'aac',
          '-b:a',
          '96k',
          '-ac',
          '1',
          '-movflags',
          '+faststart',
          '-pix_fmt',
          'yuv420p',
          tmp,
        ],
        { maxBuffer: 16 * 1024 * 1024 },
      )
    } catch (e) {
      console.warn('[eof-production] recompress failed crf', crf, e instanceof Error ? e.message : e)
      continue
    }
    if (!existsSync(tmp)) continue
    const size = statSync(tmp).size
    if (size <= maxBytes) {
      renameSync(tmp, absPath)
      return true
    }
  }
  try {
    if (existsSync(tmp)) unlinkSync(tmp)
  } catch {
    /* ignore */
  }
  return existsSync(absPath) && statSync(absPath).size <= maxBytes
}

/**
 * Persist scene-1.jpg … scene-N.jpg so admin previews survive cold Vercel instances.
 * @param {string} jobId
 * @param {string} [workDir]
 */
export async function saveEofSceneImagesArtifact(jobId, workDir) {
  if (!jobId) return false
  await ensureEofProductionSchema()
  const dir = workDir || eofProductionWorkDir(jobId)
  const map = {}
  let total = 0
  try {
    for (const name of readdirSync(dir)) {
      const m = /^scene-(\d+)\.jpg$/i.exec(name)
      if (!m) continue
      const abs = join(dir, name)
      const b64 = readFileSync(abs).toString('base64')
      total += b64.length
      if (total > MAX_SCENE_IMAGES_JSON_CHARS) {
        console.warn(`[eof-production] scene images too large to store for job ${jobId}`)
        return false
      }
      map[m[1]] = b64
    }
  } catch (e) {
    console.warn('[eof-production] save scene images failed', jobId, e)
    return false
  }
  if (!Object.keys(map).length) return false
  const payload = JSON.stringify(map)
  await query(
    `UPDATE eof_production_jobs SET scene_images_base64_json = $2, updated_at = ${dbIsPostgres() ? 'now()' : `datetime('now')`} WHERE id = $1`,
    [jobId, payload],
  )
  return true
}

async function saveArtifactColumn(jobId, column, absPath) {
  if (!jobId || !absPath || !existsSync(absPath)) return false
  await ensureEofProductionSchema()
  const buf = readFileSync(absPath)
  const b64 = buf.toString('base64')
  if (b64.length > MAX_ARTIFACT_BASE64_CHARS) {
    console.warn(`[eof-production] ${column} too large to store (${b64.length} chars) for job ${jobId}`)
    return false
  }
  await query(`UPDATE eof_production_jobs SET ${column} = $2, updated_at = ${dbIsPostgres() ? 'now()' : `datetime('now')`} WHERE id = $1`, [
    jobId,
    b64,
  ])
  return true
}

/**
 * @param {string} jobId
 * @returns {Promise<string|null>} absolute path to mixed.mp3 on disk (restored if needed)
 */
export async function ensureEofMixedAudioOnDisk(jobId) {
  const workDir = eofProductionWorkDir(jobId)
  const abs = join(workDir, 'mixed.mp3')
  if (existsSync(abs)) return abs

  await ensureEofProductionSchema()
  const { rows } = await query(`SELECT mixed_audio_base64 FROM eof_production_jobs WHERE id = $1`, [jobId])
  const b64 = rows[0]?.mixed_audio_base64
  if (!b64 || typeof b64 !== 'string') return null

  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, Buffer.from(b64, 'base64'))
  return existsSync(abs) ? abs : null
}

/**
 * @param {string} jobId
 * @returns {Promise<string|null>} absolute path to short.mp4 on disk (restored if needed)
 */
export async function ensureEofVideoOnDisk(jobId) {
  const abs = eofProductionVideoAbsPath(jobId)
  if (existsSync(abs)) return abs

  await ensureEofProductionSchema()
  const { rows } = await query(`SELECT video_base64 FROM eof_production_jobs WHERE id = $1`, [jobId])
  const b64 = rows[0]?.video_base64
  if (!b64 || typeof b64 !== 'string') return null

  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, Buffer.from(b64, 'base64'))
  return existsSync(abs) ? abs : null
}

/**
 * @param {string} jobId
 * @param {number} sceneNumber 1-based
 * @returns {Promise<string|null>}
 */
export async function ensureEofSceneImageOnDisk(jobId, sceneNumber) {
  const n = Math.max(1, Number(sceneNumber) || 1)
  const abs = eofSceneImageAbsPath(eofProductionWorkDir(jobId), n)
  if (existsSync(abs)) return abs

  await ensureEofProductionSchema()
  const { rows } = await query(`SELECT scene_images_base64_json FROM eof_production_jobs WHERE id = $1`, [jobId])
  const raw = rows[0]?.scene_images_base64_json
  if (!raw || typeof raw !== 'string') return null

  let map
  try {
    map = JSON.parse(raw)
  } catch {
    return null
  }
  const b64 = map?.[String(n)] || map?.[n]
  if (!b64 || typeof b64 !== 'string') return null

  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, Buffer.from(b64, 'base64'))
  return existsSync(abs) ? abs : null
}

/** Clear stored MP4 only — keeps scene stills for voice-only remux. */
export async function clearEofVideoOnlyArtifact(jobId) {
  await ensureEofProductionSchema()
  await query(
    `UPDATE eof_production_jobs SET video_base64 = NULL, updated_at = ${dbIsPostgres() ? 'now()' : `datetime('now')`} WHERE id = $1`,
    [jobId],
  )
}

/** Clear video + scene stills (full Short rebuild). */
export async function clearEofVideoArtifact(jobId) {
  await ensureEofProductionSchema()
  await query(
    `UPDATE eof_production_jobs SET video_base64 = NULL, scene_images_base64_json = NULL, updated_at = ${dbIsPostgres() ? 'now()' : `datetime('now')`} WHERE id = $1`,
    [jobId],
  )
}

export async function clearEofMixedAudioArtifact(jobId) {
  await ensureEofProductionSchema()
  await query(
    `UPDATE eof_production_jobs SET mixed_audio_base64 = NULL, updated_at = ${dbIsPostgres() ? 'now()' : `datetime('now')`} WHERE id = $1`,
    [jobId],
  )
}

/** Flags for list/detail UI without shipping megabytes of base64. */
export async function getEofArtifactFlags(jobId) {
  await ensureEofProductionSchema()
  const { rows } = await query(
    `SELECT
       CASE WHEN mixed_audio_base64 IS NOT NULL AND length(mixed_audio_base64) > 0 THEN 1 ELSE 0 END AS has_audio,
       CASE WHEN video_base64 IS NOT NULL AND length(video_base64) > 0 THEN 1 ELSE 0 END AS has_video,
       CASE WHEN scene_images_base64_json IS NOT NULL AND length(scene_images_base64_json) > 0 THEN 1 ELSE 0 END AS has_scenes
     FROM eof_production_jobs WHERE id = $1`,
    [jobId],
  )
  const row = rows[0]
  return {
    hasDurableAudio: Boolean(row?.has_audio),
    hasDurableVideo: Boolean(row?.has_video),
    hasDurableSceneImages: Boolean(row?.has_scenes),
  }
}
