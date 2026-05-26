import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { AdminPagination } from '../../components/admin/AdminPagination'
import { AdminHelpBanner, ADMIN_PAGE_SIZE } from '../../components/admin/AdminHelpBanner'
import { ENTRY_ATTEMPTS_PAGE_HELP } from '../../../shared/adminListCopy.mjs'

export default function EntryAttemptsPage() {
  const [flow, setFlow] = useState('')
  const [outcome, setOutcome] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    setPage(1)
  }, [flow, outcome])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(ADMIN_PAGE_SIZE) })
      if (flow) qs.set('flow', flow)
      if (outcome) qs.set('outcome', outcome)
      const res = await apiFetch(`/api/admin/entry-attempts?${qs}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load')
      setRows(j.rows || [])
      setMeta({ total: j.total ?? 0, totalPages: j.totalPages ?? 1 })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [flow, outcome, page])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-100">Entry attempt log</h1>
      </div>

      <AdminHelpBanner title="Free-route security log (not the skill quiz)">
        {ENTRY_ATTEMPTS_PAGE_HELP}
      </AdminHelpBanner>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={flow}
          onChange={(e) => setFlow(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200"
        >
          <option value="">All flows</option>
          <option value="legacy_free_online">Legacy free online</option>
          <option value="shirt_giveaway">Shirt giveaway</option>
        </select>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200"
        >
          <option value="">All outcomes</option>
          <option value="blocked">Blocked</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="setup_created">Setup created</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm text-stone-300 hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      {loading ? <p className="text-sm text-stone-500">Loading…</p> : null}

      {!loading ? (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-white/10 bg-stone-900/90 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-2.5 py-2 font-medium">When</th>
                  <th className="px-2.5 py-2 font-medium">Flow</th>
                  <th className="px-2.5 py-2 font-medium">Outcome</th>
                  <th className="px-2.5 py-2 font-medium">Name / email</th>
                  <th className="px-2.5 py-2 font-medium">IP</th>
                  <th className="px-2.5 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <tr key={row.id} className="text-stone-300 hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-2.5 py-2 text-stone-500">
                      {row.created_at ? formatDate(row.created_at) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2 font-mono text-xs">{row.flow}</td>
                    <td className="px-2.5 py-2">
                      <span
                        className={
                          row.outcome === 'blocked'
                            ? 'font-medium text-amber-300'
                            : row.outcome === 'success'
                              ? 'font-medium text-emerald-300'
                              : 'text-stone-400'
                        }
                      >
                        {row.outcome}
                      </span>
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="font-medium text-stone-200">{row.full_name || '—'}</div>
                      <div className="text-xs text-stone-500">{row.email}</div>
                    </td>
                    <td className="px-2.5 py-2 font-mono text-xs text-stone-500">{row.ip_address || '—'}</td>
                    <td className="max-w-[14rem] truncate px-2.5 py-2 text-xs text-stone-500" title={row.block_reason || ''}>
                      {row.block_reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length ? (
            <p className="px-3 py-4 text-center text-sm text-stone-500">No log rows yet.</p>
          ) : null}
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

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}
