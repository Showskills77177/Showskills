import { randomUUID } from 'node:crypto'
import { query } from './db.mjs'
import { ensureEntryAttemptLogSchema, ensureFreeEntrySchema } from './ensureFreeEntrySchema.mjs'
import { clientIp } from './rateLimit.mjs'
import {
  buildNameAddressKey,
  buildShirtIdentityKey,
  COMPETITION_LEGACY_BUNDLE,
  COMPETITION_SHIRT_GIVEAWAY,
  FREE_ENTRY_ERRORS,
  MAX_CARD_VERIFICATIONS_PER_IP_LEGACY,
  MAX_FREE_LEGACY_PER_NAME_ADDRESS,
  MAX_SHIRT_PER_DEVICE,
  MAX_SHIRT_PER_NAME_EMAIL_IP,
} from '../../../shared/freeEntryLimits.mjs'

export { clientIp }

export async function logEntryAttempt(req, fields) {
  try {
    await ensureEntryAttemptLogSchema()
    const id = randomUUID()
    const meta =
      fields.metadata && typeof fields.metadata === 'object'
        ? JSON.stringify(fields.metadata)
        : fields.metadata
          ? String(fields.metadata)
          : null
    await query(
      `INSERT INTO entry_attempt_logs (
        id, competition, flow, ip_address, full_name, email, address_key, outcome, block_reason, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        fields.competition,
        fields.flow,
        fields.ip || clientIp(req),
        fields.fullName || null,
        fields.email || null,
        fields.addressKey || null,
        fields.outcome,
        fields.blockReason || null,
        meta,
      ],
    )
  } catch (e) {
    console.error('[entry-attempt] log failed:', e)
  }
}

export function parsePostalAddress(body) {
  const addressLine1 = typeof body.addressLine1 === 'string' ? body.addressLine1.trim().slice(0, 200) : ''
  const addressLine2 = typeof body.addressLine2 === 'string' ? body.addressLine2.trim().slice(0, 200) : ''
  const city = typeof body.city === 'string' ? body.city.trim().slice(0, 120) : ''
  const postcode = typeof body.postcode === 'string' ? body.postcode.trim().slice(0, 32) : ''
  if (!addressLine1 || addressLine1.length < 3 || !city || city.length < 2 || !postcode || postcode.length < 4) {
    return { ok: false, error: FREE_ENTRY_ERRORS.invalidAddress }
  }
  return { ok: true, addressLine1, addressLine2, city, postcode }
}

export async function countFreeEntriesByNameAddress(nameAddressKey, competition = COMPETITION_LEGACY_BUNDLE) {
  await ensureFreeEntrySchema()
  const r = await query(
    `SELECT COUNT(*)::int AS c FROM free_online_entries WHERE competition = $1 AND name_address_key = $2`,
    [competition, nameAddressKey],
  )
  return Number(r.rows[0]?.c ?? 0)
}

export async function countCardVerificationsByIp(ip, competition = COMPETITION_LEGACY_BUNDLE) {
  await ensureFreeEntrySchema()
  const r = await query(
    `SELECT COUNT(*)::int AS c FROM stripe_card_verifications WHERE competition = $1 AND ip_address = $2`,
    [competition, ip],
  )
  return Number(r.rows[0]?.c ?? 0)
}

/** Setup intents started or completed from this IP (anti card-verify spam). */
export async function countLegacyVerifyAttemptsByIp(ip, competition = COMPETITION_LEGACY_BUNDLE) {
  await ensureFreeEntrySchema()
  const r = await query(
    `SELECT COUNT(*)::int AS c FROM entry_attempt_logs
     WHERE competition = $1 AND flow = 'legacy_free_online' AND ip_address = $2
       AND outcome IN ('setup_created', 'success')`,
    [competition, ip],
  )
  return Number(r.rows[0]?.c ?? 0)
}

/** Before card verify — IP cap only (questions come after verify). */
export async function checkLegacyFreeIpLimits(req, { fullName, email, address, competition = COMPETITION_LEGACY_BUNDLE }) {
  const ip = clientIp(req)
  const nameAddressKey = buildNameAddressKey({ fullName, ...address })
  const ipCount = Math.max(
    await countCardVerificationsByIp(ip, competition),
    await countLegacyVerifyAttemptsByIp(ip, competition),
  )
  if (ipCount >= MAX_CARD_VERIFICATIONS_PER_IP_LEGACY) {
    await logEntryAttempt(req, {
      competition,
      flow: 'legacy_free_online',
      fullName,
      email,
      addressKey: nameAddressKey,
      outcome: 'blocked',
      blockReason: 'ip_verification_limit',
    })
    return { ok: false, error: FREE_ENTRY_ERRORS.ipVerificationLimit, code: 'ip_verification_limit' }
  }
  return { ok: true, nameAddressKey, ip }
}

/** After card verify, when submitting skill answers — name + address cap. */
export async function checkLegacyFreeNameAddressLimits(
  req,
  { fullName, email, address, competition = COMPETITION_LEGACY_BUNDLE },
) {
  const ip = clientIp(req)
  const nameAddressKey = buildNameAddressKey({ fullName, ...address })
  const nameCount = await countFreeEntriesByNameAddress(nameAddressKey, competition)
  if (nameCount >= MAX_FREE_LEGACY_PER_NAME_ADDRESS) {
    await logEntryAttempt(req, {
      competition,
      flow: 'legacy_free_online',
      fullName,
      email,
      addressKey: nameAddressKey,
      outcome: 'blocked',
      blockReason: 'name_address_limit',
    })
    return { ok: false, error: FREE_ENTRY_ERRORS.nameAddressLimit, code: 'name_address_limit' }
  }
  return { ok: true, nameAddressKey, ip }
}

/** @deprecated Use split IP + name checks */
export async function checkLegacyFreeOnlineLimits(req, fields) {
  const ipCheck = await checkLegacyFreeIpLimits(req, fields)
  if (!ipCheck.ok) return ipCheck
  return checkLegacyFreeNameAddressLimits(req, fields)
}

export async function countShirtByIdentityKey(identityKey) {
  await ensureFreeEntrySchema()
  const r = await query(
    `SELECT COUNT(*)::int AS c FROM entry_attempt_logs
     WHERE competition = $1 AND flow = 'shirt_giveaway' AND outcome = 'success' AND address_key = $2`,
    [COMPETITION_SHIRT_GIVEAWAY, identityKey],
  )
  return Number(r.rows[0]?.c ?? 0)
}

/** Any prior shirt giveaway attempt from this IP (success or blocked), any email. */
export async function countShirtDeviceActivityByIp(ip) {
  await ensureFreeEntrySchema()
  const r = await query(
    `SELECT COUNT(*)::int AS c FROM entry_attempt_logs
     WHERE competition = $1 AND flow = 'shirt_giveaway' AND ip_address = $2
       AND outcome IN ('success', 'blocked')`,
    [COMPETITION_SHIRT_GIVEAWAY, ip],
  )
  return Number(r.rows[0]?.c ?? 0)
}

/** Also check existing kickup_submissions for shirt duplicates. */
export async function countShirtKickupByEmailName(email, fullName) {
  const r = await query(
    `SELECT COUNT(*)::int AS c FROM kickup_submissions
     WHERE lower(email) = $1 AND lower(full_name) = $2`,
    [email.toLowerCase(), fullName.toLowerCase()],
  )
  return Number(r.rows[0]?.c ?? 0)
}

export async function countShirtBlockedAttempts(identityKey) {
  await ensureFreeEntrySchema()
  const r = await query(
    `SELECT COUNT(*)::int AS c FROM entry_attempt_logs
     WHERE competition = $1 AND flow = 'shirt_giveaway' AND address_key = $2
       AND outcome IN ('success', 'blocked')`,
    [COMPETITION_SHIRT_GIVEAWAY, identityKey],
  )
  return Number(r.rows[0]?.c ?? 0)
}

export async function checkShirtGiveawayLimits(req, { fullName, email }) {
  const ip = clientIp(req)
  const identityKey = buildShirtIdentityKey({ fullName, email, ip })

  const deviceActivity = await countShirtDeviceActivityByIp(ip)
  if (deviceActivity >= MAX_SHIRT_PER_DEVICE) {
    await logEntryAttempt(req, {
      competition: COMPETITION_SHIRT_GIVEAWAY,
      flow: 'shirt_giveaway',
      fullName,
      email,
      addressKey: identityKey,
      outcome: 'blocked',
      blockReason: 'shirt_device_used',
    })
    return { ok: false, error: FREE_ENTRY_ERRORS.shirtDeviceUsed, code: 'shirt_device_used' }
  }

  const byIdentity = await countShirtByIdentityKey(identityKey)
  const legacyKick = await countShirtKickupByEmailName(email, fullName)
  const priorAttempts = await countShirtBlockedAttempts(identityKey)
  if (
    byIdentity >= MAX_SHIRT_PER_NAME_EMAIL_IP ||
    legacyKick >= MAX_SHIRT_PER_NAME_EMAIL_IP ||
    priorAttempts >= MAX_SHIRT_PER_NAME_EMAIL_IP
  ) {
    await logEntryAttempt(req, {
      competition: COMPETITION_SHIRT_GIVEAWAY,
      flow: 'shirt_giveaway',
      fullName,
      email,
      addressKey: identityKey,
      outcome: 'blocked',
      blockReason: 'shirt_duplicate',
    })
    return { ok: false, error: FREE_ENTRY_ERRORS.shirtDuplicate, code: 'shirt_duplicate' }
  }

  return { ok: true, identityKey, ip }
}
