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
          body: JSON.stringify({ prompt: trimmed, aspectRatio }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Image generation failed')
        setHistory((prev) =>
          [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              prompt: j.prompt || trimmed,
              aspectRatio: j.aspectRatio || aspectRatio,
              mime: j.mime || 'image/jpeg',
              imageBase64: j.imageBase64,
              createdAt: j.createdAt || new Date().toISOString(),
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
    [prompt, aspectRatio, busy],
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
                <p className="mt-2 line-clamp-3 text-[11px] text-[#ccc]">{item.prompt}</p>
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
