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

/** FAQ answer — everything entrants must complete for the free shirt giveaway. */
export function buildShirtGiveawayFaqRequirementsAnswer() {
  const social = SHIRT_GIVEAWAY_SOCIAL_PLATFORMS.map((p) => p.label).join(', ')
  return (
    'To enter the free Ronaldo shirt giveaway you must complete all of the following in one submission on the entry form ' +
    '(open it from Competitions or the dedicated Ronaldo shirt giveaway page): ' +
    `(1) Answer the skill question correctly — "${SHIRT_GIVEAWAY_QUESTION}" ` +
    'Acceptable answers include Ronaldo R9 or Cristiano Ronaldo; wrong answers cannot be submitted. ' +
    '(2) Enter your full name, email address, and UK mobile number. ' +
    '(3) Subscribe to our newsletter — tick the required box using the same email you enter on the form. ' +
    `(4) Follow ShowSkills on at least one of ${social}. Select the network in the form, enter your username on that network, and tick to confirm you have followed us. ` +
    `(5) Agree to the promotion terms and submit. One entry per device; VPNs and proxies are not allowed. ` +
    `If everything is correct and we can verify your newsletter signup and social follow, you are entered into the random draw for the signed ${SHIRT_GIVEAWAY_SEASON_LABEL} Manchester United shirt only — not the Legacy Bundle. No payment or video upload is required.`
  )
}

/** FAQ answer — common reasons a shirt giveaway submission is rejected. */
export function buildShirtGiveawayFaqBlockedAnswer() {
  const social = SHIRT_GIVEAWAY_SOCIAL_PLATFORMS.map((p) => p.label).join(', ')
  return (
    'Common reasons: incorrect qualification answer; newsletter box not ticked or email does not match; ' +
    `social follow not confirmed or username missing (you must pick ${social} and confirm you followed us); ` +
    'you already entered on this device (one entry per device); duplicate name or email; ' +
    'VPN or proxy detected (turn off your VPN and try again). The site shows a short message when an entry is blocked.'
  )
}

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
