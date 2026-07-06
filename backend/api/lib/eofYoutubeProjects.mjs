import { randomUUID } from 'node:crypto'
import { query } from './db.mjs'
import { ensureEofYoutubeSchema } from './ensureEofYoutubeSchema.mjs'
import {
  fetchYoutubeVideo,
  publishYoutubeVideoNow,
  scheduleYoutubeVideo,
  setYoutubeVisibility,
  uploadYoutubeThumbnail,
  youtubeVideoToSummary,
} from './youtubeUpload.mjs'
import { readYoutubeConfig } from './youtubeConfig.mjs'

export const EOF_STATUS = {
  UPLOADING: 'uploading',
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  FAILED: 'failed',
}

export const EOF_UPLOAD_SOURCE = {
  EDITOR: 'editor',
  ADMIN: 'admin',
}

function parseTagsJson(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

function parseChecksJson(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function rowToProject(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    uploadSource: row.upload_source,
    status: row.status,
    submittedBy: row.submitted_by,
    scheduledAt: row.scheduled_at || null,
    publishedAt: row.published_at || null,
    youtubeVideoId: row.youtube_video_id || null,
    errorMessage: row.error_message || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contentType: row.content_type || 'short',
    tags: parseTagsJson(row.tags_json),
    visibility: row.visibility || 'private',
    madeForKids: Boolean(row.made_for_kids),
    categoryId: row.category_id || '17',
    channelId: row.channel_id || null,
    fileSizeBytes: row.file_size_bytes ?? null,
    durationSeconds: row.duration_seconds ?? null,
    containsSyntheticMedia: Boolean(row.contains_synthetic_media),
    paidPromotion: Boolean(row.paid_promotion),
    relatedVideoId: row.related_video_id || null,
    viewCount: row.view_count ?? 0,
    processingStatus: row.processing_status || null,
    checks: parseChecksJson(row.checks_json),
    thumbnailUploaded: Boolean(row.thumbnail_uploaded),
  }
}

export async function listEofProjects() {
  await ensureEofYoutubeSchema()
  const { rows } = await query(
    `SELECT * FROM eof_youtube_projects ORDER BY created_at DESC LIMIT 200`,
  )
  return rows.map(rowToProject)
}

export async function getEofProject(id) {
  await ensureEofYoutubeSchema()
  const { rows } = await query(`SELECT * FROM eof_youtube_projects WHERE id = $1`, [id])
  return rowToProject(rows[0])
}

export async function createEofProject({
  title,
  description,
  uploadSource,
  submittedBy,
  scheduledAt = null,
  contentType = 'short',
  tags = [],
  visibility = 'private',
  madeForKids = false,
  categoryId = '17',
  channelId = null,
  fileSizeBytes = null,
  durationSeconds = null,
  containsSyntheticMedia = false,
  paidPromotion = false,
  relatedVideoId = null,
}) {
  await ensureEofYoutubeSchema()
  const id = randomUUID()
  const cfg = readYoutubeConfig()
  await query(
    `INSERT INTO eof_youtube_projects
      (id, title, description, upload_source, status, submitted_by, scheduled_at,
       content_type, tags_json, visibility, made_for_kids, category_id, channel_id,
       file_size_bytes, duration_seconds, contains_synthetic_media, paid_promotion, related_video_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      id,
      title,
      description || '',
      uploadSource,
      EOF_STATUS.UPLOADING,
      submittedBy,
      scheduledAt,
      contentType,
      JSON.stringify(tags),
      visibility,
      madeForKids ? 1 : 0,
      categoryId,
      channelId || cfg.channelId || null,
      fileSizeBytes,
      durationSeconds,
      containsSyntheticMedia ? 1 : 0,
      paidPromotion ? 1 : 0,
      relatedVideoId,
    ],
  )
  return getEofProject(id)
}

export async function markEofProjectFailed(id, message) {
  await query(
    `UPDATE eof_youtube_projects
     SET status = $2, error_message = $3, updated_at = now()
     WHERE id = $1`,
    [id, EOF_STATUS.FAILED, String(message || 'Upload failed').slice(0, 500)],
  )
  return getEofProject(id)
}

async function syncProjectFromYoutube(projectId, video) {
  const summary = youtubeVideoToSummary(video)
  if (!summary) return
  await query(
    `UPDATE eof_youtube_projects
     SET view_count = $2,
         processing_status = $3,
         checks_json = $4,
         duration_seconds = COALESCE($5, duration_seconds),
         file_size_bytes = COALESCE($6, file_size_bytes),
         channel_id = COALESCE($7, channel_id),
         updated_at = now()
     WHERE id = $1`,
    [
      projectId,
      summary.viewCount,
      summary.checks.processingStatus,
      JSON.stringify(summary.checks),
      summary.durationSeconds,
      summary.fileSizeBytes,
      summary.channelId,
    ],
  )
}

export async function completeEofUpload({
  projectId,
  youtubeVideoId,
  uploadSource,
  scheduledAt,
  visibility,
  thumbnailBase64 = null,
}) {
  const project = await getEofProject(projectId)
  if (!project) throw new Error('Project not found')

  if (thumbnailBase64 && project.contentType === 'long') {
    try {
      const buf = Buffer.from(thumbnailBase64, 'base64')
      if (buf.length > 0) {
        await uploadYoutubeThumbnail(youtubeVideoId, buf, 'image/jpeg')
        await query(
          `UPDATE eof_youtube_projects SET thumbnail_uploaded = 1 WHERE id = $1`,
          [projectId],
        )
      }
    } catch (e) {
      console.error('[eof] thumbnail', e)
    }
  }

  const video = await fetchYoutubeVideo(youtubeVideoId)
  if (!video) {
    throw new Error('Video not found on YouTube after upload')
  }

  let status = EOF_STATUS.PUBLISHED
  let publishedAt = null
  const now = new Date()
  const vis = visibility || project.visibility || 'private'

  if (uploadSource === EOF_UPLOAD_SOURCE.EDITOR) {
    status = EOF_STATUS.PENDING
    publishedAt = null
  } else if (scheduledAt && new Date(scheduledAt) > now) {
    status = EOF_STATUS.SCHEDULED
    publishedAt = null
  } else {
    status = EOF_STATUS.PUBLISHED
    publishedAt = vis === 'private' ? null : now.toISOString()
  }

  await query(
    `UPDATE eof_youtube_projects
     SET status = $2,
         youtube_video_id = $3,
         published_at = $4,
         visibility = $5,
         error_message = NULL,
         updated_at = now()
     WHERE id = $1`,
    [projectId, status, youtubeVideoId, publishedAt, vis],
  )

  await syncProjectFromYoutube(projectId, video)
  return getEofProject(projectId)
}

export async function approveEofProject(projectId, { scheduleAt = null, publishNow = false, visibility = 'public' }) {
  const project = await getEofProject(projectId)
  if (!project) throw new Error('Project not found')
  if (project.status !== EOF_STATUS.PENDING) {
    throw new Error('Only pending editor projects can be approved')
  }
  if (!project.youtubeVideoId) {
    throw new Error('Project has no YouTube video yet')
  }

  const now = new Date()
  if (publishNow) {
    await setYoutubeVisibility(project.youtubeVideoId, visibility === 'unlisted' ? 'unlisted' : 'public')
    await query(
      `UPDATE eof_youtube_projects
       SET status = $2, published_at = $3, scheduled_at = NULL, visibility = $4, updated_at = now()
       WHERE id = $1`,
      [projectId, EOF_STATUS.PUBLISHED, now.toISOString(), visibility],
    )
  } else if (scheduleAt && new Date(scheduleAt) > now) {
    await scheduleYoutubeVideo(project.youtubeVideoId, scheduleAt)
    await query(
      `UPDATE eof_youtube_projects
       SET status = $2, scheduled_at = $3, visibility = $4, updated_at = now()
       WHERE id = $1`,
      [projectId, EOF_STATUS.SCHEDULED, scheduleAt, visibility],
    )
  } else {
    throw new Error('Choose publish now or a future schedule time')
  }

  const video = await fetchYoutubeVideo(project.youtubeVideoId)
  if (video) await syncProjectFromYoutube(projectId, video)
  return getEofProject(projectId)
}

/** Refresh live YouTube stats + upload checks for one project. */
export async function refreshEofProjectFromYoutube(projectId) {
  const project = await getEofProject(projectId)
  if (!project?.youtubeVideoId) throw new Error('No YouTube video on this project')
  const video = await fetchYoutubeVideo(project.youtubeVideoId)
  if (!video) throw new Error('Video not found on YouTube')
  await syncProjectFromYoutube(projectId, video)
  const summary = youtubeVideoToSummary(video)
  return { project: await getEofProject(projectId), youtube: summary }
}

export async function syncDueScheduledProjects() {
  await ensureEofYoutubeSchema()
  const { rows } = await query(
    `SELECT * FROM eof_youtube_projects
     WHERE status = $1 AND scheduled_at IS NOT NULL AND scheduled_at <= now()`,
    [EOF_STATUS.SCHEDULED],
  )
  let updated = 0
  for (const row of rows) {
    try {
      const video = await fetchYoutubeVideo(row.youtube_video_id)
      const privacy = video?.status?.privacyStatus
      if (privacy === 'public' || privacy === 'unlisted') {
        await query(
          `UPDATE eof_youtube_projects
           SET status = $2, published_at = now(), updated_at = now()
           WHERE id = $1`,
          [row.id, EOF_STATUS.PUBLISHED],
        )
        if (video) await syncProjectFromYoutube(row.id, video)
        updated += 1
      }
    } catch {
      /* skip */
    }
  }
  return updated
}

export function buildCalendarFromProjects(projects) {
  /** @type {Record<string, typeof projects>} */
  const byDay = {}
  for (const p of projects) {
    const key =
      (p.scheduledAt && p.scheduledAt.slice(0, 10)) ||
      (p.publishedAt && p.publishedAt.slice(0, 10)) ||
      (p.createdAt && String(p.createdAt).slice(0, 10))
    if (!key) continue
    if (!byDay[key]) byDay[key] = []
    byDay[key].push(p)
  }
  return byDay
}
