import { query } from './db.mjs'
import { ensureUserAuthSchema } from './ensureUserAuthSchema.mjs'
import { ensureUserPhoneColumn } from './userContact.mjs'
import {
  ensureUserProfileSchema,
  normalizeUserAddress,
  parseUserAddress,
} from './ensureUserProfileSchema.mjs'
import { hashUserPassword, verifyUserPassword } from './password.mjs'
import { getUserAuthRowByEmail } from './userAccounts.mjs'
import {
  subscribeNewsletter,
  unsubscribeByToken,
  updateSubscriberPreferences,
  ensureNewsletterSubscriberToken,
} from './newsletter.mjs'
import { NEWSLETTER_SOURCES, normalizeNewsletterPreferences } from '../../../shared/newsletter.mjs'

async function loadUserRow(userId) {
  await ensureUserAuthSchema()
  await ensureUserPhoneColumn()
  await ensureUserProfileSchema()
  const r = await query(
    `SELECT id, email, full_name, phone, address_json, delivery_address_json, created_at, last_login_at
     FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  )
  return r.rows[0] || null
}

async function getNewsletterStatus(email) {
  const em = String(email || '')
    .trim()
    .toLowerCase()
  if (!em) return { subscribed: false, preferences: null }
  const r = await query(`SELECT unsubscribed_at, preferences_json FROM newsletter_subscribers WHERE email = $1`, [
    em,
  ])
  const row = r.rows[0]
  if (!row) return { subscribed: false, preferences: null }
  let preferences = null
  try {
    preferences = row.preferences_json ? JSON.parse(row.preferences_json) : null
  } catch {
    preferences = null
  }
  return { subscribed: !row.unsubscribed_at, preferences }
}

export async function getUserProfile(userId) {
  const row = await loadUserRow(userId)
  if (!row) return null

  const newsletter = await getNewsletterStatus(row.email)

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone || '',
    address: parseUserAddress(row.address_json),
    deliveryAddress: parseUserAddress(row.delivery_address_json),
    newsletterSubscribed: newsletter.subscribed,
    newsletterPreferences: newsletter.preferences,
    createdAt: row.created_at ?? null,
    lastLoginAt: row.last_login_at ?? null,
  }
}

export async function updateUserProfile(userId, patch) {
  const row = await loadUserRow(userId)
  if (!row) return { ok: false, error: 'Account not found.' }

  const fullName =
    typeof patch.fullName === 'string' ? patch.fullName.trim().slice(0, 120) : row.full_name
  const phone = typeof patch.phone === 'string' ? patch.phone.trim().slice(0, 32) : row.phone || ''
  const address = patch.address ? normalizeUserAddress(patch.address) : parseUserAddress(row.address_json)
  const deliveryAddress = patch.deliveryAddress
    ? normalizeUserAddress(patch.deliveryAddress)
    : parseUserAddress(row.delivery_address_json)

  if (!fullName) {
    return { ok: false, error: 'Enter your full name.' }
  }

  await query(
    `UPDATE users
     SET full_name = $2, phone = $3, address_json = $4, delivery_address_json = $5
     WHERE id = $1`,
    [userId, fullName, phone || null, JSON.stringify(address), JSON.stringify(deliveryAddress)],
  )

  const profile = await getUserProfile(userId)
  return { ok: true, profile }
}

export async function changeUserPassword(userId, { currentPassword, newPassword }) {
  const row = await loadUserRow(userId)
  if (!row) {
    return { ok: false, error: 'Account not found.' }
  }

  const authRow = await getUserAuthRowByEmail(row.email)
  if (!authRow?.password_hash) {
    return { ok: false, error: 'Account not found.' }
  }

  const valid = await verifyUserPassword(currentPassword, authRow.password_hash)
  if (!valid) {
    return { ok: false, error: 'Current password is incorrect.' }
  }

  let passwordHash
  try {
    passwordHash = await hashUserPassword(newPassword)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid password.' }
  }

  await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [userId, passwordHash])
  return { ok: true }
}

export async function setUserNewsletterSubscription(userId, subscribed) {
  const row = await loadUserRow(userId)
  if (!row) return { ok: false, error: 'Account not found.' }

  const email = row.email
  if (subscribed) {
    const result = await subscribeNewsletter(email, {
      source: NEWSLETTER_SOURCES.account_settings,
      resubscribe: true,
    })
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, subscribed: true }
  }

  const existing = await query(`SELECT unsubscribe_token FROM newsletter_subscribers WHERE email = $1`, [
    email.trim().toLowerCase(),
  ])
  const token = existing.rows[0]?.unsubscribe_token
  if (token) {
    const result = await unsubscribeByToken(token)
    if (!result.ok) return { ok: false, error: result.error }
  }
  return { ok: true, subscribed: false }
}

export async function updateUserNewsletterPreferences(userId, preferences) {
  const row = await loadUserRow(userId)
  if (!row) return { ok: false, error: 'Account not found.' }

  const token = await ensureNewsletterSubscriberToken(row.email)
  if (!token) {
    const sub = await subscribeNewsletter(row.email, {
      source: NEWSLETTER_SOURCES.account_settings,
      preferences,
      resubscribe: true,
    })
    if (!sub.ok) return { ok: false, error: sub.error }
    return {
      ok: true,
      subscribed: true,
      preferences: normalizeNewsletterPreferences(preferences),
    }
  }

  const result = await updateSubscriberPreferences(token, preferences)
  if (!result.ok) return { ok: false, error: result.error }
  return {
    ok: true,
    subscribed: result.subscriber?.active !== false,
    preferences: result.subscriber?.preferences || normalizeNewsletterPreferences(preferences),
  }
}
