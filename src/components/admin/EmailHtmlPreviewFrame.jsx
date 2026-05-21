import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Renders full HTML emails in admin preview. `srcDoc` + empty sandbox often shows a blank
 * green panel in Chrome/Safari; a blob URL iframe renders the same HTML clients receive.
 */
export function EmailHtmlPreviewFrame({ html, title = 'Email HTML preview' }) {
  const iframeRef = useRef(null)
  const [blobUrl, setBlobUrl] = useState('')

  useEffect(() => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [html])

  const resizeFrame = useCallback(() => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!iframe || !doc) return
    const height = Math.min(Math.max(doc.documentElement.scrollHeight, 520), 1400)
    iframe.style.height = `${height}px`
  }, [])

  useEffect(() => {
    if (!blobUrl) return
    const t = window.setTimeout(resizeFrame, 120)
    return () => window.clearTimeout(t)
  }, [blobUrl, html, resizeFrame])

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1a16]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/30 px-3 py-2">
        <span className="text-xs text-stone-500">Rendered like a real inbox (links open in a new tab)</span>
        {blobUrl ? (
          <a
            href={blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-teal-400 underline underline-offset-2 hover:text-teal-300"
          >
            Open full preview
          </a>
        ) : null}
      </div>
      <iframe
        ref={iframeRef}
        title={title}
        src={blobUrl || 'about:blank'}
        onLoad={resizeFrame}
        className="block w-full min-h-[520px] border-0 bg-[#0c1a16]"
      />
    </div>
  )
}
