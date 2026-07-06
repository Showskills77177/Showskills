import { randomUUID } from 'node:crypto'
import { query } from './db.mjs'
import { ensureEofYoutubeSchema } from './ensureEofYoutubeSchema.mjs'
import {
  fetchYoutubeVideo,
  publishYoutubeVideoNow,
  scheduleYoutubeVideo,
} from './youtubeUpload.mjs'

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
  }
}

export async function listEofProjects() {
  await ensureEofYoutubeSchema()
  const { rows } = await query(
    `SELECT * FROM eof_youtube_projects ORDER BY created_at DESC LIMIT 100`,
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
}) {
  await ensureEofYoutubeSchema()
  const id = randomUUID()
  const status = EOF_STATUS.UPLOADING
  await query(
    `INSERT INTO eof_youtube_projects
      (id, title, description, upload_source, status, submitted_by, scheduled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, title, description || '', uploadSource, status, submittedBy, scheduledAt],
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

export async function completeEofUpload({
  projectId,
  youtubeVideoId,
  uploadSource,
  scheduledAt,
}) {
  const video = await fetchYoutubeVideo(youtubeVideoId)
  if (!video) {
    throw new Error('Video not found on YouTube after upload')
  }

  let status = EOF_STATUS.PUBLISHED
  let publishedAt = null
  const now = new Date()

  if (uploadSource === EOF_UPLOAD_SOURCE.EDITOR) {
    status = EOF_STATUS.PENDING
  } else if (scheduledAt && new Date(scheduledAt) > now) {
    status = EOF_STATUS.SCHEDULED
  } else {
    status = EOF_STATUS.PUBLISHED
    publishedAt = now.toISOString()
  }

  await query(
    `UPDATE eof_youtube_projects
     SET status = $2,
         youtube_video_id = $3,
         published_at = $4,
         error_message = NULL,
         updated_at = now()
     WHERE id = $1`,
    [projectId, status, youtubeVideoId, publishedAt],
  )
  return getEofProject(projectId)
}

export async function approveEofProject(projectId, { scheduleAt = null, publishNow = false }) {
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
    await publishYoutubeVideoNow(project.youtubeVideoId)
    await query(
      `UPDATE eof_youtube_projects
       SET status = $2, published_at = $3, scheduled_at = NULL, updated_at = now()
       WHERE id = $1`,
      [projectId, EOF_STATUS.PUBLISHED, now.toISOString()],
    )
  } else if (scheduleAt && new Date(scheduleAt) > now) {
    await scheduleYoutubeVideo(project.youtubeVideoId, scheduleAt)
    await query(
      `UPDATE eof_youtube_projects
       SET status = $2, scheduled_at = $3, updated_at = now()
       WHERE id = $1`,
      [projectId, EOF_STATUS.SCHEDULED, scheduleAt],
    )
  } else {
    throw new Error('Choose publish now or a future schedule time')
  }
  return getEofProject(projectId)
}

/** Sync scheduled rows whose publish time has passed (YouTube publishes automatically). */
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
      if (privacy === 'public') {
        await query(
          `UPDATE eof_youtube_projects
           SET status = $2, published_at = now(), updated_at = now()
           WHERE id = $1`,
          [row.id, EOF_STATUS.PUBLISHED],
        )
        updated += 1
      }
    } catch {
      /* skip single row */
    }
  }
  return updated
}
