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

function ProjectStatusPill({ status }) {
  const styles = {
    uploading: 'bg-sky-500/15 text-sky-200',
    pending: 'bg-amber-500/15 text-amber-200',
    scheduled: 'bg-violet-500/15 text-violet-200',
    published: 'bg-emerald-500/15 text-emerald-300',
    failed: 'bg-red-500/15 text-red-300',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[status] || 'bg-white/10 text-stone-300'}`}
    >
      {status}
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

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

async function uploadShortToYoutube({ title, description, uploadSource, scheduledAt, file, onProgress }) {
  const initRes = await apiFetch('/api/admin/eof-upload-init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      description,
      uploadSource,
      scheduledAt: scheduledAt || null,
      contentType: file.type || 'video/mp4',
    }),
  })
  const init = await initRes.json().catch(() => ({}))
  if (!initRes.ok) throw new Error(init.error || 'Could not start upload')

  onProgress?.('Uploading video to YouTube…')

  const putRes = await fetch(init.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'video/mp4' },
    body: file,
  })
  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => '')
    throw new Error(`YouTube upload failed (${putRes.status}). ${detail.slice(0, 180)}`)
  }

  const ytVideo = await putRes.json().catch(() => ({}))
  const youtubeVideoId = ytVideo?.id
  if (!youtubeVideoId) {
    throw new Error('YouTube did not return a video ID after upload.')
  }

  onProgress?.('Saving project…')

  const completeRes = await apiFetch('/api/admin/eof-upload-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: init.projectId, youtubeVideoId }),
  })
  const complete = await completeRes.json().catch(() => ({}))
  if (!completeRes.ok) throw new Error(complete.error || 'Could not save upload')
  return complete.project
}

function UploadForm({ uploadSource, label, hint, canUse, scheduledAllowed, onDone }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [formErr, setFormErr] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canUse || !file) return
    setBusy(true)
    setFormErr('')
    setProgress('Starting…')
    try {
      let scheduleIso = null
      if (scheduledAllowed && scheduledAt) {
        const d = new Date(scheduledAt)
        if (Number.isNaN(d.getTime())) throw new Error('Invalid schedule time')
        if (d <= new Date()) throw new Error('Schedule time must be in the future')
        scheduleIso = d.toISOString()
      }
      await uploadShortToYoutube({
        title: title.trim(),
        description: description.trim(),
        uploadSource,
        scheduledAt: scheduleIso,
        file,
        onProgress: setProgress,
      })
      setTitle('')
      setDescription('')
      setScheduledAt('')
      setFile(null)
      setProgress('')
      onDone?.()
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Upload failed')
      setProgress('')
    } finally {
      setBusy(false)
    }
  }

  if (!canUse) {
    return (
      <p className="text-sm text-stone-500">
        {uploadSource === 'admin'
          ? 'Sign in with your channel owner username (ADMIN_USER) to use admin upload.'
          : 'YouTube must be connected before editors can upload.'}
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <p className="text-sm text-stone-400">{hint}</p>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">Title</label>
        <input
          type="text"
          required
          minLength={3}
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-stone-950/60 px-3 py-2 text-sm text-stone-100"
          placeholder="Short title"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">Description</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-stone-950/60 px-3 py-2 text-sm text-stone-100"
          placeholder="Optional description / hashtags"
        />
      </div>
      {scheduledAllowed ? (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">
            Schedule publish (optional)
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-lg border border-white/10 bg-stone-950/60 px-3 py-2 text-sm text-stone-100"
          />
          <p className="mt-1 text-xs text-stone-500">Leave empty to publish immediately as public.</p>
        </div>
      ) : null}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">Video file</label>
        <input
          type="file"
          accept="video/*"
          required
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mt-1 block w-full text-sm text-stone-400 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        <p className="mt-1 text-xs text-stone-500">Vertical Shorts work best (9:16, under 60 seconds).</p>
      </div>
      {formErr ? <p className="text-sm text-red-300">{formErr}</p> : null}
      {progress ? <p className="text-sm text-emerald-200/90">{progress}</p> : null}
      <button
        type="submit"
        disabled={busy || !file || title.trim().length < 3}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? 'Uploading…' : label}
      </button>
    </form>
  )
}

function ProjectRow({ project, isOwner, onRefresh }) {
  const [busy, setBusy] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')
  const [actionErr, setActionErr] = useState('')

  async function approve(publishNow) {
    setBusy(true)
    setActionErr('')
    try {
      let scheduledIso = null
      if (!publishNow && scheduleAt) {
        const d = new Date(scheduleAt)
        if (Number.isNaN(d.getTime()) || d <= new Date()) {
          throw new Error('Pick a future schedule time or use Publish now')
        }
        scheduledIso = d.toISOString()
      }
      const res = await apiFetch('/api/admin/eof-upload-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          projectId: project.id,
          publishNow,
          scheduledAt: scheduledIso,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Approve failed')
      onRefresh?.()
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  const ytLink = project.youtubeVideoId
    ? `https://www.youtube.com/watch?v=${project.youtubeVideoId}`
    : null

  return (
    <li className="rounded-lg border border-white/10 bg-stone-950/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-100">{project.title}</p>
          <p className="mt-1 text-xs text-stone-500">
            {project.uploadSource} · {project.submittedBy} · {formatWhen(project.createdAt)}
          </p>
        </div>
        <ProjectStatusPill status={project.status} />
      </div>
      {project.description ? (
        <p className="mt-2 text-sm text-stone-400 line-clamp-2">{project.description}</p>
      ) : null}
      {project.scheduledAt ? (
        <p className="mt-2 text-xs text-violet-200/90">Scheduled: {formatWhen(project.scheduledAt)}</p>
      ) : null}
      {project.errorMessage ? (
        <p className="mt-2 text-xs text-red-300">{project.errorMessage}</p>
      ) : null}
      {ytLink ? (
        <a
          href={ytLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-emerald-400 underline"
        >
          View on YouTube
        </a>
      ) : null}
      {isOwner && project.status === 'pending' ? (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Approve editor upload</p>
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-white/10 bg-stone-950/60 px-3 py-2 text-sm text-stone-100"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => approve(true)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Publish now
            </button>
            <button
              type="button"
              disabled={busy || !scheduleAt}
              onClick={() => approve(false)}
              className="rounded-lg border border-violet-500/40 bg-violet-950/30 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-900/40 disabled:opacity-50"
            >
              Schedule
            </button>
          </div>
          {actionErr ? <p className="text-xs text-red-300">{actionErr}</p> : null}
        </div>
      ) : null}
    </li>
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
  const session = data?.session
  const projects = data?.projects || []
  const ready = Boolean(yt?.isReadyToPublish)

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-black/30 to-stone-950/60 p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300/90">Staging only</p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-50">{EYES_OF_FOOTBALL_ADMIN_TITLE}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-400">
          YouTube Shorts hub for <strong className="text-stone-200">{EYES_OF_FOOTBALL_PRODUCT_NAME}</strong>.
          Editors upload as private drafts; you approve and schedule. Admin upload (your username only) can publish or
          schedule directly.
        </p>
        {session?.username ? (
          <p className="mt-3 text-xs text-stone-500">
            Signed in as <code className="text-emerald-200">{session.username}</code>
            {session.isOwner ? ' (channel owner)' : session.isEditor ? ' (editor)' : ''}
          </p>
        ) : null}
        {session?.isOwner ? (
          <p className="mt-3 text-xs text-stone-500">
            ShowSkills admin →{' '}
            <Link to="/admin/dashboard" className="text-emerald-400/90 underline">
              Back to main dashboard
            </Link>
          </p>
        ) : null}
      </div>

      {err ? <p className="text-sm text-red-300">{err}</p> : null}
      {loading && !data ? <p className="text-stone-500">Loading…</p> : null}

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
            {!yt.isReadyToPublish && yt.oauthConnectUrl ? (
              <a
                href={yt.oauthConnectUrl}
                className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Connect YouTube channel
              </a>
            ) : null}
          </section>

          {ready ? (
            <>
              <section className="rounded-xl border border-white/10 bg-black/25 p-5">
                <h2 className="text-lg font-semibold text-stone-100">Editor upload</h2>
                <p className="mt-1 text-sm text-stone-400">
                  Uploads go to YouTube as <strong className="text-stone-300">private</strong> until you approve.
                  {data?.editorLoginConfigured
                    ? ' Editors sign in with EOF_EDITOR_USER (separate from your admin login).'
                    : ' Set EOF_EDITOR_USER + EOF_EDITOR_PASSWORD on staging to give editors their own login.'}
                </p>
                <UploadForm
                  uploadSource="editor"
                  label="Submit for review"
                  hint="Video stays private on the channel until the owner approves."
                  canUse={ready && (session?.isOwner || session?.isEditor)}
                  scheduledAllowed={false}
                  onDone={load}
                />
              </section>

              {session?.canAdminUpload ? (
                <section className="rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-5">
                  <h2 className="text-lg font-semibold text-stone-100">Admin upload (owner only)</h2>
                  <p className="mt-1 text-sm text-stone-400">
                    Only available when signed in as <code className="text-emerald-200">ADMIN_USER</code>. Publish
                    immediately or pick a schedule time.
                  </p>
                  <UploadForm
                    uploadSource="admin"
                    label="Upload & publish"
                    hint="Public immediately, or private with a scheduled publish time."
                    canUse={ready && session.canAdminUpload}
                    scheduledAllowed
                    onDone={load}
                  />
                </section>
              ) : null}

              <section className="rounded-xl border border-white/10 bg-black/25 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-stone-100">Project queue</h2>
                  <button
                    type="button"
                    onClick={load}
                    className="text-xs text-emerald-400 underline"
                  >
                    Refresh
                  </button>
                </div>
                {projects.length === 0 ? (
                  <p className="mt-4 text-sm text-stone-500">No projects yet — upload a test Short above.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {projects.map((p) => (
                      <ProjectRow
                        key={p.id}
                        project={p}
                        isOwner={session?.canApprove}
                        onRefresh={load}
                      />
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : (
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
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-4 rounded-lg border border-white/10 bg-stone-950/40 px-4 py-2">
                {Object.entries(YOUTUBE_ENV_KEYS).map(([, key]) => (
                  <EnvRow key={key} name={key} configured={Boolean(yt.env?.[key])} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  )
}