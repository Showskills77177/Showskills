import { useCallback, useEffect, useState } from 'react'
import { apiFetch, apiUrl } from '../../lib/api'

export default function AdminSubmissionsPage() {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const qs = new URLSearchParams({ limit: '100' })
      if (debounced) qs.set('q', debounced)
      const res = await apiFetch(`/api/admin/submissions?${qs}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed')
      setRows(j.rows || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [debounced])

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
      const msg = [j.error, j.hint].filter(Boolean).join('\n\n')
      alert(msg || 'Update failed')
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
        'Delete this giveaway entry permanently? The database row will be removed and any uploaded file on disk will be deleted.',
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
      const msg = [j.error, j.hint].filter(Boolean).join('\n\n')
      alert(msg || 'Delete failed')
      return
    }
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-100">Free shirt giveaway</h1>
          <p className="mt-1 text-sm text-stone-500">
            Ronaldo shirt giveaway entries and any older uploaded/video submissions are listed here for review.
          </p>
        </div>
        <input
          type="search"
          placeholder="Search name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none"
        />
      </div>
      {err ? <p className="text-red-400">{err}</p> : null}
      {loading ? <p className="text-stone-500">Loading…</p> : null}
      {!loading ? (
        <div className="space-y-4">
          {rows.map((s) => (
            <article
              key={s.id}
              className="rounded-xl border border-white/10 bg-stone-900/40 p-4 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-stone-200">{s.full_name}</p>
                  <p className="text-stone-500">{s.email}</p>
                  <p className="mt-1 text-xs text-stone-500">{formatDate(s.created_at)}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.review_status === 'approved'
                      ? 'bg-emerald-900/50 text-emerald-200'
                      : s.review_status === 'rejected'
                        ? 'bg-red-900/40 text-red-200'
                        : 'bg-amber-900/40 text-amber-200'
                  }`}
                >
                  {s.review_status}
                </span>
              </div>
              {s.video_ref ? (
                <div className="mt-3 space-y-2">
                  {s.video_ref.startsWith('answer:') ? (
                    <div className="rounded-lg border border-lime-500/25 bg-lime-950/20 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-lime-300/80">
                        Qualification answer
                      </p>
                      <p className="mt-1 text-sm text-stone-200">
                        {String(s.video_filename || '').replace(/^Answer:\s*/i, '') || '—'}
                      </p>
                      {s.admin_notes ? (
                        <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-stone-500">{s.admin_notes}</pre>
                      ) : null}
                    </div>
                  ) : s.video_ref.startsWith('local:') ? (
                    <>
                      <a
                        href={apiUrl(`/api/admin/kickup-file?id=${encodeURIComponent(s.id)}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-sm font-medium text-teal-400 hover:underline"
                      >
                        View upload (opens in new tab)
                      </a>
                      <video
                        controls
                        playsInline
                        className="max-h-56 w-full max-w-md rounded-lg border border-white/10 bg-black"
                        src={apiUrl(`/api/admin/kickup-file?id=${encodeURIComponent(s.id)}`)}
                      />
                    </>
                  ) : (
                    <a
                      href={s.video_ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-teal-400 hover:underline"
                    >
                      {s.video_ref}
                    </a>
                  )}
                </div>
              ) : null}
              {s.video_filename && !s.video_ref?.startsWith('answer:') ? (
                <p className="mt-1 text-xs text-stone-500">Filename note: {s.video_filename}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-2 py-1 text-xs text-stone-300 hover:bg-white/5"
                  onClick={() => setStatus(s.id, 'approved')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-2 py-1 text-xs text-stone-300 hover:bg-white/5"
                  onClick={() => setStatus(s.id, 'rejected')}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-2 py-1 text-xs text-stone-300 hover:bg-white/5"
                  onClick={() => setStatus(s.id, 'pending')}
                >
                  Mark pending
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-red-500/35 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
                  onClick={() => deleteSubmission(s.id)}
                >
                  Delete entry
                </button>
              </div>
            </article>
          ))}
          {!rows.length ? <p className="text-stone-500">No submissions yet.</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return String(iso)
  }
}
