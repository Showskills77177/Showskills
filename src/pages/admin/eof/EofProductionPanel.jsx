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
import { EOF_DEFAULT_CAPTION_STYLE } from '../../../../shared/eofCaptionStyles.mjs'

/** Clean Production chrome — keep Studio gray panels so cards don’t blend into page black. */
const PX = {
  surface: 'rounded-2xl border border-[#303030] bg-[#212121]',
  surfaceInset: 'rounded-2xl border border-[#303030] bg-[#1a1a1a]',
  title: 'text-[22px] font-medium tracking-tight text-white',
  subtitle: 'text-sm text-[#aaaaaa]',
  label: 'text-[13px] font-medium text-[#aaaaaa]',
  muted: 'text-[#aaaaaa]',
  hairline: 'border-[#303030]',
  btnPrimary:
    'rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-[#e8e8e8] disabled:opacity-40',
  btnGhost:
    'rounded-xl border border-[#303030] bg-transparent px-3.5 py-2 text-sm text-[#e5e5e5] transition hover:bg-[#2a2a2a] disabled:opacity-40',
  btnSoft:
    'rounded-xl bg-[#272727] px-3.5 py-2 text-sm text-white transition hover:bg-[#3f3f3f] disabled:opacity-40',
  btnDanger:
    'rounded-xl border border-[#303030] px-3.5 py-2 text-sm text-[#ff9b95] transition hover:bg-[#2a1515] disabled:opacity-40',
}

