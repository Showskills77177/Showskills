import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../../lib/api'
import {
  EOF_CONTENT_TYPES,
  EOF_VISIBILITY_OPTIONS,
  EOF_YOUTUBE_CATEGORIES,
  EOF_LICENSE_OPTIONS,
  EOF_LANGUAGE_OPTIONS,
  formatBytes,
  formatDuration,
  detectVideoFormat,
  applyShortsDescription,
  formatAspectRatio,
} from '../../../../shared/eofYoutubeMeta.mjs'
import { EOF } from './eofStudioTheme'

async function uploadVideoToYoutube(payload, onProgress) {
  const initRes = await apiFetch('/api/admin/eof-upload-init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const init = await initRes.json().catch(() => ({}))
  if (!initRes.ok) throw new Error(init.error || 'Could not start upload')

  onProgress?.('Uploading to YouTube…')
  const putRes = await fetch(init.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': payload.contentType || 'video/mp4' },
    body: payload.file,
  })
  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => '')
    throw new Error(`YouTube upload failed (${putRes.status}). ${detail.slice(0, 120)}`)
  }

  const ytVideo = await putRes.json().catch(() => ({}))
  const youtubeVideoId = ytVideo?.id
  if (!youtubeVideoId) throw new Error('YouTube did not return a video ID.')

  onProgress?.('Running checks & saving…')
  const completeRes = await apiFetch('/api/admin/eof-upload-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: init.projectId,
      youtubeVideoId,
      thumbnailBase64: payload.thumbnailBase64 || null,
    }),
  })
  const complete = await completeRes.json().catch(() => ({}))
  if (!completeRes.ok) throw new Error(complete.error || 'Could not save upload')
  return complete
}

