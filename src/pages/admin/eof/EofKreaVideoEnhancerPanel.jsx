import { useEffect, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { apiFetch, apiUrl } from '../../../lib/api'

const ENDPOINT = '/api/admin/eof-krea-video-enhancer'
const ACTIVE_STATUSES = new Set([
  'backlogged',
  'queued',
  'scheduled',
  'processing',
  'sampling',
  'intermediate-complete',
])

async function readJsonResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `Request failed (HTTP ${response.status}).`)
  return body
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return ''
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function EofKreaVideoEnhancerPanel({ onUseVideo }) {
  const [file, setFile] = useState(null)
  const [model, setModel] = useState('economy')
  const [target, setTarget] = useState('4k')
  const [noiseScale, setNoiseScale] = useState(0.1)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [maxUploadBytes, setMaxUploadBytes] = useState(0)
  const [uploadId, setUploadId] = useState('')
  const [cleanupToken, setCleanupToken] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [job, setJob] = useState(null)
  const [modelLabel, setModelLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [usingVideo, setUsingVideo] = useState(false)
  const [error, setError] = useState('')
  const [localPreviewUrl, setLocalPreviewUrl] = useState('')

  const jobId = job?.jobId || ''
  const terminal = ['completed', 'failed', 'cancelled'].includes(job?.status)

  useEffect(() => {
    let stopped = false
    apiFetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upload-config' }),
    })
      .then(readJsonResponse)
      .then((config) => {
        if (stopped) return
        setMaxUploadBytes(config.maxUploadBytes)
        setUploadId(config.uploadId)
        setCleanupToken(config.cleanupToken)
      })
      .catch((failure) => {
        if (!stopped) setError(failure instanceof Error ? failure.message : 'Video upload is not configured.')
      })
    return () => { stopped = true }
  }, [])

  useEffect(() => {
    if (!file) {
      setLocalPreviewUrl('')
      return undefined
    }
    const url = URL.createObjectURL(file)
    setLocalPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (!jobId || terminal) return undefined
    let stopped = false
    let timer
    let attempt = 0

    async function poll() {
      try {
        const params = new URLSearchParams({ action: 'status', jobId })
        const result = await readJsonResponse(await apiFetch(`${ENDPOINT}?${params.toString()}`))
        if (stopped) return
        setJob(result.job)
        if (result.job.status === 'completed') {
          if (sourceUrl && cleanupToken) {
            try {
              await readJsonResponse(
                await apiFetch(ENDPOINT, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'cleanup-source', sourceUrl, cleanupToken }),
                }),
              )
              setSourceUrl('')
            } catch (cleanupFailure) {
              setError(cleanupFailure instanceof Error ? cleanupFailure.message : 'Could not remove the staged source.')
            }
          } else {
            setSourceUrl('')
          }
        }
      } catch (failure) {
        if (!stopped) {
          setError(failure instanceof Error ? failure.message : 'Could not refresh enhancement status.')
        }
      }
      if (!stopped) {
        timer = setTimeout(poll, Math.min(2000 * 2 ** Math.min(attempt++, 3), 10_000))
      }
    }

    timer = setTimeout(poll, 1500)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [jobId, sourceUrl, cleanupToken, terminal])

  async function chooseFile(event) {
    const candidate = event.target.files?.[0] || null
    setError('')
    if (sourceUrl && cleanupToken) {
      try {
        await readJsonResponse(
          await apiFetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'cleanup-source', sourceUrl, cleanupToken }),
          }),
        )
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Could not remove the previous staged source.')
        event.target.value = ''
        return
      }
    }
    setJob(null)
    setSourceUrl('')
    setFile(null)
    setUploadProgress(0)
    if (!candidate) return
    try {
      const config = await readJsonResponse(
        await apiFetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upload-config' }),
        }),
      )
      setMaxUploadBytes(config.maxUploadBytes)
      setUploadId(config.uploadId)
      setCleanupToken(config.cleanupToken)
      if (candidate.size > config.maxUploadBytes) {
        setError(`This video is ${formatSize(candidate.size)}; the configured upload cap is ${formatSize(config.maxUploadBytes)}.`)
        event.target.value = ''
        return
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Video upload is not configured.')
      event.target.value = ''
      return
    }
    if (!candidate.type.startsWith('video/')) {
      setError('Choose a video file.')
      event.target.value = ''
      return
    }
    setFile(candidate)
  }

  async function enhance(event) {
    event.preventDefault()
    if (!file || busy || (jobId && !terminal)) return
    setBusy(true)
    setError('')
    setJob(null)
    setUploadProgress(0)
    let uploadedUrl = sourceUrl
    try {
      if (!uploadedUrl) {
        if (!uploadId || !cleanupToken || !maxUploadBytes) {
          throw new Error('Video upload is not configured. Check the Blob store and configured upload cap.')
        }
        if (file.size > maxUploadBytes) {
          throw new Error(`This video exceeds the configured ${formatSize(maxUploadBytes)} upload cap.`)
        }
        const suffix = file.name.includes('.') ? file.name.split('.').pop().replace(/[^a-z0-9]/gi, '').slice(0, 8) : 'mp4'
        const blob = await upload(
          `eof-video-enhancer/source-${uploadId}.${suffix || 'mp4'}`,
          file,
          {
            access: 'public',
            handleUploadUrl: apiUrl(ENDPOINT),
            multipart: true,
            contentType: file.type || 'application/octet-stream',
            clientPayload: cleanupToken,
            onUploadProgress: ({ percentage }) => setUploadProgress(Math.round(percentage)),
          },
        )
        uploadedUrl = blob.url
        setSourceUrl(uploadedUrl)
      }

      const result = await readJsonResponse(
        await apiFetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'enhance', videoUrl: uploadedUrl, model, target, noiseScale }),
        }),
      )
      setJob(result.job)
      setModelLabel(result.model)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not start video enhancement.')
    } finally {
      setBusy(false)
    }
  }

  async function useInUploadStudio() {
    if (!jobId || job?.status !== 'completed' || usingVideo) return
    setUsingVideo(true)
    setError('')
    try {
      const params = new URLSearchParams({ action: 'download', jobId })
      const response = await apiFetch(`${ENDPOINT}?${params.toString()}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Video download failed (HTTP ${response.status}).`)
      }
      const blob = await response.blob()
      if (!blob.size) throw new Error('Krea returned an empty video file.')
      const enhanced = new File([blob], `eof-enhanced-${jobId}.mp4`, {
        type: blob.type || 'video/mp4',
      })
      onUseVideo?.(enhanced, `Enhanced video: ${file?.name || 'uploaded source'}`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load the enhanced video into Upload Studio.')
    } finally {
      setUsingVideo(false)
    }
  }

  async function discardSource() {
    if (!sourceUrl || busy || (jobId && !terminal)) return
    try {
      await readJsonResponse(
        await apiFetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cleanup-source', sourceUrl, cleanupToken }),
        }),
      )
      setSourceUrl('')
      setFile(null)
      setJob(null)
      setUploadProgress(0)
      setError('')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not remove the staged source.')
    }
  }

  const previewUrl = job?.status === 'completed'
    ? apiUrl(`${ENDPOINT}?${new URLSearchParams({ action: 'preview', jobId }).toString()}`)
    : sourceUrl || localPreviewUrl

  return (
    <div className="rounded-xl border border-[#303030] bg-[#181818] p-5">
      <h2 className="text-lg font-semibold text-white">Video enhancer</h2>
      <p className="mt-1 text-sm text-[#aaa]">
        Stage a source video in Vercel Blob, then enhance it with Krea. Uploads are multipart and bypass server request-size limits.
      </p>

      <form onSubmit={enhance} className="mt-5 space-y-4">
        <label className="block text-sm text-white">
          Source video
          <input
            type="file"
            accept="video/*"
            onChange={chooseFile}
            disabled={busy || (jobId && !terminal)}
            className="mt-2 block w-full text-sm text-[#bbb] file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
            aria-label="Choose source video"
          />
          {file ? <span className="mt-1 block text-xs text-[#888]">{file.name} · {formatSize(file.size)}</span> : null}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-[#ccc]">
            Enhancement profile
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-[#3a3a3a] bg-[#101010] px-3 py-2 text-white"
            >
              <option value="economy">Economy / fast — SeedVR 2 (up to 4K)</option>
              <option value="quality">Quality — Topaz Video Upscale (up to 8K)</option>
            </select>
          </label>
          {model === 'quality' ? (
            <label className="text-sm text-[#ccc]">
              Output target
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-[#3a3a3a] bg-[#101010] px-3 py-2 text-white"
              >
                <option value="4k">4K</option>
                <option value="8k">8K</option>
              </select>
            </label>
          ) : (
            <label className="text-sm text-[#ccc]">
              Denoising strength · {Number(noiseScale).toFixed(2)}
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={noiseScale}
                onChange={(event) => setNoiseScale(Number(event.target.value))}
                className="mt-3 block w-full accent-[#3ea6ff]"
              />
            </label>
          )}
        </div>

        <p className="text-xs leading-relaxed text-[#999]">
          SeedVR 2 is the economy profile; Topaz is the higher-quality option. Krea does not publish per-model prices in its API docs, so exact cheapest-model claims or a price estimate are not available here. {maxUploadBytes ? `This deployment's configured per-file cap is ${formatSize(maxUploadBytes)}.` : 'Uploads are unavailable until this deployment configures an upload cap.'} Vercel storage and Krea account quotas still apply. Source videos are staged as public, unguessable Blob URLs so Krea can fetch them.
        </p>
        <p className="text-xs leading-relaxed text-amber-200/80">
          Long-video segmentation and stitching is not yet enabled. The existing Railway worker has durable Postgres-backed production jobs and FFmpeg, but its code has no enhancer job path or Blob/Krea integration. Krea also publishes no source-video duration or size limits for its enhancer endpoints, so safe segment boundaries cannot be chosen. This submits a single source per Krea job and can only process input accepted by Krea.
        </p>

        {uploadProgress > 0 && uploadProgress < 100 ? (
          <div aria-live="polite" className="text-xs text-[#bbb]">
            Uploading source · {uploadProgress}%
            <progress className="mt-1 block w-full accent-[#3ea6ff]" max="100" value={uploadProgress} />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!file || busy || (jobId && !terminal)}
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#ddd] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? uploadProgress < 100 ? `Uploading… ${uploadProgress}%` : 'Starting enhancement…' : jobId && !terminal ? 'Enhancement in progress…' : 'Upload and enhance'}
        </button>
        {sourceUrl && (!jobId || terminal) ? (
          <button
            type="button"
            onClick={discardSource}
            disabled={busy}
            className="ml-3 rounded-full border border-[#555] px-4 py-2 text-sm font-medium text-[#ccc] transition hover:bg-[#272727] disabled:opacity-50"
          >
            Remove staged source
          </button>
        ) : null}
      </form>

      {job ? (
        <div className="mt-5 border-t border-[#303030] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-white">Enhancement</h3>
            <span className="rounded-full bg-[#272727] px-3 py-1 text-xs font-medium text-[#ddd]">
              {job.status}{job.progress != null ? ` · ${Math.round(job.progress * 100)}%` : ''}
            </span>
          </div>
          {ACTIVE_STATUSES.has(job.status) ? (
            <p role="status" className="mt-3 text-sm text-[#aaa]">
              {modelLabel || 'Krea'} is enhancing your source. This page checks for updates automatically.
            </p>
          ) : null}
          {job.status === 'failed' || job.status === 'cancelled' ? (
            <p role="alert" className="mt-3 text-sm text-red-300">{job.error || `Krea ${job.status} this enhancement.`}</p>
          ) : null}
          {job.status === 'completed' && !job.hasVideo ? (
            <p role="alert" className="mt-3 text-sm text-amber-300">Krea completed without returning a previewable video.</p>
          ) : null}
        </div>
      ) : null}

      {previewUrl ? (
        <video
          key={jobId || sourceUrl || file?.name}
          controls
          playsInline
          preload="metadata"
          src={previewUrl}
          className="mt-4 aspect-video w-full rounded-lg bg-black"
          onError={() => {
            if (job?.status === 'completed') setError('Could not load the enhanced preview. Try downloading the result.')
          }}
        />
      ) : null}

      {job?.status === 'completed' && job.hasVideo ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={apiUrl(`${ENDPOINT}?${new URLSearchParams({ action: 'download', jobId }).toString()}`)}
            download={`eof-enhanced-${jobId}.mp4`}
            className="rounded-full border border-[#555] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#272727]"
          >
            Download enhanced video
          </a>
          <button
            type="button"
            onClick={useInUploadStudio}
            disabled={usingVideo}
            className="rounded-full bg-[#3ea6ff] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#73bdff] disabled:opacity-50"
          >
            {usingVideo ? 'Loading video…' : 'Use in EOF Upload Studio'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
