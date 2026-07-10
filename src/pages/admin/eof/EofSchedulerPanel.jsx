import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../../lib/api'
import { EOF } from './eofStudioTheme'

const inputCls = `mt-1 w-full rounded-lg border px-3 py-2 text-sm ${EOF.input}`

export default function EofSchedulerPanel({ isOwner, onOpenJob }) {
  const [settings, setSettings] = useState(null)
  const [formats, setFormats] = useState([])
  const [voicePresets, setVoicePresets] = useState([])
  const [note, setNote] = useState('')
  const [newsTopics, setNewsTopics] = useState([])
  const [newsSource, setNewsSource] = useState('')
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/eof-scheduler')
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not load scheduler')
      setSettings(j.settings || null)
      setFormats(Array.isArray(j.formats) ? j.formats : [])
      setVoicePresets(Array.isArray(j.voicePresets) ? j.voicePresets : [])
      setNote(typeof j.note === 'string' ? j.note : '')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function saveSettings(e) {
    e?.preventDefault?.()
    if (!settings) return
    setBusy(true)
    setErr('')
    setSuccess('')
    try {
      const res = await apiFetch('/api/admin/eof-scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          enabled: settings.enabled,
          hourUtc: settings.hourUtc,
          minuteUtc: settings.minuteUtc,
          format: settings.format,
          voicePreset: settings.voicePreset,
          publishDelayMinutes: settings.publishDelayMinutes,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Save failed')
      setSettings(j.settings)
      setSuccess('Scheduler settings saved.')
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function runNow() {
    if (!window.confirm('Run the full daily pipeline now? This builds a Short and uploads it to YouTube (scheduled).')) {
      return
    }
    setBusy(true)
    setErr('')
    setSuccess('Running daily Short pipeline — this can take a few minutes…')
    try {
      const res = await apiFetch('/api/admin/eof-scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run-now', force: true }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Run failed')
      if (j.skipped) {
        setSuccess(j.reason || 'Skipped.')
      } else {
        setSuccess(
          `Done: “${j.title}” scheduled${j.scheduledAt ? ` for ${new Date(j.scheduledAt).toLocaleString()}` : ''}. Tags include #shortsfeed.`,
        )
        if (j.jobId && typeof onOpenJob === 'function') onOpenJob(j.jobId)
      }
      await load()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Error')
      setSuccess('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function loadNewsTopics() {
    setBusy(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/eof-scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'news-topics', count: 5 }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not load news topics')
      setNewsTopics(j.topics || [])
      setNewsSource(j.source || '')
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  if (!isOwner) {
    return <p className={`text-sm ${EOF.muted}`}>Daily Short scheduler is available to the channel owner.</p>
  }

  if (loading && !settings) {
    return <p className={`text-sm ${EOF.muted}`}>Loading scheduler…</p>
  }

  return (
    <div className="space-y-6">
      <section className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-5`}>
        <h2 className="text-base font-semibold text-white">Daily Short scheduler</h2>
        <p className={`mt-1 text-xs ${EOF.muted}`}>
          {note ||
            'Automatically composes a football news Short (World Cup + worldwide) with Grok 4.5, builds it, writes title/hashtags (#shortsfeed), picks a thumbnail, and sends it to YouTube Studio.'}
        </p>

        {success ? (
          <p className="mt-3 rounded-lg border border-[#2ba640]/40 bg-[#1a2e1f] px-3 py-2 text-sm text-[#6ee07d]" role="status">
            {success}
          </p>
        ) : null}
        {err ? <p className="mt-3 text-sm text-[#ff4e45]">{err}</p> : null}

        {settings ? (
          <form onSubmit={saveSettings} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-[#aaa] sm:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(settings.enabled)}
                onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
              />
              Enable daily auto-publish (09:00 UTC by default via Vercel Cron)
            </label>
            <label className="text-xs text-[#aaa]">
              Hour (UTC)
              <input
                type="number"
                min={0}
                max={23}
                value={settings.hourUtc}
                onChange={(e) => setSettings((s) => ({ ...s, hourUtc: Number(e.target.value) }))}
                className={inputCls}
              />
            </label>
            <label className="text-xs text-[#aaa]">
              Minute (UTC)
              <input
                type="number"
                min={0}
                max={59}
                value={settings.minuteUtc}
                onChange={(e) => setSettings((s) => ({ ...s, minuteUtc: Number(e.target.value) }))}
                className={inputCls}
              />
            </label>
            <label className="text-xs text-[#aaa]">
              Script format
              <select
                value={settings.format}
                onChange={(e) => setSettings((s) => ({ ...s, format: e.target.value }))}
                className={inputCls}
              >
                {(formats.length ? formats : [{ id: 'news', label: 'Breaking news' }]).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[#aaa]">
              Voice
              <select
                value={settings.voicePreset}
                onChange={(e) => setSettings((s) => ({ ...s, voicePreset: e.target.value }))}
                className={inputCls}
              >
                {(voicePresets.length ? voicePresets : [{ id: 'british', label: 'British (Edge, free)' }]).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[#aaa] sm:col-span-2">
              Publish delay after upload (minutes)
              <input
                type="number"
                min={0}
                max={1440}
                value={settings.publishDelayMinutes}
                onChange={(e) => setSettings((s) => ({ ...s, publishDelayMinutes: Number(e.target.value) }))}
                className={inputCls}
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" disabled={busy} className={`rounded-full px-5 py-2 text-sm ${EOF.btnPrimary} disabled:opacity-50`}>
                Save settings
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={runNow}
                className="rounded-full border border-[#3ea6ff]/50 px-4 py-2 text-sm text-[#9ecbff] disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Run now'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={loadNewsTopics}
                className="rounded-full border border-[#303030] px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Preview news topics (Grok)
              </button>
            </div>
          </form>
        ) : null}

        {settings?.lastRunAt ? (
          <p className={`mt-4 text-[11px] ${EOF.muted}`}>
            Last run: {new Date(settings.lastRunAt).toLocaleString()} · status {settings.lastStatus || '—'}
            {settings.lastError ? ` · ${settings.lastError}` : ''}
            {settings.lastJobId ? ` · job ${settings.lastJobId.slice(0, 8)}…` : ''}
          </p>
        ) : null}
      </section>

      {newsTopics.length ? (
        <section className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-5`}>
          <h3 className="text-sm font-semibold text-white">
            Today’s football angles {newsSource ? `(${newsSource === 'xai' ? 'Grok 4.5' : newsSource})` : ''}
          </h3>
          <ul className="mt-3 space-y-3">
            {newsTopics.map((t, i) => (
              <li key={i} className="rounded-lg border border-[#303030] bg-[#0d0d0d] p-3">
                <p className="text-sm font-medium text-white">{t.headline}</p>
                <p className={`mt-1 text-xs ${EOF.muted}`}>{t.angle}</p>
                <p className="mt-1 text-[10px] text-[#717171]">
                  {(t.desks || []).join(' · ')}
                  {t.whyNow ? ` — ${t.whyNow}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
