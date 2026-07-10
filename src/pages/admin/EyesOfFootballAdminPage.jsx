import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { isShowSkillsStagingClientEnabled } from '../../../shared/stagingSite.mjs'
import { EYES_OF_FOOTBALL_PRODUCT_NAME, YOUTUBE_SETUP_STEPS } from '../../../shared/eyesOfFootball.mjs'
import EofChannelBar from './eof/EofChannelBar'
import EofAnalyticsPanel from './eof/EofAnalyticsPanel'
import EofPublishCalendar from './eof/EofPublishCalendar'
import EofUploadStudio from './eof/EofUploadStudio'
import EofProductionPanel from './eof/EofProductionPanel'
import EofMusicLibrary from './eof/EofMusicLibrary'
import EofProjectList from './eof/EofProjectList'
import { EOF } from './eof/eofStudioTheme'

const EOF_VIEW_KEY = 'eof_admin_view'

function readStoredView() {
  try {
    const stored = sessionStorage.getItem(EOF_VIEW_KEY)
    if (
      stored === 'studio' ||
      stored === 'production' ||
      stored === 'music' ||
      stored === 'analytics' ||
      stored === 'calendar' ||
      stored === 'content'
    ) {
      return stored
    }
  } catch {
    /* ignore */
  }
  return 'studio'
}

export default function EyesOfFootballAdminPage() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null)
  const [view, setView] = useState(readStoredView)
  const [studioDraft, setStudioDraft] = useState(null)

  const selectView = useCallback((id) => {
    setView(id)
    try {
      sessionStorage.setItem(EOF_VIEW_KEY, id)
    } catch {
      /* ignore */
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/eyes-of-football')
      const text = await res.text()
      let j = {}
      try {
        j = text ? JSON.parse(text) : {}
      } catch {
        /* non-JSON (gateway timeout, etc.) */
      }
      if (!res.ok) {
        const detail =
          typeof j.error === 'string'
            ? j.error
            : text.trim()
              ? `${res.status}: ${text.trim().slice(0, 160)}`
              : `Request failed (HTTP ${res.status})`
        throw new Error(detail)
      }
      setData(j)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!isShowSkillsStagingClientEnabled()) {
    return <Navigate to="/admin/dashboard" replace />
  }

  const yt = data?.youtube
  const session = data?.session
  const ready = Boolean(yt?.isReadyToPublish)
  const canUpload = ready && (session?.isOwner || session?.isEditor)
  const isOwner = Boolean(session?.isOwner)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">{EYES_OF_FOOTBALL_PRODUCT_NAME}</h1>
          <p className={`mt-1 text-sm ${EOF.muted}`}>Publish Shorts and long-form to your YouTube channel</p>
        </div>
        {session?.username ? (
          <span className={`text-xs ${EOF.muted}`}>
            {session.username}
            {session.isOwner ? ' · owner' : session.isEditor ? ' · editor' : ''}
          </span>
        ) : null}
      </div>

      {err ? <p className="mb-4 text-sm text-[#ff4e45]">{err}</p> : null}
      {loading && !data ? <p className={EOF.muted}>Loading studio…</p> : null}

      {yt ? (
        <>
          <EofChannelBar channel={data.channel} youtube={yt} />

          {!ready ? (
            <section className={`mt-6 rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-5`}>
              <h2 className="font-semibold">Connect YouTube</h2>
              {yt.oauthConnectUrl ? (
                <a href={yt.oauthConnectUrl} className={`mt-3 inline-flex rounded-full px-5 py-2 text-sm ${EOF.btnPrimary}`}>
                  Connect channel
                </a>
              ) : null}
              <ol className="mt-4 space-y-3 text-sm text-[#aaa]">
                {YOUTUBE_SETUP_STEPS.slice(0, 4).map((s) => (
                  <li key={s.id}>{s.title}</li>
                ))}
              </ol>
            </section>
          ) : (
            <>
              <nav className="mt-6 flex gap-2 border-b border-[#303030] pb-2">
                {[
                  ['studio', 'Studio'],
                  ['production', 'Production'],
                  ['music', 'Music'],
                  ['analytics', 'Analytics'],
                  ['calendar', 'Calendar'],
                  ['content', 'Content'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectView(id)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                      view === id ? 'bg-white text-black' : 'text-[#aaa] hover:bg-[#272727]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>

              <div hidden={view !== 'analytics'} className="mt-6">
                <EofAnalyticsPanel analytics={data.analytics} />
              </div>

              <div hidden={view !== 'production'} className="mt-6">
                <EofProductionPanel
                  isOwner={isOwner}
                  active={view === 'production'}
                  onSendToStudio={(draft) => {
                    setStudioDraft(draft)
                    selectView('studio')
                  }}
                />
              </div>

              <div hidden={view !== 'music'} className="mt-6">
                <EofMusicLibrary />
              </div>

              <div hidden={view !== 'studio'} className="mt-6">
                <EofUploadStudio
                  canUse={canUpload}
                  isOwner={session?.isOwner}
                  initialDraft={studioDraft}
                  onInitialDraftConsumed={() => setStudioDraft(null)}
                  onDone={() => load()}
                />
              </div>

              <div hidden={view !== 'calendar'} className="mt-6 grid gap-6 lg:grid-cols-2">
                <EofPublishCalendar
                  calendar={data.calendar}
                  selectedDay={selectedDay}
                  onSelectDay={(day) => {
                    setSelectedDay(day)
                    selectView('content')
                  }}
                />
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-[#3ea6ff]">
                    {selectedDay ? `Videos on ${selectedDay}` : 'Select a day'}
                  </h3>
                  <EofProjectList
                    projects={data.projects}
                    calendar={data.calendar}
                    selectedDay={selectedDay}
                    isOwner={session?.canApprove}
                    onRefresh={load}
                  />
                </div>
              </div>

              <div hidden={view !== 'content'} className="mt-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Channel content</h2>
                  <button type="button" onClick={load} className={`text-xs ${EOF.link}`}>
                    Refresh
                  </button>
                </div>
                <EofProjectList
                  projects={data.projects}
                  calendar={data.calendar}
                  selectedDay={selectedDay}
                  isOwner={session?.canApprove}
                  onRefresh={load}
                />
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
