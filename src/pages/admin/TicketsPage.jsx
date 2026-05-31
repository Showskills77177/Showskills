import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { AdminPagination } from '../../components/admin/AdminPagination'
import { AdminHelpBanner, ADMIN_PAGE_SIZE } from '../../components/admin/AdminHelpBanner'
import {
  AdminCompetitionSelect,
  competitionFilterLabel,
} from '../../components/admin/AdminCompetitionSelect'
import { TICKETS_PAGE_HELP } from '../../../shared/adminListCopy.mjs'
import { defaultMainDrawCompetitionSlug } from '../../../shared/adminCompetitions.mjs'

export default function AdminTicketsPage() {
  const [competition, setCompetition] = useState(defaultMainDrawCompetitionSlug())
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debounced, competition])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(ADMIN_PAGE_SIZE) })
      if (debounced) qs.set('q', debounced)
      if (competition) qs.set('competition', competition)
      const res = await apiFetch(`/api/admin/tickets?${qs}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed')
      setRows(j.rows || [])
      setMeta({ total: j.total ?? 0, totalPages: j.totalPages ?? 1 })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [debounced, page, competition])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold text-stone-100">Tickets</h1>
        <div className="flex flex-wrap items-end gap-3">
          <AdminCompetitionSelect
            kind="mainDraw"
            value={competition}
            onChange={setCompetition}
            allowAll={false}
            label="Main prize draw"
          />
          <input
            type="search"
            placeholder="Search order ID, name, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none"
          />
        </div>
      </div>

      <AdminHelpBanner title={`Paid and free ticket orders — ${competitionFilterLabel('mainDraw', competition)}`}>
        {TICKETS_PAGE_HELP}
      </AdminHelpBanner>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      {loading ? <p className="text-sm text-stone-500">Loading…</p> : null}

      {!loading ? (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-white/10 bg-stone-900/90 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-2.5 py-2 font-medium">Order</th>
                  <th className="px-2.5 py-2 font-medium">Period</th>
                  <th className="px-2.5 py-2 font-medium">Draw numbers</th>
                  <th className="px-2.5 py-2 font-medium">Customer</th>
                  <th className="px-2.5 py-2 font-medium">Bundle</th>
                  <th className="px-2.5 py-2 font-medium">Qty</th>
                  <th className="px-2.5 py-2 font-medium">Status</th>
                  <th className="px-2.5 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-2.5 py-2 font-mono text-xs text-stone-400">
                      {t.ticket_public_id}
                    </td>
                    <td className="max-w-[9rem] truncate px-2.5 py-2 text-xs text-stone-500" title={t.period_title || ''}>
                      {t.period_title || t.period_id || '—'}
                    </td>
                    <td
                      className="max-w-[12rem] px-2.5 py-2 font-mono text-xs text-stone-400"
                      title={(t.ticket_numbers || []).join(', ')}
                    >
                      {formatTicketNumbers(t.ticket_numbers)}
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="font-medium text-stone-200">{t.full_name || '—'}</div>
                      <div className="text-xs text-stone-500">{t.email || '—'}</div>
                    </td>
                    <td className="px-2.5 py-2 text-stone-300">{t.bundle_id || '—'}</td>
                    <td className="px-2.5 py-2 tabular-nums text-stone-200">{t.quantity}</td>
                    <td className="px-2.5 py-2 text-stone-400">{t.payment_status}</td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-stone-500">{formatDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length ? <p className="px-3 py-4 text-sm text-stone-500">No tickets yet.</p> : null}
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

function formatTicketNumbers(nums) {
  const list = Array.isArray(nums) ? nums : []
  if (!list.length) return '—'
  if (list.length <= 3) return list.join(', ')
  return `${list.slice(0, 2).join(', ')} +${list.length - 2} more`
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}
