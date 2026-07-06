import { EOF } from './eofStudioTheme'

/** Compact subscriber + 28d strip above full analytics panel. */
export default function EofChannelBar({ channel, youtube }) {
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
            {channel?.subscriberCount != null ? (
              <>
                {' '}
                · <span className="text-white">{channel.subscriberCount.toLocaleString()} subscribers</span>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  )
}
