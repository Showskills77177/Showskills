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

  const analytics = stats.analytics || {}

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-100">Overview</h1>
        <p className="mt-1 text-sm text-stone-500">
          Sales, traffic, and audience insights for ShowSkills — last 30 days unless noted.
        </p>
        {!stats.db ? (
          <p className="mt-2 text-sm text-amber-200/80">
            Database not ready — local SQLite:{' '}
            <code className="text-amber-100">npm run db:setup</code> then{' '}
            <code className="text-amber-100">npm run db:schema</code>, then restart{' '}
            <code className="text-amber-100">npm run dev:api</code>. Hosted: set{' '}
            <code className="text-amber-100">DATABASE_URL</code> and apply{' '}
            <code className="text-amber-100">backend/api/db/schema.sql</code>.
            {stats.hint ? <span className="mt-1 block text-amber-100/90">{stats.hint}</span> : null}
          </p>
        ) : null}
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Sales &amp; entries</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Tickets sold (paid)" value={String(stats.ticketsSold)} />
          <StatCard label="Revenue" value={formatBundlePriceGBP(stats.revenuePence)} />
          <StatCard label="Quiz entries" value={String(stats.entriesCount)} />
          <StatCard label="Active competitions" value={String(stats.competitionsActive)} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Site traffic</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard subtle label="Page views (24h)" value={String(analytics.visits24h ?? 0)} />
          <StatCard subtle label="Page views (7d)" value={String(analytics.visits7d ?? 0)} />
          <StatCard
            subtle
            label="Active visitors (24h)"
            value={String(analytics.activeVisitors24h ?? 0)}
            hint="Unique sessions"
          />
          <StatCard
            subtle
            label="Registered users"
            value={String(analytics.registeredUsers ?? 0)}
            hint={`+${analytics.newUsers30d ?? 0} last 30d`}
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <AnalyticsPanel title="Visits by country" subtitle="Last 30 days">
          <RankedList
            emptyLabel="No visit data yet — browse the public site to start collecting."
            rows={(analytics.visitsByCountry || []).map((row) => ({
              label: row.countryName,
              value: row.visits,
              sharePct: row.sharePct,
            }))}
          />
        </AnalyticsPanel>

        <AnalyticsPanel title="How people found us" subtitle="Traffic source · last 30 days">
          <RankedList
            emptyLabel="No source data yet — use UTM links (e.g. ?utm_source=tiktok) or referrers from social."
            rows={(analytics.trafficSources || []).map((row) => ({
              label: row.source,
              value: row.visits,
              sharePct: row.sharePct,
            }))}
          />
        </AnalyticsPanel>
      </div>

      <AnalyticsPanel title="Tickets sold by region" subtitle="From completed payments · country from checkout IP when available">
        <RankedList
          emptyLabel="No regional ticket data yet — country is recorded on new purchases."
          rows={(analytics.ticketsByRegion || []).map((row) => ({
            label: row.countryName,
            value: row.ticketsSold,
            extra: formatBundlePriceGBP(row.revenuePence),
          }))}
          valueLabel="Tickets"
        />
      </AnalyticsPanel>

      <section className="rounded-xl border border-white/10 bg-stone-900/40 px-4 py-4">
        <p className="text-sm text-stone-400">
          Kick-up / shirt giveaway submissions pending review:{' '}
          <Link to="/admin/submissions" className="font-semibold text-teal-400 hover:underline">
            {stats.submissionsPending}
          </Link>
        </p>
        <ul className="mt-4 flex flex-wrap gap-3 text-sm">
          <QuickLink to="/admin/users">Users &amp; entries</QuickLink>
          <QuickLink to="/admin/tickets">Ticket purchases</QuickLink>
          <QuickLink to="/admin/draw">Draw winner</QuickLink>
          <QuickLink to="/admin/payments">Payments</QuickLink>
          <QuickLink to="/admin/submissions">Video submissions</QuickLink>
          <QuickLink to="/admin/entry-attempts">Entry log</QuickLink>
        </ul>
      </section>
    </div>
  )
}

function StatCard({ label, value, hint, subtle = false }) {
  if (subtle) {
    return (
      <div className="rounded-lg border border-white/10 bg-stone-900/30 px-3 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-stone-200">{value}</p>
        {hint ? <p className="mt-0.5 text-[10px] text-stone-600">{hint}</p> : null}
      </div>
    )
  }

  return (
    <div className="ss-admin-stat-featured rounded-xl border border-emerald-400/50 bg-gradient-to-br from-emerald-950/70 via-[#0a2f24]/80 to-emerald-950/50 px-4 py-5 shadow-[0_12px_32px_-8px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/30">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-emerald-200/70">{hint}</p> : null}
    </div>
  )
}

function AnalyticsPanel({ title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-white/10 bg-stone-900/40 p-5">
      <h2 className="text-sm font-semibold text-stone-100">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs text-stone-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function RankedList({ rows, emptyLabel, valueLabel = 'Visits' }) {
  if (!rows.length) {
    return <p className="text-sm text-stone-500">{emptyLabel}</p>
  }

  const max = Math.max(...rows.map((row) => row.value || 0), 1)

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-stone-200">{row.label}</span>
            <span className="shrink-0 tabular-nums text-stone-400">
              {row.value.toLocaleString()} {valueLabel.toLowerCase()}
              {row.extra ? <span className="ml-2 text-emerald-300/90">{row.extra}</span> : null}
              {row.sharePct != null ? <span className="ml-2 text-stone-500">({row.sharePct}%)</span> : null}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400"
              style={{ width: `${Math.max(8, (row.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function QuickLink({ to, children }) {
  return (
    <li>
      <Link className="rounded-lg border border-white/10 px-3 py-1.5 text-teal-400 transition hover:border-teal-600/40 hover:bg-white/5 hover:underline" to={to}>
        {children}
      </Link>
    </li>
  )
}
