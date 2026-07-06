import { json } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import {
  requireEofSession,
  eofSessionInfo,
  isEofEditorLoginConfigured,
} from '../lib/eofYoutubeAuth.mjs'
import {
  EYES_OF_FOOTBALL_PRODUCT_NAME,
  YOUTUBE_SETUP_STEPS,
} from '../../../shared/eyesOfFootball.mjs'
import { youtubeSetupStatusForAdmin } from '../lib/youtubeConfig.mjs'
import { listEofProjects, syncDueScheduledProjects } from '../lib/eofYoutubeProjects.mjs'

/** GET /api/admin/eyes-of-football — staging-only YouTube hub + project queue. */
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
  try {
    await syncDueScheduledProjects()
    projects = await listEofProjects()
  } catch (e) {
    console.error('[eyes-of-football] projects', e)
  }

  return json(res, 200, {
    product: EYES_OF_FOOTBALL_PRODUCT_NAME,
    staging: true,
    youtube,
    setupSteps: YOUTUBE_SETUP_STEPS,
    session: sessionInfo,
    editorLoginConfigured: isEofEditorLoginConfigured(),
    projects,
    oauthConnectAvailable: youtube.hasOAuthClient && !youtube.hasRefreshToken,
  })
}
