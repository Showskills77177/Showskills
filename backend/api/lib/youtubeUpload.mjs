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
 * @param {{
 *   title: string,
 *   description?: string,
 *   tags?: string[],
 *   categoryId?: string,
 *   privacyStatus: 'private' | 'public' | 'unlisted',
 *   publishAt?: string | null,
 *   contentType?: string,
 *   madeForKids?: boolean,
 *   containsSyntheticMedia?: boolean,
 *   paidPromotion?: boolean,
 *   embeddable?: boolean,
 *   publicStatsViewable?: boolean,
 *   license?: 'youtube' | 'creativeCommon',
 *   defaultLanguage?: string | null,
 *   recordingDate?: string | null,
 *   contentLength?: number | null,
 * }} params
 */
export async function initYoutubeResumableUpload({
  title,
  description = '',
  tags = [],
  categoryId = '17',
  privacyStatus,
  publishAt = null,
  contentType = 'video/*',
  contentLength = null,
  madeForKids = false,
  containsSyntheticMedia = false,
  paidPromotion = false,
  embeddable = true,
  publicStatsViewable = true,
  license = 'youtube',
  defaultLanguage = null,
  recordingDate = null,
}) {
  const accessToken = await getYoutubeAccessToken()
  const status = {
    privacyStatus,
    selfDeclaredMadeForKids: Boolean(madeForKids),
    embeddable,
    publicStatsViewable,
    license: license === 'creativeCommon' ? 'creativeCommon' : 'youtube',
  }
  if (typeof containsSyntheticMedia === 'boolean') {
    status.containsSyntheticMedia = containsSyntheticMedia
  }
  if (publishAt && (privacyStatus === 'private' || privacyStatus === 'public' || privacyStatus === 'unlisted')) {
    status.publishAt = publishAt
    if (privacyStatus !== 'private') {
      status.privacyStatus = 'private'
    }
  }

  const snippet = {
    title: String(title || '').slice(0, 100),
    description: String(description || '').slice(0, 5000),
    categoryId: String(categoryId || '17'),
  }
  if (tags.length) snippet.tags = tags.slice(0, 30)
  if (defaultLanguage) snippet.defaultLanguage = defaultLanguage

  const body = {
    snippet,
    status,
    paidProductPlacementDetails: {
      hasPaidProductPlacement: Boolean(paidPromotion),
    },
  }
  if (recordingDate) {
    body.recordingDetails = { recordingDate }
  }

  const uploadHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': contentType,
  }
  if (Number.isFinite(contentLength) && contentLength > 0) {
    uploadHeaders['X-Upload-Content-Length'] = String(Math.floor(contentLength))
  }

  const res = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status,paidProductPlacementDetails,recordingDetails',
    {
      method: 'POST',
      headers: uploadHeaders,
      body: JSON.stringify(body),
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

const VIDEO_PARTS =
  'snippet,status,contentDetails,statistics,processingDetails,fileDetails,player,paidProductPlacementDetails,suggestions'

/** @param {string} videoId */
export async function fetchYoutubeVideo(videoId) {
  const accessToken = await getYoutubeAccessToken()
  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', VIDEO_PARTS)
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

/** Normalize upload / copyright / guidelines signals from YouTube processing. */
export function extractYoutubeUploadChecks(video) {
  if (!video) {
    return {
      processingStatus: 'unknown',
      copyright: { status: 'unknown', issues: [] },
      guidelines: { status: 'unknown', issues: [] },
    }
  }

  const proc = video.processingDetails || {}
  const processingStatus = proc.processingStatus || 'unknown'
  const issues = []
  if (proc.processingFailureReason) {
    issues.push(proc.processingFailureReason)
  }
  if (Array.isArray(proc.processingIssues)) {
    for (const item of proc.processingIssues) {
      if (item?.reason) issues.push(item.reason)
    }
  }

  const copyrightIssues = issues.filter((i) =>
    /copyright|content.?id|claim|blocked/i.test(String(i)),
  )
  const guidelineIssues = issues.filter((i) =>
    /guideline|policy|community|age|restricted/i.test(String(i)),
  )

  const copyrightStatus =
    copyrightIssues.length > 0
      ? 'issues'
      : processingStatus === 'succeeded'
        ? 'clear'
        : processingStatus === 'processing'
          ? 'checking'
          : 'unknown'

  const guidelinesStatus =
    video.status?.uploadStatus === 'rejected' || guidelineIssues.length > 0
      ? 'issues'
      : processingStatus === 'succeeded'
        ? 'clear'
        : processingStatus === 'processing'
          ? 'checking'
          : 'unknown'

  return {
    processingStatus,
    copyright: { status: copyrightStatus, issues: copyrightIssues },
    guidelines: { status: guidelinesStatus, issues: guidelineIssues },
    rejectionReason: video.status?.rejectionReason || null,
    failureReason: proc.processingFailureReason || null,
  }
}

export function youtubeVideoToSummary(video) {
  if (!video) return null
  const checks = extractYoutubeUploadChecks(video)
  const file = video.fileDetails || {}
  const content = video.contentDetails || {}
  const stats = video.statistics || {}
  const dur = content.duration ? parseIso8601Duration(content.duration) : null
  const stream = file.videoStreams?.[0]
  const w = stream?.widthPixels ? Number(stream.widthPixels) : null
  const h = stream?.heightPixels ? Number(stream.heightPixels) : null
  const isVertical =
    content.dimension === '2d' && w && h ? h > w : content.dimension ? false : null

  return {
    youtubeVideoId: video.id,
    title: video.snippet?.title,
    description: video.snippet?.description,
    tags: video.snippet?.tags || [],
    channelId: video.snippet?.channelId,
    channelTitle: video.snippet?.channelTitle,
    privacyStatus: video.status?.privacyStatus,
    madeForKids: Boolean(video.status?.selfDeclaredMadeForKids),
    paidPromotion: Boolean(video.paidProductPlacementDetails?.hasPaidProductPlacement),
    containsSyntheticMedia: Boolean(video.status?.containsSyntheticMedia),
    license: video.status?.license || 'youtube',
    publishAt: video.status?.publishAt || null,
    viewCount: stats.viewCount ? Number(stats.viewCount) : 0,
    likeCount: stats.likeCount ? Number(stats.likeCount) : 0,
    commentCount: stats.commentCount ? Number(stats.commentCount) : 0,
    durationSeconds: dur,
    fileSizeBytes: file.fileSize ? Number(file.fileSize) : null,
    definition: file.definition || content.definition || null,
    dimension: content.dimension || null,
    widthPixels: w,
    heightPixels: h,
    isVerticalShort: isVertical === true || (w && h ? h >= w : false),
    tagSuggestions: video.suggestions?.tagSuggestions || [],
    processingProgress: video.processingDetails?.processingProgress || null,
    thumbnailUrl:
      video.snippet?.thumbnails?.medium?.url ||
      video.snippet?.thumbnails?.default?.url ||
      null,
    embedHtml: video.player?.embedHtml || null,
    checks,
  }
}

function parseIso8601Duration(iso) {
  const m = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return null
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)
}

/**
 * @param {string} videoId
 * @param {{ publishAt?: string | null, privacyStatus?: string, madeForKids?: boolean }} patch
 */
export async function updateYoutubeVideoStatus(videoId, patch) {
  const accessToken = await getYoutubeAccessToken()
  const res = await fetch('https://www.googleapis.com/youtube/v3/videos?part=status', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ id: videoId, status: patch }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || `YouTube video update failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

/** @param {string} videoId @param {Buffer} imageBytes @param {string} mime */
export async function uploadYoutubeThumbnail(videoId, imageBytes, mime = 'image/jpeg') {
  const accessToken = await getYoutubeAccessToken()
  const url = new URL('https://www.googleapis.com/upload/youtube/v3/thumbnails/set')
  url.searchParams.set('videoId', videoId)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': mime,
      'Content-Length': String(imageBytes.length),
    },
    body: imageBytes,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || `Thumbnail upload failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

export async function publishYoutubeVideoNow(videoId) {
  return updateYoutubeVideoStatus(videoId, {
    privacyStatus: 'public',
    publishAt: null,
  })
}

/**
 * Upload video bytes to a resumable YouTube upload URL (server-side).
 * @param {string} uploadUrl
 * @param {Buffer} buffer
 * @param {string} [contentType]
 */
export async function putYoutubeResumableUpload(uploadUrl, buffer, contentType = 'video/mp4') {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
    },
    body: buffer,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || `YouTube video PUT failed (${res.status})`
    throw new Error(msg)
  }
  const videoId = data?.id
  if (!videoId) throw new Error('YouTube upload did not return a video id')
  return { youtubeVideoId: videoId, raw: data }
}

export async function scheduleYoutubeVideo(videoId, publishAtIso) {
  return updateYoutubeVideoStatus(videoId, {
    privacyStatus: 'private',
    publishAt: publishAtIso,
  })
}

export async function setYoutubeVisibility(videoId, privacyStatus) {
  return updateYoutubeVideoStatus(videoId, { privacyStatus, publishAt: null })
}
