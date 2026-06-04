import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { DRAW_COMPETITION_LABEL, PERIOD_STATUS } from '../../../shared/competitionPeriods.mjs'
import { AdminCompetitionSelect } from '../../components/admin/AdminCompetitionSelect'
import { defaultMainDrawCompetitionSlug } from '../../../shared/adminCompetitions.mjs'

export default function DrawWinnerPage() {
  const [competition, setCompetition] = useState(defaultMainDrawCompetitionSlug())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [drawing, setDrawing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState(null)
  const [periodBusy, setPeriodBusy] = useState(false)
  const [showNewPeriod, setShowNewPeriod] = useState(false)
  const [newPeriod, setNewPeriod] = useState({
    title: '',
    summary: '',
    entryOpensAt: '',
    entryClosesAt: '',
  })

  const selectedPeriodId = data?.period?.id ?? ''

  const load = useCallback(async (periodId, competitionSlug = competition) => {
    setLoading(true)
    setErr('')
    try {
      const qs = new URLSearchParams()
      if (periodId) qs.set('periodId', periodId)
      if (competitionSlug) qs.set('competition', competitionSlug)
      const query = qs.toString() ? `?${qs.toString()}` : ''
      const res = await apiFetch(`/api/admin/draw-winner${query}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load draw pool')
      setData(j)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [competition])

  useEffect(() => {
    load(undefined, competition)
  }, [competition, load])

  function onCompetitionChange(nextCompetition) {
    setCompetition(nextCompetition)
    setResult(null)
  }

  function onPeriodChange(e) {
    const id = e.target.value
    load(id || undefined, competition)
  }

  async function patchPeriodStatus(status) {
    if (!selectedPeriodId) return
    setPeriodBusy(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/competition-periods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId: selectedPeriodId, status }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not update period')
      await load(selectedPeriodId, competition)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setPeriodBusy(false)
    }
  }

  async function createPeriod(e) {
    e.preventDefault()
    setPeriodBusy(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/competition-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPeriod.title,
          summary: newPeriod.summary,
          entryOpensAt: new Date(newPeriod.entryOpensAt).toISOString(),
          entryClosesAt: new Date(newPeriod.entryClosesAt).toISOString(),
          status: PERIOD_STATUS.draft,
          competition,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not create period')
      setShowNewPeriod(false)
      setNewPeriod({ title: '', summary: '', entryOpensAt: '', entryClosesAt: '' })
      await load(j.period?.id, competition)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setPeriodBusy(false)
    }
  }

  async function resendWinnerEmail(drawId) {
    setErr('')
    try {
      const res = await apiFetch('/api/admin/resend-winner-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Resend failed')
      if (j.sent) {
        setErr('')
        alert(`Winner email sent to ${j.to}`)
      } else {
        setErr(j.error || `Email not sent (${j.skipped ? j.skipped : 'check Resend'})`)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Resend failed')
    }
  }

  async function runDraw() {
    setConfirmOpen(false)
    setDrawing(true)
    setErr('')
    setResult(null)
    try {
      const res = await apiFetch('/api/admin/draw-winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId: selectedPeriodId, competition, sendWinnerEmail: true }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Draw failed')
      setResult(j)
      await load(selectedPeriodId, competition)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Draw failed')
    } finally {
      setDrawing(false)
    }
  }

  if (loading && !data) {
    return <p className="text-stone-500">Loading competition period…</p>
  }

  const period = data?.period

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-100">Draw winner</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-400">
          {data?.label || DRAW_COMPETITION_LABEL} — fair random draw from a{' '}
          <strong className="text-stone-300">time-scoped competition period</strong>. Entries outside the
          selected window are never included, so separate competition cycles cannot mix.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-stone-900/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Competition</h2>
        <AdminCompetitionSelect
          kind="mainDraw"
          value={competition}
          onChange={onCompetitionChange}
          allowAll={false}
          label="Main prize draw"
          disabled={loading || drawing || periodBusy}
        />
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-stone-900/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Competition period</h2>

        <label className="block text-sm text-stone-400">
          Select period
          <select
            value={selectedPeriodId}
            onChange={onPeriodChange}
            disabled={loading || drawing}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-base text-stone-100"
          >
            {(data?.periods ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — {p.statusLabel} ({p.entryWindowLabel})
              </option>
            ))}
          </select>
        </label>

        {period ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-stone-500">Status</dt>
              <dd className="mt-1 font-medium text-stone-200">{period.statusLabel}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-stone-500">Entry window (UK)</dt>
              <dd className="mt-1 text-stone-300">{period.entryWindowLabel}</dd>
            </div>
            {period.summary ? (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-stone-500">Notes</dt>
                <dd className="mt-1 text-stone-400">{period.summary}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {period?.status === PERIOD_STATUS.open ? (
            <button
              type="button"
              disabled={periodBusy || drawing}
              onClick={() => patchPeriodStatus(PERIOD_STATUS.closed)}
              className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-950/60 disabled:opacity-50"
            >
              Close period (stop new entries for this window)
            </button>
          ) : null}
          {period?.status === PERIOD_STATUS.draft ? (
            <button
              type="button"
              disabled={periodBusy || drawing}
              onClick={() => patchPeriodStatus(PERIOD_STATUS.open)}
              className="rounded-lg border border-teal-500/35 bg-teal-950/40 px-4 py-2 text-sm font-semibold text-teal-100 hover:bg-teal-950/60 disabled:opacity-50"
            >
              Open period for entries
            </button>
          ) : null}
          {period?.status === PERIOD_STATUS.closed ? (
            <button
              type="button"
              disabled={periodBusy || drawing}
              onClick={() => patchPeriodStatus(PERIOD_STATUS.open)}
              className="rounded-lg border border-teal-500/35 bg-teal-950/40 px-4 py-2 text-sm font-semibold text-teal-100 hover:bg-teal-950/60 disabled:opacity-50"
            >
              Reopen period for entries
            </button>
          ) : null}
          <button
            type="button"
            disabled={periodBusy}
            onClick={() => setShowNewPeriod((v) => !v)}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-stone-300 hover:bg-white/5 disabled:opacity-50"
          >
            {showNewPeriod ? 'Cancel new period' : 'New competition period'}
          </button>
        </div>

        {showNewPeriod ? (
          <form onSubmit={createPeriod} className="space-y-3 border-t border-white/10 pt-4">
            <input
              required
              placeholder={`Period title (e.g. ${DRAW_COMPETITION_LABEL} — Summer 2026)`}
              value={newPeriod.title}
              onChange={(e) => setNewPeriod((s) => ({ ...s, title: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-stone-200"
            />
            <textarea
              placeholder="Internal notes (optional)"
              value={newPeriod.summary}
              onChange={(e) => setNewPeriod((s) => ({ ...s, summary: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-stone-200"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-stone-400">
                Opens
                <input
                  type="datetime-local"
                  required
                  value={newPeriod.entryOpensAt}
                  onChange={(e) => setNewPeriod((s) => ({ ...s, entryOpensAt: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-stone-200"
                />
              </label>
              <label className="text-sm text-stone-400">
                Closes
                <input
                  type="datetime-local"
                  required
                  value={newPeriod.entryClosesAt}
                  onChange={(e) => setNewPeriod((s) => ({ ...s, entryClosesAt: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-stone-200"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={periodBusy}
              className="rounded-lg bg-stone-700 px-4 py-2 text-sm font-semibold text-stone-100 hover:bg-stone-600 disabled:opacity-50"
            >
              Create period
            </button>
          </form>
        ) : null}
      </section>

      {data?.governance?.isolation ? (
        <p className="rounded-xl border border-teal-900/40 bg-teal-950/25 px-4 py-3 text-sm leading-relaxed text-teal-100/90">
          {data.governance.isolation}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Qualified tickets (this period)" value={String(data?.poolSize ?? 0)} />
        <StatCard label="Unique entrants (this period)" value={String(data?.uniqueEntrants ?? 0)} />
      </div>

      {data?.entrantBreakdown?.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Chances per entrant</h2>
          <p className="text-sm text-stone-500">
            One random ticket number is selected from this period&apos;s pool only. More tickets in this period means
            higher odds.
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
            <p className="mt-2 text-sm text-stone-400">{result.periodTitle}</p>
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
                <dt className="text-xs uppercase tracking-wider text-stone-500">Phone</dt>
                <dd className="mt-1 text-stone-200">{result.winner.phone || '—'}</dd>
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
            <p className="mt-4 rounded-lg border border-emerald-800/40 bg-emerald-950/50 px-3 py-2.5 text-sm text-emerald-100/95">
              {result.winnerEmail?.sent
                ? 'Winner notification email sent successfully.'
                : result.winnerEmail?.skipped
                  ? `Email not sent (${result.winnerEmail.reason || 'skipped'}). Contact the winner manually.`
                  : `Email failed: ${result.winnerEmail?.error || 'unknown error'}. Contact the winner manually.`}
            </p>
            <p className="mt-4 text-xs text-stone-500">
              Draw ID <span className="font-mono text-stone-400">{result.drawId}</span> ·{' '}
              {result.drawnAt ? new Date(result.drawnAt).toLocaleString('en-GB') : ''}
            </p>
            <button
              type="button"
              onClick={() => resendWinnerEmail(result.drawId)}
              className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm text-stone-300 hover:bg-white/5"
            >
              Resend winner email (test)
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={drawing || !data?.canDraw}
          onClick={() => setConfirmOpen(true)}
          className="min-h-[44px] rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-base font-bold text-emerald-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {drawing ? 'Drawing…' : 'Draw winner for this period'}
        </button>
        <button
          type="button"
          onClick={() => load(selectedPeriodId, competition)}
          disabled={loading || drawing}
          className="min-h-[44px] rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-stone-300 hover:bg-white/5 disabled:opacity-50"
        >
          Refresh pool
        </button>
      </div>

      {!data?.canDraw && period && !loading ? (
        <p className="text-sm text-stone-500">
          {period.status !== PERIOD_STATUS.closed
            ? 'Close this competition period before running the official draw. While the period is open, the pool may still change.'
            : !data?.poolSize
              ? 'No qualified entries fall within this period\'s entry window.'
              : null}
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
              Run the official draw?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-400">
              This will permanently record one winner from{' '}
              <strong className="text-stone-200">{data?.poolSize}</strong> qualified ticket numbers in{' '}
              <strong className="text-stone-200">{period?.title}</strong> only, and send a formal winner email to{' '}
              <strong className="text-stone-200">the address on the winning entry</strong>. This cannot be undone for
              this period.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={runDraw}
                className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-emerald-950 hover:brightness-110"
              >
                Yes — draw and notify winner
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
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Draw history (this period)</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-white/10 bg-stone-900/80 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Winning ticket</th>
                  <th className="px-3 py-2">Winner</th>
                  <th className="px-3 py-2">Email</th>
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
                    <td className="px-3 py-2 text-xs">
                      {row.winner_email_sent_at ? (
                        <span className="text-emerald-300/90">Sent</span>
                      ) : (
                        <span className="text-amber-400/90">Not sent</span>
                      )}
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
