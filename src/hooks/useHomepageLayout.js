import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import {
  getCachedHomepageLayout,
  layoutUpdateAffectsPage,
  setCachedHomepageLayout,
} from '../lib/publicDataCache.js'
import { defaultHomepageLayout, mergeHomepageLayout } from '../../shared/homepageLayout.mjs'
import { usePageEditorDraftPages } from '../pageEditor/PageEditorPreviewContext.jsx'

function fetchHomepageLayout() {
  return apiFetch('/api/homepage-layout').then(async (res) => {
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || 'Could not load homepage layout')
    return { layout: mergeHomepageLayout(j.layout), source: j.source || 'unknown' }
  })
}

export function useHomepageLayout() {
  const draftPages = usePageEditorDraftPages()
  const [layout, setLayout] = useState(() => getCachedHomepageLayout() ?? defaultHomepageLayout())
  const [loading, setLoading] = useState(() => !getCachedHomepageLayout() && !draftPages?.homepage)
  const [source, setSource] = useState('')

  useEffect(() => {
    if (draftPages?.homepage) {
      setLayout(mergeHomepageLayout(draftPages.homepage))
      setLoading(false)
      setSource('editor-draft')
      return
    }

    let cancelled = false

    function loadFromApi() {
      setLoading(true)
      return fetchHomepageLayout()
        .then(({ layout: merged, source: src }) => {
          if (!cancelled) {
            setCachedHomepageLayout(merged)
            setLayout(merged)
            setSource(src)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLayout(defaultHomepageLayout())
            setSource('defaults')
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }

    loadFromApi()

    function onLayoutUpdated(e) {
      if (layoutUpdateAffectsPage(e.detail?.pageId, 'homepage')) loadFromApi()
    }
    window.addEventListener('ss-layout-updated', onLayoutUpdated)
    return () => {
      cancelled = true
      window.removeEventListener('ss-layout-updated', onLayoutUpdated)
    }
  }, [draftPages?.homepage])

  if (draftPages?.homepage) {
    return { layout: mergeHomepageLayout(draftPages.homepage), loading: false, source: 'editor-draft' }
  }

  return { layout, loading, source }
}
