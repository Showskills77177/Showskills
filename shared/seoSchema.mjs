/**
 * Small JSON-LD structured-data builders for ShowSkills' free quiz + giveaway pages.
 * Deliberately does NOT include any raffle/lottery/Event-style "prize draw" schema per the
 * site's SEO positioning (skill quiz + giveaway, not a lottery).
 */

import { SHOWSKILLS_ORGANIZATION_NAME, SHOWSKILLS_SITE_URL } from './sitePositioning.mjs'
import { SHOWSKILLS_CONTACT_EMAIL } from './siteContact.mjs'

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SHOWSKILLS_ORGANIZATION_NAME,
    url: SHOWSKILLS_SITE_URL,
    email: SHOWSKILLS_CONTACT_EMAIL,
    description:
      'ShowSkills is a free UK football quiz site. Players answer difficult football questions to qualify for free giveaways. Not affiliated with FIFA, any club, or any player.',
  }
}

/**
 * @param {{ id: string, question: string, answer: string }[]} items
 */
export function buildFaqPageJsonLd(items) {
  const list = Array.isArray(items) ? items.filter((item) => item?.question && item?.answer) : []
  if (!list.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: list.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

/**
 * @param {{ name: string, description: string, url: string, questionCount?: number }} options
 */
export function buildQuizJsonLd({ name, description, url, questionCount }) {
  if (!name || !url) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name,
    description,
    url: url.startsWith('http') ? url : `${SHOWSKILLS_SITE_URL}${url}`,
    ...(questionCount ? { numberOfQuestions: questionCount } : {}),
    isAccessibleForFree: true,
    provider: {
      '@type': 'Organization',
      name: SHOWSKILLS_ORGANIZATION_NAME,
      url: SHOWSKILLS_SITE_URL,
    },
  }
}
