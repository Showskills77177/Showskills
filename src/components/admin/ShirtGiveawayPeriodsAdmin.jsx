import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { COMPETITION_SHIRT_GIVEAWAY } from '../../../shared/freeEntryLimits.mjs'
import { PERIOD_STATUS, PERIOD_STATUS_LABELS, formatPeriodMonthLabel } from '../../../shared/competitionPeriods.mjs'

function isoToDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function MiniBtn({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-white/15 px-2 py-1 text-xs text-stone-300 hover:bg-white/5 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

/** Admin entry periods for the legacy free Ronaldo shirt giveaway (public countdown + entry window). */
export default function ShirtGiveawayPeriodsAdmin() {
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [editingPeriodId, setEditingPeriodId] = useState('')
  const [periodEdits, setPeriodEdits] = useState({ title: '', entryOpensAt: '', entryClosesAt: '' })
  const [periodForm, setPeriodForm] = useState({ title: '', entryOpensAt: '', entryClosesAt: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch(
        `/api/admin/competitions?slug=${encodeURIComponent(COMPETITION_SHIRT_GIVEAWAY)}`,
      )
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load shirt giveaway periods')
      setDraft(j.competition || null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
      setDraft(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openPeriod = useMemo(
    () => draft?.periods?.find((p) => p.status === PERIOD_STATUS.open),
    [draft?.periods],
  )

  async function createPeriod(e) {
    e.preventDefault()
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const res = await apiFetch('/api/admin/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createPeriod',
          competition: COMPETITION_SHIRT_GIVEAWAY,
          title: periodForm.title,
          entryOpensAt: new Date(periodForm.entryOpensAt).toISOString(),
          entryClosesAt: new Date(periodForm.entryClosesAt).toISOString(),
          status: PERIOD_STATUS.draft,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not create period')
      setPeriodForm({ title: '', entryOpensAt: '', entryClosesAt: '' })
      if (j.competition) setDraft(j.competition)
      else await load()
      setMsg('Shirt giveaway period created.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  async function setPeriodStatus(periodId, status) {
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const res = await apiFetch('/api/admin/competitions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: COMPETITION_SHIRT_GIVEAWAY,
          action: 'periodStatus',
          periodId,
          status,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Period update failed')
      if (j.competition) setDraft(j.competition)
      else await load()
      setMsg('Period status updated.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  function startEditPeriod(period) {
    setEditingPeriodId(period.id)
    setPeriodEdits({
      title: period.title || '',
      entryOpensAt: isoToDatetimeLocal(period.entryOpensAt),
      entryClosesAt: isoToDatetimeLocal(period.entryClosesAt),
    })
  }

  async function savePeriodDates(periodId) {
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const res = await apiFetch('/api/admin/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePeriod',
          periodId,
          title: periodEdits.title.trim(),
          entryOpensAt: new Date(periodEdits.entryOpensAt).toISOString(),
          entryClosesAt: new Date(periodEdits.entryClosesAt).toISOString(),
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not save period dates')
      if (j.competition) setDraft(j.competition)
      else await load()
      setEditingPeriodId('')
      setMsg('Entry period dates saved. Open the period when entries should go live.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !draft) {
    return <p className="text-sm text-stone-500">Loading shirt giveaway entry periods…</p>
  }

  return (
    <section className="rounded-xl border border-lime-400/25 bg-gradient-to-br from-emerald-950/40 to-black/30 p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-lime-300/90">Entry period &amp; countdown</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-400">
        Set when the free shirt giveaway opens and closes. The countdown on the competitions page and shirt giveaway
        page updates automatically from the open period (or the next scheduled period).
      </p>
      {err ? <p className="mt-3 text-sm text-red-300">{err}</p> : null}
      {msg ? <p className="mt-3 text-sm text-lime-200/90">{msg}</p> : null}
      {openPeriod ? (
        <p className="mt-3 text-sm text-lime-200/90">
          Open period: {openPeriod.title}
          {formatPeriodMonthLabel(openPeriod.entryClosesAt)
            ? ` · closes ${formatPeriodMonthLabel(openPeriod.entryClosesAt)}`
            : ''}{' '}
          · {new Date(openPeriod.entryClosesAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
        </p>
      ) : (
        <p className="mt-3 text-sm text-amber-200/90">
          No open period — the public countdown may show the next scheduled window until you open a period.
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {(draft?.periods || []).map((p) => (
          <li key={p.id} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium text-stone-200">{p.title}</div>
                <div className="text-xs text-stone-500">
                  {PERIOD_STATUS_LABELS[p.status] || p.status}
                  {formatPeriodMonthLabel(p.entryClosesAt) ? ` · ${formatPeriodMonthLabel(p.entryClosesAt)}` : ''} ·{' '}
                  {new Date(p.entryOpensAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })} →{' '}
                  {new Date(p.entryClosesAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <MiniBtn disabled={saving} onClick={() => startEditPeriod(p)}>
                  Edit dates
                </MiniBtn>
                {p.status !== PERIOD_STATUS.open ? (
                  <MiniBtn disabled={saving} onClick={() => setPeriodStatus(p.id, PERIOD_STATUS.open)}>
                    Open
                  </MiniBtn>
                ) : null}
                {p.status === PERIOD_STATUS.open ? (
                  <MiniBtn disabled={saving} onClick={() => setPeriodStatus(p.id, PERIOD_STATUS.closed)}>
                    Close
                  </MiniBtn>
                ) : null}
              </div>
            </div>
            {editingPeriodId === p.id ? (
              <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-2">
                <label className="block text-xs text-stone-400 sm:col-span-2">
                  Period title
                  <input
                    value={periodEdits.title}
                    onChange={(e) => setPeriodEdits((f) => ({ ...f, title: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-100"
                  />
                </label>
                <label className="block text-xs text-stone-400">
                  Entries open
                  <input
                    required
                    type="datetime-local"
                    value={periodEdits.entryOpensAt}
                    onChange={(e) => setPeriodEdits((f) => ({ ...f, entryOpensAt: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-100"
                  />
                </label>
                <label className="block text-xs text-stone-400">
                  Entries close
                  <input
                    required
                    type="datetime-local"
                    value={periodEdits.entryClosesAt}
                    onChange={(e) => setPeriodEdits((f) => ({ ...f, entryClosesAt: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-100"
                  />
                </label>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => savePeriodDates(p.id)}
                    className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                  >
                    Save period dates
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPeriodId('')}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-stone-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <form onSubmit={createPeriod} className="mt-4 grid gap-2 sm:grid-cols-2">
        <input
          required
          placeholder="Period title (e.g. June 2026 shirt draw)"
          value={periodForm.title}
          onChange={(e) => setPeriodForm((f) => ({ ...f, title: e.target.value }))}
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-100 sm:col-span-2"
        />
        <input
          required
          type="datetime-local"
          value={periodForm.entryOpensAt}
          onChange={(e) => setPeriodForm((f) => ({ ...f, entryOpensAt: e.target.value }))}
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-100"
        />
        <input
          required
          type="datetime-local"
          value={periodForm.entryClosesAt}
          onChange={(e) => setPeriodForm((f) => ({ ...f, entryClosesAt: e.target.value }))}
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-100"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-lime-400/35 bg-lime-950/40 px-3 py-2 text-sm font-semibold text-lime-100 hover:bg-lime-950/60 disabled:opacity-50 sm:col-span-2"
        >
          Create new period
        </button>
      </form>
    </section>
  )
}
