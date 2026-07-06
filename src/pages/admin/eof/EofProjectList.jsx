import { useState } from 'react'
import { apiFetch } from '../../../lib/api'
import { formatBytes, formatDuration } from '../../../../shared/eofYoutubeMeta.mjs'
import { EOF } from './eofStudioTheme'

function statusColor(status) {
  if (status === 'published') return 'text-[#2ba640]'
  if (status === 'failed') return 'text-[#ff4e45]'
  if (status === 'scheduled') return 'text-[#3ea6ff]'
  if (status === 'pending') return 'text-[#f9a825]'
  return 'text-[#aaa]'
}

export default function EofProjectList({ projects, selectedDay, calendar, isOwner, onRefresh, onSelectProject }) {
  const list = selectedDay && calendar[selectedDay] ? calendar[selectedDay] : projects

  if (!list.length) {
    return (
      <p className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-6 text-sm ${EOF.muted}`}>
        {selectedDay ? `No videos on ${selectedDay}.` : 'No videos yet — upload from Create.'}
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {list.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          isOwner={isOwner}
          onRefresh={onRefresh}
          onSelect={() => onSelectProject?.(p)}
        />
      ))}
    </ul>
  )
}

function ProjectCard({ project, isOwner, onRefresh, onSelect }) {
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const ytLink = project.youtubeVideoId
    ? `https://www.youtube.com/watch?v=${project.youtubeVideoId}`
    : null

  async function refreshChecks() {
    setBusy(true)
    try {
      await apiFetch('/api/admin/eof-upload-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh', projectId: project.id }),
      })
      onRefresh?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} overflow-hidden`}>
      <button
        type="button"
        onClick={() => {
          setExpanded((e) => !e)
          onSelect?.()
        }}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{project.title}</p>
          <p className={`mt-1 text-xs ${EOF.muted}`}>
            {project.contentType} · {project.visibility} · {project.uploadSource}
          </p>
        </div>
        <span className={`text-xs font-semibold capitalize ${statusColor(project.status)}`}>{project.status}</span>
      </button>

      {expanded ? (
        <div className="border-t border-[#303030] bg-[#0f0f0f] p-4 text-sm">
          {project.youtubeVideoId ? (
            <div className="mb-4 aspect-video max-w-md overflow-hidden rounded-lg bg-black">
              <iframe
                title={project.title}
                src={`https://www.youtube.com/embed/${project.youtubeVideoId}`}
                className="h-full w-full"
                allowFullScreen
              />
            </div>
          ) : null}

          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <Row label="Views" value={project.viewCount?.toLocaleString?.() ?? '0'} />
            <Row label="Duration" value={formatDuration(project.durationSeconds)} />
            <Row label="File size" value={formatBytes(project.fileSizeBytes)} />
            <Row label="Made for kids" value={project.madeForKids ? 'Yes' : 'No'} />
            <Row label="AI disclosure" value={project.containsSyntheticMedia ? 'Yes' : 'No'} />
            <Row label="Paid promo" value={project.paidPromotion ? 'Yes' : 'No'} />
          </dl>

          {project.checks ? (
            <div className="mt-3 space-y-2">
              <CheckPill label="Copyright" status={project.checks.copyright?.status} />
              <CheckPill label="Guidelines" status={project.checks.guidelines?.status} />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {ytLink ? (
              <a href={ytLink} target="_blank" rel="noopener noreferrer" className={`text-xs ${EOF.link} underline`}>
                Open on YouTube
              </a>
            ) : null}
            <button type="button" disabled={busy} onClick={refreshChecks} className={`text-xs ${EOF.link}`}>
              Refresh checks & views
            </button>
          </div>

          {isOwner && project.status === 'pending' ? (
            <ApproveBar projectId={project.id} onRefresh={onRefresh} />
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function Row({ label, value }) {
  return (
    <div>
      <dt className="text-[#717171]">{label}</dt>
      <dd className="text-white">{value}</dd>
    </div>
  )
}

function CheckPill({ label, status }) {
  const bg =
    status === 'clear'
      ? 'bg-[#1e3a28] text-[#2ba640]'
      : status === 'issues'
        ? 'bg-[#3a1e1e] text-[#ff4e45]'
        : 'bg-[#272727] text-[#3ea6ff]'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${bg}`}>
      {label}: {status || 'checking'}
    </span>
  )
}

function ApproveBar({ projectId, onRefresh }) {
  const [scheduleAt, setScheduleAt] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function approve(publishNow) {
    setBusy(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/eof-upload-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          projectId,
          publishNow,
          visibility,
          scheduledAt: !publishNow && scheduleAt ? new Date(scheduleAt).toISOString() : null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed')
      onRefresh?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 border-t border-[#303030] pt-4">
      <p className="text-xs font-semibold text-[#3ea6ff]">Approve editor upload</p>
      <select
        value={visibility}
        onChange={(e) => setVisibility(e.target.value)}
        className={`mt-2 rounded border px-2 py-1 text-xs ${EOF.input}`}
      >
        <option value="public">Public</option>
        <option value="unlisted">Unlisted</option>
        <option value="private">Private</option>
      </select>
      <input
        type="datetime-local"
        value={scheduleAt}
        onChange={(e) => setScheduleAt(e.target.value)}
        className={`mt-2 block rounded border px-2 py-1 text-xs ${EOF.input}`}
      />
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy} onClick={() => approve(true)} className={`rounded-full px-3 py-1 text-xs ${EOF.btnPrimary}`}>
          Publish now
        </button>
        <button
          type="button"
          disabled={busy || !scheduleAt}
          onClick={() => approve(false)}
          className={`rounded-full px-3 py-1 text-xs ${EOF.btnSecondary}`}
        >
          Schedule
        </button>
      </div>
      {err ? <p className="mt-1 text-xs text-[#ff4e45]">{err}</p> : null}
    </div>
  )
}
