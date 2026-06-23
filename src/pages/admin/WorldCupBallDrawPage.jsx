import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { WORLD_CUP_BALL_GIVEAWAY_LABEL } from '../../../shared/worldCupBallGiveaway.mjs'
import { WORLD_CUP_BALL_ADMIN_ROUTES } from '../../../shared/adminListCopy.mjs'

export default function WorldCupBallDrawPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [drawing, setDrawing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState(null)
  const [adminNotes, setAdminNotes] = useState('')

  const selectedDrawMonth = data?.drawMonth ?? ''

  const load = useCallback(async (drawMonth) => {
    setLoading(true)
    setErr('')
    try {
      const qs = drawMonth ? `?drawMonth=${encodeURIComponent(drawMonth)}` : ''
      const res = await apiFetch(`/api/admin/world-cup-ball-draw${qs}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load monthly draw pool')
      setData(j)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(undefined)
  }, [load])

  function onMonthChange(e) {
    const month = e.target.value
    void load(month || undefined)
  }

  async function runDraw() {
    setConfirmOpen(false)
    setDrawing(true)
    setErr('')
    setResult(null)
    try {
      const res = await apiFetch('/api/admin/world-cup-ball-draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drawMonth: selectedDrawMonth,
          adminNotes: adminNotes.trim() || undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Draw failed')
      setResult(j)
      await load(selectedDrawMonth)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Draw failed')
    } finally {
      setDrawing(false)
    }
  }

  if (loading && !data) {
    return <p className="text-stone-500">Loading monthly draw pool…</p>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/90">World Cup Ball</p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-100">Monthly draw</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-400">
          {data?.label || WORLD_CUP_BALL_GIVEAWAY_LABEL} — fair random draw from automatic entries awarded when
          entrants fail the skill quiz. Separate from the instant skill win. One official draw per calendar month
          (June / July 2026).
        </p>
        <p className="mt-2 text-xs text-stone-500">
          <Link to={WORLD_CUP_BALL_ADMIN_ROUTES.failedAttempts} className="text-amber-400/90 underline">
            Failed attempts
          </Link>{' '}
          ·{' '}
          <Link to={WORLD_CUP_BALL_ADMIN_ROUTES.entryLog} className="text-amber-400/90 underline">
            Entry log
          </Link>{' '}
          · filter flow <span className="font-mono text-stone-400">world_cup_ball_monthly_draw</span>
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-stone-900/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Draw month</h2>
        <label className="block text-sm text-stone-400">
          Select month
          <select
            value={selectedDrawMonth}
            onChange={onMonthChange}
            disabled={loading || drawing}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-base text-stone-100"
          >
            {(data?.months ?? []).map((m) => (
              <option key={m.drawMonth} value={m.drawMonth}>
                {m.label} — {m.entryCount} {m.entryCount === 1 ? 'entry' : 'entries'}
              </option>
            ))}
          </select>
        </label>

        {data?.drawMonthLabel ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-stone-500">Month</dt>
              <dd className="mt-1 font-medium text-stone-200">{data.drawMonthLabel}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-stone-500">Status</dt>
              <dd className="mt-1 font-medium text-stone-200">
                {data.alreadyDrawn ? 'Draw complete' : data.poolSize ? 'Ready to draw' : 'No eligible entries'}
              </dd>
            </div>
          </dl>
        ) : null}

        <label className="block text-sm text-stone-400">
          Internal notes (optional, saved with draw record)
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={2}
            disabled={drawing}
            placeholder="e.g. June 2026 monthly draw — contacted winner by phone"
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-stone-200"
          />
        </label>
      </section>

      {data?.governance?.isolation ? (
        <p className="rounded-xl border border-amber-900/40 bg-amber-950/25 px-4 py-3 text-sm leading-relaxed text-amber-100/90">
          {data.governance.isolation}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Eligible entries (this month)" value={String(data?.poolSize ?? 0)} />
        <StatCard label="Unique IPs (this month)" value={String(data?.uniqueIps ?? 0)} />
      </div>

      {data?.pool?.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Draw pool preview</h2>
          <p className="text-sm text-stone-500">
            One entry number is picked uniformly at random. Outright skill winners and entries already drawn are
            excluded.
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/10 bg-stone-900/80 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-3 py-2">Entry #</th>
                  <th className="px-3 py-2">Quiz outcome</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Entered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.pool.map((row) => (
                  <tr key={row.id} className="text-stone-300">
                    <td className="px-3 py-2 font-mono font-medium text-amber-200/90">{row.entryNumber}</td>
                    <td className="px-3 py-2 capitalize text-stone-400">{row.outcome || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-stone-500">{row.ipAddress || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-stone-500">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString('en-GB') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.poolSize > data.pool.length ? (
            <p className="text-xs text-stone-500">Showing first {data.pool.length} of {data.poolSize} entries.</p>
          ) : null}
        </section>
      ) : null}

      {data?.notes?.length ? (
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-stone-500">
          {data.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {err ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100" role="alert">
          {err}
        </p>
      ) : null}

      {result?.ok ? (
        <div
          className="overflow-hidden rounded-2xl border border-emerald-500/35 bg-gradient-to-b from-emerald-950/50 to-stone-950/80 shadow-lg"
          role="status"
        >
          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" aria-hidden />
          <div className="px-6 py-8 sm:px-8">
            <p className="font-display text-2xl uppercase tracking-wide text-emerald-100">Monthly draw winner</p>
            <p className="mt-2 text-sm text-stone-400">{result.drawMonthLabel}</p>
            <p className="mt-4 font-mono text-3xl font-bold tabular-nums text-white">{result.winner.entryNumber}</p>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-stone-500">Session</dt>
                <dd className="mt-1 break-all font-mono text-xs text-stone-300">{result.winner.sessionId || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-stone-500">IP address</dt>
                <dd className="mt-1 font-mono text-stone-300">{result.winner.ipAddress || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-stone-500">Quiz outcome</dt>
                <dd className="mt-1 capitalize text-stone-300">{result.winner.outcome || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-stone-500">Pool / index</dt>
                <dd className="mt-1 tabular-nums text-stone-300">
                  {result.poolSize} entries · index {result.randomIndex}
                </dd>
              </div>
            </dl>
            <p className="mt-4 rounded-lg border border-emerald-800/40 bg-emerald-950/50 px-3 py-2.5 text-sm text-emerald-100/95">
              No email is sent automatically — contact this entrant manually (IP / session in Entry log). Ask them
              to provide UK delivery details if they win the ball.
            </p>
            <p className="mt-4 text-xs text-stone-500">
              Draw ID <span className="font-mono text-stone-400">{result.drawId}</span> ·{' '}
              {result.drawnAt ? new Date(result.drawnAt).toLocaleString('en-GB') : ''}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={drawing || !data?.canDraw || !selectedDrawMonth}
          onClick={() => setConfirmOpen(true)}
          className="min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-3 text-base font-bold text-stone-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {drawing ? 'Drawing…' : 'Draw monthly winner'}
        </button>
        <button
          type="button"
          onClick={() => void load(selectedDrawMonth)}
          disabled={loading || drawing}
          className="min-h-[44px] rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-stone-300 hover:bg-white/5 disabled:opacity-50"
        >
          Refresh pool
        </button>
      </div>

      {!data?.canDraw && selectedDrawMonth && !loading ? (
        <p className="text-sm text-stone-500">
          {data?.alreadyDrawn
            ? 'This month already has a recorded draw winner.'
            : !data?.poolSize
              ? 'No eligible entries for this month yet — failed quiz attempts award entries automatically.'
              : null}
        </p>
      ) : null}

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wc-ball-draw-confirm-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-stone-950 p-6 shadow-2xl">
            <h2 id="wc-ball-draw-confirm-title" className="text-lg font-semibold text-stone-100">
              Run the {data?.drawMonthLabel} draw?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-400">
              This will permanently record one winner from{' '}
              <strong className="text-stone-200">{data?.poolSize}</strong> eligible entries for{' '}
              <strong className="text-stone-200">{data?.drawMonthLabel}</strong> only. No automatic email is
              sent — you must contact the winner manually. This cannot be undone for this month.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void runDraw()}
                className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-stone-950 hover:brightness-110"
              >
                Yes — draw winner
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-stone-300 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {data?.history?.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Draw history (this month)</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-white/10 bg-stone-900/80 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Winning entry</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Pool</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.history.map((row) => (
                  <tr key={row.id} className="text-stone-300">
                    <td className="whitespace-nowrap px-3 py-2 text-stone-500">
                      {row.drawn_at ? new Date(row.drawn_at).toLocaleString('en-GB') : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono font-medium text-amber-200/90">
                      {row.winning_entry_number}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-stone-500">{row.ip_address || '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-stone-500">{row.pool_size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
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
