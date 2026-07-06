import { readYoutubeConfig } from './youtubeConfig.mjs'
import { getYoutubeAccessToken } from './youtubeUpload.mjs'
import { fetchYoutubeChannelForAdmin } from './youtubeChannel.mjs'

function ymd(d) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function analyticsDateRange(days = 28) {
  const end = new Date()
  end.setUTCDate(end.getUTCDate() - 1)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return { startDate: ymd(start), endDate: ymd(end) }
}

async function queryAnalyticsReport(accessToken, channelId, { startDate, endDate, dimensions = null }) {
  const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports')
  url.searchParams.set('ids', `channel==${channelId}`)
  url.searchParams.set('startDate', startDate)
  url.searchParams.set('endDate', endDate)
  url.searchParams.set('metrics', 'views,estimatedMinutesWatched,subscribersGained')
  if (dimensions) url.searchParams.set('dimensions', dimensions)

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

function parseAnalyticsRows(data) {
  const headers = data.columnHeaders || []
  const rows = data.rows || []
  let totalViews = 0
  let totalMinutes = 0
  let subscribersGained = 0
  const viewsByDay = {}

  const dayIdx = headers.findIndex((h) => h.name === 'day')
  const viewsIdx = headers.findIndex((h) => h.name === 'views')
  const minIdx = headers.findIndex((h) => h.name === 'estimatedMinutesWatched')
  const subIdx = headers.findIndex((h) => h.name === 'subscribersGained')

  for (const row of rows) {
    const day = dayIdx >= 0 ? row[dayIdx] : null
    const views = viewsIdx >= 0 ? Number(row[viewsIdx] || 0) : 0
    totalViews += views
    if (day) viewsByDay[day] = (viewsByDay[day] || 0) + views
    if (minIdx >= 0) totalMinutes += Number(row[minIdx] || 0)
    if (subIdx >= 0) subscribersGained += Number(row[subIdx] || 0)
  }

  return {
    totalViews,
    totalMinutesWatched: Math.round(totalMinutes),
    subscribersGained,
    viewsByDay,
  }
}

/**
 * Channel analytics — YouTube Analytics API with Data API fallback for lifetime views.
 */
export async function fetchChannelAnalyticsSummary() {
  const channel = await fetchYoutubeChannelForAdmin()
  if (!channel?.id) {
    return { available: false, reason: 'Channel not found' }
  }

  const { startDate, endDate } = analyticsDateRange(28)
  const accessToken = await getYoutubeAccessToken()

  const totals = await queryAnalyticsReport(accessToken, channel.id, { startDate, endDate })
  const daily = await queryAnalyticsReport(accessToken, channel.id, {
    startDate,
    endDate,
    dimensions: 'day',
  })

  if (totals.ok) {
    const parsed = parseAnalyticsRows(totals.data)
    const dailyParsed = daily.ok ? parseAnalyticsRows(daily.data) : { viewsByDay: {} }
    return {
      available: true,
      source: 'youtube_analytics',
      periodDays: 28,
      startDate,
      endDate,
      totalViews: parsed.totalViews,
      totalMinutesWatched: parsed.totalMinutesWatched,
      subscribersGained: parsed.subscribersGained,
      viewsByDay: dailyParsed.viewsByDay,
      channelLifetimeViews: channel.viewCount ?? null,
    }
  }

  const msg = totals.data?.error?.message || `Analytics API error (${totals.status})`
  const needsReconnect = totals.status === 403 || /scope|permission|Insufficient/i.test(msg)

  return {
    available: false,
    source: 'fallback',
    reason: msg,
    needsReconnect,
    hint: needsReconnect
      ? 'Reconnect YouTube on staging (Connect channel) to grant yt-analytics.readonly scope.'
      : 'Showing lifetime channel views from YouTube Data API instead.',
    channelLifetimeViews: channel.viewCount ?? null,
    totalViews: channel.viewCount ?? null,
    periodDays: null,
    startDate: null,
    endDate: null,
  }
}

/** Per-video views for uploaded projects (Data API statistics). */
export async function fetchVideoViewCounts(videoIds) {
  if (!videoIds?.length) return {}
  const accessToken = await getYoutubeAccessToken()
  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'statistics,contentDetails')
  url.searchParams.set('id', videoIds.slice(0, 50).join(','))
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return {}
  const out = {}
  for (const item of data.items || []) {
    out[item.id] = {
      viewCount: Number(item.statistics?.viewCount || 0),
      dimension: item.contentDetails?.dimension,
    }
  }
  return out
}
