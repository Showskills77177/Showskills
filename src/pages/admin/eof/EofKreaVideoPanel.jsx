import { useEffect, useState } from 'react'
import { apiFetch, apiUrl } from '../../../lib/api'

const ASPECT_RATIOS = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9', '9:21']
const RESOLUTIONS = ['480p', '720p', '1080p']
const ACTIVE_STATUSES = new Set([
  'backlogged',
  'queued',
  'scheduled',
  'processing',
  'sampling',
  'intermediate-complete',
])

function isTerminalStatus(status) {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

async function readJsonResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `Request failed (HTTP ${response.status}).`)
  return body
}

export default function EofKreaVideoPanel({ onUseVideo }) {
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState('6')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [resolution, setResolution] = useState('720p')
  const [job, setJob] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')
  const [usingVideo, setUsingVideo] = useState(false)
  const [useError, setUseError] = useState('')
  const [promptForJob, setPromptForJob] = useState('')
  const jobId = job?.jobId || ''
  const terminal = isTerminalStatus(job?.status)

  useEffect(() => {
    if (!jobId || terminal) return undefined

    let stopped = false
    let timer
    let attempt = 0

    async function poll() {
      try {
        const params = new URLSearchParams({ action: 'status', jobId })
        const result = await readJsonResponse(
          await apiFetch(`/api/admin/eof-krea-video?${params.toString()}`),
        )
        if (stopped) return
        setJob(result.job)
        setPollError('')
      } catch (pollFailure) {
        if (stopped) return
        setPollError(pollFailure instanceof Error ? pollFailure.message : 'Could not refresh Krea status.')
      }

      if (!stopped) {
        const delay = Math.min(2000 * 2 ** Math.min(attempt, 3), 10_000)
        attempt += 1
        timer = setTimeout(poll, delay)
      }
    }

    timer = setTimeout(poll, 1500)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [jobId, terminal])

  async function generate(event) {
    event.preventDefault()
    if (!prompt.trim() || busy || (jobId && !terminal)) return

    setBusy(true)
    setError('')
    setPollError('')
    setUseError('')
    setJob(null)
    setPromptForJob(prompt)
    try {
      const result = await readJsonResponse(
        await apiFetch('/api/admin/eof-krea-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            duration: Number(duration),
            aspectRatio,
            resolution,
          }),
        }),
      )
      setJob(result.job)
    } catch (generateFailure) {
      setError(generateFailure instanceof Error ? generateFailure.message : 'Could not start Krea generation.')
    } finally {
      setBusy(false)
    }
  }

  async function useInUploadStudio() {
    if (!jobId || job?.status !== 'completed' || usingVideo) return
    setUsingVideo(true)
    setUseError('')
    try {
      const params = new URLSearchParams({ action: 'download', jobId })
      const response = await apiFetch(`/api/admin/eof-krea-video?${params.toString()}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Video download failed (HTTP ${response.status}).`)
      }
      const blob = await response.blob()
      if (!blob.size) throw new Error('Krea returned an empty video file.')
      const file = new File([blob], `krea-${jobId}.mp4`, { type: blob.type || 'video/mp4' })
      onUseVideo?.(file, promptForJob)
    } catch (failure) {
      setUseError(failure instanceof Error ? failure.message : 'Could not load this video into Upload Studio.')
    } finally {
      setUsingVideo(false)
    }
  }

  const videoParams = new URLSearchParams({ action: 'preview', jobId })
  const downloadParams = new URLSearchParams({ action: 'download', jobId })

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div className="rounded-xl border border-[#303030] bg-[#181818] p-5">
        <h2 className="text-lg font-semibold text-white">Krea video chat</h2>
        <p className="mt-1 text-sm text-[#aaa]">
          Send your prompt directly to Seedance 1.0 Pro Fast. The prompt is not rewritten.
        </p>

        <form onSubmit={generate} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white">Describe the exact video you want</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Write your video prompt…"
              className="w-full resize-y rounded-lg border border-[#3a3a3a] bg-[#101010] px-3 py-2.5 text-sm text-white outline-none focus:border-[#3ea6ff]"
              required
              aria-label="Video prompt"
            />
            <span className="mt-1 block text-right text-xs text-[#888]">{prompt.length}/2000</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-[#ccc]">
              Duration
              <select
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-[#3a3a3a] bg-[#101010] px-3 py-2 text-white"
              >
                {Array.from({ length: 11 }, (_, index) => index + 2).map((seconds) => (
                  <option key={seconds} value={seconds}>{seconds} seconds</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[#ccc]">
              Aspect ratio
              <select
                value={aspectRatio}
                onChange={(event) => setAspectRatio(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-[#3a3a3a] bg-[#101010] px-3 py-2 text-white"
              >
                {ASPECT_RATIOS.map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
              </select>
            </label>
            <label className="text-sm text-[#ccc]">
              Resolution
              <select
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-[#3a3a3a] bg-[#101010] px-3 py-2 text-white"
              >
                {RESOLUTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || !prompt.trim() || (jobId && !terminal)}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#ddd] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Sending prompt…' : jobId && !terminal ? 'Generation in progress…' : 'Generate video'}
          </button>
        </form>
      </div>

      {job ? (
        <div className="rounded-xl border border-[#303030] bg-[#181818] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-white">Generation</h3>
            <span className="rounded-full bg-[#272727] px-3 py-1 text-xs font-medium text-[#ddd]">
              {job.status}
              {job.progress != null ? ` · ${Math.round(job.progress * 100)}%` : ''}
            </span>
          </div>
          <blockquote className="mt-3 whitespace-pre-wrap border-l-2 border-[#3ea6ff] pl-3 text-sm text-[#bbb]">
            {promptForJob}
          </blockquote>
          {ACTIVE_STATUSES.has(job.status) ? (
            <p role="status" className="mt-4 text-sm text-[#aaa]">
              Krea is generating your video. This page checks for updates automatically.
            </p>
          ) : null}
          {pollError ? <p role="alert" className="mt-3 text-sm text-amber-300">{pollError} Retrying automatically…</p> : null}
          {job.status === 'failed' || job.status === 'cancelled' ? (
            <p role="alert" className="mt-4 text-sm text-red-300">
              {job.error || `Krea ${job.status} this generation.`}
            </p>
          ) : null}
          {job.status === 'completed' && !job.hasVideo ? (
            <p role="alert" className="mt-4 text-sm text-amber-300">
              Krea completed the job but did not return a previewable video.
            </p>
          ) : null}
          {job.status === 'completed' && job.hasVideo ? (
            <>
              <video
                key={jobId}
                controls
                playsInline
                preload="metadata"
                src={apiUrl(`/api/admin/eof-krea-video?${videoParams.toString()}`)}
                className="mt-4 aspect-video w-full rounded-lg bg-black"
              />
              {useError ? <p role="alert" className="mt-3 text-sm text-red-300">{useError}</p> : null}
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={apiUrl(`/api/admin/eof-krea-video?${downloadParams.toString()}`)}
                  download={`krea-${jobId}.mp4`}
                  className="rounded-full border border-[#555] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#272727]"
                >
                  Download MP4
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
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
