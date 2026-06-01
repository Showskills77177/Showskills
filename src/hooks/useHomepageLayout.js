import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { defaultHomepageLayout, mergeHomepageLayout } from '../../shared/homepageLayout.mjs'
import { usePageEditorDraftPages } from '../pageEditor/PageEditorPreviewContext.jsx'

export function useHomepageLayout() {
  const draftPages = usePageEditorDraftPages()
  const [layout, setLayout] = useState(defaultHomepageLayout())
  const [loading, setLoading] = useState(!draftPages?.homepage)

  useEffect(() => {
    if (draftPages?.homepage) {
      setLayout(mergeHomepageLayout(draftPages.homepage))
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    apiFetch('/api/homepage-layout')
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!cancelled) setLayout(mergeHomepageLayout(j.layout))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [draftPages?.homepage])

  if (draftPages?.homepage) {
    return { layout: mergeHomepageLayout(draftPages.homepage), loading: false }
  }

  return { layout, loading }
}
