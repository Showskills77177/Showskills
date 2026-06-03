/** Mandatory steps for the free Ronaldo shirt giveaway entry flow. */

import {
  isCorrectShirtGiveawayAnswer,
  SHIRT_GIVEAWAY_QUESTION,
  SHIRT_GIVEAWAY_SEASON_LABEL,
} from './shirtGiveaway.mjs'

export const SHIRT_GIVEAWAY_SOCIAL_PLATFORMS = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
]

export const SHIRT_GIVEAWAY_ENTRY_REQUIREMENTS = [
  {
    id: 'skill_answer',
    title: 'Answer the skill question correctly',
    detail: `${SHIRT_GIVEAWAY_QUESTION} Ronaldo R9 or Cristiano Ronaldo qualifies you.`,
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
      'Follow ShowSkills on TikTok, Instagram, or Facebook (pick one), enter your username on that network, and confirm you have followed us.',
  },
]

/** Public-facing step list — shirt giveaway card and dedicated archive page. */
export const SHIRT_GIVEAWAY_PUBLIC_STEPS = [
  {
    num: '1',
    title: 'Answer the skill question correctly',
    detail: `${SHIRT_GIVEAWAY_QUESTION} Wrong answers cannot be submitted.`,
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
      'Follow ShowSkills on TikTok, Instagram, or Facebook (at least one). Enter your username on that network and confirm you have followed us.',
  },
  {
    num: '5',
    title: 'Agree to the terms and submit',
    detail: `One entry per device; VPNs and proxies are not allowed. Prize: signed Ronaldo United shirt (${SHIRT_GIVEAWAY_SEASON_LABEL}) — not the Legacy Bundle.`,
  },
  {
    num: '6',
    title: 'We verify eligible entries',
    detail: 'Correct submissions with verified newsletter and social follow go into the random draw. No payment or video upload.',
  },
]

export function isValidShirtSocialPlatform(platform) {
  const id = typeof platform === 'string' ? platform.trim().toLowerCase() : ''
  return SHIRT_GIVEAWAY_SOCIAL_PLATFORMS.some((p) => p.id === id)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isShirtGiveawayRequirementMet(reqId, fields = {}) {
  switch (reqId) {
    case 'skill_answer':
      return isCorrectShirtGiveawayAnswer(fields.answer)
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
