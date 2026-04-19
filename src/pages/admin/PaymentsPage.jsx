import { useEffect, useState } from 'react'
import { formatBundlePriceGBP } from '../../competitionData'
import { apiFetch } from '../../lib/api'

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    apiFetch('/api/admin/payments?limit=150')
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || 'Failed')
        setRows(j.rows || [])
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-stone-100">Payments</h1>
      {err ? <p className="text-red-400">{err}</p> : null}
      {loading ? <p className="text-stone-500">Loading…</p> : null}
      {!loading ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 bg-stone-900/80 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2">Transaction</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.03]">
                  <td className="px-3 py-2 font-mono text-xs text-stone-400">{p.transaction_id}</td>
                  <td className="px-3 py-2">
                    <div className="text-stone-200">{p.full_name || '—'}</div>
                    <div className="text-xs text-stone-500">{p.email || '—'}</div>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-stone-200">{formatBundlePriceGBP(p.amount_pence)}</td>
                  <td className="px-3 py-2 text-stone-400">{p.provider}</td>
                  <td className="px-3 py-2 text-stone-300">{p.status}</td>
                  <td className="px-3 py-2 text-stone-500">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="p-4 text-stone-500">No payments yet.</p> : null}
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
