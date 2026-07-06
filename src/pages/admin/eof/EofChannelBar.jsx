import { EOF } from './eofStudioTheme'

export default function EofChannelBar({ channel, youtube, analytics }) {
  if (!channel && !youtube?.channelId) {
    return (
      <div className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-4`}>
        <p className={`text-sm ${EOF.muted}`}>Connect YouTube to see your publishing channel.</p>
      </div>
    )
  }

  const name = channel?.title || 'YouTube channel'
  const id = channel?.id || youtube?.channelId

  return (
    <div className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-4`}>
      <div className="flex flex-wrap items-center gap-4">
        {channel?.thumbnailUrl ? (
          <img
            src={channel.thumbnailUrl}
            alt=""
            className="h-14 w-14 rounded-full border border-[#303030] object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ff0000] text-lg font-bold text-white">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#3ea6ff]">Publishing to</p>
          <h2 className="truncate text-lg font-semibold text-white">{name}</h2>
          <p className={`text-xs ${EOF.muted}`}>
            Channel ID: <code className="text-[#3ea6ff]">{id}</code>
            {channel?.customUrl ? <> · youtube.com/{channel.customUrl}</> : null}
          </p>
        </div>
        <AnalyticsBlock analytics={analytics} channel={channel} />
      </div>
    </div>
  )
}

function AnalyticsBlock({ analytics, channel }) {
  if (analytics?.available) {
    return (
      <div className="flex flex-wrap gap-4 text-center">
        <Stat label={`Views (${analytics.periodDays}d)`} value={analytics.totalViews?.toLocaleString()} />
        <Stat label="Watch time (min)" value={analytics.totalMinutesWatched?.toLocaleString()} />
        <Stat label="Subs gained" value={analytics.subscribersGained?.toLocaleString()} />
        {analytics.channelLifetimeViews != null ? (
          <Stat label="Lifetime views" value={analytics.channelLifetimeViews?.toLocaleString()} />
        ) : null}
      </div>
    )
  }

  if (channel?.viewCount != null || analytics?.channelLifetimeViews != null) {
    return (
      <div className="max-w-sm text-right">
        <Stat
          label="Channel views (lifetime)"
          value={(analytics?.channelLifetimeViews ?? channel?.viewCount)?.toLocaleString()}
        />
        {analytics?.hint ? <p className={`mt-1 text-[10px] ${EOF.muted}`}>{analytics.hint}</p> : null}
      </div>
    )
  }

  if (analytics) {
    return (
      <p className={`max-w-xs text-xs ${EOF.muted}`}>
        Analytics: {analytics.hint || analytics.reason || 'Unavailable — reconnect YouTube for analytics scope.'}
      </p>
    )
  }

  return null
}

function Stat({ label, value }) {
  return (
    <div className="min-w-[72px]">
      <p className="text-lg font-semibold text-white">{value ?? '—'}</p>
      <p className="text-[10px] uppercase tracking-wide text-[#aaaaaa]">{label}</p>
    </div>
  )
}
