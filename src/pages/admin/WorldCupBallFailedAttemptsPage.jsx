import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { AdminPagination } from '../../components/admin/AdminPagination'
import { AdminHelpBanner, ADMIN_PAGE_SIZE } from '../../components/admin/AdminHelpBanner'
import { WORLD_CUP_BALL_ADMIN_HELP, WORLD_CUP_BALL_ADMIN_ROUTES } from '../../../shared/adminListCopy.mjs'
import { WORLD_CUP_BALL_GIVEAWAY_LABEL } from '../../../shared/worldCupBallGiveaway.mjs'

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default function WorldCupBallFailedAttemptsPage() {
  const [emailOnly, setEmailOnly] = useState(false)
  const [outcome, setOutcome] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    setPage(1)
  }, [emailOnly, outcome])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(ADMIN_PAGE_SIZE) })
      if (emailOnly) qs.set('emailOnly', '1')
      if (outcome) qs.set('outcome', outcome)
      const res = await apiFetch(`/api/admin/world-cup-ball-failed?${qs}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load')
      setRows(j.rows || [])
      setMeta({ total: j.total ?? 0, totalPages: j.totalPages ?? 1 })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [emailOnly, outcome, page])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/90">World Cup Ball</p>
        <h1 className="mt-1 text-xl font-semibold text-stone-100">Failed quiz attempts</h1>
        <p className="mt-2 text-sm text-stone-400">
          Every finished attempt that did not win the ball — lost or disqualified. Country is inferred from the
          visitor&apos;s IP at quiz start (Vercel geo headers). Email appears when the entrant saved it on the fail
          screen.
        </p>
      </div>

      <AdminHelpBanner title={`${WORLD_CUP_BALL_GIVEAWAY_LABEL} — failed attempts`}>
        {WORLD_CUP_BALL_ADMIN_HELP.failedAttempts}{' '}
        <Link to={WORLD_CUP_BALL_ADMIN_ROUTES.monthlyDraw} className="text-amber-400/90 underline">
          Monthly draw admin
        </Link>{' '}
        uses draw entry numbers from automatic monthly draw awards.{' '}
        <Link to={WORLD_CUP_BALL_ADMIN_ROUTES.entryLog} className="text-amber-400/90 underline">
          Entry log
        </Link>{' '}
        flow <span className="font-mono text-stone-400">world_cup_ball_failed_contact</span> records email saves.
      </AdminHelpBanner>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200">
          <input
            type="checkbox"
            checked={emailOnly}
            onChange={(e) => setEmailOnly(e.target.checked)}
            className="rounded border-white/20"
          />
          With email only
        </label>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200"
        >
          <option value="">All outcomes</option>
          <option value="lost">Lost</option>
          <option value="disqualified">Disqualified</option>
        </select>
      </div>

      {err ? <p className="text-sm text-red-300">{err}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-stone-900/60 text-xs uppercase tracking-wider text-stone-500">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Submitted</th>
              <th className="px-3 py-2.5 font-semibold">Email</th>
              <th className="px-3 py-2.5 font-semibold">Outcome</th>
              <th className="px-3 py-2.5 font-semibold">Draw entry</th>
              <th className="px-3 py-2.5 font-semibold">Country</th>
              <th className="px-3 py-2.5 font-semibold">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && !rows.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-stone-500">
                  Loading…
                </td>
              </tr>
            ) : null}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-stone-500">
                  No failed attempts yet.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.sessionId} className="text-stone-300">
                <td className="whitespace-nowrap px-3 py-2.5">{formatWhen(row.submittedAt)}</td>
                <td className="px-3 py-2.5">
                  {row.email ? (
                    <a href={`mailto:${row.email}`} className="text-amber-300/95 underline">
                      {row.email}
                    </a>
                  ) : (
                    <span className="text-stone-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 capitalize">{row.outcome || '—'}</td>
                <td className="px-3 py-2.5">
                  {row.drawEntryNumber ? (
                    <span>
                      <span className="font-mono text-amber-100/90">{row.drawEntryNumber}</span>
                      {row.drawMonthLabel ? (
                        <span className="mt-0.5 block text-xs text-stone-500">{row.drawMonthLabel}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-stone-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {row.countryName ? (
                    <span>
                      {row.countryName}
                      {row.countryCode ? (
                        <span className="mt-0.5 block font-mono text-xs text-stone-500">{row.countryCode}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-stone-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-stone-500">{row.ipAddress || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
    </div>
  )
}
