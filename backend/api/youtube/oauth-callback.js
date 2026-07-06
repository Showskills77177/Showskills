import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { readYoutubeConfig, defaultYoutubeOAuthRedirectUri } from '../lib/youtubeConfig.mjs'
import { exchangeYoutubeAuthCode, fetchYoutubeChannelId } from '../lib/youtubeOAuth.mjs'

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * GET /api/youtube/oauth/callback — exchange code, show refresh token for Vercel (staging).
 */
export default async function handler(req, res) {
  if (!isShowSkillsStagingServerEnabled()) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end('<!DOCTYPE html><html><body><p>Not found</p></body></html>')
    return
  }

  const url = new URL(req.url || '/', 'http://local')
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const cfg = readYoutubeConfig()
  const redirectUri = defaultYoutubeOAuthRedirectUri()

  if (error) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;max-width:40rem">
        <h1>Eyes Of Football — connect failed</h1>
        <p>${escapeHtml(error)}</p>
        <p><a href="/admin/eyes-of-football">Back to admin</a></p>
      </body></html>`,
    )
    return
  }

  if (!code) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;max-width:40rem">
        <h1>Missing authorization code</h1>
        <p>Start from <a href="/admin/eyes-of-football">Eyes Of Football admin</a> → Connect YouTube channel.</p>
      </body></html>`,
    )
    return
  }

  if (!cfg.hasOAuthClient) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;max-width:40rem">
        <h1>YouTube OAuth not configured</h1>
        <p>Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET on staging, then redeploy.</p>
      </body></html>`,
    )
    return
  }

  try {
    const tokens = await exchangeYoutubeAuthCode({ code, redirectUri })
    const channelId = await fetchYoutubeChannelId(tokens.refreshToken)

    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;max-width:42rem;line-height:1.55">
        <h1>✓ YouTube connected</h1>
        <p>Add these to <strong>Vercel → staging → Environment Variables</strong>, then redeploy:</p>
        <ol>
          <li><code>YOUTUBE_REFRESH_TOKEN</code> — mark as <strong>Sensitive</strong></li>
          ${
            channelId
              ? `<li><code>YOUTUBE_CHANNEL_ID</code> = <code>${escapeHtml(channelId)}</code></li>`
              : ''
          }
        </ol>
        <p style="margin-top:1.25rem"><strong>Refresh token</strong> (copy once — shown only here):</p>
        <textarea readonly rows="4" style="width:100%;font-family:monospace;font-size:12px;padding:8px">${escapeHtml(tokens.refreshToken)}</textarea>
        ${
          channelId
            ? `<p>Detected channel ID: <code>${escapeHtml(channelId)}</code></p>`
            : ''
        }
        <p style="margin-top:1rem;color:#555">After redeploy, open <a href="/admin/eyes-of-football">Eyes Of Football admin</a> — status should show <em>Ready to publish</em>.</p>
      </body></html>`,
    )
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;max-width:40rem">
        <h1>Connect failed</h1>
        <p>${escapeHtml(err instanceof Error ? err.message : 'Token exchange failed')}</p>
        <p>Check redirect URI matches Google exactly:<br><code>${escapeHtml(redirectUri || '')}</code></p>
        <p><a href="/admin/eyes-of-football">Back to admin</a></p>
      </body></html>`,
    )
  }
}
