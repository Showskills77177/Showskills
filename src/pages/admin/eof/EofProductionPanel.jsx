import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../../../lib/api'
import {
  productionJobStatusLabel,
  estimateEofRenderDurationSec,
  refreshEofRenderProgress,
  buildFallbackRenderProgress,
} from '../../../../shared/eofProduction.mjs'
import { EOF } from './eofStudioTheme'

const inputCls = `mt-1 w-full rounded-lg border px-3 py-2 text-sm ${EOF.input}`
const SELECTED_JOB_KEY = 'eof_production_selected_job'

function readStoredSelectedId() {
  try {
    return sessionStorage.getItem(SELECTED_JOB_KEY) || null
  } catch {
    return null
  }
}

function formatDuration(sec) {
  const total = Math.max(0, Math.round(Number(sec) || 0))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function EofRenderProgressBar({ progress, stuck, onCancel, cancelBusy }) {
  if (!progress) return null
  const percent = Math.min(100, Math.max(0, Math.round(progress.percent || 0)))

  return (
    <div className="rounded-lg border border-[#3ea6ff]/30 bg-[#172033] p-4" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#9ecbff]">
        <span>{progress.message || 'Rendering…'}</span>
        <span className="font-semibold tabular-nums">{percent}%</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#0d1520]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#2563eb] to-[#3ea6ff] transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-[10px] text-[#717171]">
        Elapsed {formatDuration(progress.elapsedSeconds)}
        {progress.etaLabel ? ` · ${progress.etaLabel}` : ''}
        {progress.estimatedTotalSec ? ` · ~${formatDuration(progress.estimatedTotalSec)} total est.` : ''}
      </p>
      {stuck ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-xs text-amber-400">
            This render may have timed out on the server (Vercel limit). Reset it, then try again.
          </p>
          <button
            type="button"
            disabled={cancelBusy}
            onClick={onCancel}
            className="rounded-full border border-amber-500/50 px-3 py-1 text-xs text-amber-200 disabled:opacity-50"
          >
            Reset & retry
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function EofProductionPanel({ isOwner, active = true }) {
  const [jobs, setJobs] = useState([])
  const [tracks, setTracks] = useState([])
  const [voicePresets, setVoicePresets] = useState([])
  const [ffmpegAvailable, setFfmpegAvailable] = useState(false)
  const [topic, setTopic] = useState('')
  const [voicePreset, setVoicePreset] = useState('british')
  const [selectedId, setSelectedId] = useState(readStoredSelectedId)
  const [draftScript, setDraftScript] = useState(null)
  const [draftDirty, setDraftDirty] = useState(false)
  const hydratedJobIdRef = useRef(null)
  const [musicTrackId, setMusicTrackId] = useState('')
  const [musicVolume, setMusicVolume] = useState(0.22)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [renderNote, setRenderNote] = useState('')
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('')
  const [renderPhase, setRenderPhase] = useState('')
  const [renderProgress, setRenderProgress] = useState(null)
  const [renderStack, setRenderStack] = useState(null)
  const [progressTick, setProgressTick] = useState(0)
  const [deletingId, setDeletingId] = useState(null)
  const renderPollRef = useRef(null)

  const fetchProduction = useCallback(async () => {
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
    return j
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const j = await fetchProduction()
      setJobs(j.jobs || [])
      setTracks(j.tracks || [])
      setVoicePresets(j.voicePresets || [])
      setFfmpegAvailable(Boolean(j.ffmpegAvailable))
      setRenderNote(typeof j.renderNote === 'string' ? j.renderNote : '')
      setRenderStack(j.renderStack || null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [fetchProduction])

  const refreshJobsQuiet = useCallback(async () => {
    try {
      const j = await fetchProduction()
      setJobs(j.jobs || [])
      setTracks(j.tracks || [])
    } catch {
      /* background refresh */
    }
  }, [fetchProduction])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!selectedId) {
      try {
        sessionStorage.removeItem(SELECTED_JOB_KEY)
      } catch {
        /* ignore */
      }
      return
    }
    try {
      sessionStorage.setItem(SELECTED_JOB_KEY, selectedId)
    } catch {
      /* ignore */
    }
  }, [selectedId])

  const selected = jobs.find((j) => j.id === selectedId) || null

  function hydrateDraftFromJob(job) {
    setDraftScript(job.script ? JSON.parse(JSON.stringify(job.script)) : null)
    setMusicTrackId(job.musicTrackId || '')
    setMusicVolume(job.musicVolume ?? 0.22)
    setVoicePreset(job.voicePreset || 'british')
    if (job.status !== 'rendered') setAudioPreviewUrl('')
    setDraftDirty(false)
  }

  function selectJob(jobId) {
    hydratedJobIdRef.current = null
    setSelectedId(jobId)
  }

  useEffect(() => {
    if (!selectedId) {
      setDraftScript(null)
      setDraftDirty(false)
      hydratedJobIdRef.current = null
      setAudioPreviewUrl('')
      return
    }
    if (hydratedJobIdRef.current === selectedId) return
    const job = jobs.find((j) => j.id === selectedId)
    if (!job) return
    hydratedJobIdRef.current = selectedId
    hydrateDraftFromJob(job)
  }, [selectedId, jobs])

  useEffect(() => {
    return () => {
      if (renderPollRef.current) clearInterval(renderPollRef.current)
    }
  }, [])

  const isRendering =
    selected?.status === 'rendering' || busy || renderPhase === 'rendering' || renderPhase === 'saving'

  useEffect(() => {
    if (!isRendering) return undefined
    const timer = setInterval(() => setProgressTick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [isRendering])

  const displayProgress = useMemo(() => {
    void progressTick
    if (renderProgress) return refreshEofRenderProgress(renderProgress)
    if (selected?.renderProgress) return refreshEofRenderProgress(selected.renderProgress)
    if (selected?.status === 'rendering' && draftScript) {
      return buildFallbackRenderProgress(selected, draftScript)
    }
    return null
  }, [
    progressTick,
    renderProgress,
    selected?.renderProgress,
    selected?.status,
    selected?.updatedAt,
    draftScript,
  ])

  const isRenderStuck =
    selected?.status === 'rendering' &&
    displayProgress &&
    displayProgress.elapsedSeconds > Math.max(360, (displayProgress.estimatedTotalSec || 120) * 2)

  useEffect(() => {
    if (!active || !selectedId) return undefined
    if (selected?.status !== 'rendering' && renderPhase !== 'rendering') return undefined

    const poll = async () => {
      try {
        const j = await fetchProduction()
        const fresh = (j.jobs || []).find((row) => row.id === selectedId)
        if (!fresh) return
        upsertJob(fresh)
        if (fresh.renderProgress) setRenderProgress(fresh.renderProgress)
      } catch {
        /* polling */
      }
    }

    poll()
    renderPollRef.current = setInterval(poll, 1200)
    return () => {
      if (renderPollRef.current) {
        clearInterval(renderPollRef.current)
        renderPollRef.current = null
      }
    }
  }, [active, selectedId, selected?.status, renderPhase, fetchProduction])

  function stopRenderPolling() {
    if (renderPollRef.current) {
      clearInterval(renderPollRef.current)
      renderPollRef.current = null
    }
  }

  async function cancelStuckRender() {
    if (!selectedId) return
    setBusy(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel-render', jobId: selectedId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not reset render')
      setRenderProgress(null)
      if (j.job) upsertJob(j.job)
      setSuccess('Render reset — you can click “Render audio + music” again.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  function markDraftDirty() {
    setDraftDirty(true)
  }

  function workflowStepState(step) {
    if (!selected) return step === 1 ? 'current' : 'upcoming'
    const status = selected.status
    if (step === 1) return status === 'draft' || status === 'scripting' ? 'current' : 'done'
    if (step === 2) {
      if (status === 'ready_script' || status === 'draft') return 'current'
      if (status === 'rendering' || status === 'rendered' || status === 'failed') return 'done'
      return 'upcoming'
    }
    if (step === 3) {
      if (status === 'rendering') return 'current'
      if (status === 'rendered') return 'done'
      if (status === 'failed') return 'failed'
      return 'current'
    }
    if (step === 4) return status === 'rendered' ? 'current' : 'upcoming'
    return 'upcoming'
  }

  function upsertJob(job) {
    if (!job?.id) return
    setJobs((prev) => {
      const i = prev.findIndex((row) => row.id === job.id)
      if (i === -1) return [job, ...prev]
      const next = [...prev]
      next[i] = job
      return next
    })
  }

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
      selectJob(j.job.id)
      if (j.job?.script) hydrateDraftFromJob(j.job)
      hydratedJobIdRef.current = j.job.id
      setSuccess(`Script drafted for “${j.job.topic}”. Review scenes, then render audio.`)
      upsertJob(j.job)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function saveJob({ silent = false } = {}) {
    if (!selectedId || !draftScript) return false
    if (!silent) {
      setBusy(true)
      setErr('')
      setSuccess('')
    }
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
      if (!silent) {
        setSuccess('Script and music settings saved. Next: click “Render audio + music”.')
      }
      if (j.job) {
        upsertJob(j.job)
        hydratedJobIdRef.current = selectedId
        hydrateDraftFromJob(j.job)
      }
      return true
    } catch (e) {
      if (!silent) setErr(e instanceof Error ? e.message : 'Error')
      if (silent) setErr(e instanceof Error ? e.message : 'Error')
      return false
    } finally {
      if (!silent) setBusy(false)
    }
  }

  async function waitForRenderComplete(jobId) {
    const deadline = Date.now() + 6 * 60 * 1000
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      const j = await fetchProduction()
      const job = (j.jobs || []).find((row) => row.id === jobId)
      if (!job) throw new Error('Job disappeared during render.')
      upsertJob(job)
      if (job.renderProgress) setRenderProgress(job.renderProgress)
      if (job.status === 'rendered') return job
      if (job.status === 'failed') throw new Error(job.errorMessage || 'Render failed')
      if (job.status !== 'rendering') return job
    }
    throw new Error('Render timed out — click Reset & retry, then render again.')
  }

  async function renderAudio() {
    if (!selectedId) return
    setBusy(true)
    setErr('')
    setSuccess('')
    setRenderPhase('saving')
    setAudioPreviewUrl('')
    try {
      const saved = await saveJob({ silent: true })
      if (!saved) return

      setRenderPhase('rendering')
      const estSec = estimateEofRenderDurationSec(draftScript)
      setRenderProgress({
        percent: 2,
        message: 'Starting narration render…',
        etaLabel: `~${formatDuration(estSec)} est.`,
        elapsedSeconds: 0,
        estimatedTotalSec: estSec,
        startedAt: new Date().toISOString(),
        sceneCount: draftScript?.scenes?.length || 1,
        stage: 'tts',
        sceneIndex: 0,
      })
      setSuccess('Rendering narration and mixing music… Keep this tab open.')

      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'render', jobId: selectedId }),
      })
      const j = await res.json().catch(() => ({}))

      let finishedJob = null
      if (res.status === 202 || j.accepted) {
        if (j.job) upsertJob(j.job)
        finishedJob = await waitForRenderComplete(selectedId)
      } else if (res.ok) {
        finishedJob = j.job || null
        if (typeof j.audioDataUrl === 'string' && j.audioDataUrl.startsWith('data:audio/')) {
          setAudioPreviewUrl(j.audioDataUrl)
        }
      } else {
        throw new Error(j.error || 'Render failed')
      }

      if (!finishedJob || finishedJob.status !== 'rendered') {
        throw new Error(finishedJob?.errorMessage || 'Render did not complete')
      }

      if (!audioPreviewUrl) {
        const audioRes = await apiFetch(`/api/admin/eof-production-audio?jobId=${encodeURIComponent(selectedId)}`)
        if (audioRes.ok) {
          const blob = await audioRes.blob()
          setAudioPreviewUrl(URL.createObjectURL(blob))
        }
      }

      setRenderPhase('done')
      setRenderProgress({ percent: 100, message: 'Render complete', etaLabel: '0:00 left' })
      setSuccess(
        finishedJob.mixedAudioPath
          ? 'Audio rendered. Preview below, then video assembly is next.'
          : 'Audio rendered.',
      )
      upsertJob(finishedJob)
      hydratedJobIdRef.current = selectedId
      hydrateDraftFromJob(finishedJob)
    } catch (e) {
      setRenderPhase('failed')
      setRenderProgress(null)
      setErr(e instanceof Error ? e.message : 'Error')
      await refreshJobsQuiet()
    } finally {
      stopRenderPolling()
      setBusy(false)
      setRenderPhase('')
    }
  }

  async function loadAudioPreview() {
    if (!selectedId || !selected?.mixedAudioPath) return
    setErr('')
    try {
      const audioRes = await apiFetch(`/api/admin/eof-production-audio?jobId=${encodeURIComponent(selectedId)}`)
      const j = await audioRes.json().catch(() => ({}))
      if (!audioRes.ok) throw new Error(j.error || 'Could not load audio preview')
      const blob = await audioRes.blob()
      setAudioPreviewUrl(URL.createObjectURL(blob))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load audio preview')
    }
  }

  async function deleteJob(jobId) {
    const job = jobs.find((row) => row.id === jobId)
    const label = job?.title || job?.topic || 'this script'
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return

    setDeletingId(jobId)
    setErr('')
    setSuccess('')
    try {
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', jobId }),
      })
      const text = await res.text()
      let j = {}
      try {
        j = text ? JSON.parse(text) : {}
      } catch {
        /* non-JSON */
      }
      if (!res.ok) {
        throw new Error(j.error || text.trim() || `Could not delete script (HTTP ${res.status})`)
      }

      setJobs((prev) => prev.filter((row) => row.id !== jobId))
      if (selectedId === jobId) {
        hydratedJobIdRef.current = null
        setSelectedId(null)
        setDraftScript(null)
        setDraftDirty(false)
        setAudioPreviewUrl('')
        setRenderProgress(null)
      }
      setSuccess(`Deleted “${label}”.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setDeletingId(null)
    }
  }

  function updateScene(index, field, value) {
    markDraftDirty()
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
        <ol className="mt-3 flex flex-wrap gap-2 text-[11px]">
          {[
            ['1', 'Create script'],
            ['2', 'Review & save'],
            ['3', 'Render audio'],
            ['4', 'Preview audio'],
          ].map(([n, label]) => {
            const state = workflowStepState(Number(n))
            const cls =
              state === 'done'
                ? 'border-[#2ba640]/50 bg-[#1a2e1f] text-[#6ee07d]'
                : state === 'current'
                  ? 'border-[#3ea6ff]/50 bg-[#172033] text-[#9ecbff]'
                  : state === 'failed'
                    ? 'border-[#ff4e45]/50 bg-[#2a1515] text-[#ff9b95]'
                    : 'border-[#303030] text-[#717171]'
            return (
              <li key={n} className={`rounded-full border px-3 py-1 ${cls}`}>
                {n}. {label}
              </li>
            )
          })}
        </ol>
        {!loading && !ffmpegAvailable ? (
          <p className="mt-2 text-xs text-amber-400">
            {renderNote ||
              'ffmpeg is not detected — redeploy staging with ffmpeg-static, or set FFMPEG_PATH on the API host.'}
          </p>
        ) : null}
        {!loading && tracks.length === 0 ? (
          <p className="mt-2 text-xs text-amber-400">
            Add at least one music track in the Music tab, or refresh after the default catalog is seeded.
          </p>
        ) : null}

        {renderStack ? (
          <details className={`mt-3 text-xs ${EOF.muted}`}>
            <summary className="cursor-pointer text-[#aaa]">What API / platform renders the audio?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[#717171]">
              <li>
                <span className="text-[#aaa]">{renderStack.tts.label}</span> — {renderStack.tts.detail}
              </li>
              <li>
                <span className="text-[#aaa]">{renderStack.audio.label}</span> — {renderStack.audio.detail}
              </li>
              <li>
                <span className="text-[#aaa]">{renderStack.host.label}</span> — {renderStack.host.detail}
              </li>
              {renderStack.video ? (
                <li>
                  <span className="text-[#aaa]">{renderStack.video.label}</span> — {renderStack.video.detail}
                </li>
              ) : null}
            </ul>
          </details>
        ) : null}

        {displayProgress ? (
          <EofRenderProgressBar
            progress={displayProgress}
            stuck={isRenderStuck}
            onCancel={cancelStuckRender}
            cancelBusy={busy}
          />
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
                <li key={j.id} className="flex items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => selectJob(j.id)}
                    className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm ${
                      selectedId === j.id ? 'bg-[#272727] text-white' : 'text-[#aaa] hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <div className="font-medium truncate">{j.title || j.topic}</div>
                    <div className="text-[10px] text-[#717171]">
                      {j.status === 'rendering' && j.renderProgress?.percent != null
                        ? `Rendering… ${Math.round(j.renderProgress.percent)}%`
                        : productionJobStatusLabel(j.status)}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteJob(j.id)}
                    disabled={deletingId === j.id}
                    title={`Delete ${j.title || j.topic}`}
                    aria-label={`Delete ${j.title || j.topic}`}
                    className="rounded-lg px-2 text-sm text-[#717171] hover:bg-[#2a1515] hover:text-[#ff9b95] disabled:opacity-50"
                  >
                    ×
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
                <p className={`text-xs ${EOF.muted}`}>
                  {selected.topic}
                  {draftDirty ? <span className="ml-2 text-amber-400">· unsaved changes</span> : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveJob()}
                  className="rounded-full border border-[#303030] px-4 py-1.5 text-xs text-white disabled:opacity-50"
                >
                  Save script
                </button>
                <button
                  type="button"
                  disabled={busy || selected.status === 'rendering'}
                  onClick={renderAudio}
                  className={`rounded-full px-4 py-1.5 text-xs ${EOF.btnPrimary} disabled:opacity-50`}
                >
                  {busy && renderPhase === 'rendering'
                    ? 'Rendering…'
                    : selected.status === 'rendering'
                      ? 'Rendering…'
                      : 'Render audio + music'}
                </button>
                {!busy && selected.status !== 'rendering' && draftScript ? (
                  <span className="self-center text-[10px] text-[#717171]">
                    ~{formatDuration(estimateEofRenderDurationSec(draftScript))} est.
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={deletingId === selected.id}
                  onClick={() => deleteJob(selected.id)}
                  className="rounded-full border border-[#ff4e45]/40 px-4 py-1.5 text-xs text-[#ff9b95] disabled:opacity-50"
                >
                  {deletingId === selected.id ? 'Deleting…' : 'Delete script'}
                </button>
              </div>
            </div>

            {displayProgress && (selected.status === 'rendering' || busy) ? (
              <div className="mt-4">
                <EofRenderProgressBar
                  progress={displayProgress}
                  stuck={isRenderStuck}
                  onCancel={cancelStuckRender}
                  cancelBusy={busy}
                />
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-[#aaa]">
                Music bed
                <select
                  value={musicTrackId}
                  onChange={(e) => {
                    markDraftDirty()
                    setMusicTrackId(e.target.value)
                  }}
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
                  onChange={(e) => {
                    markDraftDirty()
                    setMusicVolume(Number(e.target.value))
                  }}
                  className="mt-2 w-full"
                />
              </label>
            </div>

            <label className="mt-4 block text-xs text-[#aaa]">
              Description
              <textarea
                rows={2}
                value={draftScript.description || ''}
                onChange={(e) => {
                  markDraftDirty()
                  setDraftScript((s) => ({ ...s, description: e.target.value }))
                }}
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

            {selected.status === 'failed' && selected.errorMessage ? (
              <p className="mt-4 rounded-lg border border-[#ff4e45]/40 bg-[#2a1515] px-3 py-2 text-sm text-[#ff9b95]">
                Render failed: {selected.errorMessage}
              </p>
            ) : null}

            {selected.mixedAudioPath || audioPreviewUrl ? (
              <div className="mt-4 rounded-lg border border-[#2ba640]/30 bg-[#141f17] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#6ee07d]">
                  Step 4 — Mixed audio preview
                </p>
                {selected.mixedAudioPath ? (
                  <p className="mt-1 text-[10px] text-[#717171]">{selected.mixedAudioPath}</p>
                ) : null}
                {audioPreviewUrl ? (
                  <audio controls className="mt-3 w-full" src={audioPreviewUrl}>
                    Your browser does not support audio playback.
                  </audio>
                ) : (
                  <button
                    type="button"
                    onClick={loadAudioPreview}
                    className="mt-3 rounded-full border border-[#303030] px-4 py-1.5 text-xs text-white"
                  >
                    Load preview
                  </button>
                )}
                <p className={`mt-2 text-[10px] ${EOF.muted}`}>
                  Video assembly (images + captions) is the next pipeline step.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className={`text-sm ${EOF.muted}`}>Select a job or create one from a topic.</p>
        )}
      </div>
    </div>
  )
}
