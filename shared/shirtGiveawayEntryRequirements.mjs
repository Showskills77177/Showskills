/** Mandatory steps for the free Ronaldo shirt giveaway entry flow. */

import { SHIRT_GIVEAWAY_SEASON_LABEL } from './shirtGiveaway.mjs'
import { RONALDO_SHIRT_QUIZ_QUESTION_COUNT } from './ronaldoShirtQuiz.mjs'

export const SHIRT_GIVEAWAY_SOCIAL_PLATFORMS = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
]

export const SHIRT_GIVEAWAY_ENTRY_REQUIREMENTS = [
  {
    id: 'skill_quiz',
    title: `Pass the ${RONALDO_SHIRT_QUIZ_QUESTION_COUNT}-question skill quiz`,
    detail: 'Answer the timed quiz — up to 2 mistakes and 2 time-outs are tolerated, each with a bonus chance.',
  },
  {
    id: 'newsletter',
    title: 'Subscribe to our newsletter',
    detail: 'Tick the box below using the same email address you enter on this form.',
  },
  {
    id: 'social_follow',
    title: 'Follow us on social media',
    detail:
      'Pick TikTok, Instagram, or Facebook, open our profile in a new tab to follow us, enter your handle here, then tick to confirm.',
  },
]

/** Public-facing step list — shirt giveaway card and dedicated archive page. */
export const SHIRT_GIVEAWAY_PUBLIC_STEPS = [
  {
    num: '1',
    title: `Pass the ${RONALDO_SHIRT_QUIZ_QUESTION_COUNT}-question skill quiz`,
    detail: 'A timed football skill quiz. Up to 2 mistakes and 2 time-outs are tolerated, each with a bonus chance to make up for it.',
  },
  {
    num: '2',
    title: 'Enter your details',
    detail: 'Full name, email address, and UK mobile number in the giveaway form.',
  },
  {
    num: '3',
    title: 'Subscribe to our newsletter',
    detail: 'Required for every free shirt entry — tick the box with the same email you enter.',
  },
  {
    num: '4',
    title: 'Follow us on social media',
    detail:
      'Pick one network, open our profile in a new tab to follow ShowSkills, return here, enter your username, and tick to confirm.',
  },
  {
    num: '5',
    title: 'Agree to the terms and submit',
    detail: `One entry per device; VPNs and proxies are not allowed. Prize: signed Ronaldo United shirt (${SHIRT_GIVEAWAY_SEASON_LABEL}) — not the Signed Legacy Bundle.`,
  },
  {
    num: '6',
    title: 'We verify eligible entries',
    detail: 'Correct submissions with verified newsletter and social follow go into the random draw. No payment or video upload.',
  },
]

/** Short step titles for the competitions page shirt card — full detail on the archive page. */
export const SHIRT_GIVEAWAY_CARD_STEP_TITLES = SHIRT_GIVEAWAY_PUBLIC_STEPS.slice(0, 5).map((step) => step.title)

export function isValidShirtSocialPlatform(platform) {
  const id = typeof platform === 'string' ? platform.trim().toLowerCase() : ''
  return SHIRT_GIVEAWAY_SOCIAL_PLATFORMS.some((p) => p.id === id)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isShirtGiveawayRequirementMet(reqId, fields = {}) {
  switch (reqId) {
    case 'skill_quiz':
      return Boolean(fields.quizPassed)
    case 'newsletter':
      return (
        fields.newsletterOptIn === true &&
        typeof fields.email === 'string' &&
        EMAIL_RE.test(fields.email.trim())
      )
    case 'social_follow':
      return (
        isValidShirtSocialPlatform(fields.socialPlatform) &&
        typeof fields.socialHandle === 'string' &&
        fields.socialHandle.trim() &&
        fields.socialFollowConfirmed === true
      )
    default:
      return false
  }
}
