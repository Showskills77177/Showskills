import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'

export default function EntryAttemptsPage() {
  const [flow, setFlow] = useState('')
  const [outcome, setOutcome] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const qs = new URLSearchParams({ limit: '120' })
      if (flow) qs.set('flow', flow)
      if (outcome) qs.set('outcome', outcome)
      const res = await apiFetch(`/api/admin/entry-attempts?${qs}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load')
      setRows(j.rows || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [flow, outcome])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-100">Entry attempt log</h1>
        <p className="mt-2 text-sm text-stone-500">
          Suspicious or blocked free-entry attempts (legacy free online and shirt giveaway). Successful entries are
          logged too.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
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
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-stone-300 hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      {err ? <p className="text-red-400">{err}</p> : null}
      {loading ? <p className="text-stone-500">Loading…</p> : null}

      {!loading ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-white/10 bg-stone-900/80 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Flow</th>
                <th className="px-3 py-2">Outcome</th>
                <th className="px-3 py-2">Name / email</th>
                <th className="px-3 py-2">IP</th>
                <th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((row) => (
                <tr key={row.id} className="text-stone-300">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-stone-500">
                    {row.created_at ? new Date(row.created_at).toLocaleString('en-GB') : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.flow}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        row.outcome === 'blocked'
                          ? 'text-amber-300'
                          : row.outcome === 'success'
                            ? 'text-emerald-300'
                            : 'text-stone-400'
                      }
                    >
                      {row.outcome}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div>{row.full_name || '—'}</div>
                    <div className="text-xs text-stone-500">{row.email}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-500">{row.ip_address || '—'}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{row.block_reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="px-4 py-6 text-center text-stone-500">No log rows yet.</p> : null}
        </div>
      ) : null}
    </div>
  )
}
