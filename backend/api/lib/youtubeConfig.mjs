import { YOUTUBE_ENV_KEYS, YOUTUBE_OAUTH_CALLBACK_PATH } from '../../../shared/eyesOfFootball.mjs'
import { resolveSiteUrl } from './resendConfig.mjs'

function env(name) {
  return String(process.env[name] || '').trim()
}

function maskSecret(value, { head = 4, tail = 4 } = {}) {
  const s = String(value || '')
  if (!s) return null
  if (s.length <= head + tail + 2) return '••••••••'
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}

/** Default OAuth callback when YOUTUBE_REDIRECT_URI is unset. */
export function defaultYoutubeOAuthRedirectUri() {
  const configured = env(YOUTUBE_ENV_KEYS.redirectUri)
  if (configured) return configured
  const site = resolveSiteUrl()?.replace(/\/$/, '')
  if (!site) return null
  return `${site}${YOUTUBE_OAUTH_CALLBACK_PATH}`
}

export function readYoutubeConfig() {
  const clientId = env(YOUTUBE_ENV_KEYS.clientId)
  const clientSecret = env(YOUTUBE_ENV_KEYS.clientSecret)
  const refreshToken = env(YOUTUBE_ENV_KEYS.refreshToken)
  const channelId = env(YOUTUBE_ENV_KEYS.channelId)
  const redirectUri = defaultYoutubeOAuthRedirectUri()

  return {
    clientId,
    clientSecret,
    refreshToken,
    channelId,
    redirectUri,
    hasOAuthClient: Boolean(clientId && clientSecret),
    hasRefreshToken: Boolean(refreshToken),
    isReadyToPublish: Boolean(clientId && clientSecret && refreshToken),
  }
}

export function buildYoutubeOAuthConnectUrl(clientId, redirectUri) {
  if (!clientId || !redirectUri) return null
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/** Public admin payload — never expose full secrets. */
export function youtubeSetupStatusForAdmin() {
  const cfg = readYoutubeConfig()
  return {
    redirectUri: cfg.redirectUri,
    hasOAuthClient: cfg.hasOAuthClient,
    hasRefreshToken: cfg.hasRefreshToken,
    isReadyToPublish: cfg.isReadyToPublish,
    channelId: cfg.channelId || null,
    oauthConnectUrl: cfg.hasOAuthClient ? buildYoutubeOAuthConnectUrl(cfg.clientId, cfg.redirectUri) : null,
    masked: {
      clientId: maskSecret(cfg.clientId, { head: 8, tail: 6 }),
      clientSecret: cfg.clientSecret ? 'configured' : null,
      refreshToken: cfg.refreshToken ? 'configured' : null,
    },
    env: {
      [YOUTUBE_ENV_KEYS.clientId]: Boolean(cfg.clientId),
      [YOUTUBE_ENV_KEYS.clientSecret]: Boolean(cfg.clientSecret),
      [YOUTUBE_ENV_KEYS.refreshToken]: Boolean(cfg.refreshToken),
      [YOUTUBE_ENV_KEYS.channelId]: Boolean(cfg.channelId),
      [YOUTUBE_ENV_KEYS.redirectUri]: Boolean(env(YOUTUBE_ENV_KEYS.redirectUri)),
    },
  }
}
