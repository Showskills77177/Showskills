/**
 * Classify marketing / referral traffic for admin analytics.
 * @param {{ utmSource?: string | null, utmMedium?: string | null, utmCampaign?: string | null, referrer?: string | null }} params
 */
export function resolveTrafficSource({ utmSource = '', utmMedium = '', referrer = '' } = {}) {
  const src = String(utmSource || '').trim().toLowerCase()
  const medium = String(utmMedium || '').trim().toLowerCase()
  const ref = String(referrer || '').trim().toLowerCase()

  if (src.includes('tiktok') || ref.includes('tiktok.com')) return 'TikTok'
  if (src.includes('instagram') || ref.includes('instagram.com')) return 'Instagram'
  if (src.includes('facebook') || src.includes('meta') || ref.includes('facebook.com') || ref.includes('fb.com')) {
    return 'Facebook'
  }
  if (src.includes('youtube') || ref.includes('youtube.com') || ref.includes('youtu.be')) return 'YouTube'
  if (src.includes('google') || medium === 'cpc' || medium === 'ppc' || ref.includes('google.')) return 'Google'
  if (
    src.includes('twitter') ||
    src === 'x' ||
    ref.includes('twitter.com') ||
    ref.includes('x.com') ||
    ref.includes('t.co')
  ) {
    return 'X / Twitter'
  }
  if (src.includes('snapchat') || ref.includes('snapchat.com')) return 'Snapchat'
  if (src.includes('trustpilot') || ref.includes('trustpilot.')) return 'Trustpilot'
  if (src) return src.charAt(0).toUpperCase() + src.slice(1)
  if (ref) {
    try {
      const host = new URL(ref).hostname.replace(/^www\./, '')
      if (host) return `Referral (${host})`
    } catch {
      /* ignore */
    }
    return 'Referral'
  }
  return 'Direct'
}

/** @param {string | null | undefined} code */
export function countryDisplayName(code) {
  const c = String(code || '').trim().toUpperCase()
  if (!c || c === 'XX') return 'Unknown'
  return COUNTRY_NAMES[c] || c
}

/** @type {Record<string, string>} */
const COUNTRY_NAMES = {
  GB: 'United Kingdom',
  IE: 'Ireland',
  US: 'United States',
  CA: 'Canada',
  AU: 'Australia',
  NZ: 'New Zealand',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  BE: 'Belgium',
  PT: 'Portugal',
  PL: 'Poland',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  AE: 'United Arab Emirates',
  IN: 'India',
  PK: 'Pakistan',
  NG: 'Nigeria',
  ZA: 'South Africa',
  BR: 'Brazil',
  MX: 'Mexico',
  RO: 'Romania',
  GR: 'Greece',
  AT: 'Austria',
  CH: 'Switzerland',
  CY: 'Cyprus',
  MT: 'Malta',
}
