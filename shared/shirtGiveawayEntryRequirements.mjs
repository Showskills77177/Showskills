/** Mandatory steps for the free Ronaldo shirt giveaway entry flow. */

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
    id: 'account_sign_in',
    title: 'Sign in before you enter',
    detail: 'Use the same email for your ShowSkills account and your entry so we can verify you.',
  },
  {
    id: 'newsletter',
    title: 'Subscribe to our newsletter',
    detail: 'We use your entry email for ShowSkills updates and giveaway news.',
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
