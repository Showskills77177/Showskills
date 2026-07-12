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
          : { xai: false, openai: false, groq: false, perplexity: false },
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

  function sceneImageSourceLabel(source) {
    if (source === 'pexels') return 'Pexels'
    if (source === 'google') return 'Google Images'
    if (source === 'pinterest') return 'Pinterest search'
    if (source === 'pinterest-pin') return 'Pinterest pin'
    if (source === 'wikimedia') return 'Wikimedia Commons'
    if (source === 'cache') return 'Cached photo'
    if (source === 'placeholder-no-image-keys') return 'Placeholder — search missed'
    if (source === 'placeholder') return 'Placeholder — search missed'
    return 'Image'
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
          `Fallback draft ready for “${j.job.topic}”. Edit it, then Adapt to scenes — or fix AI billing and click Generate script.`,
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
        setSuccess('Fallback draft loaded. Edit it, or fix AI billing and Generate again.')
      } else {
        setSuccess(
          j.scriptProviderLabel
            ? `Script generated with ${j.scriptProviderLabel}${j.job?.topic ? ` — “${j.job.topic}”` : ''}. Edit, then Adapt to scenes.`
            : 'Script generated. Edit if needed, then Adapt to scenes.',
        )
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
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

  if (!isOwner) {
    return <p className={`text-sm ${EOF.muted}`}>Production automation is available to the channel owner.</p>
  }

  return (
    <div className="space-y-6">
      {loading ? <p className={`text-sm ${EOF.muted}`}>Loading production…</p> : null}
      <section className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-5`}>
        <h2 className="text-base font-semibold text-white">Production Shorts</h2>
        <p className={`mt-1 text-xs ${EOF.muted}`}>
          Football worldwide — multi-pass scripts: desk headlines → research brief → Shorts voiceover → polish → Adapt to scenes. Always call it football, never soccer. Pick Groq (free) in Script AI.
        </p>
        <ol className="mt-3 flex flex-wrap gap-2 text-[11px]">
          {[
            ['1', 'Write draft'],
            ['2', 'Adapt to scenes'],
            ['3', 'Build video'],
            ['4', 'Watch result'],
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
            {renderNote || 'ffmpeg is not detected — video build needs ffmpeg-static on the host.'}
          </p>
        ) : null}
        {!loading && !imageSources.google && !imageSources.pexels && !imageSources.pinterestApi ? (
          <p className="mt-2 text-xs text-amber-400">
            {imagesNote ||
              'Using free Wikimedia photos. Add PEXELS_API_KEY or GOOGLE_CSE_* for better football stock — or paste Pinterest pin URLs.'}
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-[#6ee07d]">
            Images:{' '}
            {[
              imageSources.google && 'Google',
              imageSources.pexels && 'Pexels',
              imageSources.pinterestApi && 'Pinterest API',
              imageSources.wikimedia && 'Wikimedia',
              'Pin URLs',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <p className={`mt-1 text-[11px] ${EOF.muted}`}>
          Scripts:{' '}
          {openAiScriptEnabled
            ? scriptProviders.groq
              ? `Groq Llama 3.3 70B (free) preferred in Auto${scriptProviders.openai ? ' · OpenAI fallback' : ''}${scriptProviders.xai ? ' · xAI fallback' : ''}${scriptProviders.perplexity ? ' · Perplexity sourcing' : ''}`
              : scriptProviders.xai
                ? `xAI Grok 4.5${scriptProviders.openai ? ' · OpenAI fallback' : ''}${scriptProviders.perplexity ? ' · Perplexity sourcing' : ''}`
                : [scriptProviders.openai && 'OpenAI', scriptProviders.groq && 'Groq (free)']
                    .filter(Boolean)
                    .join(' → ') + ' (templates if all fail)'
            : 'Built-in templates — add free GROQ_API_KEY (console.groq.com) on Vercel'}
        </p>
        {!scriptProviders.perplexity ? (
          <p className="mt-1 text-[11px] text-[#9ecbff]">
            Live article sourcing: add{' '}
            <code className="text-[#9ecbff]">PERPLEXITY_API_KEY</code> from{' '}
            <a href="https://www.perplexity.ai/account/api/keys" target="_blank" rel="noreferrer" className="underline">
              perplexity.ai/account/api/keys
            </a>{' '}
            on Vercel → Redeploy. Sonar researches; Groq still writes the Short.
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-[#6ee07d]">Perplexity Sonar connected — live web sourcing on Generate.</p>
        )}
        {!scriptProviders.groq ? (
          <p className="mt-1 text-[11px] text-[#9ecbff]">
            Free scripts: create a key at{' '}
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="underline">
              console.groq.com
            </a>{' '}
            → add <code className="text-[#9ecbff]">GROQ_API_KEY</code> on Vercel → redeploy → pick Groq above.
          </p>
        ) : null}
        {scriptBillingNote ? (
          <p className="mt-2 rounded-lg border border-amber-500/40 bg-[#2a2210] px-3 py-2 text-xs text-amber-200">
            {scriptBillingNote}
          </p>
        ) : null}
        <p className={`mt-1 text-[11px] ${EOF.muted}`}>
          Scope: football worldwide — World Cup, club, and international. Always say{' '}
          <span className="text-[#9ecbff]">football</span>, never soccer. Use{' '}
          <span className="text-[#9ecbff]">Quote Short</span> for attributed lines (Rooney / coaches / studio) —
          Generate sources the quote, then writes the Short. Scheduler can run Quote Shorts automatically.
        </p>

        {renderStack ? (
          <details className={`mt-3 text-xs ${EOF.muted}`}>
            <summary className="cursor-pointer text-[#aaa]">How does this work?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[#717171]">
              {renderStack.script ? (
                <li>
                  <span className="text-[#aaa]">{renderStack.script.label}</span> — {renderStack.script.detail}
                </li>
              ) : null}
              {renderStack.video ? (
                <li>
                  <span className="text-[#aaa]">{renderStack.video.label}</span> — {renderStack.video.detail}
                </li>
              ) : null}
              {renderStack.host ? (
                <li>
                  <span className="text-[#aaa]">{renderStack.host.label}</span> — {renderStack.host.detail}
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
            Topic (player, club, nation, or football news headline)
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={inputCls}
              placeholder={
                format === 'quote'
                  ? 'e.g. Rooney on Ronaldo — or leave short and Generate will source a quote'
                  : format === 'news'
                    ? 'e.g. Spain beat Belgium at the World Cup'
                    : 'e.g. Cristiano Ronaldo'
              }
              minLength={2}
              required
            />
          </label>
          <label className="text-xs text-[#aaa]">
            Script format
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
                    { id: 'groq', label: 'Groq — Llama 3.3 70B (free)', configured: false },
                    { id: 'xai', label: 'xAI Grok 4.5', configured: false },
                    { id: 'openai', label: 'OpenAI', configured: false },
                  ]
              ).map((p) => (
                <option key={p.id} value={p.id} disabled={p.id !== 'auto' && !p.configured} title={p.detail}>
                  {p.label}
                  {p.id !== 'auto' && !p.configured ? ' (not configured)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[#aaa]">
            Voiceover
            <select
              value={voicePreset}
              onChange={(e) => setVoicePreset(e.target.value)}
              className={inputCls}
            >
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
          <button
            type="submit"
            disabled={busy || loading}
            className={`rounded-full px-5 py-2 text-sm ${EOF.btnPrimary} disabled:opacity-50`}
          >
            Create job
          </button>
        </form>
        {!loading && voicePreset === 'brian' && !elevenLabsConfigured ? (
          <p className="mt-2 text-xs text-amber-400">
            Brian needs <code className="text-amber-200">ELEVENLABS_API_KEY</code> on staging (elevenlabs.io). Or pick a free Edge voice.
          </p>
        ) : null}
        {!loading && elevenLabsConfigured ? (
          <p className="mt-2 text-[11px] text-[#6ee07d]">ElevenLabs connected — Brian voiceover ready.</p>
        ) : null}

        {success ? (
          <p
            className="mt-3 rounded-lg border border-[#2ba640]/40 bg-[#1a2e1f] px-3 py-2 text-sm text-[#6ee07d]"
            role="status"
          >
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
                    <div className="truncate font-medium">{j.title || j.topic}</div>
                    <div className="text-[10px] text-[#717171]">
                      {(j.status === 'rendering' || j.status === 'rendering_video') &&
                      j.renderProgress?.percent != null
                        ? `Building… ${Math.round(j.renderProgress.percent)}%`
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
                  {draftScript.format ? ` · ${draftScript.format}` : ''}
                  {selected.voicePreset ? ` · voice ${selected.voicePreset}` : ''}
                  {selected.scriptSource && selected.scriptSource !== 'template'
                    ? ` · script ${selected.scriptSource === 'xai' ? 'Grok' : selected.scriptSource}`
                    : preferredScriptProvider === 'xai' && !selected.scriptSource
                      ? ' · script Grok'
                      : ''}
                  <span className="ml-2 text-[#9ecbff]">· {productionJobStatusLabel(selected.status)}</span>
                  {draftDirty ? <span className="ml-2 text-amber-400">· unsaved changes</span> : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="text-[10px] text-[#aaa]">
                  Voice
                  <select
                    value={voicePreset}
                    onChange={(e) => {
                      const next = e.target.value
                      setVoicePreset(next)
                      if (next === 'brian') {
                        setVoiceSettings((prev) =>
                          prev ? normalizeElevenLabsVoiceSettings(prev) : normalizeElevenLabsVoiceSettings(elevenLabsVoiceDefaults),
                        )
                      }
                      markDraftDirty()
                    }}
                    className={`${inputCls} mt-0.5 min-w-[160px] py-1.5 text-xs`}
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
                  disabled={busy || isRendering || String(draftScript.plainTextDraft || '').trim().length < 40}
                  onClick={adaptToScenes}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${EOF.btnPrimary} disabled:opacity-50`}
                >
                  Adapt to scenes
                </button>
                <button
                  type="button"
                  disabled={
                    busy ||
                    (isRendering && !isRenderStuck) ||
                    !(draftScript.scenes?.length >= 1)
                  }
                  onClick={buildShort}
                  className="rounded-full border border-[#2ba640]/50 bg-[#1a2e1f] px-4 py-2 text-sm font-semibold text-[#6ee07d] disabled:opacity-50"
                >
                  {busy || isRendering
                    ? 'Building…'
                    : selected.status === 'video_rendered'
                      ? 'Rebuild Short'
                      : 'Build Short'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveJob()}
                  className="rounded-full border border-[#303030] px-4 py-1.5 text-xs text-white disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={busy || isRendering}
                  onClick={regenerateDraft}
                  className="rounded-full border border-[#3ea6ff]/40 px-4 py-1.5 text-xs text-[#9ecbff] disabled:opacity-50"
                >
                  Generate script
                </button>
                <button
                  type="button"
                  disabled={busy || isRendering}
                  onClick={regenerateScript}
                  className="rounded-full border border-[#303030] px-4 py-1.5 text-xs text-[#aaa] disabled:opacity-50"
                  title="Regenerate plain text and scenes in one go"
                >
                  Full rewrite
                </button>
                <button
                  type="button"
                  disabled={deletingId === selected.id}
                  onClick={() => deleteJob(selected.id)}
                  className="rounded-full border border-[#ff4e45]/40 px-4 py-1.5 text-xs text-[#ff9b95] disabled:opacity-50"
                >
                  {deletingId === selected.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-[#3ea6ff]/25 bg-[#0d1520] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ecbff]">
                  1 · Plain-text script (news desk / voiceover)
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] ${EOF.muted}`}>
                    {String(draftScript.plainTextDraft || '').trim().split(/\s+/).filter(Boolean).length}{' '}
                    words
                  </span>
                  <button
                    type="button"
                    disabled={busy || isRendering}
                    onClick={regenerateDraft}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold ${EOF.btnPrimary} disabled:opacity-50`}
                  >
                    {busy ? 'Generating…' : 'Generate script'}
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
                rows={8}
                className={`${inputCls} mt-2 font-serif text-[15px] leading-relaxed text-[#f1f1f1]`}
                placeholder='Click “Generate script” — vague topics like “world cup news” become a specific match story first.'
              />
              <p className={`mt-2 text-[11px] ${EOF.muted}`}>
                Tip: “world cup news” is too vague alone — Generate script picks a concrete World Cup angle (teams + stakes). Or type e.g. “Spain beat Belgium World Cup”.
              </p>
            </div>

            {voicePreset === 'brian' ? (
              <div className="mt-4 rounded-lg border border-[#303030] bg-[#0d0d0d] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#717171]">
                    Brian voice tuning (ElevenLabs)
                  </p>
                  <button
                    type="button"
                    onClick={resetBrianVoiceSettings}
                    className="text-[10px] text-[#3ea6ff] hover:underline"
                  >
                    Reset to defaults
                  </button>
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
              </div>
            ) : null}

            {(selected.status === 'video_rendered' ||
              selected.status === 'rendered' ||
              selected.mixedAudioPath) &&
            draftScript?.scenes?.length ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#303030] bg-[#0d0d0d] p-4">
                <button
                  type="button"
                  disabled={busy || isRendering || !voiceRegen.canRegenerate}
                  onClick={regenerateVoiceover}
                  title={voiceRegen.blockedReason || undefined}
                  className="rounded-full border border-[#3ea6ff]/50 px-4 py-2 text-xs font-semibold text-[#9ecbff] disabled:opacity-50"
                >
                  {busy || isRendering
                    ? 'Regenerating…'
                    : `Regenerate voiceover only (${voiceRegen.remaining}/${voiceRegen.limit} free)`}
                </button>
                <p className="text-[10px] text-[#717171]">
                  Same captions, new Brian sliders only — remuxes with cached photos (ElevenLabs free regen rule: up to{' '}
                  {voiceRegen.limit} slider tweaks per Short).
                  {voiceRegen.blockedReason ? (
                    <span className="mt-1 block text-amber-400">{voiceRegen.blockedReason}</span>
                  ) : null}
                </p>
              </div>
            ) : null}

            {displayProgress &&
            (selected.status === 'rendering' ||
              selected.status === 'rendering_video' ||
              renderPhase === 'rendering-video') ? (
              <div className="mt-4">
                <EofRenderProgressBar
                  progress={displayProgress}
                  stuck={isRenderStuck}
                  onCancel={cancelStuckRender}
                  cancelBusy={busy}
                />
              </div>
            ) : null}

            {selected.status === 'video_rendered' || videoPreviewUrl ? (
              <div
                ref={resultPanelRef}
                className="mt-4 rounded-xl border-2 border-[#2ba640]/50 bg-[#101a14] p-5"
              >
                <p className="text-sm font-semibold text-[#6ee07d]">Your Short is ready</p>
                <p className={`mt-1 text-xs ${EOF.muted}`}>
                  9:16 Short with voiceover, images, and TikTok-style popping captions. Download it or open YouTube Studio to publish.
                </p>
                {videoPreviewUrl ? (
                  <video
                    controls
                    playsInline
                    className="mt-4 max-h-[min(70vh,640px)] w-full rounded-xl bg-black shadow-lg"
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
                    Load finished Short
                  </button>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
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
                      Send to YouTube Studio
                    </button>
                  ) : null}
                </div>

                {selected.narrationManifest?.length ? (
                  <div className="mt-5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#717171]">
                      Scenes in this Short
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {selected.narrationManifest.map((scene, i) => (
                        <div
                          key={scene.sceneId || i}
                          className="overflow-hidden rounded-lg border border-[#303030] bg-[#0d0d0d]"
                        >
                          <img
                            alt=""
                            className="h-36 w-full bg-[#1a1a1a] object-cover"
                            src={sceneStillUrl((scene.index ?? i) + 1)}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.opacity = '0.25'
                            }}
                          />
                          <div className="p-2">
                            <p className="text-[10px] font-semibold text-[#9ecbff]">Scene {(scene.index ?? i) + 1}</p>
                            <p className="mt-1 line-clamp-2 text-[10px] text-[#aaa]">
                              {scene.caption || draftScript.scenes?.[i]?.caption}
                            </p>
                            <p className="mt-1 text-[10px] text-[#717171]">
                              {scene.durationSec ? `${Number(scene.durationSec).toFixed(1)}s` : '—'}
                              {scene.imageSource ? ` · ${sceneImageSourceLabel(scene.imageSource)}` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <label className="mt-4 block text-xs text-[#aaa]">
              YouTube title
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

            <label className="mt-4 block text-xs text-[#aaa]">
              YouTube description
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

            <label className="mt-4 block text-xs text-[#aaa]">
              Tags (include shortsfeed)
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

            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#717171]">
                  Scenes — step 2 · on-screen text + image search ({draftScript.scenes?.length || 0}/{EOF_MAX_SCENES})
                </p>
                <button
                  type="button"
                  disabled={busy || (draftScript.scenes?.length || 0) >= EOF_MAX_SCENES}
                  onClick={() => addScene()}
                  className="rounded-full border border-[#3ea6ff]/40 px-3 py-1 text-[11px] text-[#9ecbff] disabled:opacity-50"
                >
                  + Add scene
                </button>
              </div>
              {draftScript.scenes?.map((scene, i) => (
                <div key={scene.id || i} className="rounded-lg border border-[#303030] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase text-[#717171]">
                      Scene {i + 1}
                      {scene.role ? ` · ${scene.role}` : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {scene.durationSec ? (
                        <span className="text-[10px] text-[#3ea6ff]">~{Number(scene.durationSec).toFixed(1)}s</span>
                      ) : null}
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
                        disabled={busy || i >= (draftScript.scenes?.length || 0) - 1}
                        onClick={() => moveScene(i, 1)}
                        className="text-[10px] text-[#aaa] hover:text-white disabled:opacity-30"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={busy || (draftScript.scenes?.length || 0) <= EOF_MIN_SCENES}
                        onClick={() => removeScene(i)}
                        className="text-[10px] text-[#ff9b95] hover:underline disabled:opacity-30"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <label className="mt-2 block text-xs text-[#aaa]">
                    On-screen caption (what viewers read)
                    <textarea
                      rows={2}
                      value={scene.caption || ''}
                      onChange={(e) => updateScene(i, 'caption', e.target.value)}
                      className={inputCls}
                      maxLength={140}
                    />
                  </label>
                  <label className="mt-2 block text-xs text-[#aaa]">
                    Image search or Pinterest pin URL
                    <input
                      value={scene.imageQuery || ''}
                      onChange={(e) => updateScene(i, 'imageQuery', e.target.value)}
                      className={inputCls}
                      placeholder="e.g. Ronaldo goal celebration or https://pin.it/…"
                    />
                  </label>
                  <label className="mt-2 block text-xs text-[#aaa]">
                    Seconds on screen
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
                  <button
                    type="button"
                    disabled={busy || (draftScript.scenes?.length || 0) >= EOF_MAX_SCENES}
                    onClick={() => addScene(i)}
                    className="mt-2 text-[10px] text-[#3ea6ff] hover:underline disabled:opacity-50"
                  >
                    + Add scene after this
                  </button>
                </div>
              ))}
            </div>

            {selected.status === 'failed' && selected.errorMessage ? (
              <p className="mt-4 rounded-lg border border-[#ff4e45]/40 bg-[#2a1515] px-3 py-2 text-sm text-[#ff9b95]">
                Build failed: {selected.errorMessage}
              </p>
            ) : null}
          </div>
        ) : (
          <p className={`text-sm ${EOF.muted}`}>Select a job or create one from a topic.</p>
        )}
      </div>
    </div>
  )
}
