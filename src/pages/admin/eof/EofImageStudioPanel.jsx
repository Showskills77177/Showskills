import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../../lib/api'
import { EOF } from './eofStudioTheme'

const inputCls = `mt-1 w-full rounded-lg border px-3 py-2 text-sm ${EOF.input}`
const MAX_HISTORY = 12

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

/**
 * Ad-hoc xAI (Grok Imagine) image generator — a free-form "chat prompt" tool for thumbnails
 * or any other one-off image work, decoupled from any production job/scene.
 */
export default function EofImageStudioPanel() {
  const [configured, setConfigured] = useState(true)
  const [aspectRatios, setAspectRatios] = useState(Object.keys(ASPECT_LABELS))
  const [costNote, setCostNote] = useState('')
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [history, setHistory] = useState([])
  const [refImageDataUrl, setRefImageDataUrl] = useState('')
  const [refImageName, setRefImageName] = useState('')
  const [docText, setDocText] = useState('')
  const [docName, setDocName] = useState('')
  const [attachErr, setAttachErr] = useState('')

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/eof-image-studio')
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not load Image Studio status')
      setConfigured(Boolean(j.configured))
      if (Array.isArray(j.aspectRatios) && j.aspectRatios.length) setAspectRatios(j.aspectRatios)
      if (typeof j.costNote === 'string') setCostNote(j.costNote)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const onPickRefImage = useCallback(async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAttachErr('')
    try {
      const dataUrl = await readReferenceImageFile(file)
      setRefImageDataUrl(dataUrl)
      setRefImageName(file.name)
    } catch (err) {
      setAttachErr(err instanceof Error ? err.message : 'Could not read the image file.')
    }
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
            referenceImage: refImageDataUrl || undefined,
            documentText: docText || undefined,
          }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Image generation failed')
        setHistory((prev) =>
          [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              prompt: j.prompt || trimmed,
              userPrompt: j.userPrompt || trimmed,
              aspectRatio: j.aspectRatio || aspectRatio,
              mime: j.mime || 'image/jpeg',
              imageBase64: j.imageBase64,
              createdAt: j.createdAt || new Date().toISOString(),
              referenceImageUsed: Boolean(j.referenceImageUsed),
              referenceDescription: j.referenceDescription || '',
              referenceImageWarning: j.referenceImageWarning || '',
              documentExcerptUsed: Boolean(j.documentExcerptUsed),
            },
            ...prev,
          ].slice(0, MAX_HISTORY),
        )
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Error')
      } finally {
        setBusy(false)
      }
    },
    [prompt, aspectRatio, busy, refImageDataUrl, docText],
  )

  return (
    <section className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-5`}>
      <h2 className="text-base font-semibold text-white">Image Studio</h2>
      <p className={`mt-1 text-xs ${EOF.muted}`}>
        Free-form xAI (Grok Imagine) prompt — generate thumbnails or any other one-off image, not tied to a
        production job. {costNote ? <span>{costNote}.</span> : null}
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
            image-to-image, so a reference photo is described by Grok vision and used as style/subject guidance only.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <label className="flex flex-col text-xs text-[#aaa]">
              Reference image (optional)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onPickRefImage}
                className="mt-1 text-[11px] text-[#ccc]"
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
          {refImageDataUrl ? (
            <div className="mt-2 flex items-center gap-2">
              <img src={refImageDataUrl} alt="Reference preview" className="h-12 w-12 rounded object-cover" />
              <span className="text-[11px] text-[#ccc]">{refImageName}</span>
              <button
                type="button"
                onClick={() => {
                  setRefImageDataUrl('')
                  setRefImageName('')
                }}
                className={`text-[11px] ${EOF.link}`}
              >
                Remove
              </button>
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
        {history.length === 0 ? (
          <p className={`text-sm ${EOF.muted}`}>No generations yet this session — try a prompt above.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((item) => (
              <li key={item.id} className="rounded-lg border border-[#303030] p-2">
                <img
                  src={`data:${item.mime};base64,${item.imageBase64}`}
                  alt={item.prompt}
                  className="w-full rounded object-cover"
                />
                <p className="mt-2 line-clamp-3 text-[11px] text-[#ccc]">{item.userPrompt || item.prompt}</p>
                {item.referenceImageUsed ? (
                  <p className="mt-1 line-clamp-2 text-[10px] text-[#8fb8ff]" title={item.referenceDescription}>
                    Reference seen as: {item.referenceDescription}
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
                  <a
                    href={`data:${item.mime};base64,${item.imageBase64}`}
                    download={`eof-image-studio-${item.id}.jpg`}
                    className={`text-[11px] ${EOF.link}`}
                  >
                    Download
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
