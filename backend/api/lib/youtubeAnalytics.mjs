import { readYoutubeConfig } from './youtubeConfig.mjs'
import { getYoutubeAccessToken } from './youtubeUpload.mjs'
import { fetchYoutubeChannelForAdmin } from './youtubeChannel.mjs'

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/**
 * Channel views last 28 days via YouTube Analytics API.
 * Requires yt-analytics.readonly scope on the refresh token.
 */
export async function fetchChannelAnalyticsSummary() {
  const channel = await fetchYoutubeChannelForAdmin()
  if (!channel?.id) {
    return { available: false, reason: 'Channel not found' }
  }

  const accessToken = await getYoutubeAccessToken()
  const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports')
  url.searchParams.set('ids', `channel==${channel.id}`)
  url.searchParams.set('startDate', daysAgo(28))
  url.searchParams.set('endDate', daysAgo(0))
  url.searchParams.set('metrics', 'views,estimatedMinutesWatched,subscribersGained')
  url.searchParams.set('dimensions', 'day')

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const msg = data?.error?.message || `Analytics API error (${res.status})`
    const needsReconnect = res.status === 403 || /scope|permission/i.test(msg)
    return {
      available: false,
      reason: msg,
      needsReconnect,
      hint: needsReconnect
        ? 'Reconnect YouTube on staging to grant YouTube Analytics scope (yt-analytics.readonly).'
        : null,
    }
  }

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
    const day = row[dayIdx]
    const views = viewsIdx >= 0 ? Number(row[viewsIdx] || 0) : 0
    totalViews += views
    if (day) viewsByDay[day] = views
    if (minIdx >= 0) totalMinutes += Number(row[minIdx] || 0)
    if (subIdx >= 0) subscribersGained += Number(row[subIdx] || 0)
  }

  return {
    available: true,
    periodDays: 28,
    totalViews,
    totalMinutesWatched: Math.round(totalMinutes),
    subscribersGained,
    viewsByDay,
  }
}
