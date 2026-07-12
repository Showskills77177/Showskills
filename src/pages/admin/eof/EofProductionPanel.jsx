import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../../../lib/api'
import {
  productionJobStatusLabel,
  estimateEofVideoRenderDurationSec,
  estimateEofRenderDurationSec,
  estimateEofVoiceoverRemuxDurationSec,
  refreshEofRenderProgress,
  buildFallbackRenderProgress,
  EOF_DEFAULT_VOICE_PRESET,
} from '../../../../shared/eofProduction.mjs'
import {
  EOF_DEFAULT_SCRIPT_FORMAT,
  createEofScene,
  EOF_MAX_SCENES,
  EOF_MIN_SCENES,
} from '../../../../shared/eofScriptTemplates.mjs'
import {
  EOF_ELEVENLABS_VOICE_FIELDS,
  EOF_ELEVENLABS_VOICE_LIMITS,
  normalizeElevenLabsVoiceSettings,
} from '../../../../shared/eofElevenLabsVoice.mjs'
import { eofVoiceRegenerationStatus } from '../../../../shared/eofVoiceRegeneration.mjs'
import { EOF } from './eofStudioTheme'

const inputCls = `mt-1 w-full rounded-lg border px-3 py-2 text-sm ${EOF.input}`
const SELECTED_JOB_KEY = 'eof_production_selected_job'
const SCRIPT_PROVIDER_KEY = 'eof_script_provider'

