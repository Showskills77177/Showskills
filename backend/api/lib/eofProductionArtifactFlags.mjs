/**
 * Lightweight durable-artifact flags for EOF Production list/detail.
 * Kept separate from eofProductionArtifacts.mjs so hub GET does not import
 * ffmpeg / video remux code (Vercel FUNCTION_INVOCATION_FAILED risk).
 */
import { query, dbIsPostgres } from './db.mjs'
import { ensureEofProductionSchema } from './ensureEofProductionSchema.mjs'

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

/**
 * Attach durable-artifact flags to job payloads (list/detail) without loading base64 blobs.
 * @param {Array<object>} jobs
 */
export async function withEofArtifactFlags(jobs) {
  if (!Array.isArray(jobs) || !jobs.length) return jobs || []
  await ensureEofProductionSchema()
  const ids = jobs.map((j) => j?.id).filter(Boolean)
  if (!ids.length) return jobs
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
  const { rows } = await query(
    `SELECT
       id,
       CASE WHEN mixed_audio_base64 IS NOT NULL AND length(mixed_audio_base64) > 0 THEN 1 ELSE 0 END AS has_audio,
       CASE WHEN video_base64 IS NOT NULL AND length(video_base64) > 0 THEN 1 ELSE 0 END AS has_video,
       CASE WHEN scene_images_base64_json IS NOT NULL AND length(scene_images_base64_json) > 0 THEN 1 ELSE 0 END AS has_scenes
     FROM eof_production_jobs WHERE id IN (${placeholders})`,
    ids,
  )
  const byId = new Map(
    rows.map((row) => [
      row.id,
      {
        hasDurableAudio: Boolean(row.has_audio),
        hasDurableVideo: Boolean(row.has_video),
        hasDurableSceneImages: Boolean(row.has_scenes),
      },
    ]),
  )
  return jobs.map((job) => {
    const flags = byId.get(job.id) || {
      hasDurableAudio: false,
      hasDurableVideo: false,
      hasDurableSceneImages: false,
    }
    return { ...job, ...flags }
  })
}
