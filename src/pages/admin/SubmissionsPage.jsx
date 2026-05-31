import { Fragment, useCallback, useEffect, useState } from 'react'
import { apiFetch, apiUrl } from '../../lib/api'
import { AdminPagination } from '../../components/admin/AdminPagination'
import { AdminHelpBanner, ADMIN_PAGE_SIZE } from '../../components/admin/AdminHelpBanner'
import {
  AdminCompetitionSelect,
  competitionFilterLabel,
} from '../../components/admin/AdminCompetitionSelect'
import { SUBMISSIONS_PAGE_HELP } from '../../../shared/adminListCopy.mjs'
import { defaultGiveawayCompetitionSlug } from '../../../shared/adminCompetitions.mjs'

export default function AdminSubmissionsPage() {
  const [giveaway, setGiveaway] = useState(defaultGiveawayCompetitionSlug())
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 })
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debounced, giveaway])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(ADMIN_PAGE_SIZE) })
      if (debounced) qs.set('q', debounced)
      if (giveaway) qs.set('competition', giveaway)
      const res = await apiFetch(`/api/admin/submissions?${qs}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed')
      setRows(j.rows || [])
      setMeta({ total: j.total ?? 0, totalPages: j.totalPages ?? 1 })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [debounced, page, giveaway])

  useEffect(() => {
    load()
  }, [load])

  async function setStatus(id, review_status) {
    const res = await apiFetch('/api/admin/submissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, review_status }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert([j.error, j.hint].filter(Boolean).join('\n\n') || 'Update failed')
      return
    }
    load()
  }

  async function deleteSubmission(id) {
    const sid = id != null ? String(id).trim() : ''
    if (!sid) {
      alert('Cannot delete: missing submission id.')
      return
    }
    if (
      !window.confirm(
        'Delete this giveaway entry permanently? The database row and any uploaded file will be removed.',
      )
    ) {
      return
    }
    const res = await apiFetch('/api/admin/submissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sid, action: 'delete' }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert([j.error, j.hint].filter(Boolean).join('\n\n') || 'Delete failed')
      return
    }
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold text-stone-100">Giveaway entries</h1>
        <div className="flex flex-wrap items-end gap-3">
          <AdminCompetitionSelect
            kind="giveaway"
            value={giveaway}
            onChange={setGiveaway}
            allowAll={false}
            allLabel="All giveaways"
            label="Giveaway"
          />
          <input
            type="search"
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none"
          />
        </div>
      </div>

      <AdminHelpBanner title={`${competitionFilterLabel('giveaway', giveaway)} — separate from main draw`}>
        {SUBMISSIONS_PAGE_HELP}
      </AdminHelpBanner>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      {loading ? <p className="text-sm text-stone-500">Loading…</p> : null}

      {!loading ? (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/10 bg-stone-900/90 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-2.5 py-2 font-medium">Entry #</th>
                  <th className="px-2.5 py-2 font-medium">Name</th>
                  <th className="px-2.5 py-2 font-medium">Email</th>
                  <th className="px-2.5 py-2 font-medium">Status</th>
                  <th className="px-2.5 py-2 font-medium">When</th>
                  <th className="px-2.5 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((s) => {
                  const open = expandedId === s.id
                  const hasMedia = Boolean(s.video_ref)
                  return (
                    <Fragment key={s.id}>
                      <tr className="hover:bg-white/[0.03]">
                        <td className="whitespace-nowrap px-2.5 py-2 font-mono text-xs text-amber-200/90">
                          {s.entry_number || '—'}
                        </td>
                        <td className="max-w-[10rem] truncate px-2.5 py-2 font-medium text-stone-200">
                          {s.full_name}
                        </td>
                        <td className="max-w-[12rem] truncate px-2.5 py-2 text-stone-400">{s.email}</td>
                        <td className="px-2.5 py-2">
                          <StatusPill status={s.review_status} />
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2 text-stone-500">{formatDate(s.created_at)}</td>
                        <td className="px-2.5 py-2">
                          <div className="flex flex-wrap gap-1">
                            {hasMedia ? (
                              <MiniBtn onClick={() => setExpandedId(open ? null : s.id)}>
                                {open ? 'Hide' : 'View'}
                              </MiniBtn>
                            ) : null}
                            <MiniBtn onClick={() => setStatus(s.id, 'approved')}>Approve</MiniBtn>
                            <MiniBtn onClick={() => setStatus(s.id, 'rejected')}>Reject</MiniBtn>
                            <MiniBtn onClick={() => deleteSubmission(s.id)} danger>
                              Delete
                            </MiniBtn>
                          </div>
                        </td>
                      </tr>
                      {open && hasMedia ? (
                        <tr className="bg-black/25">
                          <td colSpan={6} className="px-2.5 py-2">
                            <SubmissionMedia s={s} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!rows.length ? <p className="px-3 py-4 text-sm text-stone-500">No submissions yet.</p> : null}
          <AdminPagination
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            pageSize={ADMIN_PAGE_SIZE}
            onPageChange={setPage}
            disabled={loading}
          />
        </div>
      ) : null}
    </div>
  )
}

function SubmissionMedia({ s }) {
  if (s.video_ref?.startsWith('answer:')) {
    return (
      <div className="rounded-lg border border-lime-500/25 bg-lime-950/20 px-3 py-2 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-lime-300/80">Qualification answer</p>
        <p className="mt-1 text-stone-200">
          {String(s.video_filename || '').replace(/^Answer:\s*/i, '') || '—'}
        </p>
        {s.admin_notes ? (
          <pre className="mt-2 whitespace-pre-wrap text-xs text-stone-500">{s.admin_notes}</pre>
        ) : null}
      </div>
    )
  }
  if (s.video_ref?.startsWith('local:')) {
    const src = apiUrl(`/api/admin/kickup-file?id=${encodeURIComponent(s.id)}`)
    return (
      <div className="space-y-2">
        <a href={src} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-teal-400 hover:underline">
          Open upload
        </a>
        <video
          controls
          playsInline
          className="max-h-48 w-full max-w-md rounded-lg border border-white/10 bg-black"
          src={src}
        />
      </div>
    )
  }
  if (s.video_ref) {
    return (
      <a href={s.video_ref} target="_blank" rel="noopener noreferrer" className="break-all text-teal-400 hover:underline">
        {s.video_ref}
      </a>
    )
  }
  return null
}

function StatusPill({ status }) {
  const cls =
    status === 'approved'
      ? 'bg-emerald-900/50 text-emerald-200'
      : status === 'rejected'
        ? 'bg-red-900/40 text-red-200'
        : 'bg-amber-900/40 text-amber-200'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>
}

function MiniBtn({ children, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-0.5 text-xs transition hover:bg-white/5 ${
        danger ? 'border-red-500/35 text-red-300' : 'border-white/10 text-stone-400 hover:text-stone-200'
      }`}
    >
      {children}
    </button>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}
