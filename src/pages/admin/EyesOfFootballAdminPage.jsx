import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { isShowSkillsStagingClientEnabled } from '../../../shared/stagingSite.mjs'
import {
  EYES_OF_FOOTBALL_ADMIN_TITLE,
  EYES_OF_FOOTBALL_PRODUCT_NAME,
  YOUTUBE_ENV_KEYS,
  YOUTUBE_SETUP_STEPS,
} from '../../../shared/eyesOfFootball.mjs'

function StatusPill({ ok, label }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'
      }`}
    >
      {label}
    </span>
  )
}

function EnvRow({ name, configured }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2 text-sm last:border-0">
      <code className="text-amber-100/90">{name}</code>
      <StatusPill ok={configured} label={configured ? 'Set' : 'Missing'} />
    </div>
  )
}

export default function EyesOfFootballAdminPage() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/eyes-of-football')
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load')
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

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-black/30 to-stone-950/60 p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300/90">Staging only</p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-50">{EYES_OF_FOOTBALL_ADMIN_TITLE}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-400">
          YouTube Shorts hub for <strong className="text-stone-200">{EYES_OF_FOOTBALL_PRODUCT_NAME}</strong>.
          Editors will drop projects here without access to your channel; after you connect YouTube once, approved
          Shorts can publish automatically.
        </p>
        <p className="mt-3 text-xs text-stone-500">
          ShowSkills admin →{' '}
          <Link to="/admin/dashboard" className="text-emerald-400/90 underline">
            Back to main dashboard
          </Link>
        </p>
      </div>

      {err ? <p className="text-sm text-red-300">{err}</p> : null}
      {loading && !data ? <p className="text-stone-500">Loading setup…</p> : null}

      {yt ? (
        <>
          <section className="rounded-xl border border-white/10 bg-black/25 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-stone-100">YouTube connection</h2>
              <StatusPill
                ok={yt.isReadyToPublish}
                label={yt.isReadyToPublish ? 'Ready to publish' : 'Not connected yet'}
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="OAuth client" ok={yt.hasOAuthClient} />
              <Stat label="Refresh token" ok={yt.hasRefreshToken} />
              <Stat label="Channel ID" ok={Boolean(yt.channelId)} />
              <Stat label="Redirect URI" ok={Boolean(yt.redirectUri)} />
            </div>
            {yt.channelId ? (
              <p className="mt-4 text-sm text-stone-400">
                Channel ID: <code className="text-emerald-200">{yt.channelId}</code>
              </p>
            ) : null}
            {yt.redirectUri ? (
              <div className="mt-4 rounded-lg border border-white/10 bg-stone-950/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">OAuth redirect URI</p>
                <p className="mt-1 break-all font-mono text-xs text-emerald-100/90">{yt.redirectUri}</p>
                <p className="mt-2 text-xs text-stone-500">
                  Add this exact URL under Google Cloud → Credentials → your OAuth client → Authorized redirect
                  URIs.
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-white/10 bg-black/25 p-5">
            <h2 className="text-lg font-semibold text-stone-100">What to give us (Vercel staging env)</h2>
            <p className="mt-2 text-sm text-stone-400">
              Set these in your staging project on Vercel. Never commit secrets to git.
            </p>
            <div className="mt-4 rounded-lg border border-white/10 bg-stone-950/40 px-4 py-2">
              {Object.entries(YOUTUBE_ENV_KEYS).map(([, key]) => (
                <EnvRow key={key} name={key} configured={Boolean(yt.env?.[key])} />
              ))}
            </div>
            {yt.masked?.clientId ? (
              <p className="mt-3 text-xs text-stone-500">
                Client ID (masked): <code>{yt.masked.clientId}</code>
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-white/10 bg-black/25 p-5">
            <h2 className="text-lg font-semibold text-stone-100">Setup checklist</h2>
            <ol className="mt-4 space-y-4">
              {YOUTUBE_SETUP_STEPS.map((step, index) => (
                <li key={step.id} className="flex gap-3 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-300">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-stone-200">{step.title}</p>
                    <p className="mt-1 leading-relaxed text-stone-400">{step.detail}</p>
                    {step.envKeys?.length ? (
                      <p className="mt-1 font-mono text-xs text-amber-200/80">{step.envKeys.join(', ')}</p>
                    ) : null}
                    {step.docUrl ? (
                      <a
                        href={step.docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-emerald-400 underline"
                      >
                        Open in Google / YouTube
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-950/10 p-5">
            <h2 className="text-lg font-semibold text-stone-100">Connect channel (one-time)</h2>
            {yt.isReadyToPublish ? (
              <p className="mt-2 text-sm text-emerald-200/90">
                Refresh token is configured. Next step: editor upload queue and Shorts publish (coming on staging).
              </p>
            ) : yt.hasOAuthClient ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-stone-400">
                  Client ID and secret are set. Sign in as the <strong className="text-stone-200">channel owner</strong>{' '}
                  to authorize upload access. We will store a refresh token server-side only.
                </p>
                <a
                  href={yt.oauthConnectUrl || '#'}
                  className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  onClick={(e) => {
                    if (!yt.oauthConnectUrl) e.preventDefault()
                  }}
                >
                  Connect YouTube channel
                </a>
                <p className="text-xs text-stone-500">
                  Opens Google OAuth as the channel owner. Callback URL is listed above.
                </p>
                <p className="text-xs text-amber-200/80">
                  After Google redirects back, send us the authorization code or we finish token exchange once wired.
                  You can also paste <code>YOUTUBE_REFRESH_TOKEN</code> manually in Vercel if you generate it locally.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-stone-400">
                Add <code className="text-amber-100">YOUTUBE_CLIENT_ID</code> and{' '}
                <code className="text-amber-100">YOUTUBE_CLIENT_SECRET</code> on staging first.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-white/10 bg-black/25 p-5">
            <h2 className="text-lg font-semibold text-stone-100">Editor projects</h2>
            <p className="mt-2 text-sm text-stone-400">{data?.projectsNote}</p>
            <div className="mt-4 rounded-lg border border-dashed border-white/15 px-4 py-8 text-center text-sm text-stone-500">
              No projects yet — upload queue appears after YouTube is connected.
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}

function Stat({ label, ok }) {
  return (
    <div className="rounded-lg border border-white/10 bg-stone-950/40 px-3 py-2.5">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${ok ? 'text-emerald-300' : 'text-amber-200'}`}>
        {ok ? 'OK' : 'Missing'}
      </p>
    </div>
  )
}
