import { query, dbIsPostgres } from './db.mjs'

let ensured = false

function emptyAddress() {
  return { line1: '', line2: '', city: '', postcode: '', country: '' }
}

export function parseUserAddress(raw) {
  if (!raw || typeof raw !== 'string') return emptyAddress()
  try {
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object') return emptyAddress()
    return {
      line1: String(o.line1 || '').slice(0, 120),
      line2: String(o.line2 || '').slice(0, 120),
      city: String(o.city || '').slice(0, 80),
      postcode: String(o.postcode || '').slice(0, 24),
      country: String(o.country || '').slice(0, 80),
    }
  } catch {
    return emptyAddress()
  }
}

export function normalizeUserAddress(input) {
  const base = emptyAddress()
  if (!input || typeof input !== 'object') return base
  return {
    line1: String(input.line1 || '').trim().slice(0, 120),
    line2: String(input.line2 || '').trim().slice(0, 120),
    city: String(input.city || '').trim().slice(0, 80),
    postcode: String(input.postcode || '').trim().slice(0, 24),
    country: String(input.country || '').trim().slice(0, 80),
  }
}

/** Idempotent DDL for profile fields on users. */
export async function ensureUserProfileSchema() {
  if (ensured) return

  const cols = ['address_json', 'delivery_address_json']
  if (dbIsPostgres()) {
    for (const col of cols) {
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col} TEXT`)
    }
  } else {
    for (const col of cols) {
      try {
        await query(`ALTER TABLE users ADD COLUMN ${col} TEXT`)
      } catch {
        /* exists */
      }
    }
  }

  ensured = true
}
