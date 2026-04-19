import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'

export default function AdminTicketsPage() {
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
      const qs = new URLSearchParams({ limit: '150' })
      if (debounced) qs.set('q', debounced)
      const res = await apiFetch(`/api/admin/tickets?${qs}`)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold text-stone-100">Tickets</h1>
        <input
          type="search"
          placeholder="Search ticket ID, name, email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none"
        />
      </div>
      {err ? <p className="text-red-400">{err}</p> : null}
      {loading ? <p className="text-stone-500">Loading…</p> : null}
      {!loading ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 bg-stone-900/80 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2">Public ID</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Bundle</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-white/[0.03]">
                  <td className="px-3 py-2 font-mono text-xs text-stone-400">{t.ticket_public_id}</td>
                  <td className="px-3 py-2">
                    <div className="text-stone-200">{t.full_name || '—'}</div>
                    <div className="text-xs text-stone-500">{t.email || '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-stone-300">{t.bundle_id || '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-stone-200">{t.quantity}</td>
                  <td className="px-3 py-2 text-stone-300">{t.payment_status}</td>
                  <td className="px-3 py-2 text-stone-500">{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="p-4 text-stone-500">No tickets yet.</p> : null}
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