function readStoredScriptProvider() {
  try {
    const v = localStorage.getItem(SCRIPT_PROVIDER_KEY)
    if (v === 'auto' || v === 'groq' || v === 'xai' || v === 'openai') return v
  } catch {
    /* ignore */
  }
  return 'auto'
}

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
        <span>{progress.message || 'Building…'}</span>
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
      </p>
      {stuck ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-xs text-amber-400">This build may have timed out. Reset, then try again.</p>
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

export default function EofProductionPanel({ isOwner, active = true, onSendToStudio }) {
  const [jobs, setJobs] = useState([])
  const [scriptFormats, setScriptFormats] = useState([])
  const [format, setFormat] = useState(EOF_DEFAULT_SCRIPT_FORMAT)
  const [voicePresets, setVoicePresets] = useState([])
  const [voicePreset, setVoicePreset] = useState(EOF_DEFAULT_VOICE_PRESET)
  const [elevenLabsConfigured, setElevenLabsConfigured] = useState(false)
  const [elevenLabsVoiceDefaults, setElevenLabsVoiceDefaults] = useState(() =>
    normalizeElevenLabsVoiceSettings(null),
  )
  const [voiceSettings, setVoiceSettings] = useState(() => normalizeElevenLabsVoiceSettings(null))
  const [openAiScriptEnabled, setOpenAiScriptEnabled] = useState(false)
  const [scriptProviders, setScriptProviders] = useState({
    xai: false,
    openai: false,
    groq: false,
    guardian: false,
    perplexity: false,
  })
  const [scriptProviderOptions, setScriptProviderOptions] = useState([])
  const [scriptProvider, setScriptProvider] = useState(readStoredScriptProvider)
  const [preferredScriptProvider, setPreferredScriptProvider] = useState('template')
  const [ffmpegAvailable, setFfmpegAvailable] = useState(false)
  const [topic, setTopic] = useState('')
  const [selectedId, setSelectedId] = useState(readStoredSelectedId)
  const [draftScript, setDraftScript] = useState(null)
  const [draftDirty, setDraftDirty] = useState(false)
  const hydratedJobIdRef = useRef(null)
  const [scriptBillingNote, setScriptBillingNote] = useState('')
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  /** 'draft' | 'rewrite' | '' — so Regenerate button can show its own label */
  const [scriptBusy, setScriptBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const [renderNote, setRenderNote] = useState('')
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('')
  const [renderPhase, setRenderPhase] = useState('')
  const [renderProgress, setRenderProgress] = useState(null)
  const [renderStack, setRenderStack] = useState(null)
  const [imageSources, setImageSources] = useState({
    google: false,
    pexels: false,
    pinterestApi: false,
    pinterestPinUrl: true,
  })
  const [imagesNote, setImagesNote] = useState('')
  const [progressTick, setProgressTick] = useState(0)
  const [deletingId, setDeletingId] = useState(null)
  const renderPollRef = useRef(null)
  const resultPanelRef = useRef(null)

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
      setScriptFormats(Array.isArray(j.scriptFormats) ? j.scriptFormats : [])
      if (j.defaultScriptFormat) setFormat((prev) => prev || j.defaultScriptFormat)
      setVoicePresets(Array.isArray(j.voicePresets) ? j.voicePresets : [])
      if (j.defaultVoicePreset) setVoicePreset((prev) => prev || j.defaultVoicePreset)
      setElevenLabsConfigured(Boolean(j.elevenLabsConfigured))
      if (j.elevenLabsVoiceDefaults) {
        setElevenLabsVoiceDefaults(normalizeElevenLabsVoiceSettings(j.elevenLabsVoiceDefaults))
      }
      setOpenAiScriptEnabled(Boolean(j.openAiScriptEnabled))
      setScriptProviders(
        j.scriptProviders && typeof j.scriptProviders === 'object'
          ? j.scriptProviders
          : { xai: false, openai: false, groq: false, guardian: false, perplexity: false },
      )
      setScriptProviderOptions(Array.isArray(j.scriptProviderOptions) ? j.scriptProviderOptions : [])
      if (j.preferredScriptProvider) setPreferredScriptProvider(j.preferredScriptProvider)
      setScriptBillingNote(typeof j.scriptBillingNote === 'string' ? j.scriptBillingNote : '')
      setFfmpegAvailable(Boolean(j.ffmpegAvailable))
      setRenderNote(typeof j.renderNote === 'string' ? j.renderNote : '')
      setImageSources(
        j.imageSources && typeof j.imageSources === 'object'
          ? j.imageSources
          : { google: false, pexels: Boolean(j.pexelsConfigured), pinterestApi: false, pinterestPinUrl: true },
      )
      setImagesNote(typeof j.imagesNote === 'string' ? j.imagesNote : '')
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
    } catch {
      /* background */
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
  const hasPlainDraft = String(draftScript?.plainTextDraft || '').trim().length >= 40
  const regenerateScriptLabel = scriptBusy === 'draft'
    ? 'Regenerating…'
    : hasPlainDraft
      ? 'Regenerate script'
      : 'Generate script'

  const voiceRegen = useMemo(() => {
    if (!selected || !draftScript) {
      return { canRegenerate: false, remaining: 0, limit: 3, blockedReason: null }
    }
    return eofVoiceRegenerationStatus({ ...selected, script: draftScript })
  }, [selected, draftScript])

  function hydrateDraftFromJob(job) {
    setDraftScript(job.script ? JSON.parse(JSON.stringify(job.script)) : null)
    if (job.script?.format) setFormat(job.script.format)
    if (job.voicePreset) setVoicePreset(job.voicePreset)
    if (job.voiceSettings) {
      setVoiceSettings(normalizeElevenLabsVoiceSettings(job.voiceSettings))
    } else if (job.voicePreset === 'brian') {
      setVoiceSettings(normalizeElevenLabsVoiceSettings(elevenLabsVoiceDefaults))
    }
    if (job.status !== 'video_rendered') setVideoPreviewUrl('')
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
      setVideoPreviewUrl('')
      return
    }
    if (hydratedJobIdRef.current === selectedId) return
    const job = jobs.find((j) => j.id === selectedId)
    if (!job) return
    hydratedJobIdRef.current = selectedId
    hydrateDraftFromJob(job)
  }, [selectedId, jobs])

  useEffect(() => {
    if (!selectedId || !selected || busy) return undefined
    if (selected.status === 'video_rendered' && !videoPreviewUrl) {
      void loadVideoPreview()
    }
    return undefined
  }, [selectedId, selected?.status, busy])

  useEffect(() => {
    return () => {
      if (renderPollRef.current) clearInterval(renderPollRef.current)
    }
  }, [])

  const isRendering =
    selected?.status === 'rendering' ||
    selected?.status === 'rendering_video' ||
    busy ||
    renderPhase === 'rendering' ||
    renderPhase === 'rendering-video'

  useEffect(() => {
    if (!isRendering) return undefined
    const timer = setInterval(() => setProgressTick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [isRendering])

  const displayProgress = useMemo(() => {
    void progressTick
    if (renderProgress) return refreshEofRenderProgress(renderProgress)
    if (selected?.renderProgress) return refreshEofRenderProgress(selected.renderProgress)
    if ((selected?.status === 'rendering' || selected?.status === 'rendering_video') && draftScript) {
      return buildFallbackRenderProgress(selected, draftScript, 'video')
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
    (selected?.status === 'rendering' || selected?.status === 'rendering_video') &&
    displayProgress &&
    displayProgress.elapsedSeconds > Math.max(240, (displayProgress.estimatedTotalSec || 60) * 2)

  useEffect(() => {
    if (!active || !selectedId) return undefined
    if (
      selected?.status !== 'rendering' &&
      selected?.status !== 'rendering_video' &&
      renderPhase !== 'rendering' &&
      renderPhase !== 'rendering-video'
    ) {
      return undefined
    }

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
      if (!res.ok) throw new Error(j.error || 'Could not reset build')
      setRenderProgress(null)
      if (j.job) upsertJob(j.job)
      setSuccess('Build reset — you can click Build Short again.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  function markDraftDirty() {
    setDraftDirty(true)
  }

  function updateVoiceSetting(key, value) {
    setVoiceSettings((prev) => normalizeElevenLabsVoiceSettings({ ...prev, [key]: value }))
    markDraftDirty()
  }

  function resetBrianVoiceSettings() {
    setVoiceSettings(normalizeElevenLabsVoiceSettings(elevenLabsVoiceDefaults))
    markDraftDirty()
  }

  function workflowStepState(step) {
    if (!selected) return step === 1 ? 'current' : 'upcoming'
    const status = selected.status
    const hasScenes = (draftScript?.scenes?.length || selected?.script?.scenes?.length || 0) >= 1
    const hasDraft = Boolean(String(draftScript?.plainTextDraft || selected?.script?.plainTextDraft || '').trim())
    if (step === 1) {
      // Write draft
      if (status === 'draft' || (hasDraft && !hasScenes)) return 'current'
      if (hasDraft || hasScenes || status === 'ready_script' || status === 'video_rendered') return 'done'
      return 'current'
    }
    if (step === 2) {
      // Adapt to scenes
      if (!hasDraft && !hasScenes) return 'upcoming'
      if (hasScenes && ['ready_script', 'rendering', 'rendering_video', 'video_rendered', 'rendered'].includes(status)) {
        return status === 'ready_script' || status === 'rendered' ? 'current' : 'done'
      }
      if (hasDraft && !hasScenes) return 'current'
      return 'upcoming'
    }
    if (step === 3) {
      if (['rendering', 'rendering_video'].includes(status)) return 'current'
      if (status === 'video_rendered') return 'done'
      if (status === 'failed') return 'failed'
      if (hasScenes) return 'upcoming'
      return 'upcoming'
    }
    if (step === 4) return status === 'video_rendered' ? 'current' : 'upcoming'
    return 'upcoming'
  }

  function sceneStillUrl(sceneNumber) {
    if (!selectedId) return ''
    const bust = selected?.updatedAt ? encodeURIComponent(String(selected.updatedAt)) : String(Date.now())
    return `/api/admin/eof-production-scene-image?jobId=${encodeURIComponent(selectedId)}&scene=${sceneNumber}&v=${bust}`
  }

  async function downloadShort() {
    if (!selectedId) return
    setErr('')
    try {
      let blobUrl = videoPreviewUrl
      if (!blobUrl) {
        const videoRes = await apiFetch(
          `/api/admin/eof-production-video?jobId=${encodeURIComponent(selectedId)}&download=1`,
        )
        if (!videoRes.ok) {
          const j = await videoRes.json().catch(() => ({}))
          throw new Error(j.error || 'Could not download video')
        }
        const blob = await videoRes.blob()
        blobUrl = URL.createObjectURL(blob)
        setVideoPreviewUrl(blobUrl)
      }
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${String(selected?.title || selected?.topic || 'eof-short').replace(/[^\w\-]+/g, '-').slice(0, 60)}.mp4`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setSuccess('Download started.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Download failed')
    }
  }

  async function sendToYoutubeStudio() {
    if (!selectedId || typeof onSendToStudio !== 'function') return
    setBusy(true)
    setErr('')
    try {
      let blob
      if (videoPreviewUrl) {
        const r = await fetch(videoPreviewUrl)
        blob = await r.blob()
      } else {
        const videoRes = await apiFetch(`/api/admin/eof-production-video?jobId=${encodeURIComponent(selectedId)}`)
        if (!videoRes.ok) {
          const j = await videoRes.json().catch(() => ({}))
          throw new Error(j.error || 'Could not load video for Studio')
        }
        blob = await videoRes.blob()
        setVideoPreviewUrl(URL.createObjectURL(blob))
      }
      const title = String(draftScript?.title || selected?.title || selected?.topic || 'EOF Short').trim()
      const file = new File([blob], `${title.replace(/[^\w\-]+/g, '-').slice(0, 60) || 'eof-short'}.mp4`, {
        type: 'video/mp4',
      })
      onSendToStudio({
        file,
        title,
        description: String(draftScript?.description || '').trim(),
        tags: Array.isArray(draftScript?.tags) ? draftScript.tags.join(', ') : '',
        productionJobId: selectedId,
      })
      setSuccess('Opened YouTube Studio with this Short — review and upload.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send to Studio')
    } finally {
      setBusy(false)
    }
  }

  async function waitForJobComplete(jobId, acceptableStatuses = ['video_rendered']) {
    const deadline = Date.now() + 12 * 60 * 1000
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      const j = await fetchProduction()
      const job = (j.jobs || []).find((row) => row.id === jobId)
      if (!job) throw new Error('Job disappeared during build.')
      upsertJob(job)
      if (job.renderProgress) setRenderProgress(job.renderProgress)
      if (acceptableStatuses.includes(job.status)) return job
      if (job.status === 'failed') throw new Error(job.errorMessage || 'Build failed')
    }
    throw new Error('Build timed out — click Reset & retry, then try again.')
  }

  async function waitForVideoComplete(jobId) {
    return waitForJobComplete(jobId, ['video_rendered'])
  }

  async function buildShort() {
    if (!selectedId || !draftScript) return
    setBusy(true)
    setErr('')
    setSuccess('Building Short — voiceover, photos, captions…')
    setRenderPhase('rendering')
    setVideoPreviewUrl('')

    try {
      const saved = await saveJob({ silent: true })
      if (!saved) {
        setErr((prev) => prev || 'Could not save script — fix errors and try again.')
        return
      }

      const estSec =
        estimateEofRenderDurationSec(draftScript) +
        estimateEofVideoRenderDurationSec(draftScript?.scenes?.length || 5)
      setRenderProgress({
        percent: 3,
        message: 'Starting voiceover…',
        etaLabel: `~${formatDuration(estSec)} est.`,
        elapsedSeconds: 0,
        estimatedTotalSec: estSec,
        startedAt: new Date().toISOString(),
        sceneCount: draftScript?.scenes?.length || 5,
        stage: 'tts',
        pipeline: 'audio',
      })

      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'build-short', jobId: selectedId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 202) {
        throw new Error(j.error || `Build failed to start (HTTP ${res.status})`)
      }
      if (j.job) {
        upsertJob(j.job)
        if (j.job.renderProgress) setRenderProgress(j.job.renderProgress)
      }

      const finishedJob = await waitForVideoComplete(selectedId)
      if (finishedJob.status !== 'video_rendered') {
        throw new Error(finishedJob.errorMessage || 'Build did not finish with a video')
      }

      await loadVideoPreview()
      setRenderProgress({ percent: 100, message: 'Short ready', etaLabel: '0:00 left', pipeline: 'video' })
      setSuccess('Your Short is ready — voiceover, images, and captions.')
      upsertJob(finishedJob)
      hydratedJobIdRef.current = selectedId
      hydrateDraftFromJob(finishedJob)

      setTimeout(() => {
        resultPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
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

  async function regenerateVoiceover() {
    if (!selectedId || !draftScript) return
    setBusy(true)
    setErr('')
    setSuccess('Regenerating voiceover with your Brian settings — reusing scene photos…')
    setRenderPhase('rendering')
    setVideoPreviewUrl('')

    try {
      const saved = await saveJob({ silent: true })
      if (!saved) {
        setErr((prev) => prev || 'Could not save voice settings — fix errors and try again.')
        return
      }

      const estSec = estimateEofVoiceoverRemuxDurationSec(draftScript)
      setRenderProgress({
        percent: 3,
        message: 'Regenerating voiceover…',
        etaLabel: `~${formatDuration(estSec)} est.`,
        elapsedSeconds: 0,
        estimatedTotalSec: estSec,
        startedAt: new Date().toISOString(),
        sceneCount: draftScript?.scenes?.length || 5,
        stage: 'tts',
        pipeline: 'audio',
      })

      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate-voiceover',
          jobId: selectedId,
          voicePreset,
          voiceSettings: voicePreset === 'brian' ? voiceSettings : null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 202) {
        throw new Error(j.error || `Voiceover regeneration failed (HTTP ${res.status})`)
      }
      if (j.job) {
        upsertJob(j.job)
        if (j.job.renderProgress) setRenderProgress(j.job.renderProgress)
      }

      const finishedJob = await waitForJobComplete(selectedId, ['video_rendered', 'rendered'])
      if (finishedJob.status !== 'video_rendered' && finishedJob.status !== 'rendered') {
        throw new Error(finishedJob.errorMessage || 'Voiceover regeneration did not finish')
      }

      if (finishedJob.status === 'video_rendered') {
        await loadVideoPreview()
      }
      setRenderProgress({ percent: 100, message: 'Voiceover updated', etaLabel: '0:00 left', pipeline: 'video' })
      setSuccess(
        finishedJob.status === 'video_rendered'
          ? 'Voiceover regenerated — same photos, new Brian mix, Short remuxed.'
          : 'Voiceover regenerated — run Build Short once to create the video.',
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
        body: JSON.stringify({ topic, format, voicePreset, scriptProvider }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not create script')
      setTopic('')
      selectJob(j.job.id)
      if (j.job?.script) hydrateDraftFromJob(j.job)
      hydratedJobIdRef.current = j.job.id
      if (j.scriptWarning) {
        setErr(j.scriptWarning)
        setSuccess(
          `Fallback draft ready for “${j.job.topic}”. Edit it, then Adapt to scenes — or fix AI billing and click Regenerate script.`,
        )
      } else {
        setSuccess(
          j.scriptProviderLabel
            ? `Plain-text draft written with ${j.scriptProviderLabel}. Edit it, then Adapt to scenes.`
            : `Plain-text draft ready for “${j.job.topic}”. Edit it, then Adapt to scenes.`,
        )
      }
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
          voicePreset,
          voiceSettings: voicePreset === 'brian' ? voiceSettings : null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Save failed')
      if (!silent) {
        const hasScenes = (draftScript.scenes?.length || 0) >= 1
        setSuccess(hasScenes ? 'Script saved. Next: Build Short.' : 'Draft saved. Next: Adapt to scenes.')
      }
      if (j.job) {
        upsertJob(j.job)
        hydratedJobIdRef.current = selectedId
        hydrateDraftFromJob(j.job)
      }
      return true
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
      return false
    } finally {
      if (!silent) setBusy(false)
    }
  }

  async function regenerateDraft() {
    if (!selectedId) return
    setBusy(true)
    setScriptBusy('draft')
    setErr('')
    setSuccess('')
    try {
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate-draft', jobId: selectedId, format, scriptProvider }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not regenerate draft')
      setVideoPreviewUrl('')
      setRenderProgress(null)
      if (j.job) {
        upsertJob(j.job)
        hydratedJobIdRef.current = selectedId
        hydrateDraftFromJob(j.job)
      }
      if (j.scriptWarning) {
        setErr(j.scriptWarning)
        setSuccess('Fallback draft loaded. Edit it, or fix AI billing and Regenerate again.')
      } else {
        setSuccess(
          j.scriptProviderLabel
            ? `Script regenerated with ${j.scriptProviderLabel}${j.job?.topic ? ` — “${j.job.topic}”` : ''}. Edit, then Adapt to scenes.`
            : 'Script regenerated. Edit if needed, then Adapt to scenes.',
        )
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
      setScriptBusy('')
    }
  }

  async function adaptToScenes() {
    if (!selectedId || !draftScript) return
    const plain = String(draftScript.plainTextDraft || '').trim()
    if (plain.length < 40) {
      setErr('Write a fuller plain-text script first (at least a short paragraph).')
      return
    }
    setBusy(true)
    setErr('')
    setSuccess('')
    try {
      // Save draft text first so Adapt uses the latest edits
      await saveJob({ silent: true })
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adapt-to-scenes',
          jobId: selectedId,
          format,
          plainTextDraft: plain,
          scriptProvider,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not adapt to scenes')
      setVideoPreviewUrl('')
      setRenderProgress(null)
      if (j.job) {
        upsertJob(j.job)
        hydratedJobIdRef.current = selectedId
        hydrateDraftFromJob(j.job)
      }
      setSuccess(
        j.scriptProviderLabel
          ? `Scenes adapted with ${j.scriptProviderLabel}. Tweak captions, then Build Short.`
          : 'Scenes ready. Tweak captions, then Build Short.',
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function regenerateScript() {
    if (!selectedId) return
    setBusy(true)
    setScriptBusy('rewrite')
    setErr('')
    setSuccess('')
    try {
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate-script', jobId: selectedId, format, scriptProvider }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not rewrite script')
      setVideoPreviewUrl('')
      setRenderProgress(null)
      if (j.job) {
        upsertJob(j.job)
        hydratedJobIdRef.current = selectedId
        hydrateDraftFromJob(j.job)
      }
      setSuccess('Full rewrite done (new draft + scenes). Review, then Build Short.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
      setScriptBusy('')
    }
  }

  async function loadVideoPreview() {
    if (!selectedId) return
    setErr('')
    try {
      const videoRes = await apiFetch(`/api/admin/eof-production-video?jobId=${encodeURIComponent(selectedId)}`)
      if (!videoRes.ok) {
        const j = await videoRes.json().catch(() => ({}))
        throw new Error(j.error || 'Could not load video preview')
      }
      const blob = await videoRes.blob()
      setVideoPreviewUrl(URL.createObjectURL(blob))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load video preview')
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
        setVideoPreviewUrl('')
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
      const next = { ...scenes[index], [field]: value }
      // Keep narration aligned with on-screen caption for older rows / APIs
      if (field === 'caption') next.narration = value
      scenes[index] = next
      return { ...prev, scenes }
    })
  }

  function addScene(afterIndex = null) {
    markDraftDirty()
    setDraftScript((prev) => {
      if (!prev?.scenes) return prev
      if (prev.scenes.length >= EOF_MAX_SCENES) return prev
      const topic = prev.topic || selected?.topic || 'football'
      const insertAt =
        afterIndex == null || afterIndex < 0 ? prev.scenes.length : Math.min(prev.scenes.length, afterIndex + 1)
      const newScene = createEofScene({
        caption: 'New scene — write the on-screen line',
        imageQuery: `${topic} football`,
        role: insertAt === 0 ? 'hook' : 'body',
        durationSec: 3,
      })
      const scenes = [...prev.scenes]
      scenes.splice(insertAt, 0, newScene)
      // Keep last scene as CTA when possible
      if (scenes.length > 1) {
        scenes[scenes.length - 1] = { ...scenes[scenes.length - 1], role: 'cta' }
        if (scenes[0]) scenes[0] = { ...scenes[0], role: scenes[0].role || 'hook' }
      }
      return { ...prev, scenes }
    })
    setSuccess(`Scene added. Edit the caption, then Rebuild Short to include it.`)
  }

  function removeScene(index) {
    markDraftDirty()
    setDraftScript((prev) => {
      if (!prev?.scenes || prev.scenes.length <= EOF_MIN_SCENES) return prev
      const scenes = prev.scenes.filter((_, i) => i !== index)
      if (scenes[0]) scenes[0] = { ...scenes[0], role: 'hook' }
      if (scenes.length > 1) scenes[scenes.length - 1] = { ...scenes[scenes.length - 1], role: 'cta' }
      return { ...prev, scenes }
    })
    setSuccess('Scene removed. Rebuild Short to update voiceover, images, and video.')
  }

  function moveScene(index, direction) {
    markDraftDirty()
    setDraftScript((prev) => {
      if (!prev?.scenes) return prev
      const target = index + direction
      if (target < 0 || target >= prev.scenes.length) return prev
      const scenes = [...prev.scenes]
      const tmp = scenes[index]
      scenes[index] = scenes[target]
      scenes[target] = tmp
      return { ...prev, scenes }
    })
  }

  const sceneCount = draftScript?.scenes?.length || 0
  const wordCount = String(draftScript?.plainTextDraft || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
  const scriptSourceLabel =
    selected?.scriptSource && selected.scriptSource !== 'template'
      ? selected.scriptSource === 'xai'
        ? 'Grok'
        : selected.scriptSource
      : preferredScriptProvider === 'xai' && !selected?.scriptSource
        ? 'Grok'
        : selected?.scriptSource === 'template'
          ? 'template'
          : null

  const primaryAction = (() => {
    if (!selected || !draftScript) return null
    if (isRendering || scriptBusy) {
      return {
        label: scriptBusy === 'draft' ? 'Writing script…' : scriptBusy === 'rewrite' ? 'Rewriting…' : 'Building…',
        disabled: true,
        tone: 'busy',
      }
    }
    if (!hasPlainDraft) {
      return { label: regenerateScriptLabel, run: regenerateDraft, tone: 'primary', hint: 'Step 1 — write the voiceover' }
    }
    if (sceneCount < 1) {
      return { label: 'Adapt to scenes', run: adaptToScenes, tone: 'primary', hint: 'Step 2 — split into Short captions' }
    }
    if (selected.status !== 'video_rendered') {
      return { label: 'Build Short', run: buildShort, tone: 'success', hint: 'Step 3 — voice + images + video' }
    }
    return { label: 'Download MP4', run: downloadShort, tone: 'success', hint: 'Step 4 — download or publish' }
  })()

  const statusPill = (status) => {
    if (status === 'video_rendered') return 'bg-[#1a2e1f] text-[#6ee07d] border-[#2ba640]/40'
    if (status === 'failed') return 'bg-[#2a1515] text-[#ff9b95] border-[#ff4e45]/40'
    if (status === 'rendering' || status === 'rendering_video') return 'bg-[#172033] text-[#9ecbff] border-[#3ea6ff]/40'
    if (status === 'ready_script') return 'bg-[#1a1a1a] text-[#f0c674] border-[#f0c674]/30'
    return 'bg-[#1a1a1a] text-[#aaa] border-[#303030]'
  }

  if (!isOwner) {
    return <p className={`text-sm ${EOF.muted}`}>Production automation is available to the channel owner.</p>
  }

  return (
    <div className="space-y-5">
      {loading ? <p className={`text-sm ${EOF.muted}`}>Loading production…</p> : null}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Make a Short</h2>
          <p className={`mt-0.5 text-sm ${EOF.muted}`}>
            Topic → script → scenes → video. Football only — never soccer.
          </p>
        </div>
        <details className="text-xs text-[#aaa]">
          <summary className="cursor-pointer select-none rounded-full border border-[#303030] bg-[#1a1a1a] px-3 py-1.5 hover:border-[#3ea6ff]/40 hover:text-[#9ecbff]">
            Setup status
          </summary>
          <div className={`mt-2 w-[min(100vw-2rem,28rem)] space-y-2 rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-3 shadow-xl`}>
            <p className={scriptProviders.groq || openAiScriptEnabled ? 'text-[#6ee07d]' : 'text-amber-300'}>
              Script AI:{' '}
              {scriptProviders.groq
                ? 'Groq ready'
                : openAiScriptEnabled
                  ? 'AI key ready'
                  : 'Add GROQ_API_KEY on Vercel'}
              {scriptProviders.openai ? ' · OpenAI' : ''}
              {scriptProviders.xai ? ' · xAI' : ''}
            </p>
            <p className={scriptProviders.guardian ? 'text-[#6ee07d]' : 'text-[#aaa]'}>
              Articles: {scriptProviders.guardian ? 'Guardian + RSS' : 'RSS only (optional GUARDIAN_API_KEY)'}
            </p>
            <p className={ffmpegAvailable ? 'text-[#6ee07d]' : 'text-amber-300'}>
              Video: {ffmpegAvailable ? 'ffmpeg ready' : renderNote || 'ffmpeg missing'}
            </p>
            <p className="text-[#aaa]">
              Images:{' '}
              {[
                imageSources.google && 'Google',
                imageSources.pexels && 'Pexels',
                imageSources.pinterestApi && 'Pinterest',
                imageSources.wikimedia && 'Wikimedia',
                'Pin URLs',
              ]
                .filter(Boolean)
                .join(' · ') || imagesNote}
            </p>
            <p className={elevenLabsConfigured ? 'text-[#6ee07d]' : 'text-[#aaa]'}>
              Voice: {elevenLabsConfigured ? 'ElevenLabs Brian ready' : 'Edge British (free) · Brian needs ELEVENLABS_API_KEY'}
            </p>
            {scriptBillingNote ? <p className="text-amber-200">{scriptBillingNote}</p> : null}
            {renderStack ? (
              <ul className="list-disc space-y-1 pl-4 text-[#717171]">
                {renderStack.script ? <li>{renderStack.script.label}</li> : null}
                {renderStack.video ? <li>{renderStack.video.label}</li> : null}
              </ul>
            ) : null}
          </div>
        </details>
      </div>

      {/* New Short composer */}
      <section className={`rounded-2xl border ${EOF.panelBorder} bg-gradient-to-b from-[#252525] to-[#1a1a1a] p-5`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#717171]">New Short</p>
        <form onSubmit={createJob} className="mt-3 space-y-3">
          <label className="block text-sm text-white">
            What’s the story?
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={`${inputCls} mt-1.5 py-3 text-base`}
              placeholder={
                format === 'quote'
                  ? 'e.g. Rooney on Ronaldo — or keep short and we’ll source a quote'
                  : format === 'news'
                    ? 'e.g. Spain beat Belgium at the World Cup'
                    : 'e.g. Cristiano Ronaldo / World Cup news'
              }
              minLength={2}
              required
              autoComplete="off"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-[#aaa]">
              Format
              <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputCls}>
                {(scriptFormats.length
                  ? scriptFormats
                  : [{ id: EOF_DEFAULT_SCRIPT_FORMAT, label: '5 facts listicle' }]
                ).map((f) => (
                  <option key={f.id} value={f.id} title={f.detail}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[#aaa]">
              Script AI
              <select
                value={scriptProvider}
                onChange={(e) => {
                  const next = e.target.value
                  setScriptProvider(next)
                  try {
                    localStorage.setItem(SCRIPT_PROVIDER_KEY, next)
                  } catch {
                    /* ignore */
                  }
                }}
                className={inputCls}
              >
                {(scriptProviderOptions.length
                  ? scriptProviderOptions
                  : [
                      { id: 'auto', label: 'Auto', configured: true },
                      { id: 'groq', label: 'Groq (free)', configured: false },
                      { id: 'xai', label: 'xAI Grok', configured: false },
                      { id: 'openai', label: 'OpenAI', configured: false },
                    ]
                ).map((p) => (
                  <option key={p.id} value={p.id} disabled={p.id !== 'auto' && !p.configured} title={p.detail}>
                    {p.label}
                    {p.id !== 'auto' && !p.configured ? ' (not set)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[#aaa]">
              Voice
              <select value={voicePreset} onChange={(e) => setVoicePreset(e.target.value)} className={inputCls}>
                {(voicePresets.length
                  ? voicePresets
                  : [{ id: EOF_DEFAULT_VOICE_PRESET, label: 'British (Edge, free)' }]
                ).map((v) => (
                  <option key={v.id} value={v.id} title={v.detail}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!loading && voicePreset === 'brian' && !elevenLabsConfigured ? (
            <p className="text-xs text-amber-400">
              Brian needs <code className="text-amber-200">ELEVENLABS_API_KEY</code> — or pick Edge British (free).
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={busy || loading}
              className={`rounded-full px-6 py-2.5 text-sm font-semibold ${EOF.btnPrimary} disabled:opacity-50`}
            >
              {busy ? 'Starting…' : 'Start Short'}
            </button>
            <p className={`text-xs ${EOF.muted}`}>Creates a draft job and writes the first script.</p>
          </div>
        </form>

        {success ? (
          <p
            className="mt-4 rounded-xl border border-[#2ba640]/40 bg-[#1a2e1f] px-3 py-2 text-sm text-[#6ee07d]"
            role="status"
          >
            {success}
          </p>
        ) : null}
        {err ? (
          <p className="mt-4 rounded-xl border border-[#ff4e45]/40 bg-[#2a1515] px-3 py-2 text-sm text-[#ff9b95]">
            {err}
          </p>
        ) : null}
        {displayProgress && !selected ? (
          <div className="mt-4">
            <EofRenderProgressBar
              progress={displayProgress}
              stuck={isRenderStuck}
              onCancel={cancelStuckRender}
              cancelBusy={busy}
            />
          </div>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Job list */}
        <aside className={`rounded-2xl border ${EOF.panelBorder} ${EOF.panel} p-3`}>
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#717171]">Your Shorts</h3>
            <span className="tabular-nums text-[10px] text-[#555]">{jobs.length}</span>
          </div>
          <ul className="max-h-[min(70vh,640px)] space-y-1 overflow-y-auto pr-0.5">
            {jobs.length === 0 ? (
              <li className={`px-2 py-6 text-center text-sm ${EOF.muted}`}>No Shorts yet — start one above.</li>
            ) : (
              jobs.map((j) => (
                <li key={j.id} className="group flex items-stretch gap-0.5">
                  <button
                    type="button"
                    onClick={() => selectJob(j.id)}
                    className={`min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left transition ${
                      selectedId === j.id
                        ? 'bg-[#2a2a2a] ring-1 ring-[#3ea6ff]/40'
                        : 'hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <div className="truncate text-sm font-medium text-white">{j.title || j.topic}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${statusPill(j.status)}`}>
                        {(j.status === 'rendering' || j.status === 'rendering_video') &&
                        j.renderProgress?.percent != null
                          ? `${Math.round(j.renderProgress.percent)}%`
                          : productionJobStatusLabel(j.status)}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteJob(j.id)}
                    disabled={deletingId === j.id}
                    title={`Delete ${j.title || j.topic}`}
                    aria-label={`Delete ${j.title || j.topic}`}
                    className="rounded-lg px-2 text-[#555] opacity-0 transition hover:bg-[#2a1515] hover:text-[#ff9b95] group-hover:opacity-100 disabled:opacity-50"
                  >
                    ×
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        {selected && draftScript ? (
          <div className="space-y-4">
            {/* Workspace header + primary CTA */}
            <div className={`rounded-2xl border ${EOF.panelBorder} ${EOF.panel} p-4 sm:p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold text-white sm:text-lg">
                    {draftScript.title || selected.topic}
                  </h3>
                  <p className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${EOF.muted}`}>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusPill(selected.status)}`}>
                      {productionJobStatusLabel(selected.status)}
                    </span>
                    {draftScript.format ? <span>{draftScript.format}</span> : null}
                    {scriptSourceLabel ? <span>AI: {scriptSourceLabel}</span> : null}
                    {draftDirty ? <span className="text-amber-400">Unsaved edits</span> : null}
                  </p>
                </div>
                {primaryAction ? (
                  <div className="flex flex-col items-stretch gap-1 sm:items-end">
                    <button
                      type="button"
                      disabled={Boolean(primaryAction.disabled) || busy}
                      onClick={() => primaryAction.run?.()}
                      className={`rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                        primaryAction.tone === 'success'
                          ? 'border border-[#2ba640]/50 bg-[#1a2e1f] text-[#6ee07d]'
                          : primaryAction.tone === 'busy'
                            ? 'border border-[#303030] bg-[#1a1a1a] text-[#aaa]'
                            : EOF.btnPrimary
                      }`}
                    >
                      {primaryAction.label}
                    </button>
                    {primaryAction.hint ? (
                      <span className="text-[10px] text-[#717171]">{primaryAction.hint}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['1', 'Script'],
                  ['2', 'Scenes'],
                  ['3', 'Build'],
                  ['4', 'Ready'],
                ].map(([n, label]) => {
                  const state = workflowStepState(Number(n))
                  const cls =
                    state === 'done'
                      ? 'border-[#2ba640]/40 bg-[#142018] text-[#6ee07d]'
                      : state === 'current'
                        ? 'border-[#3ea6ff]/50 bg-[#122033] text-[#9ecbff]'
                        : state === 'failed'
                          ? 'border-[#ff4e45]/40 bg-[#2a1515] text-[#ff9b95]'
                          : 'border-[#2a2a2a] text-[#555]'
                  return (
                    <li key={n} className={`rounded-xl border px-3 py-2 text-center text-xs font-medium ${cls}`}>
                      <span className="block text-[10px] opacity-70">Step {n}</span>
                      {label}
                    </li>
                  )
                })}
              </ol>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#2a2a2a] pt-3">
                <label className="text-[10px] text-[#aaa]">
                  Voice
                  <select
                    value={voicePreset}
                    onChange={(e) => {
                      const next = e.target.value
                      setVoicePreset(next)
                      if (next === 'brian') {
                        setVoiceSettings((prev) =>
                          prev
                            ? normalizeElevenLabsVoiceSettings(prev)
                            : normalizeElevenLabsVoiceSettings(elevenLabsVoiceDefaults),
                        )
                      }
                      markDraftDirty()
                    }}
                    className={`${inputCls} mt-0.5 min-w-[150px] py-1.5 text-xs`}
                  >
                    {(voicePresets.length
                      ? voicePresets
                      : [{ id: EOF_DEFAULT_VOICE_PRESET, label: 'British (Edge, free)' }]
                    ).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveJob()}
                  className={`mt-4 rounded-full px-3 py-1.5 text-xs ${EOF.btnSecondary} disabled:opacity-50`}
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={busy || isRendering || sceneCount < 1}
                  onClick={buildShort}
                  className="mt-4 rounded-full border border-[#2ba640]/40 px-3 py-1.5 text-xs text-[#6ee07d] disabled:opacity-50"
                >
                  {selected.status === 'video_rendered' ? 'Rebuild' : 'Build'}
                </button>
                <button
                  type="button"
                  disabled={busy || isRendering}
                  onClick={regenerateDraft}
                  className="mt-4 rounded-full border border-[#3ea6ff]/30 px-3 py-1.5 text-xs text-[#9ecbff] disabled:opacity-50"
                >
                  {scriptBusy === 'draft' ? '…' : 'Regenerate'}
                </button>
                <button
                  type="button"
                  disabled={busy || isRendering}
                  onClick={regenerateScript}
                  title="New draft + scenes"
                  className="mt-4 rounded-full border border-[#303030] px-3 py-1.5 text-xs text-[#aaa] disabled:opacity-50"
                >
                  {scriptBusy === 'rewrite' ? '…' : 'Full rewrite'}
                </button>
                <button
                  type="button"
                  disabled={deletingId === selected.id}
                  onClick={() => deleteJob(selected.id)}
                  className="mt-4 rounded-full border border-[#ff4e45]/30 px-3 py-1.5 text-xs text-[#ff9b95] disabled:opacity-50"
                >
                  {deletingId === selected.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>

            {/* Ready result first when available */}
            {selected.status === 'video_rendered' || videoPreviewUrl ? (
              <div
                ref={resultPanelRef}
                className="rounded-2xl border-2 border-[#2ba640]/40 bg-[#101a14] p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#6ee07d]">Short ready</p>
                    <p className={`mt-0.5 text-xs ${EOF.muted}`}>9:16 with voiceover, images, and captions.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={downloadShort}
                      className="rounded-full border border-[#3ea6ff]/40 px-4 py-2 text-sm text-[#9ecbff] disabled:opacity-50"
                    >
                      Download MP4
                    </button>
                    {typeof onSendToStudio === 'function' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={sendToYoutubeStudio}
                        className={`rounded-full px-4 py-2 text-sm ${EOF.btnPrimary} disabled:opacity-50`}
                      >
                        YouTube Studio
                      </button>
                    ) : null}
                  </div>
                </div>
                {videoPreviewUrl ? (
                  <video
                    controls
                    playsInline
                    className="mt-4 max-h-[min(70vh,640px)] w-full rounded-xl bg-black"
                    src={videoPreviewUrl}
                  >
                    Your browser does not support video playback.
                  </video>
                ) : (
                  <button
                    type="button"
                    onClick={loadVideoPreview}
                    className={`mt-4 rounded-full px-5 py-2 text-sm ${EOF.btnPrimary}`}
                  >
                    Load preview
                  </button>
                )}
                {selected.narrationManifest?.length ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {selected.narrationManifest.map((scene, i) => (
                      <div
                        key={scene.sceneId || i}
                        className="overflow-hidden rounded-lg border border-[#2a3a2a] bg-[#0d0d0d]"
                      >
                        <img
                          alt=""
                          className="h-24 w-full bg-[#1a1a1a] object-cover"
                          src={sceneStillUrl((scene.index ?? i) + 1)}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.opacity = '0.25'
                          }}
                        />
                        <p className="line-clamp-2 p-1.5 text-[9px] text-[#aaa]">
                          {scene.caption || draftScript.scenes?.[i]?.caption}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {displayProgress &&
            (selected.status === 'rendering' ||
              selected.status === 'rendering_video' ||
              renderPhase === 'rendering-video') ? (
              <EofRenderProgressBar
                progress={displayProgress}
                stuck={isRenderStuck}
                onCancel={cancelStuckRender}
                cancelBusy={busy}
              />
            ) : null}

            {/* Step 1 — Script */}
            <section className={`rounded-2xl border border-[#3ea6ff]/20 bg-[#0f1520] p-4 sm:p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9ecbff]">Step 1 · Script</p>
                  <p className={`mt-0.5 text-xs ${EOF.muted}`}>Spoken voiceover — edit freely, then go to scenes.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums text-[11px] text-[#717171]">{wordCount} words</span>
                  <button
                    type="button"
                    disabled={busy || isRendering}
                    onClick={regenerateDraft}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold ${EOF.btnPrimary} disabled:opacity-50`}
                  >
                    {regenerateScriptLabel}
                  </button>
                </div>
              </div>
              <textarea
                value={draftScript.plainTextDraft || ''}
                onChange={(e) => {
                  const plainTextDraft = e.target.value
                  setDraftScript((prev) => (prev ? { ...prev, plainTextDraft } : prev))
                  markDraftDirty()
                }}
                rows={7}
                className={`${inputCls} mt-3 font-serif text-[15px] leading-relaxed text-[#f1f1f1]`}
                placeholder="Write or regenerate a punchy Shorts voiceover here…"
              />
              {hasPlainDraft ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || isRendering}
                    onClick={adaptToScenes}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${EOF.btnPrimary} disabled:opacity-50`}
                  >
                    Next: Adapt to scenes →
                  </button>
                  <button
                    type="button"
                    disabled={busy || isRendering}
                    onClick={regenerateScript}
                    className="rounded-full border border-[#303030] px-3 py-2 text-xs text-[#aaa] disabled:opacity-50"
                  >
                    Full rewrite (script + scenes)
                  </button>
                </div>
              ) : (
                <p className={`mt-2 text-xs ${EOF.muted}`}>
                  Click <span className="text-[#9ecbff]">Generate script</span> to pull desk notes and write the VO.
                </p>
              )}
            </section>

            {/* Voice tuning (Brian only) */}
            {voicePreset === 'brian' ? (
              <details className={`rounded-2xl border ${EOF.panelBorder} ${EOF.panel} p-4`}>
                <summary className="cursor-pointer text-xs font-semibold text-[#aaa]">
                  Brian voice tuning (optional)
                </summary>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={resetBrianVoiceSettings}
                    className="text-[10px] text-[#3ea6ff] hover:underline"
                  >
                    Reset to defaults
                  </button>
                </div>
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  {EOF_ELEVENLABS_VOICE_FIELDS.map((field) => {
                    const limits = EOF_ELEVENLABS_VOICE_LIMITS[field.key]
                    const val = voiceSettings[field.key] ?? limits.default
                    return (
                      <label key={field.key} className="block text-xs text-[#aaa]">
                        <span className="flex items-center justify-between gap-2">
                          <span>{field.label}</span>
                          <span className="tabular-nums text-[#9ecbff]">{Number(val).toFixed(2)}</span>
                        </span>
                        <input
                          type="range"
                          min={limits.min}
                          max={limits.max}
                          step={limits.step}
                          value={val}
                          onChange={(e) => updateVoiceSetting(field.key, e.target.value)}
                          className="mt-1 w-full accent-[#3ea6ff]"
                        />
                        <span className="mt-0.5 block text-[10px] text-[#717171]">{field.hint}</span>
                      </label>
                    )
                  })}
                </div>
                {(selected.status === 'video_rendered' ||
                  selected.status === 'rendered' ||
                  selected.mixedAudioPath) &&
                sceneCount ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#2a2a2a] pt-3">
                    <button
                      type="button"
                      disabled={busy || isRendering || !voiceRegen.canRegenerate}
                      onClick={regenerateVoiceover}
                      title={voiceRegen.blockedReason || undefined}
                      className="rounded-full border border-[#3ea6ff]/50 px-4 py-2 text-xs font-semibold text-[#9ecbff] disabled:opacity-50"
                    >
                      {busy || isRendering
                        ? 'Regenerating…'
                        : `Regenerate voiceover (${voiceRegen.remaining}/${voiceRegen.limit})`}
                    </button>
                    {voiceRegen.blockedReason ? (
                      <span className="text-[10px] text-amber-400">{voiceRegen.blockedReason}</span>
                    ) : (
                      <span className="text-[10px] text-[#717171]">Same captions & photos — new Brian mix only.</span>
                    )}
                  </div>
                ) : null}
              </details>
            ) : null}

            {/* Step 2 — Scenes */}
            <section className={`rounded-2xl border ${EOF.panelBorder} ${EOF.panel} p-4 sm:p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#717171]">
                    Step 2 · Scenes ({sceneCount}/{EOF_MAX_SCENES})
                  </p>
                  <p className={`mt-0.5 text-xs ${EOF.muted}`}>On-screen captions + image search for each beat.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || isRendering || !hasPlainDraft}
                    onClick={adaptToScenes}
                    className="rounded-full border border-[#3ea6ff]/40 px-3 py-1.5 text-xs font-semibold text-[#9ecbff] disabled:opacity-50"
                  >
                    Adapt from script
                  </button>
                  <button
                    type="button"
                    disabled={busy || sceneCount >= EOF_MAX_SCENES}
                    onClick={() => addScene()}
                    className="rounded-full border border-[#303030] px-3 py-1.5 text-[11px] text-[#aaa] disabled:opacity-50"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {!sceneCount ? (
                <p className={`mt-4 rounded-xl border border-dashed border-[#303030] px-4 py-8 text-center text-sm ${EOF.muted}`}>
                  No scenes yet — finish the script, then tap <span className="text-[#9ecbff]">Adapt to scenes</span>.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {draftScript.scenes.map((scene, i) => (
                    <div key={scene.id || i} className="rounded-xl border border-[#2a2a2a] bg-[#171717] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase text-[#717171]">
                          Scene {i + 1}
                          {scene.role ? ` · ${scene.role}` : ''}
                          {scene.durationSec ? (
                            <span className="ml-2 font-normal normal-case text-[#3ea6ff]">
                              ~{Number(scene.durationSec).toFixed(1)}s
                            </span>
                          ) : null}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busy || i === 0}
                            onClick={() => moveScene(i, -1)}
                            className="text-[10px] text-[#aaa] hover:text-white disabled:opacity-30"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={busy || i >= sceneCount - 1}
                            onClick={() => moveScene(i, 1)}
                            className="text-[10px] text-[#aaa] hover:text-white disabled:opacity-30"
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            disabled={busy || sceneCount <= EOF_MIN_SCENES}
                            onClick={() => removeScene(i)}
                            className="text-[10px] text-[#ff9b95] hover:underline disabled:opacity-30"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <label className="mt-2 block text-xs text-[#aaa]">
                        Caption
                        <textarea
                          rows={2}
                          value={scene.caption || ''}
                          onChange={(e) => updateScene(i, 'caption', e.target.value)}
                          className={inputCls}
                          maxLength={140}
                        />
                      </label>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_100px]">
                        <label className="block text-xs text-[#aaa]">
                          Image search / Pinterest URL
                          <input
                            value={scene.imageQuery || ''}
                            onChange={(e) => updateScene(i, 'imageQuery', e.target.value)}
                            className={inputCls}
                            placeholder="e.g. Ronaldo celebration or https://pin.it/…"
                          />
                        </label>
                        <label className="block text-xs text-[#aaa]">
                          Seconds
                          <input
                            type="number"
                            min={2}
                            max={8}
                            step={0.1}
                            value={scene.durationSec ?? ''}
                            onChange={(e) =>
                              updateScene(i, 'durationSec', e.target.value === '' ? null : Number(e.target.value))
                            }
                            className={inputCls}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sceneCount >= 1 ? (
                <button
                  type="button"
                  disabled={busy || (isRendering && !isRenderStuck)}
                  onClick={buildShort}
                  className="mt-4 w-full rounded-full border border-[#2ba640]/50 bg-[#1a2e1f] px-4 py-3 text-sm font-semibold text-[#6ee07d] disabled:opacity-50 sm:w-auto"
                >
                  {busy || isRendering
                    ? 'Building…'
                    : selected.status === 'video_rendered'
                      ? 'Rebuild Short'
                      : 'Next: Build Short →'}
                </button>
              ) : null}
            </section>

            {/* YouTube metadata */}
            <details className={`rounded-2xl border ${EOF.panelBorder} ${EOF.panel} p-4`}>
              <summary className="cursor-pointer text-xs font-semibold text-[#aaa]">
                YouTube title, description & tags
              </summary>
              <div className="mt-3 space-y-3">
                <label className="block text-xs text-[#aaa]">
                  Title
                  <input
                    value={draftScript.title || ''}
                    onChange={(e) => {
                      markDraftDirty()
                      setDraftScript((s) => ({ ...s, title: e.target.value }))
                    }}
                    className={inputCls}
                    maxLength={100}
                  />
                </label>
                <label className="block text-xs text-[#aaa]">
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
                <label className="block text-xs text-[#aaa]">
                  Tags
                  <input
                    value={Array.isArray(draftScript.tags) ? draftScript.tags.join(', ') : ''}
                    onChange={(e) => {
                      markDraftDirty()
                      const tags = e.target.value
                        .split(/[,#]+/)
                        .map((t) => t.trim())
                        .filter(Boolean)
                      setDraftScript((s) => ({ ...s, tags }))
                    }}
                    className={inputCls}
                    placeholder="shortsfeed, football, shorts, …"
                  />
                </label>
              </div>
            </details>

            {selected.status === 'failed' && selected.errorMessage ? (
              <p className="rounded-xl border border-[#ff4e45]/40 bg-[#2a1515] px-3 py-2 text-sm text-[#ff9b95]">
                Build failed: {selected.errorMessage}
              </p>
            ) : null}
          </div>
        ) : (
          <div className={`flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed ${EOF.panelBorder} ${EOF.panel} p-8`}>
            <p className={`max-w-sm text-center text-sm ${EOF.muted}`}>
              Pick a Short from the list, or start a new one above.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
