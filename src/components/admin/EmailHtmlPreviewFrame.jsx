import { useCallback, useEffect, useRef, useState } from 'react'
import { useAdminThemeOptional } from '../../admin/AdminThemeContext'
import { DEFAULT_ADMIN_THEME_ID, getAdminTheme } from '../../admin/adminThemes.mjs'

/**
 * Renders full HTML emails in admin preview. `srcDoc` + empty sandbox often shows a blank
 * green panel in Chrome/Safari; a blob URL iframe renders the same HTML clients receive.
 */
export function EmailHtmlPreviewFrame({ html, title = 'Email HTML preview' }) {
  const ctx = useAdminThemeOptional()
  const theme = ctx?.theme ?? getAdminTheme(DEFAULT_ADMIN_THEME_ID)
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
    <div className={theme.emailPreviewChrome}>
      <div className={theme.emailPreviewToolbar}>
        <span className={theme.emailPreviewToolbarText}>
          Rendered like a real inbox (links open in a new tab)
        </span>
        {blobUrl ? (
          <a
            href={blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={theme.emailPreviewToolbarLink}
          >
            Open full preview
          </a>
        ) : null}
      </div>
      <div className="ss-admin-email-preview-canvas bg-[#0c1a16]">
        <iframe
          ref={iframeRef}
          title={title}
          src={blobUrl || 'about:blank'}
          onLoad={resizeFrame}
          className="block w-full min-h-[520px] border-0 bg-[#0c1a16]"
        />
      </div>
    </div>
  )
}
