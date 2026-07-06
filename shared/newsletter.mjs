/** Newsletter preferences and copy shared by API + UI. */

export const NEWSLETTER_SOURCES = {
  footer: 'footer',
  page: 'newsletter_page',
  shirt_giveaway: 'shirt_giveaway',
  paid_competition: 'paid_competition',
  admin_import: 'admin_import',
  account_registration: 'account_registration',
  account_settings: 'account_settings',
}

export const DEFAULT_NEWSLETTER_PREFERENCES = {
  giveawayUpdates: true,
  competitionNews: true,
  promotions: false,
}

export function normalizeNewsletterPreferences(raw) {
  const base = { ...DEFAULT_NEWSLETTER_PREFERENCES }
  if (!raw || typeof raw !== 'object') return base
  return {
    giveawayUpdates: raw.giveawayUpdates !== false,
    competitionNews: raw.competitionNews !== false,
    promotions: raw.promotions === true,
  }
}
