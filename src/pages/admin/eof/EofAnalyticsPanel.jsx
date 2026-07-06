import { EOF } from './eofStudioTheme'
import { formatDuration } from '../../../../shared/eofYoutubeMeta.mjs'

export default function EofAnalyticsPanel({ analytics }) {
  if (!analytics) return null

  const period = analytics.periodDays ? `Last ${analytics.periodDays} days` : 'Channel totals'
  const range =
    analytics.startDate && analytics.endDate
      ? `${analytics.startDate} → ${analytics.endDate}`
      : null

  return (
    <div className="mt-6 space-y-4">
      <section className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-5`}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Channel analytics</h2>
            <p className={`text-xs ${EOF.muted}`}>
              {period}
              {range ? ` · ${range}` : ''}
            </p>
          </div>
          {analytics.source === 'youtube_analytics' ? (
            <span className="rounded-full bg-[#1e3a28] px-2.5 py-0.5 text-[10px] font-semibold text-[#2ba640]">
              YouTube Analytics
            </span>
          ) : (
            <span className="rounded-full bg-[#3a2a1e] px-2.5 py-0.5 text-[10px] font-semibold text-[#f9a825]">
              Limited data
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryCard
            label="Subscribers"
            value={analytics.subscriberCount?.toLocaleString()}
            sub="Current total"
            accent="text-[#ff0000]"
          />
          <SummaryCard
            label="Views"
            value={analytics.available ? analytics.totalViews?.toLocaleString() : '—'}
            sub={analytics.available ? 'Last 28 days' : 'Need analytics scope'}
          />
          <SummaryCard
            label="Watch time"
            value={
              analytics.available
                ? `${analytics.totalWatchTimeHours?.toLocaleString()}h`
                : '—'
            }
            sub="Last 28 days"
          />
          <SummaryCard
            label="Subs gained"
            value={analytics.available ? analytics.subscribersGained?.toLocaleString() : '—'}
            sub="Last 28 days"
          />
          <SummaryCard
            label="Lifetime views"
            value={analytics.channelLifetimeViews?.toLocaleString()}
            sub="All time"
          />
        </div>

        {!analytics.available && analytics.hint ? (
          <p className={`mt-4 text-xs ${EOF.muted}`}>{analytics.hint}</p>
        ) : null}
      </section>

      <section className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-5`}>
        <h2 className="text-base font-semibold text-white">Top content</h2>
        <p className={`mt-1 text-xs ${EOF.muted}`}>Best performing videos in the last 28 days on this channel</p>

        {!analytics.available ? (
          <p className={`mt-4 text-sm ${EOF.muted}`}>
            Top content requires YouTube Analytics. Reconnect the channel if you enabled Analytics API already.
          </p>
        ) : analytics.topContent?.length === 0 ? (
          <p className={`mt-4 text-sm ${EOF.muted}`}>No video views in this period yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#303030] text-[10px] uppercase tracking-wider text-[#717171]">
                  <th className="pb-2 pr-3">Video</th>
                  <th className="pb-2 pr-3 text-right">Views (28d)</th>
                  <th className="pb-2 pr-3 text-right">Watch time</th>
                  <th className="pb-2 text-right">Avg duration</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topContent.map((row, i) => (
                  <tr key={row.videoId || i} className="border-b border-[#303030]/60 last:border-0">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        {row.thumbnailUrl ? (
                          <img
                            src={row.thumbnailUrl}
                            alt=""
                            className="h-12 w-20 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded bg-[#272727] text-[10px] text-[#555]">
                            No thumb
                          </div>
                        )}
                        <div className="min-w-0">
                          {row.youtubeUrl ? (
                            <a
                              href={row.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="line-clamp-2 font-medium text-white hover:text-[#3ea6ff]"
                            >
                              {row.title || row.videoId}
                            </a>
                          ) : (
                            <p className="line-clamp-2 font-medium text-white">{row.title || '—'}</p>
                          )}
                          <p className="text-[10px] text-[#717171]">{row.videoId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-right font-semibold text-white">
                      {row.views?.toLocaleString()}
                    </td>
                    <td className="py-3 pr-3 text-right text-[#aaaaaa]">{row.watchTimeHours}h</td>
                    <td className="py-3 text-right text-[#aaaaaa]">
                      {row.averageViewDurationSeconds
                        ? formatDuration(row.averageViewDurationSeconds)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryCard({ label, value, sub, accent = 'text-white' }) {
  return (
    <div className="rounded-lg border border-[#303030] bg-[#121212] px-3 py-3">
      <p className={`text-xl font-semibold ${accent}`}>{value ?? '—'}</p>
      <p className="mt-0.5 text-xs font-medium text-white">{label}</p>
      {sub ? <p className="text-[10px] text-[#717171]">{sub}</p> : null}
    </div>
  )
}
