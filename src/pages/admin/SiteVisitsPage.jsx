import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { AdminPagination } from '../../components/admin/AdminPagination'
import { AdminHelpBanner, ADMIN_PAGE_SIZE } from '../../components/admin/AdminHelpBanner'

const PERIOD_OPTIONS = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
]

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

function shortSessionId(id) {
  if (!id || typeof id !== 'string') return '—'
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

export default function SiteVisitsPage() {
  const [period, setPeriod] = useState('30d')
  const [country, setCountry] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    setPage(1)
  }, [period, country])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const qs = new URLSearchParams({
        period,
        page: String(page),
        pageSize: String(ADMIN_PAGE_SIZE),
      })
      if (country) qs.set('country', country)
      const res = await apiFetch(`/api/admin/site-visits?${qs}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load')
      setData(j)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [period, country, page])

  useEffect(() => {
    load()
  }, [load])

  const summary = data?.summary || { pageViews: 0, uniqueSessions: 0, countriesReached: 0 }
  const countries = data?.visitsByCountry || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-100">Site visits</h1>
        <p className="mt-2 text-sm text-stone-400">
          Anonymous page views from the public site — country from Vercel edge headers, traffic source from UTM tags and
          referrers.
        </p>
      </div>

      <AdminHelpBanner title="How visit tracking works">
        Each public page load sends one row (admin routes are excluded). Country is inferred from the visitor&apos;s IP at
        the edge — use UTM links like <span className="font-mono text-stone-300">?utm_source=tiktok</span> to attribute
        campaigns. Summary also appears on the{' '}
        <Link to="/admin/dashboard" className="text-teal-400/90 underline">
          dashboard
        </Link>
        .
      </AdminHelpBanner>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200"
        >
          <option value="">All countries</option>
          {countries.map((row) => (
            <option key={row.countryCode} value={row.countryCode}>
              {row.countryName} ({row.visits})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm text-stone-300 hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      {err ? <p className="text-sm text-red-300">{err}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Page views" value={summary.pageViews} />
        <SummaryCard label="Unique sessions" value={summary.uniqueSessions} />
        <SummaryCard label="Countries" value={summary.countriesReached} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-stone-900/40 p-5">
          <h2 className="text-sm font-semibold text-stone-100">Visits by country</h2>
          <p className="mt-1 text-xs text-stone-500">Page views and unique sessions per country</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="pb-2 pr-3 font-semibold">Country</th>
                  <th className="pb-2 pr-3 font-semibold">Views</th>
                  <th className="pb-2 pr-3 font-semibold">Sessions</th>
                  <th className="pb-2 font-semibold">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-stone-300">
                {!countries.length ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-stone-500">
                      {loading ? 'Loading…' : 'No visits recorded yet.'}
                    </td>
                  </tr>
                ) : null}
                {countries.map((row) => (
                  <tr key={row.countryCode}>
                    <td className="py-2 pr-3 font-medium text-stone-200">{row.countryName}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.visits.toLocaleString()}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.uniqueSessions.toLocaleString()}</td>
                    <td className="py-2 tabular-nums text-stone-500">{row.sharePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <MiniRank title="Top pages" rows={(data?.topPaths || []).map((r) => ({ label: r.path, value: r.visits }))} />
          <MiniRank
            title="Traffic sources"
            rows={(data?.topSources || []).map((r) => ({ label: r.source, value: r.visits }))}
          />
        </section>
      </div>

      <section className="overflow-x-auto rounded-xl border border-white/10">
        <div className="border-b border-white/10 bg-stone-900/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-100">Recent visits</h2>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-stone-500">
            <tr>
              <th className="px-3 py-2.5 font-semibold">When</th>
              <th className="px-3 py-2.5 font-semibold">Page</th>
              <th className="px-3 py-2.5 font-semibold">Country</th>
              <th className="px-3 py-2.5 font-semibold">Source</th>
              <th className="px-3 py-2.5 font-semibold">Session</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && !data?.rows?.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-stone-500">
                  Loading…
                </td>
              </tr>
            ) : null}
            {!loading && !data?.rows?.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-stone-500">
                  No visits in this period.
                </td>
              </tr>
            ) : null}
            {(data?.rows || []).map((row, idx) => (
              <tr key={`${row.createdAt}-${row.sessionId}-${idx}`} className="text-stone-300">
                <td className="whitespace-nowrap px-3 py-2.5">{formatWhen(row.createdAt)}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-stone-200">{row.path}</td>
                <td className="px-3 py-2.5">{row.countryName}</td>
                <td className="px-3 py-2.5">
                  {row.trafficSource}
                  {row.referrerHost ? (
                    <span className="mt-0.5 block text-xs text-stone-500">{row.referrerHost}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-stone-500">{shortSessionId(row.sessionId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <AdminPagination
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-stone-900/40 px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-100">
        {Number(value || 0).toLocaleString()}
      </p>
    </div>
  )
}

function MiniRank({ title, rows }) {
  return (
    <div className="rounded-xl border border-white/10 bg-stone-900/40 p-5">
      <h2 className="text-sm font-semibold text-stone-100">{title}</h2>
      {!rows.length ? <p className="mt-3 text-sm text-stone-500">No data yet.</p> : null}
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-stone-300">{row.label}</span>
            <span className="shrink-0 tabular-nums text-stone-500">{row.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
