/**
 * Durable EOF render artifacts (audio / video) stored in the DB.
 * Vercel serverless uses ephemeral /tmp — files vanish across instances.
 * Small Shorts (~0.5MB) fit in Postgres TEXT as base64.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { query, dbIsPostgres } from './db.mjs'
import { ensureEofProductionSchema } from './ensureEofProductionSchema.mjs'
import { eofProductionWorkDir } from './eofSceneTts.mjs'
import { eofProductionVideoAbsPath } from './eofProductionVideo.mjs'

/** ~8MB base64 (~6MB binary) — hard stop so we never bloat the DB. */
const MAX_ARTIFACT_BASE64_CHARS = 8_000_000

export async function saveEofMixedAudioArtifact(jobId, absPath) {
  return saveArtifactColumn(jobId, 'mixed_audio_base64', absPath)
}

export async function saveEofVideoArtifact(jobId, absPath) {
  return saveArtifactColumn(jobId, 'video_base64', absPath)
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

/** Optional: clear blobs when re-rendering (frees DB space). */
export async function clearEofVideoArtifact(jobId) {
  await ensureEofProductionSchema()
  await query(
    `UPDATE eof_production_jobs SET video_base64 = NULL, updated_at = ${dbIsPostgres() ? 'now()' : `datetime('now')`} WHERE id = $1`,
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
       CASE WHEN video_base64 IS NOT NULL AND length(video_base64) > 0 THEN 1 ELSE 0 END AS has_video
     FROM eof_production_jobs WHERE id = $1`,
    [jobId],
  )
  const row = rows[0]
  return {
    hasDurableAudio: Boolean(row?.has_audio),
    hasDurableVideo: Boolean(row?.has_video),
  }
}
