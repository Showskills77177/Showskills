import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatBundlePriceGBP } from '../../competitionData'
import { apiFetch } from '../../lib/api'

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    apiFetch('/api/admin/stats')
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || 'Failed to load stats')
        setStats(j)
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Error'))
  }, [])

  if (err) {
    return <p className="text-red-400">{err}</p>
  }
  if (!stats) {
    return <p className="text-stone-500">Loading…</p>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-100">Overview</h1>
        {!stats.db ? (
          <p className="mt-2 text-sm text-amber-200/80">
            Database not ready — local SQLite:{' '}
            <code className="text-amber-100">npm run db:setup</code> then{' '}
            <code className="text-amber-100">npm run db:schema</code>, then restart{' '}
            <code className="text-amber-100">npm run dev:api</code>. Hosted: set{' '}
            <code className="text-amber-100">DATABASE_URL</code> and apply{' '}
            <code className="text-amber-100">api/db/schema.sql</code>.
            {stats.hint ? <span className="mt-1 block text-amber-100/90">{stats.hint}</span> : null}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tickets sold (paid)" value={String(stats.ticketsSold)} />
        <StatCard label="Revenue" value={formatBundlePriceGBP(stats.revenuePence)} />
        <StatCard label="Quiz entries" value={String(stats.entriesCount)} />
        <StatCard label="Active competitions" value={String(stats.competitionsActive)} />
      </div>
      <p className="text-sm text-stone-500">
        Kick-up submissions pending review:{' '}
        <Link to="/admin/submissions" className="text-teal-400 hover:underline">
          {stats.submissionsPending}
        </Link>
      </p>
      <ul className="flex flex-wrap gap-4 text-sm">
        <li>
          <Link className="text-teal-400 hover:underline" to="/admin/users">
            Users &amp; entries
          </Link>
        </li>
        <li>
          <Link className="text-teal-400 hover:underline" to="/admin/tickets">
            Ticket purchases
          </Link>
        </li>
        <li>
          <Link className="text-teal-400 hover:underline" to="/admin/payments">
            Payments
          </Link>
        </li>
        <li>
          <Link className="text-teal-400 hover:underline" to="/admin/submissions">
            Video submissions
          </Link>
        </li>
      </ul>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-stone-900/50 px-4 py-5">
      <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-100">{value}</p>
    </div>
  )
}
