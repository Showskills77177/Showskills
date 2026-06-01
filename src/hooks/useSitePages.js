import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import {
  defaultSiteShell,
  mergeSiteShell,
  defaultCompetitionsPageLayout,
  mergeCompetitionsPageLayout,
  defaultFaqPageLayout,
  mergeFaqPageLayout,
  defaultContactPageLayout,
  mergeContactPageLayout,
  defaultShirtGiveawayPageLayout,
  mergeShirtGiveawayPageLayout,
  SITE_SHELL_ID,
  COMPETITIONS_PAGE_ID,
  FAQ_PAGE_ID,
  CONTACT_PAGE_ID,
  SHIRT_GIVEAWAY_PAGE_ID,
} from '../../shared/sitePageLayout.mjs'
import { usePageEditorDraftPages } from '../pageEditor/PageEditorPreviewContext.jsx'

const PAGE_LOADERS = {
  [SITE_SHELL_ID]: () => mergeSiteShell(null),
  [COMPETITIONS_PAGE_ID]: () => mergeCompetitionsPageLayout(null),
  [FAQ_PAGE_ID]: () => mergeFaqPageLayout(null),
  [CONTACT_PAGE_ID]: () => mergeContactPageLayout(null),
  [SHIRT_GIVEAWAY_PAGE_ID]: () => mergeShirtGiveawayPageLayout(null),
}

const PAGE_MERGERS = {
  [SITE_SHELL_ID]: mergeSiteShell,
  [COMPETITIONS_PAGE_ID]: mergeCompetitionsPageLayout,
  [FAQ_PAGE_ID]: mergeFaqPageLayout,
  [CONTACT_PAGE_ID]: mergeContactPageLayout,
  [SHIRT_GIVEAWAY_PAGE_ID]: mergeShirtGiveawayPageLayout,
}

export function useSitePages() {
  const [pages, setPages] = useState(() => ({
    site: defaultSiteShell(),
    competitions: defaultCompetitionsPageLayout(),
    faq: defaultFaqPageLayout(),
    contact: defaultContactPageLayout(),
    shirt_giveaway: defaultShirtGiveawayPageLayout(),
  }))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/site-pages')
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (cancelled || !j.pages) return
        setPages({
          site: mergeSiteShell(j.pages.site),
          competitions: mergeCompetitionsPageLayout(j.pages.competitions),
          faq: mergeFaqPageLayout(j.pages.faq),
          contact: mergeContactPageLayout(j.pages.contact),
          shirt_giveaway: mergeShirtGiveawayPageLayout(j.pages.shirt_giveaway),
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { pages, loading }
}

export function usePageLayout(pageId) {
  const draftPages = usePageEditorDraftPages()
  const loader = PAGE_LOADERS[pageId]
  const merger = PAGE_MERGERS[pageId]
  const draftLayout = draftPages?.[pageId]
  const [layout, setLayout] = useState(() => (draftLayout && merger ? merger(draftLayout) : loader ? loader() : null))
  const [loading, setLoading] = useState(Boolean(pageId) && !draftLayout)

  useEffect(() => {
    if (draftLayout && merger) {
      setLayout(merger(draftLayout))
      setLoading(false)
      return
    }
    if (!pageId || !merger) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    apiFetch('/api/site-pages')
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (cancelled) return
        setLayout(merger(j.pages?.[pageId]))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pageId, merger, draftLayout])

  if (draftLayout && merger) {
    return { layout: merger(draftLayout), loading: false }
  }

  return { layout: layout ?? loader(), loading }
}

export function useSiteShell() {
  const draftPages = usePageEditorDraftPages()
  const { pages, loading } = useSitePages()
  if (draftPages?.site) {
    return { shell: mergeSiteShell(draftPages.site), loading: false }
  }
  return { shell: pages.site, loading }
}
