import { readYoutubeConfig, defaultYoutubeOAuthRedirectUri } from './youtubeConfig.mjs'

/**
 * Exchange a one-time OAuth code for access + refresh tokens.
 * @param {{ code: string, redirectUri?: string | null }} params
 */
export async function exchangeYoutubeAuthCode({ code, redirectUri }) {
  const cfg = readYoutubeConfig()
  if (!cfg.hasOAuthClient) {
    throw new Error('YouTube OAuth client is not configured')
  }
  const uri = redirectUri || defaultYoutubeOAuthRedirectUri()
  if (!uri) throw new Error('YouTube redirect URI is not configured')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: String(code || '').trim(),
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: uri,
      grant_type: 'authorization_code',
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data.error_description || data.error || `Token exchange failed (${res.status})`
    throw new Error(msg)
  }
  if (!data.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Try Connect again — you may need to revoke prior access at myaccount.google.com/permissions and reconnect with prompt=consent.',
    )
  }
  return {
    accessToken: data.access_token || null,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || null,
    scope: data.scope || null,
    tokenType: data.token_type || null,
  }
}

/**
 * @param {string} refreshToken
 */
export async function fetchYoutubeChannelId(refreshToken) {
  const cfg = readYoutubeConfig()
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const tokenData = await tokenRes.json().catch(() => ({}))
  if (!tokenRes.ok || !tokenData.access_token) return null

  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
  )
  const data = await res.json().catch(() => ({}))
  const id = data?.items?.[0]?.id
  return typeof id === 'string' ? id : null
}
