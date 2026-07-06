import { json } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import {
  requireEofSession,
  eofSessionInfo,
  isEofEditorLoginConfigured,
} from '../lib/eofYoutubeAuth.mjs'
import { EYES_OF_FOOTBALL_PRODUCT_NAME, YOUTUBE_SETUP_STEPS } from '../../../shared/eyesOfFootball.mjs'
import { youtubeSetupStatusForAdmin } from '../lib/youtubeConfig.mjs'
import {
  listEofProjects,
  syncDueScheduledProjects,
  buildCalendarFromProjects,
} from '../lib/eofYoutubeProjects.mjs'
import { fetchYoutubeChannelForAdmin } from '../lib/youtubeChannel.mjs'
import { fetchChannelAnalyticsSummary, fetchVideoViewCounts } from '../lib/youtubeAnalytics.mjs'

/** GET /api/admin/eyes-of-football */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!isShowSkillsStagingServerEnabled()) {
    return json(res, 404, { error: 'Eyes Of Football admin is only available on staging.' })
  }

  let session
  try {
    session = await requireEofSession(req)
  } catch {
    return json(res, 401, { error: 'Unauthorized' })
  }

  const youtube = youtubeSetupStatusForAdmin()
  const sessionInfo = eofSessionInfo(session)

  let projects = []
  let channel = null
  let analytics = null

  try {
    await syncDueScheduledProjects()
    projects = await listEofProjects()
    const videoIds = projects.map((p) => p.youtubeVideoId).filter(Boolean)
    if (videoIds.length && youtube.isReadyToPublish) {
      const views = await fetchVideoViewCounts(videoIds)
      projects = projects.map((p) =>
        p.youtubeVideoId && views[p.youtubeVideoId]
          ? { ...p, viewCount: views[p.youtubeVideoId].viewCount }
          : p,
      )
    }
  } catch (e) {
    console.error('[eyes-of-football] projects', e)
  }

  if (youtube.isReadyToPublish) {
    try {
      channel = await fetchYoutubeChannelForAdmin()
    } catch (e) {
      console.error('[eyes-of-football] channel', e)
    }
    try {
      analytics = await fetchChannelAnalyticsSummary()
    } catch (e) {
      analytics = { available: false, reason: e instanceof Error ? e.message : 'Analytics unavailable' }
    }
  }

  const calendar = buildCalendarFromProjects(projects)

  return json(res, 200, {
    product: EYES_OF_FOOTBALL_PRODUCT_NAME,
    staging: true,
    youtube,
    channel,
    analytics,
    setupSteps: YOUTUBE_SETUP_STEPS,
    session: sessionInfo,
    editorLoginConfigured: isEofEditorLoginConfigured(),
    projects,
    calendar,
    oauthConnectAvailable: youtube.hasOAuthClient && !youtube.hasRefreshToken,
  })
}
