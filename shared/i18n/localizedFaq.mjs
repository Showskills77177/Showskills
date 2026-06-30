import { FAQ_SECTIONS } from '../faqContent.mjs'
import { t as translate } from './translate.mjs'

/**
 * @param {string | null | undefined} locale
 * @param {(key: string, params?: Record<string, string | number>) => string} [tFn]
 */
export function getLocalizedFaqSections(locale, tFn) {
  const t = tFn || ((key, params) => translate(locale, key, params))
  return FAQ_SECTIONS.map((section) => ({
    ...section,
    title: t(`faq.section.${section.id}.title`),
    summary: t(`faq.section.${section.id}.summary`),
    items: section.items.map((item) => ({
      ...item,
      question: t(`faq.item.${item.id}.question`),
      answer: t(`faq.item.${item.id}.answer`),
    })),
  }))
}

/** @param {string | null | undefined} locale @param {(key: string) => string} [tFn] */
export function getLocalizedFaqPageTitle(locale, tFn) {
  const t = tFn || ((key) => translate(locale, key))
  return t('layout.faq.title') || t('faq.page.title')
}

/** @param {string | null | undefined} locale @param {(key: string) => string} [tFn] */
export function getLocalizedFaqPageSubtitle(locale, tFn) {
  const t = tFn || ((key) => translate(locale, key))
  return t('layout.faq.subtitle') || t('faq.page.subtitle')
}