export default function EofUploadStudio({ canUse, isOwner, onDone }) {
  const [tab, setTab] = useState('details')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [videoContentType, setVideoContentType] = useState('short')
  const [formatManual, setFormatManual] = useState(false)
  const [addShortsHashtag, setAddShortsHashtag] = useState(true)
  const [visibility, setVisibility] = useState('private')
  const [categoryId, setCategoryId] = useState('17')
  const [license, setLicense] = useState('youtube')
  const [defaultLanguage, setDefaultLanguage] = useState('')
  const [recordingDate, setRecordingDate] = useState('')
  const [embeddable, setEmbeddable] = useState(true)
  const [publicStatsViewable, setPublicStatsViewable] = useState(true)
  const [madeForKids, setMadeForKids] = useState(false)
  const [containsSyntheticMedia, setContainsSyntheticMedia] = useState(false)
  const [paidPromotion, setPaidPromotion] = useState(false)
  const [relatedVideoId, setRelatedVideoId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [file, setFile] = useState(null)
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [meta, setMeta] = useState({ size: 0, duration: 0, width: 0, height: 0, aspectLabel: '', isShort: false })
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [formErr, setFormErr] = useState('')
  const [lastChecks, setLastChecks] = useState(null)
  const videoRef = useRef(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      setMeta({ size: 0, duration: 0, width: 0, height: 0, aspectLabel: '', isShort: false })
      setFormatManual(false)
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setMeta({ size: file.size, duration: 0 })
    return () => URL.revokeObjectURL(url)
  }, [file])

  function onVideoMeta() {
    const v = videoRef.current
    if (!v) return
    const detected = detectVideoFormat({ width: v.videoWidth, height: v.videoHeight })
    setMeta((m) => ({
      ...m,
      duration: Number.isFinite(v.duration) ? v.duration : m.duration,
      width: detected.width,
      height: detected.height,
      aspectLabel: detected.aspectLabel,
      isShort: detected.isShort,
    }))
    if (!formatManual) {
      setVideoContentType(detected.formatId)
      setAddShortsHashtag(detected.isShort)
    }
  }

  async function readThumbnailBase64() {
    if (!thumbnailFile || videoContentType !== 'long') return null
    const buf = await thumbnailFile.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ''
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canUse || !file || title.trim().length < 3) return
    setBusy(true)
    setFormErr('')
    setLastChecks(null)
    try {
      let scheduleIso = null
      if (isOwner && scheduledAt) {
        const d = new Date(scheduledAt)
        if (Number.isNaN(d.getTime())) throw new Error('Invalid schedule time')
        if (d <= new Date()) throw new Error('Schedule must be in the future')
        scheduleIso = d.toISOString()
      }

      const detected = detectVideoFormat({ width: meta.width, height: meta.height })
      const finalDescription = applyShortsDescription(description.trim(), {
        isShort: detected.isShort || videoContentType === 'short',
        addShortsHashtag,
      })

      const result = await uploadVideoToYoutube(
        {
          title: title.trim(),
          description: finalDescription,
          tags,
          uploadSource: isOwner ? 'admin' : 'editor',
          videoContentType,
          visibility: isOwner ? visibility : 'private',
          categoryId,
          license,
          defaultLanguage: defaultLanguage || null,
          recordingDate: recordingDate || null,
          embeddable,
          publicStatsViewable,
          madeForKids,
          containsSyntheticMedia,
          paidPromotion,
          relatedVideoId: relatedVideoId.trim() || null,
          scheduledAt: scheduleIso,
          contentType: file.type || 'video/mp4',
          fileSizeBytes: file.size,
          durationSeconds: meta.duration || null,
          widthPixels: meta.width || null,
          heightPixels: meta.height || null,
          aspectRatio: meta.width && meta.height ? meta.width / meta.height : null,
          isVerticalShort: detected.isShort,
          thumbnailBase64: await readThumbnailBase64(),
          file,
        },
        setProgress,
      )
      setLastChecks(result.youtube?.checks || result.project?.checks)
      if (result.youtube?.checks?.processingStatus === 'processing') {
        pollUploadChecks(result.project?.id)
      }
      setTitle('')
      setDescription('')
      setTags('')
      setFile(null)
      setThumbnailFile(null)
      setScheduledAt('')
      setProgress('')
      onDone?.(result)
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Upload failed')
      setProgress('')
    } finally {
      setBusy(false)
    }
  }

  async function pollUploadChecks(projectId) {
    if (!projectId) return
    for (let i = 0; i < 12; i += 1) {
      await new Promise((r) => setTimeout(r, 5000))
      try {
        const res = await apiFetch('/api/admin/eof-upload-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'refresh', projectId }),
        })
        const j = await res.json().catch(() => ({}))
        if (j.youtube?.checks) {
          setLastChecks(j.youtube.checks)
          if (j.youtube.checks.processingStatus === 'succeeded' || j.youtube.checks.processingStatus === 'failed') {
            onDone?.()
            break
          }
        }
      } catch {
        /* keep polling */
      }
    }
  }

  const detectedFormat = detectVideoFormat({ width: meta.width, height: meta.height })
  const formatMismatch =
    formatManual && meta.width > 0 && detectedFormat.formatId !== videoContentType

  if (!canUse) {
    return <p className={`text-sm ${EOF.muted}`}>Sign in and connect YouTube to upload.</p>
  }

  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'visibility', label: 'Visibility' },
    { id: 'advanced', label: 'Advanced' },
    { id: 'checks', label: 'Checks' },
  ]

  return (
    <form onSubmit={handleSubmit} className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} overflow-hidden`}>
      <div className="border-b border-[#303030] px-4 py-3">
        <h2 className="text-base font-semibold text-white">Create</h2>
        <p className={`text-xs ${EOF.muted}`}>Upload Short or long-form — full YouTube metadata</p>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
        <div className="border-b border-[#303030] p-4 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex flex-wrap gap-1 border-b border-[#303030] pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  tab === t.id ? 'bg-white text-black' : 'text-[#aaaaaa] hover:bg-[#3f3f3f]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'details' ? (
            <div className="space-y-4">
              <Field label="Format">
                {meta.width > 0 ? (
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        detectedFormat.isShort ? 'bg-[#ff0000] text-white' : 'bg-[#3ea6ff] text-white'
                      }`}
                    >
                      {detectedFormat.isShort ? 'Short (vertical)' : 'Long (landscape)'}
                    </span>
                    <span className="text-xs text-[#3ea6ff]">
                      {meta.width}×{meta.height} · {formatAspectRatio(meta.width, meta.height)} ·{' '}
                      {formatDuration(meta.duration)}
                    </span>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  {EOF_CONTENT_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setFormatManual(true)
                        setVideoContentType(t.id)
                      }}
                      className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm ${
                        videoContentType === t.id
                          ? 'border-[#3ea6ff] bg-[#1a2a3a] text-white'
                          : 'border-[#303030] text-[#aaa]'
                      }`}
                    >
                      <span className="font-semibold">{t.label}</span>
                      <span className="mt-0.5 block text-[10px]">{t.hint}</span>
                    </button>
                  ))}
                </div>
                {formatMismatch ? (
                  <p className="mt-2 text-xs text-[#f9a825]">
                    Selected format differs from detected {detectedFormat.aspectLabel}. YouTube classifies Shorts by
                    vertical/square shape, not length.
                  </p>
                ) : null}
                {detectedFormat.isShort ? (
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-[#aaa]">
                    <input
                      type="checkbox"
                      checked={addShortsHashtag}
                      onChange={(e) => setAddShortsHashtag(e.target.checked)}
                    />
                    Add #Shorts to description (recommended for vertical videos)
                  </label>
                ) : null}
              </Field>
              <Field label="Title (required)">
                <input
                  required
                  minLength={3}
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Description">
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputCls}
                  placeholder="Description, links, hashtags…"
                />
              </Field>
              <Field label="Tags (comma-separated)">
                <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Category">
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                  {EOF_YOUTUBE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Language">
                <select value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)} className={inputCls}>
                  {EOF_LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.id || 'default'} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="License">
                <select value={license} onChange={(e) => setLicense(e.target.value)} className={inputCls}>
                  {EOF_LICENSE_OPTIONS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Recording date (optional)">
                <input
                  type="date"
                  value={recordingDate}
                  onChange={(e) => setRecordingDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Video file">
                <input
                  type="file"
                  accept="video/*"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="text-sm text-[#aaa] file:mr-2 file:rounded file:border-0 file:bg-[#ff0000] file:px-3 file:py-1.5 file:text-white"
                />
                {file ? (
                  <p className="mt-1 text-xs text-[#3ea6ff]">
                    {formatBytes(meta.size)} · {formatDuration(meta.duration)} ·{' '}
                    {meta.width ? `${meta.width}×${meta.height}` : '—'} · {file.type || 'video'}
                  </p>
                ) : null}
              </Field>
              {videoContentType === 'long' ? (
                <Field label="Custom thumbnail (long form)">
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                    className="text-sm text-[#aaa] file:mr-2 file:rounded file:border-0 file:bg-[#272727] file:px-3 file:py-1.5 file:text-white"
                  />
                </Field>
              ) : null}
            </div>
          ) : null}

          {tab === 'visibility' ? (
            <div className="space-y-4">
              {isOwner ? (
                <>
                  <Field label="Visibility">
                    <div className="space-y-2">
                      {EOF_VISIBILITY_OPTIONS.map((v) => (
                        <label
                          key={v.id}
                          className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
                            visibility === v.id ? 'border-[#3ea6ff] bg-[#1a2a3a]' : 'border-[#303030]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="vis"
                            checked={visibility === v.id}
                            onChange={() => setVisibility(v.id)}
                            className="mt-1"
                          />
                          <span>
                            <span className="font-semibold text-white">{v.label}</span>
                            <span className={`block text-xs ${EOF.muted}`}>{v.hint}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label="Schedule publish (optional)">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </>
              ) : (
                <p className={`text-sm ${EOF.muted}`}>
                  Editor uploads are always <strong className="text-white">private</strong> until the channel owner
                  approves.
                </p>
              )}
            </div>
          ) : null}

          {tab === 'advanced' ? (
            <div className="space-y-4">
              <Toggle
                label="Allow embedding"
                hint="Let others embed this video on websites"
                checked={embeddable}
                onChange={setEmbeddable}
              />
              <Toggle
                label="Show public view count"
                hint="Display view count on watch page"
                checked={publicStatsViewable}
                onChange={setPublicStatsViewable}
              />
              <Toggle
                label="Made for kids"
                hint="Default: No — required for COPPA compliance"
                checked={madeForKids}
                onChange={setMadeForKids}
              />
              <Toggle
                label="Altered or synthetic content (AI)"
                hint="Disclose AI-generated or significantly altered content"
                checked={containsSyntheticMedia}
                onChange={setContainsSyntheticMedia}
              />
              <Toggle
                label="Paid promotion / sponsorship"
                hint="Video includes paid product placement or sponsorship"
                checked={paidPromotion}
                onChange={setPaidPromotion}
              />
              <Field label="Related video ID (optional)">
                <input
                  value={relatedVideoId}
                  onChange={(e) => setRelatedVideoId(e.target.value)}
                  placeholder="YouTube video ID to reference in description"
                  className={inputCls}
                />
                <p className={`mt-1 text-[10px] ${EOF.muted}`}>
                  Appended to description as a link. End screens/cards are set in YouTube Studio.
                </p>
              </Field>
            </div>
          ) : null}

          {tab === 'checks' ? (
            <div className="space-y-3 text-sm">
              <p className={EOF.muted}>
                After upload, YouTube runs copyright and community guidelines checks. Results appear here and on each
                video in the queue.
              </p>
              {lastChecks ? (
                <>
                  <CheckRow label="Processing" status={lastChecks.processingStatus} />
                  <CheckRow label="Copyright" status={lastChecks.copyright?.status} issues={lastChecks.copyright?.issues} />
                  <CheckRow
                    label="Community guidelines"
                    status={lastChecks.guidelines?.status}
                    issues={lastChecks.guidelines?.issues}
                  />
                </>
              ) : (
                <p className="text-xs text-[#717171]">Upload a video to run checks.</p>
              )}
            </div>
          ) : null}

          {formErr ? <p className="mt-4 text-sm text-[#ff4e45]">{formErr}</p> : null}
          {progress ? <p className="mt-2 text-sm text-[#3ea6ff]">{progress}</p> : null}

          <button
            type="submit"
            disabled={busy || !file}
            className={`mt-6 rounded-full px-6 py-2 text-sm ${EOF.btnPrimary} disabled:opacity-50`}
          >
            {busy ? 'Uploading…' : isOwner ? 'Upload' : 'Submit for review'}
          </button>
        </div>

        <div className="bg-[#0f0f0f] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#717171]">Preview</p>
          <div
            className={`overflow-hidden rounded-lg bg-black ${
              detectedFormat.isShort || videoContentType === 'short' ? 'mx-auto aspect-[9/16] max-w-[200px]' : 'aspect-video'
            }`}
          >
            {previewUrl ? (
              <video
                ref={videoRef}
                src={previewUrl}
                controls
                className="h-full w-full object-contain"
                onLoadedMetadata={onVideoMeta}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[#555]">Select a video</div>
            )}
          </div>
          {thumbnailFile ? (
            <img
              src={URL.createObjectURL(thumbnailFile)}
              alt="Thumbnail"
              className="mt-2 aspect-video w-full rounded border border-[#303030] object-cover"
            />
          ) : null}
        </div>
      </div>
    </form>
  )
}

const inputCls = `mt-1 w-full rounded-lg border px-3 py-2 text-sm ${EOF.input}`

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-[#aaaaaa]">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg border border-[#303030] p-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
      <span>
        <span className="font-medium text-white">{label}</span>
        <span className={`block text-xs ${EOF.muted}`}>{hint}</span>
      </span>
    </label>
  )
}

function CheckRow({ label, status, issues = [] }) {
  const color =
    status === 'clear'
      ? 'text-[#2ba640]'
      : status === 'issues'
        ? 'text-[#ff4e45]'
        : status === 'checking'
          ? 'text-[#3ea6ff]'
          : 'text-[#aaa]'
  return (
    <div className="rounded-lg border border-[#303030] p-3">
      <div className="flex justify-between">
        <span className="text-white">{label}</span>
        <span className={`text-xs font-semibold capitalize ${color}`}>{status || '—'}</span>
      </div>
      {issues?.length ? (
        <ul className="mt-2 list-inside list-disc text-xs text-[#ff4e45]">
          {issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
