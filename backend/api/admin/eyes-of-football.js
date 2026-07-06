import { requireAdmin } from '../lib/adminAuth.mjs'
import { json } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import {
  EYES_OF_FOOTBALL_PRODUCT_NAME,
  YOUTUBE_SETUP_STEPS,
} from '../../../shared/eyesOfFootball.mjs'
import { youtubeSetupStatusForAdmin } from '../lib/youtubeConfig.mjs'

/** GET /api/admin/eyes-of-football — staging-only YouTube hub setup status. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!isShowSkillsStagingServerEnabled()) {
    return json(res, 404, { error: 'Eyes Of Football admin is only available on staging.' })
  }

  try {
    await requireAdmin(req)
  } catch {
    return json(res, 401, { error: 'Unauthorized' })
  }

  const youtube = youtubeSetupStatusForAdmin()

  return json(res, 200, {
    product: EYES_OF_FOOTBALL_PRODUCT_NAME,
    staging: true,
    youtube,
    setupSteps: YOUTUBE_SETUP_STEPS,
    projects: [],
    projectsNote:
      'Editor upload queue and Shorts publishing will appear here after YouTube OAuth is connected.',
    oauthConnectAvailable: youtube.hasOAuthClient && !youtube.hasRefreshToken,
  })
}
