import { json } from '../../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { readYoutubeConfig } from '../../lib/youtubeConfig.mjs'

/**
 * GET /api/youtube/oauth/callback — OAuth redirect target (connect flow TBD).
 * Staging only. Shows instructions until full OAuth exchange is wired.
 */
export default async function handler(req, res) {
  if (!isShowSkillsStagingServerEnabled()) {
    return json(res, 404, { error: 'Not found' })
  }

  const url = new URL(req.url || '/', 'http://local')
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const cfg = readYoutubeConfig()

  if (error) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;max-width:40rem">
        <h1>Eyes Of Football — YouTube connect failed</h1>
        <p>${error}</p>
        <p><a href="/admin/eyes-of-football">Back to admin</a></p>
      </body></html>`,
    )
    return
  }

  if (!code) {
    return json(res, 400, { error: 'Missing authorization code. Start connect from Eyes Of Football admin.' })
  }

  if (!cfg.hasOAuthClient) {
    return json(res, 503, {
      error: 'Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET on staging before connecting.',
    })
  }

  // Full token exchange will be implemented once owner provides OAuth credentials.
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;max-width:40rem;line-height:1.5">
      <h1>Eyes Of Football — authorization received</h1>
      <p>Google returned an authorization code. The token exchange step is not wired yet.</p>
      <p>Send your developer the staging <strong>YOUTUBE_CLIENT_ID</strong> and <strong>YOUTUBE_CLIENT_SECRET</strong>;
      they will finish connect and give you the <strong>YOUTUBE_REFRESH_TOKEN</strong> to paste into Vercel.</p>
      <p><a href="/admin/eyes-of-football">Back to admin</a></p>
    </body></html>`,
  )
}
