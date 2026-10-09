import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../../lib/api'
import { EOF } from './eofStudioTheme'

const inputCls = `mt-1 w-full rounded-lg border px-3 py-2 text-sm ${EOF.input}`
const MAX_REF_IMAGES = 5

const ASPECT_LABELS = {
  '16:9': '16:9 — thumbnail / widescreen',
  '9:16': '9:16 — Shorts / vertical',
  '1:1': '1:1 — square',
  '4:5': '4:5 — portrait post',
  '3:2': '3:2 — classic photo',
}

const REFERENCE_IMAGE_MAX_DIM = 1280
const TEXT_DOCUMENT_RE = /\.(txt|md|markdown|csv|json)$/i

/** Downscale + re-encode as JPEG in the browser so the data URL stays well under the request-size limit. */
function readReferenceImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the image file.'))
    reader.onload = () => {
      img.onerror = () => reject(new Error('Could not decode the image file.'))
      img.onload = () => {
        const scale = Math.min(1, REFERENCE_IMAGE_MAX_DIM / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function readDocumentTextFile(file) {
  return new Promise((resolve, reject) => {
    if (!TEXT_DOCUMENT_RE.test(file.name)) {
      reject(new Error('Unsupported document type — upload .txt, .md, .csv, or .json (PDF/Word aren\'t supported yet).'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the document file.'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsText(file)
  })
}

/** Full-size image viewer — click any generated or reference thumbnail to open. */
function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!src) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white hover:bg-black/80"
        aria-label="Close"
      >
        ✕ Close
      </button>
      <img
        src={src}
        alt={alt || 'Full size preview'}
        className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

/**
 * Ad-hoc xAI (Grok Imagine) image generator — a free-form "chat prompt" tool for thumbnails
 * or any other one-off image work, decoupled from any production job/scene. Generations are
 * saved server-side per logged-in user and stay in history until explicitly deleted.
 */
export default function EofImageStudioPanel() {
  const [configured, setConfigured] = useState(true)
  const [aspectRatios, setAspectRatios] = useState(Object.keys(ASPECT_LABELS))
  const [costNote, setCostNote] = useState('')
  const [maxRefImages, setMaxRefImages] = useState(MAX_REF_IMAGES)
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [deletingId, setDeletingId] = useState('')
  const [refImages, setRefImages] = useState([]) // [{ dataUrl, name }]
  const [docText, setDocText] = useState('')
  const [docName, setDocName] = useState('')
  const [attachErr, setAttachErr] = useState('')
  const [lightbox, setLightbox] = useState(null) // { src, alt }
  const loadedOnce = useRef(false)

  const openLightbox = useCallback((src, alt) => setLightbox({ src, alt }), [])
  const closeLightbox = useCallback(() => setLightbox(null), [])

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/eof-image-studio')
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not load Image Studio status')
      setConfigured(Boolean(j.configured))
      if (Array.isArray(j.aspectRatios) && j.aspectRatios.length) setAspectRatios(j.aspectRatios)
      if (typeof j.costNote === 'string') setCostNote(j.costNote)
      if (Number.isFinite(j.maxReferenceImages) && j.maxReferenceImages > 0) setMaxRefImages(j.maxReferenceImages)
      if (Array.isArray(j.history)) setHistory(j.history)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loadedOnce.current) return
    loadedOnce.current = true
    loadStatus()
  }, [loadStatus])

  const onPickRefImages = useCallback(
    async (e) => {
      const files = Array.from(e.target.files || [])
      e.target.value = ''
      if (!files.length) return
      setAttachErr('')
      const room = maxRefImages - refImages.length
      if (room <= 0) {
        setAttachErr(`You can attach up to ${maxRefImages} reference images — remove one first.`)
        return
      }
      const toRead = files.slice(0, room)
      if (files.length > room) {
        setAttachErr(`Only attached ${toRead.length} of ${files.length} — up to ${maxRefImages} reference images total.`)
      }
      for (const file of toRead) {
        try {
          const dataUrl = await readReferenceImageFile(file)
          setRefImages((prev) => (prev.length >= maxRefImages ? prev : [...prev, { dataUrl, name: file.name }]))
        } catch (err) {
          setAttachErr(err instanceof Error ? err.message : 'Could not read the image file.')
        }
      }
    },
    [maxRefImages, refImages.length],
  )

  const removeRefImage = useCallback((index) => {
    setRefImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const onPickDocument = useCallback(async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAttachErr('')
    try {
      const text = await readDocumentTextFile(file)
      setDocText(text)
      setDocName(file.name)
    } catch (err) {
      setAttachErr(err instanceof Error ? err.message : 'Could not read the document file.')
    }
  }, [])

  const generate = useCallback(
    async (e) => {
      e.preventDefault()
      const trimmed = prompt.trim()
      if (!trimmed || busy) return
      setBusy(true)
      setErr('')
      try {
        const res = await apiFetch('/api/admin/eof-image-studio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: trimmed,
            aspectRatio,
            referenceImages: refImages.length ? refImages.map((r) => r.dataUrl) : undefined,
            documentText: docText || undefined,
          }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Image generation failed')
        setHistory((prev) => [
          {
            id: j.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            prompt: j.prompt || trimmed,
            userPrompt: j.userPrompt || trimmed,
            aspectRatio: j.aspectRatio || aspectRatio,
            mime: j.mime || 'image/jpeg',
            imageBase64: j.imageBase64,
            createdAt: j.createdAt || new Date().toISOString(),
            referenceImageUsed: Boolean(j.referenceImageUsed),
            referenceImageCount: j.referenceImageCount || 0,
            referenceDescription: j.referenceDescription || '',
            referenceImageWarning: j.referenceImageWarning || '',
            documentExcerptUsed: Boolean(j.documentExcerptUsed),
          },
          ...prev,
        ])
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Error')
      } finally {
        setBusy(false)
      }
    },
    [prompt, aspectRatio, busy, refImages, docText],
  )

  const deleteHistoryItem = useCallback(
    async (id) => {
      if (!id || deletingId) return
      setDeletingId(id)
      try {
        const res = await apiFetch(`/api/admin/eof-image-studio?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
        if (!res.ok && res.status !== 404) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || 'Could not delete image')
        }
        setHistory((prev) => prev.filter((item) => item.id !== id))
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Error')
      } finally {
        setDeletingId('')
      }
    },
    [deletingId],
  )

  return (
    <section className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-5`}>
      <h2 className="text-base font-semibold text-white">Image Studio</h2>
      <p className={`mt-1 text-xs ${EOF.muted}`}>
        Free-form xAI (Grok Imagine) prompt — generate thumbnails or any other one-off image, not tied to a
        production job. Your generations are saved to your history until you delete them.{' '}
        {costNote ? <span>{costNote}.</span> : null}
      </p>

      {!configured ? (
        <p className="mt-3 rounded-lg border border-[#ff4e45]/40 bg-[#ff4e45]/10 px-3 py-2 text-xs text-[#ff8f88]">
          XAI_API_KEY is not configured on the server — set it to enable image generation.
        </p>
      ) : null}

      {err ? <p className="mt-3 text-sm text-[#ff4e45]">{err}</p> : null}

      <form onSubmit={generate} className="mt-4 space-y-3">
        <label className="block text-xs text-[#aaa]">
          Prompt
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className={`${inputCls} min-h-[84px] resize-y`}
            placeholder='e.g. "Bold YouTube thumbnail: Arsenal vs Brighton, dramatic stadium lights, big bold score text"'
            maxLength={2000}
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-xs text-[#aaa]">
            Aspect ratio
            <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className={inputCls}>
              {aspectRatios.map((ar) => (
                <option key={ar} value={ar}>
                  {ASPECT_LABELS[ar] || ar}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || !prompt.trim() || !configured}
            className={`rounded-full px-4 py-2 text-sm ${EOF.btnPrimary} disabled:opacity-50`}
          >
            {busy ? 'Generating…' : 'Generate image'}
          </button>
        </div>

        <div className="rounded-lg border border-[#303030] p-3">
          <p className={`text-[11px] ${EOF.muted}`}>
            Optional attachments — folded into the prompt as extra context. xAI can&apos;t do pixel-perfect
            image-to-image, so reference photos are described by Grok vision and used as style/subject guidance
            only.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <label className="flex flex-col text-xs text-[#aaa]">
              Reference images ({refImages.length}/{maxRefImages})
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={refImages.length >= maxRefImages}
                onChange={onPickRefImages}
                className="mt-1 text-[11px] text-[#ccc] disabled:opacity-40"
              />
            </label>
            <label className="flex flex-col text-xs text-[#aaa]">
              Document (optional, .txt/.md/.csv/.json)
              <input
                type="file"
                accept=".txt,.md,.markdown,.csv,.json"
                onChange={onPickDocument}
                className="mt-1 text-[11px] text-[#ccc]"
              />
            </label>
          </div>
          {attachErr ? <p className="mt-2 text-[11px] text-[#ff8f88]">{attachErr}</p> : null}
          {refImages.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {refImages.map((img, i) => (
                <div key={`${img.name}-${i}`} className="flex items-center gap-1.5 rounded border border-[#303030] p-1">
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    onClick={() => openLightbox(img.dataUrl, img.name)}
                    className="h-12 w-12 cursor-zoom-in rounded object-cover"
                    title="Click to view full size"
                  />
                  <span className="max-w-[90px] truncate text-[11px] text-[#ccc]" title={img.name}>
                    {img.name}
                  </span>
                  <button type="button" onClick={() => removeRefImage(i)} className={`text-[11px] ${EOF.link}`}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {docText ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-[#ccc]">
                {docName} ({docText.length.toLocaleString()} chars)
              </span>
              <button
                type="button"
                onClick={() => {
                  setDocText('')
                  setDocName('')
                }}
                className={`text-[11px] ${EOF.link}`}
              >
                Remove
              </button>
            </div>
          ) : null}
        </div>
      </form>

      <div className="mt-6 border-t border-[#303030] pt-4">
        {historyLoading ? (
          <p className={`text-sm ${EOF.muted}`}>Loading your saved history…</p>
        ) : history.length === 0 ? (
          <p className={`text-sm ${EOF.muted}`}>No generations yet — try a prompt above.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((item) => {
              const src = `data:${item.mime};base64,${item.imageBase64}`
              return (
                <li key={item.id} className="rounded-lg border border-[#303030] p-2">
                  <img
                    src={src}
                    alt={item.prompt}
                    onClick={() => openLightbox(src, item.userPrompt || item.prompt)}
                    className="w-full cursor-zoom-in rounded object-cover"
                    title="Click to view full size"
                  />
                  <p className="mt-2 line-clamp-3 text-[11px] text-[#ccc]">{item.userPrompt || item.prompt}</p>
                  {item.referenceImageUsed ? (
                    <p className="mt-1 line-clamp-2 text-[10px] text-[#8fb8ff]" title={item.referenceDescription}>
                      {item.referenceImageCount > 1 ? `${item.referenceImageCount} references` : 'Reference'} seen
                      as: {item.referenceDescription}
                    </p>
                  ) : null}
                  {item.referenceImageWarning ? (
                    <p className="mt-1 text-[10px] text-[#ff8f88]">Reference image skipped: {item.referenceImageWarning}</p>
                  ) : null}
                  {item.documentExcerptUsed ? (
                    <p className="mt-1 text-[10px] text-[#717171]">Document context included.</p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-[#717171]">{item.aspectRatio}</span>
                    <div className="flex items-center gap-2">
                      <a href={src} download={`eof-image-studio-${item.id}.jpg`} className={`text-[11px] ${EOF.link}`}>
                        Download
                      </a>
                      <button
                        type="button"
                        onClick={() => deleteHistoryItem(item.id)}
                        disabled={deletingId === item.id}
                        className="text-[11px] text-[#ff8f88] hover:text-[#ff4e45] disabled:opacity-50"
                      >
                        {deletingId === item.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {lightbox ? <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={closeLightbox} /> : null}
    </section>
  )
}
