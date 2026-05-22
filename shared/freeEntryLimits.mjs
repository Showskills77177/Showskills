/** Anti-abuse limits for free competition entry routes. */

export const COMPETITION_LEGACY_BUNDLE = 'ronaldo_legacy_bundle'
export const COMPETITION_SHIRT_GIVEAWAY = 'ronaldo_shirt_giveaway'

/** Max successful free online Legacy entries per normalised name + address. */
export const MAX_FREE_LEGACY_PER_NAME_ADDRESS = 3

/** Max Stripe card verifications (Setup Intents completed) per IP for Legacy free online. */
export const MAX_CARD_VERIFICATIONS_PER_IP_LEGACY = 3

/** Shirt giveaway: one entry per name + email + IP combination. */
export const MAX_SHIRT_PER_NAME_EMAIL_IP = 1

/** Shirt giveaway: one attempt block per device/IP (any email or name). */
export const MAX_SHIRT_PER_DEVICE = 1

export function normalizePersonName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function normalizePostcode(postcode) {
  return String(postcode || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim()
}

/**
 * Stable key for duplicate detection (name + address lines + city + postcode).
 */
export function buildNameAddressKey({ fullName, addressLine1, addressLine2, city, postcode }) {
  const parts = [
    normalizePersonName(fullName),
    normalizePersonName(addressLine1),
    normalizePersonName(addressLine2),
    normalizePersonName(city),
    normalizePostcode(postcode),
  ].filter(Boolean)
  return parts.join('|')
}

export function buildShirtIdentityKey({ fullName, email, ip }) {
  return [
    normalizePersonName(fullName),
    String(email || '')
      .trim()
      .toLowerCase(),
    String(ip || '').trim(),
  ].join('|')
}

export const FREE_ENTRY_ERRORS = {
  nameAddressLimit:
    'You have already used the maximum number of free online entries for this name and address (3).',
  ipVerificationLimit:
    'Too many card verifications from this connection. Please try again later or contact us.',
  shirtDuplicate:
    'You have already entered with these details. Only one shirt giveaway entry per name, email, and device.',
  shirtDeviceUsed:
    'This device has already been used to enter the shirt giveaway. Only one entry per device is allowed, even with a different email.',
  vpnNotAllowed: "We don't allow VPNs. Please turn off your VPN and try again.",
  invalidAddress: 'Please enter your full postal address (line 1, town/city, and postcode).',
  setupRequired: 'Card verification is required to complete your free entry (no charge).',
}
