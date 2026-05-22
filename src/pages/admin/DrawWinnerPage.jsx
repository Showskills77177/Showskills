import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'

export default function DrawWinnerPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [drawing, setDrawing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/draw-winner')
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load draw pool')
      setData(j)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function runDraw() {
    setConfirmOpen(false)
    setDrawing(true)
    setErr('')
    setResult(null)
    try {
      const res = await apiFetch('/api/admin/draw-winner', { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Draw failed')
      setResult(j)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Draw failed')
    } finally {
      setDrawing(false)
    }
  }

  if (loading && !data) {
    return <p className="text-stone-500">Loading draw pool…</p>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-100">Draw winner</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-400">
          {data?.label || 'Ronaldo Legacy Bundle'} — random selection from qualified paid entries. Each ticket
          number is one chance; buyers with more tickets have proportionally higher odds.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Qualified ticket numbers" value={String(data?.poolSize ?? 0)} />
        <StatCard label="Unique entrants" value={String(data?.uniqueEntrants ?? 0)} />
      </div>

      {data?.entrantBreakdown?.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Chances per entrant</h2>
          <p className="text-sm text-stone-500">
            The draw picks one <strong className="text-stone-400">ticket number</strong> at random. Someone with more
            numbers is more likely to win each time — that is intentional, not a bug.
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="border-b border-white/10 bg-stone-900/80 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-3 py-2">Entrant</th>
                  <th className="px-3 py-2">Ticket slots</th>
                  <th className="px-3 py-2">Win chance (each draw)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.entrantBreakdown.map((row) => (
                  <tr key={row.email || row.fullName}>
                    <td className="px-3 py-2">
                      <div className="text-stone-200">{row.fullName}</div>
                      <div className="text-xs text-stone-500">{row.email}</div>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-stone-300">{row.slots}</td>
                    <td className="px-3 py-2 tabular-nums font-medium text-teal-200/90">
                      {row.winChancePercent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <p className="font-display text-2xl uppercase tracking-wide text-emerald-100">Winner drawn</p>
            <p className="mt-4 font-mono text-3xl font-bold tabular-nums text-white">{result.winner.ticketNumber}</p>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-stone-500">Name</dt>
                <dd className="mt-1 text-stone-200">{result.winner.fullName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-stone-500">Email</dt>
                <dd className="mt-1 break-all text-stone-200">{result.winner.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-stone-500">Order ref</dt>
                <dd className="mt-1 font-mono text-stone-300">{result.winner.ticketPublicId || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-stone-500">Pool / index</dt>
                <dd className="mt-1 tabular-nums text-stone-300">
                  {result.poolSize} slots · index {result.randomIndex}
                </dd>
              </div>
            </dl>
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
          disabled={drawing || !data?.poolSize}
          onClick={() => setConfirmOpen(true)}
          className="min-h-[44px] rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-base font-bold text-emerald-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {drawing ? 'Drawing…' : 'Draw winner now'}
        </button>
        <button
          type="button"
          onClick={load}
          disabled={loading || drawing}
          className="min-h-[44px] rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-stone-300 hover:bg-white/5 disabled:opacity-50"
        >
          Refresh pool
        </button>
      </div>

      {!data?.poolSize && !loading ? (
        <p className="text-sm text-stone-500">
          No qualified ticket numbers yet. Entrants need a paid purchase and all three skill answers correct.
        </p>
      ) : null}

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="draw-confirm-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-stone-950 p-6 shadow-2xl">
            <h2 id="draw-confirm-title" className="text-lg font-semibold text-stone-100">
              Run the draw?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-400">
              This picks one winner at random from <strong className="text-stone-200">{data?.poolSize}</strong>{' '}
              qualified ticket numbers using a secure random index. The result is saved in the audit log below.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={runDraw}
                className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-emerald-950 hover:brightness-110"
              >
                Yes, draw now
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
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Draw history</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-white/10 bg-stone-900/80 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Winning ticket</th>
                  <th className="px-3 py-2">Winner</th>
                  <th className="px-3 py-2">Pool</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.history.map((row) => (
                  <tr key={row.id} className="text-stone-300">
                    <td className="whitespace-nowrap px-3 py-2 text-stone-500">
                      {row.drawn_at ? new Date(row.drawn_at).toLocaleString('en-GB') : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono font-medium text-emerald-200/90">
                      {row.winning_ticket_number}
                    </td>
                    <td className="px-3 py-2">
                      <div>{row.winner_full_name || '—'}</div>
                      <div className="text-xs text-stone-500">{row.winner_email}</div>
                    </td>
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
