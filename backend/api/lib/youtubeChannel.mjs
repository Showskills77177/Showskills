import { readYoutubeConfig } from './youtubeConfig.mjs'
import { getYoutubeAccessToken } from './youtubeUpload.mjs'

/** @returns {Promise<{ id: string, title: string, thumbnailUrl: string | null, customUrl: string | null } | null>} */
export async function fetchYoutubeChannelForAdmin() {
  const cfg = readYoutubeConfig()
  const accessToken = await getYoutubeAccessToken()

  if (cfg.channelId) {
    const url = new URL('https://www.googleapis.com/youtube/v3/channels')
    url.searchParams.set('part', 'snippet,statistics')
    url.searchParams.set('id', cfg.channelId)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    const data = await res.json().catch(() => ({}))
    const ch = data?.items?.[0]
    if (ch) return channelPayload(ch)
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'snippet,statistics')
  url.searchParams.set('mine', 'true')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const data = await res.json().catch(() => ({}))
  const ch = data?.items?.[0]
  return ch ? channelPayload(ch) : null
}

function channelPayload(ch) {
  const thumbs = ch?.snippet?.thumbnails || {}
  const thumb =
    thumbs.medium?.url || thumbs.default?.url || thumbs.high?.url || null
  return {
    id: ch.id,
    title: ch.snippet?.title || 'YouTube channel',
    thumbnailUrl: thumb,
    customUrl: ch.snippet?.customUrl || null,
    subscriberCount: ch.statistics?.subscriberCount
      ? Number(ch.statistics.subscriberCount)
      : null,
    videoCount: ch.statistics?.videoCount ? Number(ch.statistics.videoCount) : null,
  }
}
