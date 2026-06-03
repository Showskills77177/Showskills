/** Mandatory steps for the free Ronaldo shirt giveaway entry flow. */

import { isCorrectShirtGiveawayAnswer } from './shirtGiveaway.mjs'

export const SHIRT_GIVEAWAY_SOCIAL_PLATFORMS = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
]

export const SHIRT_GIVEAWAY_ENTRY_REQUIREMENTS = [
  {
    id: 'skill_answer',
    title: 'Answer the skill question correctly',
    detail: 'One Ronaldo qualification question — correct answer required.',
  },
  {
    id: 'newsletter',
    title: 'Subscribe to our newsletter',
    detail: 'Tick the box below using the same email address you enter on this form.',
  },
  {
    id: 'social_follow',
    title: 'Follow us on social media',
    detail: 'Follow ShowSkills on TikTok, Instagram, or Facebook (at least one).',
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
