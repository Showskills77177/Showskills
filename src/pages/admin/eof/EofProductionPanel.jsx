import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../../lib/api'
import { productionJobStatusLabel } from '../../../../shared/eofProduction.mjs'
import { EOF } from './eofStudioTheme'

const inputCls = `mt-1 w-full rounded-lg border px-3 py-2 text-sm ${EOF.input}`

export default function EofProductionPanel({ isOwner }) {
  const [jobs, setJobs] = useState([])
  const [tracks, setTracks] = useState([])
  const [voicePresets, setVoicePresets] = useState([])
  const [ffmpegAvailable, setFfmpegAvailable] = useState(false)
  const [topic, setTopic] = useState('')
  const [voicePreset, setVoicePreset] = useState('british')
  const [selectedId, setSelectedId] = useState(null)
  const [draftScript, setDraftScript] = useState(null)
  const [musicTrackId, setMusicTrackId] = useState('')
  const [musicVolume, setMusicVolume] = useState(0.22)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [renderNote, setRenderNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/eof-production')
      const text = await res.text()
      let j = {}
      try {
        j = text ? JSON.parse(text) : {}
      } catch {
        /* non-JSON */
      }
      if (!res.ok) {
        const detail =
          typeof j.error === 'string'
            ? j.error
            : text.trim()
              ? `${res.status}: ${text.trim().slice(0, 160)}`
              : `Request failed (HTTP ${res.status})`
        throw new Error(detail)
      }
      setJobs(j.jobs || [])
      setTracks(j.tracks || [])
      setVoicePresets(j.voicePresets || [])
      setFfmpegAvailable(Boolean(j.ffmpegAvailable))
      setRenderNote(typeof j.renderNote === 'string' ? j.renderNote : '')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selected = jobs.find((j) => j.id === selectedId) || null

  useEffect(() => {
    if (selected) {
      setDraftScript(selected.script ? JSON.parse(JSON.stringify(selected.script)) : null)
      setMusicTrackId(selected.musicTrackId || '')
      setMusicVolume(selected.musicVolume ?? 0.22)
    } else {
      setDraftScript(null)
    }
  }, [selected])

  async function createJob(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setSuccess('')
    try {
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, voicePreset, musicTrackId: musicTrackId || null }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not create job')
      setTopic('')
      setSelectedId(j.job.id)
      setSuccess(`Script drafted for “${j.job.topic}”. Review scenes, then render audio.`)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function saveJob() {
    if (!selectedId || !draftScript) return
    setBusy(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedId,
          script: draftScript,
          musicTrackId: musicTrackId || null,
          musicVolume,
          voicePreset,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Save failed')
      setSuccess('Script and music settings saved.')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function renderAudio() {
    if (!selectedId) return
    setBusy(true)
    setErr('')
    setSuccess('')
    try {
      await saveJob()
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'render', jobId: selectedId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Render failed')
      setSuccess(
        j.job?.mixedAudioPath
          ? `Audio rendered with music bed. File: ${j.job.mixedAudioPath}`
          : 'Audio rendered.',
      )
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  function updateScene(index, field, value) {
    setDraftScript((prev) => {
      if (!prev?.scenes) return prev
      const scenes = [...prev.scenes]
      scenes[index] = { ...scenes[index], [field]: value }
      return { ...prev, scenes }
    })
  }

  if (!isOwner) {
    return <p className={`text-sm ${EOF.muted}`}>Production automation is available to the channel owner.</p>
  }

  return (
    <div className="space-y-6">
      {loading ? <p className={`text-sm ${EOF.muted}`}>Loading production…</p> : null}
      <section className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-5`}>
        <h2 className="text-base font-semibold text-white">Auto production</h2>
        <p className={`mt-1 text-xs ${EOF.muted}`}>
          Topic → script → narration + music mix. Video assembly (images + captions) comes next.
        </p>
        {!loading && !ffmpegAvailable ? (
          <p className="mt-2 text-xs text-amber-400">
            {renderNote ||
              'ffmpeg is not available on this API host — you can still draft scripts here; audio render needs a local worker with ffmpeg.'}
          </p>
        ) : null}
        {!loading && tracks.length === 0 ? (
          <p className="mt-2 text-xs text-amber-400">
            Add at least one music track in the Music tab, or refresh after the default catalog is seeded.
          </p>
        ) : null}

        <form onSubmit={createJob} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[200px] flex-1 text-xs text-[#aaa]">
            Topic (e.g. Cristiano Ronaldo)
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={inputCls}
              placeholder="Player or theme"
              minLength={2}
              required
            />
          </label>
          <label className="text-xs text-[#aaa]">
            Voice
            <select
              value={voicePreset}
              onChange={(e) => setVoicePreset(e.target.value)}
              className={inputCls}
            >
              {voicePresets.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || loading || tracks.length === 0}
            className={`rounded-full px-5 py-2 text-sm ${EOF.btnPrimary} disabled:opacity-50`}
          >
            Create script
          </button>
        </form>

        {success ? (
          <p className="mt-3 rounded-lg border border-[#2ba640]/40 bg-[#1a2e1f] px-3 py-2 text-sm text-[#6ee07d]" role="status">
            {success}
          </p>
        ) : null}
        {err ? <p className="mt-3 text-sm text-[#ff4e45]">{err}</p> : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#717171]">Jobs</h3>
          <ul className="space-y-1">
            {jobs.length === 0 ? (
              <li className={`text-sm ${EOF.muted}`}>No jobs yet</li>
            ) : (
              jobs.map((j) => (
                <li key={j.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(j.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      selectedId === j.id ? 'bg-[#272727] text-white' : 'text-[#aaa] hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <div className="font-medium truncate">{j.title || j.topic}</div>
                    <div className="text-[10px] text-[#717171]">{productionJobStatusLabel(j.status)}</div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        {selected && draftScript ? (
          <div className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{draftScript.title}</h3>
                <p className={`text-xs ${EOF.muted}`}>{selected.topic}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveJob}
                  className="rounded-full border border-[#303030] px-4 py-1.5 text-xs text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={renderAudio}
                  className={`rounded-full px-4 py-1.5 text-xs ${EOF.btnPrimary}`}
                >
                  Render audio + music
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-[#aaa]">
                Music bed
                <select
                  value={musicTrackId}
                  onChange={(e) => setMusicTrackId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Auto (default / mood)</option>
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.mood}){t.isDefault ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[#aaa]">
                Music volume ({Math.round(musicVolume * 100)}%)
                <input
                  type="range"
                  min={0.05}
                  max={0.5}
                  step={0.01}
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </label>
            </div>

            <label className="mt-4 block text-xs text-[#aaa]">
              Description
              <textarea
                rows={2}
                value={draftScript.description || ''}
                onChange={(e) => setDraftScript((s) => ({ ...s, description: e.target.value }))}
                className={inputCls}
              />
            </label>

            <div className="mt-4 space-y-3">
              {draftScript.scenes?.map((scene, i) => (
                <div key={scene.id || i} className="rounded-lg border border-[#303030] p-3">
                  <p className="text-[10px] font-bold uppercase text-[#717171]">Scene {i + 1}</p>
                  <label className="mt-2 block text-xs text-[#aaa]">
                    Narration
                    <textarea
                      rows={2}
                      value={scene.narration || ''}
                      onChange={(e) => updateScene(i, 'narration', e.target.value)}
                      className={inputCls}
                    />
                  </label>
                  <label className="mt-2 block text-xs text-[#aaa]">
                    On-screen caption
                    <input
                      value={scene.caption || ''}
                      onChange={(e) => updateScene(i, 'caption', e.target.value)}
                      className={inputCls}
                    />
                  </label>
                  <label className="mt-2 block text-xs text-[#aaa]">
                    Image search
                    <input
                      value={scene.imageQuery || ''}
                      onChange={(e) => updateScene(i, 'imageQuery', e.target.value)}
                      className={inputCls}
                    />
                  </label>
                  {scene.durationSec ? (
                    <p className="mt-1 text-[10px] text-[#3ea6ff]">{scene.durationSec.toFixed(1)}s (after render)</p>
                  ) : null}
                </div>
              ))}
            </div>

            {selected.mixedAudioPath ? (
              <p className="mt-4 text-xs text-[#6ee07d]">Mixed audio: {selected.mixedAudioPath}</p>
            ) : null}
          </div>
        ) : (
          <p className={`text-sm ${EOF.muted}`}>Select a job or create one from a topic.</p>
        )}
      </div>
    </div>
  )
}
