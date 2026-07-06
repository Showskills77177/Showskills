import { json, readJsonBody } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofSession, requireEofOwner } from '../lib/eofYoutubeAuth.mjs'
import {
  completeEofUpload,
  markEofProjectFailed,
  getEofProject,
  approveEofProject,
} from '../lib/eofYoutubeProjects.mjs'

function parseScheduleAt(value) {
  if (!value || typeof value !== 'string') return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** POST /api/admin/eof-upload-complete — after browser PUT to YouTube upload URL. */
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

  try {
    await requireEofSession(req)
  } catch (e) {
    return json(res, e.statusCode || 401, { error: 'Unauthorized' })
  }

  const body = await readJsonBody(req)
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
  const youtubeVideoId = typeof body.youtubeVideoId === 'string' ? body.youtubeVideoId.trim() : ''
  const action = typeof body.action === 'string' ? body.action.trim() : 'complete'

  if (action === 'approve') {
    try {
      await requireEofOwner(req)
    } catch (e) {
      return json(res, 403, { error: 'Only the channel owner can approve projects.' })
    }
    if (!projectId) {
      return json(res, 400, { error: 'projectId is required.' })
    }
    const publishNow = body.publishNow === true
    const scheduleAt = parseScheduleAt(body.scheduledAt)
    try {
      const project = await approveEofProject(projectId, { publishNow, scheduleAt })
      return json(res, 200, { ok: true, project })
    } catch (e) {
      return json(res, 400, { error: e instanceof Error ? e.message : 'Approve failed' })
    }
  }

  if (!projectId || !youtubeVideoId) {
    return json(res, 400, { error: 'projectId and youtubeVideoId are required.' })
  }

  const project = await getEofProject(projectId)
  if (!project) {
    return json(res, 404, { error: 'Project not found.' })
  }

  try {
    const updated = await completeEofUpload({
      projectId,
      youtubeVideoId,
      uploadSource: project.uploadSource,
      scheduledAt: project.scheduledAt,
    })
    return json(res, 200, { ok: true, project: updated })
  } catch (e) {
    await markEofProjectFailed(projectId, e instanceof Error ? e.message : 'Upload complete failed')
    console.error('[eof-upload-complete]', e)
    return json(res, 500, { error: e instanceof Error ? e.message : 'Could not finalize upload' })
  }
}
