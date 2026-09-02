import { Fragment, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiFetch, apiUrl } from '../../lib/api'
import { AdminPagination } from '../../components/admin/AdminPagination'
import { AdminHelpBanner, ADMIN_PAGE_SIZE } from '../../components/admin/AdminHelpBanner'
import {
  AdminCompetitionSelect,
  competitionFilterLabel,
} from '../../components/admin/AdminCompetitionSelect'
import {
  SUBMISSIONS_PAGE_HELP,
  WORLD_CUP_BALL_ADMIN_HELP,
} from '../../../shared/adminListCopy.mjs'
import {
  defaultGiveawayCompetitionSlug,
  isGiveawayCompetitionSlug,
} from '../../../shared/adminCompetitions.mjs'
import { WORLD_CUP_BALL_GIVEAWAY_LABEL, WORLD_CUP_BALL_GIVEAWAY_SLUG } from '../../../shared/worldCupBallGiveaway.mjs'

export default function AdminSubmissionsPage() {
  const [searchParams] = useSearchParams()
  const initialGiveaway =
    (searchParams.get('competition') || '').trim() &&
    isGiveawayCompetitionSlug(searchParams.get('competition'))
      ? searchParams.get('competition').trim()
      : defaultGiveawayCompetitionSlug()
  const [giveaway, setGiveaway] = useState(initialGiveaway)
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 })
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [emailTarget, setEmailTarget] = useState(null)

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
        {giveaway === WORLD_CUP_BALL_GIVEAWAY_SLUG
          ? `${WORLD_CUP_BALL_ADMIN_HELP.submissions} ${SUBMISSIONS_PAGE_HELP}`
          : SUBMISSIONS_PAGE_HELP}
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
                  const hasDetails = hasMedia || isWorldCupBallWinnerEntry(s)
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
                            {hasDetails ? (
                              <MiniBtn onClick={() => setExpandedId(open ? null : s.id)}>
                                {open ? 'Hide' : 'Details'}
                              </MiniBtn>
                            ) : null}
                            <MiniBtn onClick={() => setStatus(s.id, 'approved')}>Approve</MiniBtn>
                            <MiniBtn onClick={() => setStatus(s.id, 'rejected')}>Reject</MiniBtn>
                            {isWorldCupBallWinnerEntry(s) && s.email ? (
                              <MiniBtn onClick={() => setEmailTarget(s)}>Email</MiniBtn>
                            ) : null}
                            <MiniBtn onClick={() => deleteSubmission(s.id)} danger>
                              Delete
                            </MiniBtn>
                          </div>
                        </td>
                      </tr>
                      {open && hasDetails ? (
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
      {emailTarget ? (
        <SendEmailModal submission={emailTarget} onClose={() => setEmailTarget(null)} />
      ) : null}
    </div>
  )
}

function isWorldCupBallWinnerEntry(s) {
  return (
    s.competition === WORLD_CUP_BALL_GIVEAWAY_SLUG || s.video_ref === 'skill:world-cup-ball-giveaway'
  )
}

function SendEmailModal({ submission, onClose }) {
  const isCashWinner = submission.winner_prize_fulfilment === 'international_cash'
  const [to, setTo] = useState(submission.email || '')
  const [subject, setSubject] = useState(`Your ${WORLD_CUP_BALL_GIVEAWAY_LABEL} prize`)
  const [message, setMessage] = useState(
    `Congratulations again on your win, ${submission.full_name || ''}!\n\n`,
  )
  const [attachCheque, setAttachCheque] = useState(isCashWinner)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  async function send() {
    setSending(true)
    setResult(null)
    try {
      const res = await apiFetch('/api/admin/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          message,
          recipientName: submission.full_name,
          submissionId: submission.id,
          attachCheque,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) {
        const errMsg = typeof j.error === 'string' && j.error ? j.error : 'Send failed'
        setResult({ ok: false, error: errMsg })
      } else {
        setResult({
          ok: true,
          note: j.sandboxRedirect
            ? `Sent (sandbox mode — delivered to ${j.deliveredTo})`
            : j.chequeAttached
              ? 'Sent with winner\u2019s cheque attached.'
              : 'Sent.',
        })
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Send failed' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      {/*
       * Deliberately no click-outside-to-close on this backdrop. It was reported that the
       * modal appears to close while typing in the message box — a click-outside-style
       * close is the only mechanism that can dismiss this modal from arbitrary DOM
       * activity, so it's removed entirely rather than trying to out-guess the trigger
       * (mobile keyboard/viewport resize, a browser extension mutating the textarea, etc).
       * The modal now only closes via the explicit Cancel/✕ buttons.
       */}
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-stone-900 p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-100">Send email from sales@showskills.co.uk</h3>
          <button type="button" onClick={onClose} className="text-stone-500 hover:text-stone-300">
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <Field label="To">
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm text-stone-200"
            />
          </Field>
          <Field label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm text-stone-200"
            />
          </Field>
          <Field label="Message">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full rounded border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm text-stone-200"
            />
          </Field>
          {isCashWinner ? (
            <label className="flex items-center gap-2 text-xs text-stone-400">
              <input
                type="checkbox"
                checked={attachCheque}
                onChange={(e) => setAttachCheque(e.target.checked)}
              />
              Attach auto-generated winner&rsquo;s cheque (${submission.winner_cash_prize_usd || ''} USD, ref{' '}
              {submission.entry_number})
            </label>
          ) : null}
          {result ? (
            <p className={`text-xs ${result.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {result.ok ? result.note : result.error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <MiniBtn onClick={onClose}>Cancel</MiniBtn>
            <button
              type="button"
              onClick={send}
              disabled={sending || !to.includes('@') || !subject.trim() || !message.trim()}
              className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-stone-500">{label}</span>
      {children}
    </label>
  )
}

function SubmissionMedia({ s }) {
  if (isWorldCupBallWinnerEntry(s)) {
    const addressParts = [
      s.winner_address_line1 || null,
      s.winner_address_line2 || null,
      s.winner_city || null,
      s.winner_postcode || null,
    ].filter(Boolean)
    return (
      <div className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/80">{WORLD_CUP_BALL_GIVEAWAY_LABEL} winner</p>
        <dl className="mt-2 grid gap-1.5 text-stone-300 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-stone-500">Win reference</dt>
            <dd className="font-mono text-amber-100">{s.entry_number || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Phone</dt>
            <dd>{s.winner_phone || String(s.video_filename || '').replace(/^Phone:\s*/i, '') || '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-stone-500">UK delivery address</dt>
            <dd>{addressParts.length ? addressParts.join(', ') : '—'}</dd>
          </div>
          {s.winner_email_sent_at ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-stone-500">Winner email sent</dt>
              <dd className="text-stone-400">{formatDate(s.winner_email_sent_at)}</dd>
            </div>
          ) : null}
        </dl>
        {s.admin_notes ? (
          <pre className="mt-3 whitespace-pre-wrap rounded-md border border-white/5 bg-black/20 p-2.5 text-xs text-stone-500">
            {s.admin_notes}
          </pre>
        ) : null}
      </div>
    )
  }
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
