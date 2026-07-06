import { json, readJsonBody } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofSession, requireEofOwner, eofSessionInfo } from '../lib/eofYoutubeAuth.mjs'
import { readYoutubeConfig } from '../lib/youtubeConfig.mjs'
import { initYoutubeResumableUpload } from '../lib/youtubeUpload.mjs'
import {
  createEofProject,
  completeEofUpload,
  markEofProjectFailed,
  approveEofProject,
  EOF_UPLOAD_SOURCE,
} from '../lib/eofYoutubeProjects.mjs'

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

/** POST /api/admin/eof-upload-init — start resumable YouTube upload + DB project. */
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

  if (!title || title.length < 3) {
    return json(res, 400, { error: 'Title is required (min 3 characters).' })
  }

  const info = eofSessionInfo(session)

  if (uploadSource === EOF_UPLOAD_SOURCE.ADMIN) {
    try {
      await requireEofOwner(req)
    } catch (e) {
      return json(res, 403, {
        error: 'Admin upload is only available when signed in as the channel owner (ADMIN_USER).',
      })
    }
  }

  const submittedBy = info.username || 'unknown'
  let privacyStatus = 'private'
  let publishAt = null

  if (uploadSource === EOF_UPLOAD_SOURCE.ADMIN) {
    if (scheduledAt && isFuture(scheduledAt)) {
      privacyStatus = 'private'
      publishAt = scheduledAt
    } else {
      privacyStatus = 'public'
    }
  }

  let project = null
  try {
    project = await createEofProject({
      title,
      description,
      uploadSource,
      submittedBy,
      scheduledAt: uploadSource === EOF_UPLOAD_SOURCE.ADMIN && isFuture(scheduledAt) ? scheduledAt : null,
    })

    const { uploadUrl } = await initYoutubeResumableUpload({
      title,
      description,
      privacyStatus,
      publishAt,
      contentType,
    })

    return json(res, 200, {
      projectId: project.id,
      uploadUrl,
      uploadSource,
      privacyStatus,
      scheduledAt: project.scheduledAt,
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
