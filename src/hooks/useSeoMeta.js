import { useEffect } from 'react'
import { SHOWSKILLS_SITE_URL } from '../../shared/sitePositioning.mjs'

function setMetaTag(name, content, { property = false } = {}) {
  if (!content) return () => {}
  const attr = property ? 'property' : 'name'
  let el = document.head.querySelector(`meta[${attr}="${name}"]`)
  const existed = Boolean(el)
  const previousContent = el?.getAttribute('content') ?? null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
  return () => {
    if (!el) return
    if (!existed) {
      el.remove()
    } else if (previousContent !== null) {
      el.setAttribute('content', previousContent)
    }
  }
}

function setCanonicalLink(path) {
  if (!path) return () => {}
  let el = document.head.querySelector('link[rel="canonical"]')
  const existed = Boolean(el)
  const previousHref = el?.getAttribute('href') ?? null
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  const href = `${SHOWSKILLS_SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
  el.setAttribute('href', href)
  return () => {
    if (!el) return
    if (!existed) {
      el.remove()
    } else if (previousHref !== null) {
      el.setAttribute('href', previousHref)
    }
  }
}

/**
 * Sets the document title, meta description, and canonical link for the current page.
 * Restores the previous values on unmount so navigating between pages doesn't leak state.
 *
 * @param {{ title?: string, description?: string, path?: string }} options
 */
export function useSeoMeta({ title, description, path } = {}) {
  useEffect(() => {
    const previousTitle = document.title
    if (title) document.title = title

    const restoreDescription = description ? setMetaTag('description', description) : () => {}
    const restoreOgTitle = title ? setMetaTag('og:title', title, { property: true }) : () => {}
    const restoreOgDescription = description
      ? setMetaTag('og:description', description, { property: true })
      : () => {}
    const restoreCanonical = path ? setCanonicalLink(path) : () => {}

    return () => {
      document.title = previousTitle
      restoreDescription()
      restoreOgTitle()
      restoreOgDescription()
      restoreCanonical()
    }
  }, [title, description, path])
}
