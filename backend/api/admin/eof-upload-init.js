import { json, readJsonBody } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofSession, requireEofOwner, eofSessionInfo } from '../lib/eofYoutubeAuth.mjs'
import { readYoutubeConfig } from '../lib/youtubeConfig.mjs'
import { initYoutubeResumableUpload } from '../lib/youtubeUpload.mjs'
import { parseTagsInput } from '../../../shared/eofYoutubeMeta.mjs'
import {
  createEofProject,
  markEofProjectFailed,
  EOF_UPLOAD_SOURCE,
} from '../lib/eofYoutubeProjects.mjs'
import { fetchYoutubeChannelForAdmin } from '../lib/youtubeChannel.mjs'

function parseScheduleAt(value) {
  if (!value || typeof value !== 'string') return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function isFuture(iso) {
  if (!iso) return false
  return new Date(iso) > new Date()
}

function parseVisibility(v, fallback = 'private') {
  if (v === 'public' || v === 'unlisted' || v === 'private') return v
  return fallback
}

/** POST /api/admin/eof-upload-init */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!isShowSkillsStagingServerEnabled()) {
    return json(res, 404, { error: 'Eyes Of Football is only available on staging.' })
  }

  const yt = readYoutubeConfig()
  if (!yt.isReadyToPublish) {
    return json(res, 503, { error: 'YouTube is not connected yet. Connect the channel first.' })
  }

  let session
  try {
    session = await requireEofSession(req)
  } catch (e) {
    return json(res, e.statusCode || 401, { error: 'Unauthorized' })
  }

  const body = await readJsonBody(req)
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const uploadSource =
    body.uploadSource === EOF_UPLOAD_SOURCE.ADMIN ? EOF_UPLOAD_SOURCE.ADMIN : EOF_UPLOAD_SOURCE.EDITOR
  const contentType =
    typeof body.contentType === 'string' && body.contentType.startsWith('video/')
      ? body.contentType
      : 'video/mp4'
  const scheduledAt = parseScheduleAt(body.scheduledAt)
  const videoContentType = body.videoContentType === 'long' ? 'long' : 'short'
  const tags = Array.isArray(body.tags)
    ? body.tags.map(String).slice(0, 30)
    : parseTagsInput(body.tags || '')
  const categoryId = typeof body.categoryId === 'string' ? body.categoryId : '17'
  const madeForKids = body.madeForKids === true
  const containsSyntheticMedia = body.containsSyntheticMedia === true
  const paidPromotion = body.paidPromotion === true
  const relatedVideoId =
    typeof body.relatedVideoId === 'string' ? body.relatedVideoId.trim() : null
  const fileSizeBytes = Number.isFinite(body.fileSizeBytes) ? body.fileSizeBytes : null
  const durationSeconds = Number.isFinite(body.durationSeconds) ? body.durationSeconds : null
  const widthPixels = Number.isFinite(body.widthPixels) ? body.widthPixels : null
  const heightPixels = Number.isFinite(body.heightPixels) ? body.heightPixels : null
  const aspectRatio = Number.isFinite(body.aspectRatio) ? body.aspectRatio : null
  const isVerticalShort = body.isVerticalShort === true
  const license = body.license === 'creativeCommon' ? 'creativeCommon' : 'youtube'
  const defaultLanguage = typeof body.defaultLanguage === 'string' ? body.defaultLanguage.trim() : null
  const recordingDateRaw = typeof body.recordingDate === 'string' ? body.recordingDate.trim() : ''
  const recordingDate = recordingDateRaw
    ? new Date(`${recordingDateRaw}T12:00:00Z`).toISOString()
    : null
  const embeddable = body.embeddable !== false
  const publicStatsViewable = body.publicStatsViewable !== false

  if (!title || title.length < 3) {
    return json(res, 400, { error: 'Title is required (min 3 characters).' })
  }

  const info = eofSessionInfo(session)

  if (uploadSource === EOF_UPLOAD_SOURCE.ADMIN) {
    try {
      await requireEofOwner(req)
    } catch {
      return json(res, 403, {
        error: 'Admin upload is only available when signed in as the channel owner (ADMIN_USER).',
      })
    }
  }

  let visibility = parseVisibility(body.visibility, uploadSource === EOF_UPLOAD_SOURCE.EDITOR ? 'private' : 'public')
  let publishAt = null

  if (uploadSource === EOF_UPLOAD_SOURCE.EDITOR) {
    visibility = 'private'
  } else if (scheduledAt && isFuture(scheduledAt)) {
    visibility = 'private'
    publishAt = scheduledAt
  } else {
    visibility = parseVisibility(body.visibility, 'public')
  }

  let channel = null
  try {
    channel = await fetchYoutubeChannelForAdmin()
  } catch {
    /* optional */
  }

  let project = null
  try {
    project = await createEofProject({
      title,
      description,
      uploadSource,
      submittedBy: info.username || 'unknown',
      scheduledAt: uploadSource === EOF_UPLOAD_SOURCE.ADMIN && isFuture(scheduledAt) ? scheduledAt : null,
      contentType: videoContentType,
      tags,
      visibility,
      madeForKids,
      categoryId,
      channelId: channel?.id || yt.channelId || null,
      fileSizeBytes,
      durationSeconds,
      containsSyntheticMedia,
      paidPromotion,
      relatedVideoId,
      widthPixels,
      heightPixels,
      aspectRatio,
      isVerticalShort,
      license,
      defaultLanguage: defaultLanguage || null,
      recordingDate: recordingDate || null,
      embeddable,
      publicStatsViewable,
    })

    let finalDescription = description
    if (relatedVideoId) {
      finalDescription = `${finalDescription}\n\nRelated: https://www.youtube.com/watch?v=${relatedVideoId}`.trim()
    }

    const { uploadUrl } = await initYoutubeResumableUpload({
      title,
      description: finalDescription,
      tags,
      categoryId,
      privacyStatus: visibility,
      publishAt,
      contentType,
      madeForKids,
      containsSyntheticMedia,
      paidPromotion,
      embeddable,
      publicStatsViewable,
      license,
      defaultLanguage: defaultLanguage || null,
      recordingDate: recordingDate || null,
    })

    return json(res, 200, {
      projectId: project.id,
      uploadUrl,
      uploadSource,
      privacyStatus: visibility,
      scheduledAt: project.scheduledAt,
      channelId: project.channelId,
    })
  } catch (e) {
    if (project?.id) {
      await markEofProjectFailed(project.id, e instanceof Error ? e.message : 'Upload init failed')
    }
    console.error('[eof-upload-init]', e)
    return json(res, 500, {
      error: e instanceof Error ? e.message : 'Could not start YouTube upload',
    })
  }
}
