import { useEffect } from 'react'
import {
  isShowSkillsStagingClientEnabled,
  STAGING_SEARCH_ENGINE_BLOCK,
} from '../../shared/stagingSite.mjs'

function upsertMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/** Reinforces noindex on the unlisted staging test site (middleware + build inject the same). */
export function StagingSeoBlock() {
  useEffect(() => {
    if (!isShowSkillsStagingClientEnabled()) return undefined

    upsertMeta('robots', STAGING_SEARCH_ENGINE_BLOCK)
    upsertMeta('googlebot', STAGING_SEARCH_ENGINE_BLOCK)

    const existing = document.querySelector('link[rel="canonical"]')
    if (existing) existing.remove()

    return () => {
      document.querySelector('meta[name="robots"]')?.remove()
      document.querySelector('meta[name="googlebot"]')?.remove()
    }
  }, [])

  return null
}
