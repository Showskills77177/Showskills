/** Eyes Of Football — YouTube Shorts publishing hub (staging). */
export const EYES_OF_FOOTBALL_PRODUCT_NAME = 'Eyes Of Football'
export const EYES_OF_FOOTBALL_ADMIN_TITLE = `${EYES_OF_FOOTBALL_PRODUCT_NAME} admin`
export const EYES_OF_FOOTBALL_ADMIN_PATH = '/admin/eyes-of-football'

/** Single-segment path — Vercel root catch-all only matches one segment after /api/. */
export const YOUTUBE_OAUTH_CALLBACK_PATH = '/api/youtube-oauth-callback'

/** Vercel / local env keys for YouTube Data API v3 OAuth. */
export const YOUTUBE_ENV_KEYS = {
  clientId: 'YOUTUBE_CLIENT_ID',
  clientSecret: 'YOUTUBE_CLIENT_SECRET',
  refreshToken: 'YOUTUBE_REFRESH_TOKEN',
  channelId: 'YOUTUBE_CHANNEL_ID',
  redirectUri: 'YOUTUBE_REDIRECT_URI',
}

/** Setup steps shown in admin — what the channel owner must provide. */
export const YOUTUBE_SETUP_STEPS = [
  {
    id: 'google_project',
    title: 'Google Cloud project',
    detail:
      'Create a project at console.cloud.google.com, enable YouTube Data API v3, and configure the OAuth consent screen (External or Internal).',
    envKeys: [],
    docUrl: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
  },
  {
    id: 'oauth_client',
    title: 'OAuth 2.0 Web client',
    detail:
      'APIs & Services → Credentials → Create OAuth client ID (Web application). Add the redirect URI from this page to Authorized redirect URIs.',
    envKeys: [YOUTUBE_ENV_KEYS.clientId, YOUTUBE_ENV_KEYS.clientSecret],
    docUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  {
    id: 'redirect_uri',
    title: 'Redirect URI on staging',
    detail:
      'Set YOUTUBE_REDIRECT_URI on Vercel staging to the callback URL shown below (must match Google exactly).',
    envKeys: [YOUTUBE_ENV_KEYS.redirectUri],
  },
  {
    id: 'channel_connect',
    title: 'Connect your YouTube channel (one time)',
    detail:
      'After client ID + secret are on staging, open Connect channel on the admin page. You sign in as the channel owner; we store a refresh token — editors never get your Google login.',
    envKeys: [YOUTUBE_ENV_KEYS.refreshToken],
  },
  {
    id: 'channel_id',
    title: 'Channel ID (optional but recommended)',
    detail:
      'Your channel ID (starts with UC…) or set YOUTUBE_CHANNEL_ID after connecting so uploads always target the right channel.',
    envKeys: [YOUTUBE_ENV_KEYS.channelId],
    docUrl: 'https://www.youtube.com/account_advanced',
  },
  {
    id: 'quota',
    title: 'API quota (important for volume)',
    detail:
      'Default YouTube API quota is ~6 uploads/day. Request a quota increase in Google Cloud Console if editors will publish many Shorts.',
    envKeys: [],
    docUrl: 'https://support.google.com/youtube/contact/yt_api_form',
  },
]
