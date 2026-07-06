import { readYoutubeConfig } from './youtubeConfig.mjs'

export async function getYoutubeAccessToken() {
  const cfg = readYoutubeConfig()
  if (!cfg.refreshToken) {
    throw new Error('YouTube refresh token is not configured')
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    const msg = data.error_description || data.error || 'Failed to refresh YouTube access token'
    throw new Error(msg)
  }
  return data.access_token
}

/**
 * Start a resumable upload — client PUTs video bytes to returned uploadUrl.
 * @param {{ title: string, description?: string, privacyStatus: 'private' | 'public' | 'unlisted', publishAt?: string | null, contentType?: string }} params
 */
export async function initYoutubeResumableUpload({
  title,
  description = '',
  privacyStatus,
  publishAt = null,
  contentType = 'video/*',
}) {
  const accessToken = await getYoutubeAccessToken()
  const status = {
    privacyStatus,
    selfDeclaredMadeForKids: false,
  }
  if (publishAt && privacyStatus === 'private') {
    status.publishAt = publishAt
  }

  const res = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': contentType,
      },
      body: JSON.stringify({
        snippet: {
          title: String(title || '').slice(0, 100),
          description: String(description || '').slice(0, 5000),
          categoryId: '17',
        },
        status,
      }),
    },
  )

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    const msg =
      errBody?.error?.message ||
      errBody?.error_description ||
      `YouTube upload init failed (${res.status})`
    throw new Error(msg)
  }

  const uploadUrl = res.headers.get('Location')
  if (!uploadUrl) {
    throw new Error('YouTube did not return a resumable upload URL')
  }
  return { uploadUrl }
}

/** @param {string} videoId */
export async function fetchYoutubeVideo(videoId) {
  const accessToken = await getYoutubeAccessToken()
  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'snippet,status')
  url.searchParams.set('id', videoId)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || `YouTube video lookup failed (${res.status})`
    throw new Error(msg)
  }
  return data?.items?.[0] || null
}

/**
 * @param {string} videoId
 * @param {{ publishAt?: string | null, privacyStatus?: string }} patch
 */
export async function updateYoutubeVideoStatus(videoId, patch) {
  const accessToken = await getYoutubeAccessToken()
  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/videos?part=status',
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        id: videoId,
        status: patch,
      }),
    },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || `YouTube video update failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

/** Publish a private video immediately. */
export async function publishYoutubeVideoNow(videoId) {
  return updateYoutubeVideoStatus(videoId, {
    privacyStatus: 'public',
    publishAt: null,
  })
}

/** Schedule a private video for future publish. */
export async function scheduleYoutubeVideo(videoId, publishAtIso) {
  return updateYoutubeVideoStatus(videoId, {
    privacyStatus: 'private',
    publishAt: publishAtIso,
  })
}
