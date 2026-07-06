import { getYoutubeAccessToken } from './youtubeUpload.mjs'
import { fetchYoutubeChannelForAdmin } from './youtubeChannel.mjs'

function ymd(d) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function analyticsDateRange(days = 28) {
  const end = new Date()
  end.setUTCDate(end.getUTCDate() - 1)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return { startDate: ymd(start), endDate: ymd(end) }
}

async function queryAnalyticsReport(accessToken, channelId, params) {
  const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports')
  url.searchParams.set('ids', `channel==${channelId}`)
  url.searchParams.set('startDate', params.startDate)
  url.searchParams.set('endDate', params.endDate)
  url.searchParams.set('metrics', params.metrics || 'views,estimatedMinutesWatched,subscribersGained')
  if (params.dimensions) url.searchParams.set('dimensions', params.dimensions)
  if (params.sort) url.searchParams.set('sort', params.sort)
  if (params.maxResults) url.searchParams.set('maxResults', String(params.maxResults))

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

function colIndex(headers, name) {
  return headers.findIndex((h) => h.name === name)
}

/** Sum 28-day totals from daily rows — most reliable for channel summary. */
function parseDailySummary(data) {
  const headers = data.columnHeaders || []
  const rows = data.rows || []
  const dayIdx = colIndex(headers, 'day')
  const viewsIdx = colIndex(headers, 'views')
  const minIdx = colIndex(headers, 'estimatedMinutesWatched')
  const subIdx = colIndex(headers, 'subscribersGained')

  let totalViews = 0
  let totalMinutes = 0
  let subscribersGained = 0
  const viewsByDay = {}

  for (const row of rows) {
    const day = dayIdx >= 0 ? row[dayIdx] : null
    const views = viewsIdx >= 0 ? Number(row[viewsIdx] || 0) : 0
    const mins = minIdx >= 0 ? Number(row[minIdx] || 0) : 0
    const subs = subIdx >= 0 ? Number(row[subIdx] || 0) : 0
    totalViews += views
    totalMinutes += mins
    subscribersGained += subs
    if (day) viewsByDay[day] = views
  }

  return {
    totalViews,
    totalMinutesWatched: Math.round(totalMinutes),
    totalWatchTimeHours: Math.round((totalMinutes / 60) * 10) / 10,
    subscribersGained,
    viewsByDay,
  }
}

function parseTopVideoRows(data) {
  const headers = data.columnHeaders || []
  const rows = data.rows || []
  const videoIdx = colIndex(headers, 'video')
  const viewsIdx = colIndex(headers, 'views')
  const minIdx = colIndex(headers, 'estimatedMinutesWatched')
  const avgIdx = colIndex(headers, 'averageViewDuration')

  return rows.map((row) => ({
    videoId: videoIdx >= 0 ? String(row[videoIdx]) : null,
    views: viewsIdx >= 0 ? Number(row[viewsIdx] || 0) : 0,
    minutesWatched: minIdx >= 0 ? Math.round(Number(row[minIdx] || 0)) : 0,
    watchTimeHours: minIdx >= 0 ? Math.round((Number(row[minIdx] || 0) / 60) * 10) / 10 : 0,
    averageViewDurationSeconds: avgIdx >= 0 ? Math.round(Number(row[avgIdx] || 0)) : null,
  }))
}

async function enrichVideosWithMetadata(accessToken, items) {
  const ids = items.map((i) => i.videoId).filter(Boolean)
  if (!ids.length) return items

  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'snippet,contentDetails,statistics')
  url.searchParams.set('id', ids.join(','))

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const data = await res.json().catch(() => ({}))
  const byId = {}
  for (const v of data.items || []) {
    byId[v.id] = {
      title: v.snippet?.title || 'Untitled',
      thumbnailUrl:
        v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || null,
      publishedAt: v.snippet?.publishedAt || null,
      lifetimeViews: Number(v.statistics?.viewCount || 0),
    }
  }

  return items.map((item) => ({
    ...item,
    ...byId[item.videoId],
    youtubeUrl: item.videoId ? `https://www.youtube.com/watch?v=${item.videoId}` : null,
  }))
}

/**
 * Channel analytics — 28-day summary, subscriber count, top content.
 */
export async function fetchChannelAnalyticsSummary({ topVideoLimit = 10 } = {}) {
  const channel = await fetchYoutubeChannelForAdmin()
  if (!channel?.id) {
    return { available: false, reason: 'Channel not found' }
  }

  const { startDate, endDate } = analyticsDateRange(28)
  const accessToken = await getYoutubeAccessToken()

  const daily = await queryAnalyticsReport(accessToken, channel.id, {
    startDate,
    endDate,
    dimensions: 'day',
    metrics: 'views,estimatedMinutesWatched,subscribersGained',
  })

  let topContent = []
  const topVideos = await queryAnalyticsReport(accessToken, channel.id, {
    startDate,
    endDate,
    dimensions: 'video',
    metrics: 'views,estimatedMinutesWatched,averageViewDuration',
    sort: '-views',
    maxResults: topVideoLimit,
  })

  if (daily.ok) {
    const summary = parseDailySummary(daily.data)
    if (topVideos.ok) {
      const parsed = parseTopVideoRows(topVideos.data)
      topContent = await enrichVideosWithMetadata(accessToken, parsed)
    }

    return {
      available: true,
      source: 'youtube_analytics',
      periodDays: 28,
      startDate,
      endDate,
      subscriberCount: channel.subscriberCount ?? null,
      totalViews: summary.totalViews,
      totalMinutesWatched: summary.totalMinutesWatched,
      totalWatchTimeHours: summary.totalWatchTimeHours,
      subscribersGained: summary.subscribersGained,
      viewsByDay: summary.viewsByDay,
      channelLifetimeViews: channel.viewCount ?? null,
      topContent,
    }
  }

  const msg = daily.data?.error?.message || `Analytics API error (${daily.status})`
  const needsReconnect = daily.status === 403 || /scope|permission|Insufficient/i.test(msg)

  return {
    available: false,
    source: 'fallback',
    reason: msg,
    needsReconnect,
    hint: needsReconnect
      ? 'Reconnect YouTube on staging (Connect channel) to grant yt-analytics.readonly scope.'
      : '28-day analytics unavailable. Showing channel totals from YouTube Data API.',
    subscriberCount: channel.subscriberCount ?? null,
    channelLifetimeViews: channel.viewCount ?? null,
    topContent: [],
    periodDays: null,
    startDate: null,
    endDate: null,
  }
}

/** Per-video lifetime views (Data API) for EOF project list. */
export async function fetchVideoViewCounts(videoIds) {
  if (!videoIds?.length) return {}
  const accessToken = await getYoutubeAccessToken()
  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'statistics,contentDetails,snippet')
  url.searchParams.set('id', videoIds.slice(0, 50).join(','))
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return {}
  const out = {}
  for (const item of data.items || []) {
    out[item.id] = {
      viewCount: Number(item.statistics?.viewCount || 0),
      dimension: item.contentDetails?.dimension,
      title: item.snippet?.title,
    }
  }
  return out
}