const inputCls =
  'mt-1.5 w-full rounded-xl border border-[#303030] bg-[#121212] px-3.5 py-2.5 text-sm text-white placeholder:text-[#717171] outline-none transition focus:border-[#555]'
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
    <div className={`${PX.surfaceInset} p-4`} role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#d4d4d4]">
        <span>{progress.message || 'Building…'}</span>
        <span className="tabular-nums text-[#8e8e8e]">{percent}%</span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#303030]">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[#717171]">
        Elapsed {formatDuration(progress.elapsedSeconds)}
        {progress.etaLabel ? ` · ${progress.etaLabel}` : ''}
      </p>
      {stuck ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-xs text-[#fbbf24]">This build may have timed out. Reset, then try again.</p>
          <button type="button" disabled={cancelBusy} onClick={onCancel} className={PX.btnGhost}>
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
  const [captionStyles, setCaptionStyles] = useState([])
  const [captionStyle, setCaptionStyle] = useState(EOF_DEFAULT_CAPTION_STYLE)
  const [zapcapTemplates, setZapcapTemplates] = useState([])
  const [zapcapTemplatesError, setZapcapTemplatesError] = useState('')
  const [zapcapTemplateId, setZapcapTemplateId] = useState('')
  const [zapcapTemplateFilter, setZapcapTemplateFilter] = useState('')
  const [captionEngine, setCaptionEngine] = useState({ engine: 'local', zapcap: false, local: true })
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
    newsdata: false,
    guardian: false,
    perplexity: false,
    judge: { enabled: false },
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
  const [scriptChat, setScriptChat] = useState('')
  const [scriptChatLog, setScriptChatLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [renderNote, setRenderNote] = useState('')
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('')
  const [renderPhase, setRenderPhase] = useState('')
  const [renderProgress, setRenderProgress] = useState(null)
  const [renderStack, setRenderStack] = useState(null)
  const [imageSources, setImageSources] = useState({
    ap: false,
    google: false,
    pexels: false,
    pinterestApi: false,
    pinterestPinUrl: true,
    wikimedia: true,
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
      setCaptionStyles(Array.isArray(j.captionStyles) ? j.captionStyles : [])
      if (j.defaultCaptionStyle) setCaptionStyle((prev) => prev || j.defaultCaptionStyle)
      if (j.captionEngine && typeof j.captionEngine === 'object') setCaptionEngine(j.captionEngine)
      setZapcapTemplates(Array.isArray(j.zapcapTemplates) ? j.zapcapTemplates : [])
      setZapcapTemplatesError(typeof j.zapcapTemplatesError === 'string' ? j.zapcapTemplatesError : '')
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
          : { xai: false, openai: false, groq: false, newsdata: false, guardian: false, perplexity: false },
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
    if (job.captionStyle) setCaptionStyle(job.captionStyle)
    setZapcapTemplateId(job.zapcapTemplateId || '')
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

      let thumbnailBase64 = null
      let thumbnailSceneIndex = null
      try {
        const thumbRes = await apiFetch(
          `/api/admin/eof-production-scene-image?jobId=${encodeURIComponent(selectedId)}&thumbnail=1&format=base64`,
        )
        const thumbJson = await thumbRes.json().catch(() => ({}))
        if (thumbRes.ok && thumbJson.thumbnailBase64) {
          thumbnailBase64 = thumbJson.thumbnailBase64
          thumbnailSceneIndex = thumbJson.sceneIndex
        }
      } catch (e) {
        console.warn('[eof-production] thumbnail adapt skipped', e)
      }

      onSendToStudio({
        file,
        title,
        description: String(draftScript?.description || '').trim(),
        tags: Array.isArray(draftScript?.tags) ? draftScript.tags.join(', ') : '',
        productionJobId: selectedId,
        thumbnailBase64,
        thumbnailSceneIndex,
      })
      setSuccess(
        thumbnailBase64
          ? 'Opened Studio with this Short + adapted thumbnail — review and upload.'
          : 'Opened YouTube Studio with this Short — review and upload.',
      )
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
        body: JSON.stringify({
          topic,
          format,
          voicePreset,
          scriptProvider,
          captionStyle,
          zapcapTemplateId: captionStyle === 'live' || captionStyle === 'off' ? '' : zapcapTemplateId,
        }),
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
          captionStyle,
          zapcapTemplateId: captionStyle === 'live' || captionStyle === 'off' ? '' : zapcapTemplateId,
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

  async function regenerateDraft({ directorNote } = {}) {
    if (!selectedId) return
    const note = String(directorNote ?? scriptChat).trim().slice(0, 1200)
    setBusy(true)
    setScriptBusy('draft')
    setErr('')
    setSuccess('')
    const previousPlain = String(draftScript?.plainTextDraft || selected?.script?.plainTextDraft || '').trim()
    try {
      if (note) {
        setScriptChatLog((prev) => [...prev.slice(-8), { role: 'you', text: note }])
      }
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate-draft',
          jobId: selectedId,
          format,
          scriptProvider,
          directorNote: note || undefined,
        }),
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
      const nextPlain = String(j.job?.script?.plainTextDraft || '').trim()
      const ds = j.deskSources || j.job?.deskSources
      const sourced =
        ds && typeof ds === 'object'
          ? ` NewsData ${ds.newsdata || 0} · Guardian ${ds.guardian || 0} · RSS ${ds.rss || 0}.`
          : ''
      const judge = j.judge || j.job?.judge
      const judged =
        judge && !judge.skipped
          ? ` Judge ${judge.judgeProvider || ''} ${judge.pass ? 'pass' : 'soft'} ${judge.overall}/10 (merit ${judge.merit} · interest ${judge.interest} · value ${judge.value}).`
          : ''
      if (note) {
        setScriptChatLog((prev) => [
          ...prev.slice(-10),
          {
            role: 'ai',
            text: nextPlain
              ? `Updated draft (${j.scriptProviderLabel || 'AI'})${judge && !judge.skipped ? ` · judge ${judge.overall}/10` : ''}.`
              : 'Draft rewrite finished.',
          },
        ])
        setScriptChat('')
      }
      if (j.scriptWarning) {
        setErr(j.scriptWarning)
        setSuccess('Fallback draft loaded. Edit it, or fix AI billing and Regenerate again.')
      } else if (previousPlain && nextPlain && previousPlain === nextPlain) {
        setSuccess('Regenerate returned a similar draft — tweak your direction or click Regenerate again.')
      } else {
        setSuccess(
          j.scriptProviderLabel
            ? `${note ? 'Directed' : 'Fresh'} script from ${j.scriptProviderLabel}${j.job?.topic ? ` — “${j.job.topic}”` : ''}.${sourced}${judged} Edit, then Adapt to scenes.`
            : `${note ? 'Directed' : 'Fresh'} script loaded.${sourced}${judged} Edit if needed, then Adapt to scenes.`,
        )
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
      if (note) {
        setScriptChatLog((prev) => [
          ...prev.slice(-10),
          { role: 'ai', text: e instanceof Error ? e.message : 'Could not rewrite from your direction.' },
        ])
      }
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
      return {
        label: regenerateScriptLabel,
        run: () => regenerateDraft({ directorNote: '' }),
        tone: 'primary',
        hint: 'Step 1 — write the voiceover',
      }
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
    if (status === 'video_rendered') return 'border-[#303030] bg-[#272727] text-[#d4d4d4]'
    if (status === 'failed') return 'border-[#ff4e45]/40 bg-[#2a1515] text-[#ff9b95]'
    if (status === 'rendering' || status === 'rendering_video') return 'border-[#303030] bg-[#272727] text-white'
    if (status === 'ready_script') return 'border-[#303030] bg-[#272727] text-[#a3a3a3]'
    return 'border-[#303030] bg-transparent text-[#aaaaaa]'
  }

  if (!isOwner) {
    return <p className={`text-sm ${PX.muted}`}>Production automation is available to the channel owner.</p>
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {loading ? <p className={`text-sm ${PX.muted}`}>Loading…</p> : null}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={PX.title}>Production</h2>
          <p className={`mt-1 ${PX.subtitle}`}>Write a Short, adapt scenes, then build.</p>
        </div>
        <details className="relative text-sm text-[#a3a3a3]">
          <summary className="cursor-pointer list-none rounded-xl border border-[#303030] px-3 py-1.5 hover:bg-[#2a2a2a]">
            Setup
          </summary>
          <div className={`absolute right-0 z-20 mt-2 w-[min(100vw-2rem,20rem)] space-y-2 ${PX.surface} p-4 text-xs shadow-2xl`}>
            <p>
              Script AI:{' '}
              {scriptProviders.groq ? 'Groq' : openAiScriptEnabled ? 'Configured' : 'Add GROQ_API_KEY'}
              {scriptProviders.openai ? ' · OpenAI' : ''}
              {scriptProviders.xai ? ' · xAI' : ''}
            </p>
            <p>
              Script judge:{' '}
              {scriptProviders.judge?.enabled
                ? scriptProviders.judge.openai || scriptProviders.judge.xai
                  ? 'Second model (merit · interest · value)'
                  : 'Groq-only fallback'
                : 'Off / not keyed'}
            </p>
            {scriptProviders.judge?.note ? (
              <p className="text-[#fbbf24]">{scriptProviders.judge.note}</p>
            ) : null}
            <p>
              Articles:{' '}
              {scriptProviders.newsdata
                ? 'NewsData.io keyed (used on each draft/regenerate)'
                : 'NewsData.io not set'}
              {scriptProviders.guardian ? ' · Guardian' : ''}
              {' · RSS'}
            </p>
            <p>Video: {ffmpegAvailable ? 'Ready' : renderNote || 'ffmpeg missing'}</p>
            <p>
              Images:{' '}
              {[
                imageSources.ap && 'AP (latest first)',
                imageSources.google && 'Google',
                imageSources.pinterestApi && 'Pinterest',
                imageSources.pexels && 'Pexels',
                'Wikimedia',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {imagesNote ? <p className="text-[#fbbf24]">{imagesNote}</p> : null}
            <p>
              Captions:{' '}
              {captionEngine.zapcap
                ? 'ZapCap ready · Live subs free'
                : 'Live subs free (ZapCap optional)'}
            </p>
            {captionEngine.note ? <p className="text-[#fbbf24]">{captionEngine.note}</p> : null}
            {scriptBillingNote ? <p className="text-[#fbbf24]">{scriptBillingNote}</p> : null}
          </div>
        </details>
      </header>

      <section className={`${PX.surface} p-6 sm:p-8`}>
        <form onSubmit={createJob} className="space-y-5">
          <label className={`block ${PX.label}`}>
            Topic
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={`${inputCls} text-base`}
              placeholder={
                format === 'quote'
                  ? 'e.g. Rooney on Ronaldo'
                  : format === 'news'
                    ? 'e.g. Spain beat Belgium at the World Cup'
                    : 'e.g. Cristiano Ronaldo'
              }
              minLength={2}
              required
              autoComplete="off"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className={PX.label}>
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
            <label className={PX.label}>
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
            <label className={PX.label}>
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

          <div>
            <p className={PX.label}>Captions</p>
            {captionStyle === 'off' ? (
              <p className={`mt-1 text-xs ${PX.muted}`}>Captions off — clean plate, voiceover only.</p>
            ) : captionStyle === 'live' ? (
              <p className={`mt-1 text-xs ${PX.muted}`}>
                Free live subtitles along the bottom — no ZapCap cost or ZapCap watermark.
              </p>
            ) : !captionEngine.zapcap ? (
              <p className="mt-1 text-xs text-[#fbbf24]">
                CapCut templates need ZAPCAP_API_KEY. Use Live subs (free) for bottom captions without it.
              </p>
            ) : (
              <p className={`mt-1 text-xs ${PX.muted}`}>
                Pick any ZapCap template below (~$0.10/min). Free ZapCap credits stamp a ZapCap watermark —
                Pro removes it. Live / Off stay free.
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { id: 'live', label: 'Live subs (free)', vibe: 'Bottom TV-style' },
                { id: 'off', label: 'Off', vibe: 'Voiceover only' },
              ].map((s) => {
                const active = captionStyle === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setCaptionStyle(s.id)
                      setZapcapTemplateId('')
                    }}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-white/30 bg-[#272727]'
                        : 'border-[#303030] bg-[#121212] hover:border-[#555] hover:bg-[#272727]'
                    }`}
                  >
                    <span className={`block text-sm font-medium ${active ? 'text-white' : 'text-[#e5e5e5]'}`}>
                      {s.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#aaaaaa]">{s.vibe}</span>
                  </button>
                )
              })}
            </div>

            {captionEngine.zapcap ? (
              <div className="mt-4 space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <p className={PX.label}>
                    ZapCap templates{zapcapTemplates.length ? ` (${zapcapTemplates.length})` : ''}
                  </p>
                  <input
                    value={zapcapTemplateFilter}
                    onChange={(e) => setZapcapTemplateFilter(e.target.value)}
                    placeholder="Filter templates…"
                    className={`${inputCls} max-w-xs py-1.5 text-xs`}
                  />
                </div>
                {zapcapTemplatesError ? (
                  <p className="text-xs text-[#fbbf24]">{zapcapTemplatesError}</p>
                ) : null}
                {zapcapTemplates.length ? (
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-[#303030] bg-[#121212] p-2">
                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {zapcapTemplates
                        .filter((t) => {
                          const q = zapcapTemplateFilter.trim().toLowerCase()
                          if (!q) return true
                          return (
                            String(t.name || '').toLowerCase().includes(q) ||
                            String(t.description || '').toLowerCase().includes(q) ||
                            String(t.category || '').toLowerCase().includes(q)
                          )
                        })
                        .map((t) => {
                          const active =
                            (captionStyle === 'zapcap' ||
                              captionStyle === 'pop' ||
                              captionStyle === 'karaoke' ||
                              captionStyle === 'beast') &&
                            zapcapTemplateId === t.id
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setCaptionStyle('zapcap')
                                setZapcapTemplateId(t.id)
                              }}
                              className={`rounded-lg border px-3 py-2 text-left transition ${
                                active
                                  ? 'border-white/35 bg-[#272727]'
                                  : 'border-transparent hover:border-[#444] hover:bg-[#1c1c1c]'
                              }`}
                              title={t.description || t.id}
                            >
                              <span
                                className={`block text-sm font-medium ${active ? 'text-white' : 'text-[#e5e5e5]'}`}
                              >
                                {t.name}
                              </span>
                              {t.category ? (
                                <span className="mt-0.5 block text-[11px] text-[#888]">{t.category}</span>
                              ) : null}
                            </button>
                          )
                        })}
                    </div>
                  </div>
                ) : (
                  <p className={`text-xs ${PX.muted}`}>
                    No ZapCap templates returned yet — check the API key, or use Live / Off.
                  </p>
                )}
                {zapcapTemplateId ? (
                  <p className={`text-xs ${PX.muted}`}>
                    Selected template{' '}
                    <span className="text-[#d4d4d4]">
                      {zapcapTemplates.find((t) => t.id === zapcapTemplateId)?.name || zapcapTemplateId}
                    </span>
                  </p>
                ) : captionStyle === 'zapcap' ? (
                  <p className="text-xs text-[#fbbf24]">Choose a ZapCap template above before rendering.</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {!loading && voicePreset === 'brian' && !elevenLabsConfigured ? (
            <p className="text-xs text-[#fbbf24]">Brian needs ELEVENLABS_API_KEY — or pick Edge British.</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="submit" disabled={busy || loading} className={PX.btnPrimary}>
              {busy ? 'Starting…' : 'Create'}
            </button>
            <span className={`text-xs ${PX.muted}`}>Draft script is generated automatically.</span>
          </div>
        </form>

        {success ? (
          <p className="mt-5 rounded-xl border border-[#303030] bg-[#1a1a1a] px-4 py-3 text-sm text-[#e5e5e5]" role="status">
            {success}
          </p>
        ) : null}
        {err ? (
          <p className="mt-5 rounded-xl border border-[#ff4e45]/40 bg-[#2a1515] px-4 py-3 text-sm text-[#ff9b95]">{err}</p>
        ) : null}
        {displayProgress && !selected ? (
          <div className="mt-5">
            <EofRenderProgressBar
              progress={displayProgress}
              stuck={isRenderStuck}
              onCancel={cancelStuckRender}
              cancelBusy={busy}
            />
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className={`${PX.surfaceInset} p-3`}>
          <div className="mb-3 flex items-center justify-between px-2">
            <h3 className="text-xs font-medium text-[#aaaaaa]">Shorts</h3>
            <span className="tabular-nums text-xs text-[#525252]">{jobs.length}</span>
          </div>
          <ul className="max-h-[min(70vh,640px)] space-y-0.5 overflow-y-auto">
            {jobs.length === 0 ? (
              <li className={`px-2 py-8 text-center text-sm ${PX.muted}`}>No Shorts yet</li>
            ) : (
              jobs.map((j) => (
                <li key={j.id} className="group flex items-stretch gap-0.5">
                  <button
                    type="button"
                    onClick={() => selectJob(j.id)}
                    className={`min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left transition ${
                      selectedId === j.id ? 'bg-[#2a2a2a]' : 'hover:bg-[#272727]'
                    }`}
                  >
                    <div className="truncate text-sm text-[#ececec]">{j.title || j.topic}</div>
                    <div className="mt-1">
                      <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] ${statusPill(j.status)}`}>
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
                    className="rounded-lg px-2 text-[#555] opacity-0 transition hover:text-[#ff9b95] group-hover:opacity-100 disabled:opacity-50"
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
            <div className={`${PX.surface} p-5 sm:p-6`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold text-white sm:text-lg">
                    {draftScript.title || selected.topic}
                  </h3>
                  <p className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${PX.muted}`}>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusPill(selected.status)}`}>
                      {productionJobStatusLabel(selected.status)}
                    </span>
                    {draftScript.format ? <span>{draftScript.format}</span> : null}
                    {scriptSourceLabel ? <span>AI: {scriptSourceLabel}</span> : null}
                    {draftDirty ? <span className="text-[#fbbf24]">Unsaved edits</span> : null}
                  </p>
                </div>
                {primaryAction ? (
                  <div className="flex flex-col items-stretch gap-1 sm:items-end">
                    <button
                      type="button"
                      disabled={Boolean(primaryAction.disabled) || busy}
                      onClick={() => primaryAction.run?.()}
                      className={`${
                        primaryAction.tone === 'busy' ? PX.btnSoft : PX.btnPrimary
                      } disabled:opacity-40`}
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
                      ? 'border-[#303030] bg-[#1a1a1a] text-[#aaaaaa]'
                      : state === 'current'
                        ? 'border-[#555] bg-[#272727] text-white'
                        : state === 'failed'
                          ? 'border-[#ff4e45]/40 bg-[#2a1515] text-[#ff9b95]'
                          : 'border-[#303030] text-[#717171]'
                  return (
                    <li key={n} className={`rounded-xl border px-3 py-2 text-center text-xs font-medium ${cls}`}>
                      <span className="block text-[10px] opacity-70">Step {n}</span>
                      {label}
                    </li>
                  )
                })}
              </ol>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#303030] pt-3">
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
                <label className="text-[10px] text-[#aaa]">
                  Captions
                  <select
                    value={
                      captionStyle === 'zapcap' && zapcapTemplateId
                        ? `zapcap:${zapcapTemplateId}`
                        : captionStyle
                    }
                    onChange={(e) => {
                      const v = e.target.value
                      if (v.startsWith('zapcap:')) {
                        setCaptionStyle('zapcap')
                        setZapcapTemplateId(v.slice('zapcap:'.length))
                      } else {
                        setCaptionStyle(v)
                        if (v === 'live' || v === 'off') setZapcapTemplateId('')
                      }
                      markDraftDirty()
                    }}
                    className={`${inputCls} mt-0.5 min-w-[180px] py-1.5 text-xs`}
                  >
                    <option value="live">Live subs (free)</option>
                    <option value="off">Off</option>
                    {zapcapTemplates.length ? (
                      <optgroup label="ZapCap templates">
                        {zapcapTemplates.map((t) => (
                          <option key={t.id} value={`zapcap:${t.id}`}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      (captionStyles.length
                        ? captionStyles.filter((s) => s.engine === 'zapcap')
                        : [
                            { id: 'pop', label: 'Pop (Hormozi)' },
                            { id: 'karaoke', label: 'Karaoke fill' },
                            { id: 'beast', label: 'Beast bounce' },
                          ]
                      ).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveJob()}
                  className={`mt-4 ${PX.btnGhost}`}
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={busy || isRendering || sceneCount < 1}
                  onClick={buildShort}
                  className={`mt-4 ${PX.btnSoft}`}
                >
                  {selected.status === 'video_rendered' ? 'Rebuild' : 'Build'}
                </button>
                <button
                  type="button"
                  disabled={busy || isRendering}
                  onClick={() => regenerateDraft()}
                  className={`mt-4 ${PX.btnGhost}`}
                >
                  {scriptBusy === 'draft' ? '…' : 'Regenerate'}
                </button>
                <button
                  type="button"
                  disabled={busy || isRendering}
                  onClick={regenerateScript}
                  title="New draft + scenes"
                  className={`mt-4 ${PX.btnGhost}`}
                >
                  {scriptBusy === 'rewrite' ? '…' : 'Full rewrite'}
                </button>
                <button
                  type="button"
                  disabled={deletingId === selected.id}
                  onClick={() => deleteJob(selected.id)}
                  className={`mt-4 ${PX.btnDanger}`}
                >
                  {deletingId === selected.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>

            {/* Ready result first when available */}
            {selected.status === 'video_rendered' || videoPreviewUrl ? (
              <div ref={resultPanelRef} className={`${PX.surface} p-6`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#d4d4d4]">Short ready</p>
                    <p className={`mt-0.5 text-xs ${PX.muted}`}>
                      9:16 with voiceover and images
                      {selected.captionStyle === 'off' || selected.captionEngine === 'none'
                        ? ' · captions off'
                        : selected.captionStyle === 'live' || selected.captionEngine === 'local'
                          ? ' · live bottom subtitles'
                          : selected.captionEngine === 'zapcap' || selected.zapcapTemplateId
                            ? ` · ZapCap${
                                selected.zapcapTemplateId
                                  ? ` · ${
                                      zapcapTemplates.find((t) => t.id === selected.zapcapTemplateId)?.name ||
                                      `${String(selected.zapcapTemplateId).slice(0, 8)}…`
                                    }`
                                  : ''
                              }`
                            : ''}
                      .
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={downloadShort}
                      className={PX.btnGhost}
                    >
                      Download MP4
                    </button>
                    {typeof onSendToStudio === 'function' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={sendToYoutubeStudio}
                        className={PX.btnPrimary}
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
                    className={`mt-4 ${PX.btnPrimary}`}
                  >
                    Load preview
                  </button>
                )}
                {selected.narrationManifest?.length ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {selected.narrationManifest.map((scene, i) => (
                      <div
                        key={scene.sceneId || i}
                        className="overflow-hidden rounded-lg border border-[#303030] bg-[#121212]"
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
            <section className={`${PX.surfaceInset} p-5 sm:p-6`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#d4d4d4]">Step 1 · Script</p>
                  <p className={`mt-0.5 text-xs ${PX.muted}`}>Spoken voiceover — edit freely, then go to scenes.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums text-[11px] text-[#717171]">{wordCount} words</span>
                  <button
                    type="button"
                    disabled={busy || isRendering}
                    onClick={() => regenerateDraft({ directorNote: '' })}
                    className={PX.btnPrimary}
                  >
                    {regenerateScriptLabel}
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-[#303030] bg-[#121212] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#aaa]">
                  Direct the AI · tell Groq how to write
                </p>
                {scriptChatLog.length ? (
                  <div className="mt-2 max-h-28 space-y-1.5 overflow-y-auto">
                    {scriptChatLog.map((row, i) => (
                      <p
                        key={`${row.role}-${i}`}
                        className={`text-xs leading-snug ${row.role === 'you' ? 'text-[#e5e5e5]' : 'text-[#8ab4f8]'}`}
                      >
                        <span className="font-medium text-[#717171]">{row.role === 'you' ? 'You' : 'AI'}: </span>
                        {row.text}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className={`mt-1 text-xs ${PX.muted}`}>
                    e.g. “Open angry about Tuchel’s selection — name England XI debate — end asking who’s wrong”
                  </p>
                )}
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <textarea
                    value={scriptChat}
                    onChange={(e) => setScriptChat(e.target.value)}
                    rows={2}
                    disabled={busy || isRendering}
                    placeholder="What script do you want? Tone, angle, names to stress, opening line…"
                    className={`${inputCls} min-h-[56px] flex-1 text-sm`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !busy && !isRendering) {
                        e.preventDefault()
                        if (scriptChat.trim()) regenerateDraft({ directorNote: scriptChat })
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy || isRendering || !scriptChat.trim()}
                    onClick={() => regenerateDraft({ directorNote: scriptChat })}
                    className={`${PX.btnSoft} shrink-0 sm:mb-0.5`}
                  >
                    {scriptBusy === 'draft' ? 'Writing…' : 'Send to AI'}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-[#717171]">⌘/Ctrl + Enter to send · uses your Script AI (Groq / OpenAI / xAI)</p>
              </div>

              <textarea
                value={draftScript.plainTextDraft || ''}
                onChange={(e) => {
                  const plainTextDraft = e.target.value
                  setDraftScript((prev) => (prev ? { ...prev, plainTextDraft } : prev))
                  markDraftDirty()
                }}
                rows={7}
                className={`${inputCls} mt-3 text-[15px] leading-relaxed text-[#ececec]`}
                placeholder="Write or regenerate a punchy Shorts voiceover here…"
              />
              {hasPlainDraft ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || isRendering}
                    onClick={adaptToScenes}
                    className={PX.btnPrimary}
                  >
                    Next: Adapt to scenes →
                  </button>
                  <button
                    type="button"
                    disabled={busy || isRendering}
                    onClick={regenerateScript}
                    className={PX.btnGhost}
                  >
                    Full rewrite (script + scenes)
                  </button>
                </div>
              ) : (
                <p className={`mt-2 text-xs ${PX.muted}`}>
                  Click <span className="text-[#d4d4d4]">Generate script</span> to pull desk notes and write the VO.
                </p>
              )}
            </section>

            {/* Voice tuning (Brian only) */}
            {voicePreset === 'brian' ? (
              <details className={`${PX.surface} p-4`}>
                <summary className="cursor-pointer text-xs font-semibold text-[#aaa]">
                  Brian voice tuning (optional)
                </summary>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={resetBrianVoiceSettings}
                    className="text-[10px] text-[#a3a3a3] hover:text-white hover:underline"
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
                          <span className="tabular-nums text-[#d4d4d4]">{Number(val).toFixed(2)}</span>
                        </span>
                        <input
                          type="range"
                          min={limits.min}
                          max={limits.max}
                          step={limits.step}
                          value={val}
                          onChange={(e) => updateVoiceSetting(field.key, e.target.value)}
                          className="mt-1 w-full accent-white"
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
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#303030] pt-3">
                    <button
                      type="button"
                      disabled={busy || isRendering || !voiceRegen.canRegenerate}
                      onClick={regenerateVoiceover}
                      title={voiceRegen.blockedReason || undefined}
                      className={PX.btnGhost}
                    >
                      {busy || isRendering
                        ? 'Regenerating…'
                        : `Regenerate voiceover (${voiceRegen.remaining}/${voiceRegen.limit})`}
                    </button>
                    {voiceRegen.blockedReason ? (
                      <span className="text-[10px] text-[#fbbf24]">{voiceRegen.blockedReason}</span>
                    ) : (
                      <span className="text-[10px] text-[#717171]">Same captions & photos — new Brian mix only.</span>
                    )}
                  </div>
                ) : null}
              </details>
            ) : null}

            {/* Step 2 — Scenes */}
            <section className={`${PX.surface} p-5 sm:p-6`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-[#aaaaaa]">
                    Step 2 · Scenes ({sceneCount}/{EOF_MAX_SCENES})
                  </p>
                  <p className={`mt-0.5 text-xs ${PX.muted}`}>On-screen captions + image search for each beat.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || isRendering || !hasPlainDraft}
                    onClick={adaptToScenes}
                    className={PX.btnGhost}
                  >
                    Adapt from script
                  </button>
                  <button
                    type="button"
                    disabled={busy || sceneCount >= EOF_MAX_SCENES}
                    onClick={() => addScene()}
                    className={PX.btnGhost}
                  >
                    + Add
                  </button>
                </div>
              </div>

              {!sceneCount ? (
                <p className={`mt-4 rounded-xl border border-dashed border-[#303030] px-4 py-8 text-center text-sm ${PX.muted}`}>
                  No scenes yet — finish the script, then tap <span className="text-[#d4d4d4]">Adapt to scenes</span>.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {draftScript.scenes.map((scene, i) => (
                    <div key={scene.id || i} className="rounded-xl border border-[#303030] bg-[#121212] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase text-[#717171]">
                          Scene {i + 1}
                          {scene.role ? ` · ${scene.role}` : ''}
                          {scene.durationSec ? (
                            <span className="ml-2 font-normal normal-case text-[#a3a3a3]">
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
                  className={`mt-4 w-full ${PX.btnPrimary} sm:w-auto`}
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
            <details className={`${PX.surface} p-4`}>
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
              <p className="rounded-xl border border-[#ff4e45]/40 bg-[#2a1515] px-4 py-3 text-sm text-[#ff9b95]">
                Build failed: {selected.errorMessage}
              </p>
            ) : null}
          </div>
        ) : (
          <div className={`flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-[#303030] bg-[#121212] p-8`}>
            <p className={`max-w-sm text-center text-sm ${PX.muted}`}>
              Pick a Short from the list, or start a new one above.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
