import { COMPETITION_NAME_POSTAL } from './competitionCopy.mjs'

/** Entry routes available on a main prize draw (same UX as Ronaldo Legacy Bundle). */
export const ENTRY_METHOD = {
  paid: 'paid',
  freeOnline: 'free_online',
  postal: 'postal',
}

export function defaultEntryMethodsForNewCompetition(title = '') {
  return {
    allowPaidEntry: true,
    allowFreeOnline: true,
    allowPostalEntry: true,
    postalCompetitionName: defaultPostalName(title),
  }
}

/** Giveaways: free routes only (no ticket bundles). */
export function defaultEntryMethodsForNewGiveaway(title = '') {
  return {
    allowPaidEntry: false,
    allowFreeOnline: true,
    allowPostalEntry: true,
    postalCompetitionName: defaultPostalName(title),
  }
}

export function legacyEntryMethods() {
  return {
    allowPaidEntry: true,
    allowFreeOnline: true,
    allowPostalEntry: true,
    postalCompetitionName: COMPETITION_NAME_POSTAL,
  }
}

export function defaultPostalName(title) {
  const t = String(title || '').trim()
  if (!t) return ''
  return `${t} — ShowSkills Rewards`
}

export function normalizeEntryMethods(input, { title = '' } = {}) {
  const allowPaidEntry = input?.allowPaidEntry !== false && input?.allow_paid_entry !== false
  const allowFreeOnline =
    input?.allowFreeOnline === true ||
    input?.allow_free_online === true ||
    input?.allowFreeOnline === 1 ||
    input?.allow_free_online === 1
  const allowPostalEntry =
    input?.allowPostalEntry === true ||
    input?.allow_postal_entry === true ||
    input?.allowPostalEntry === 1 ||
    input?.allow_postal_entry === 1
  const postalCompetitionName =
    (typeof input?.postalCompetitionName === 'string' && input.postalCompetitionName.trim()) ||
    (typeof input?.postal_competition_name === 'string' && input.postal_competition_name.trim()) ||
    defaultPostalName(title)

  return {
    allowPaidEntry,
    allowFreeOnline,
    allowPostalEntry,
    postalCompetitionName,
  }
}

export function mapEntryMethodsFromDbRow(row, { title = '' } = {}) {
  if (!row) return defaultEntryMethodsForNewCompetition(title)
  const bool = (val, fallback = false) => {
    if (val === null || val === undefined) return fallback
    if (typeof val === 'boolean') return val
    return Boolean(Number(val))
  }
  return {
    allowPaidEntry: bool(row.allow_paid_entry, true),
    allowFreeOnline: bool(row.allow_free_online, false),
    allowPostalEntry: bool(row.allow_postal_entry, false),
    postalCompetitionName:
      (typeof row.postal_competition_name === 'string' && row.postal_competition_name.trim()) ||
      defaultPostalName(row.title || title),
  }
}

export function firstAvailableEntryRoute(methods) {
  if (methods.allowPaidEntry) return ENTRY_METHOD.paid
  if (methods.allowFreeOnline) return ENTRY_METHOD.freeOnline
  if (methods.allowPostalEntry) return ENTRY_METHOD.postal
  return ENTRY_METHOD.paid
}
