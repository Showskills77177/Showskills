import { TICKET_BUNDLES } from '../ticketBundles.mjs'
import { t as translate } from './translate.mjs'

/**
 * @param {string | null | undefined} locale
 * @param {typeof TICKET_BUNDLES[number]} bundle
 * @param {(key: string) => string} [tFn]
 */
export function localizeTicketBundle(locale, bundle, tFn) {
  const t = tFn || ((key) => translate(locale, key))
  const id = bundle.id
  const bullets = (bundle.bullets || [])
    .map((_, i) => t(`bundles.${id}.bullet.${i}`))
    .filter(Boolean)
  return {
    ...bundle,
    title: t(`bundles.${id}.title`) || bundle.title,
    line1: t(`bundles.${id}.line1`) || bundle.line1,
    line2: bundle.line2 ? t(`bundles.${id}.line2`) || bundle.line2 : null,
    bullets: bullets.length ? bullets : bundle.bullets,
  }
}

/** @param {string | null | undefined} locale @param {(key: string) => string} [tFn] */
export function localizeTicketBundles(locale, tFn) {
  return TICKET_BUNDLES.map((bundle) => localizeTicketBundle(locale, bundle, tFn))
}
