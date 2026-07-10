/**
 * Durable EOF render artifacts (audio / video / scene stills) stored in the DB.
 * Vercel serverless uses ephemeral /tmp — files vanish across instances.
 * Small Shorts (~0.5MB) fit in Postgres TEXT as base64.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { query, dbIsPostgres } from './db.mjs'
import { ensureEofProductionSchema } from './ensureEofProductionSchema.mjs'
import { eofProductionWorkDir } from './eofSceneTts.mjs'
import { eofProductionVideoAbsPath } from './eofProductionVideo.mjs'
import { eofSceneImageAbsPath } from './eofSceneImages.mjs'

/** ~8MB base64 (~6MB binary) — hard stop so we never bloat the DB. */
const MAX_ARTIFACT_BASE64_CHARS = 8_000_000
/** Scene stills pack — allow a bit more for 5 JPGs. */
const MAX_SCENE_IMAGES_JSON_CHARS = 12_000_000

export async function saveEofMixedAudioArtifact(jobId, absPath) {
  return saveArtifactColumn(jobId, 'mixed_audio_base64', absPath)
}

export async function saveEofVideoArtifact(jobId, absPath) {
  return saveArtifactColumn(jobId, 'video_base64', absPath)
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
