import { randomUUID } from 'node:crypto'
import { query } from './db.mjs'
import { ensureFreeEntrySchema } from './ensureFreeEntrySchema.mjs'
import { logEntryAttempt } from './freeEntryAbuse.mjs'
import { allocateShirtEntryNumber } from './shirtEntryNumbers.mjs'
import {
  CONSOLATION_SHIRT_ENTRY_COUNT,
  paidSpendQualifiesForConsolation,
} from '../../../shared/consolationShirtGiveaway.mjs'
import { COMPETITION_SHIRT_GIVEAWAY } from '../../../shared/freeEntryLimits.mjs'

export async function hasConsolationBeenAwarded(competitionEntryId) {
  if (!competitionEntryId) return false
  await ensureFreeEntrySchema()
  const marker = `"competitionEntryId":"${competitionEntryId}"`
  const r = await query(
    `SELECT 1 FROM entry_attempt_logs
     WHERE flow = 'consolation_shirt' AND outcome = 'success'
       AND metadata LIKE $1
     LIMIT 1`,
    [`%${marker}%`],
  )
  return Boolean(r.rows[0])
}

/**
 * Award consolation shirt giveaway rows when Legacy Bundle skill answers are wrong.
 * @param {{ req?: import('http').IncomingMessage, fullName: string, email: string, competitionEntryId: string, source: 'paid' | 'free', amountPence?: number, orderRef?: string }} params
 */
export async function awardConsolationShirtEntries({
  req,
  fullName,
  email,
  competitionEntryId,
  source,
  amountPence,
  orderRef,
}) {
  if (!competitionEntryId || !fullName?.trim() || !email?.includes('@')) {
    return { awarded: false, entryCount: 0, entryNumbers: [], reason: 'invalid_input' }
  }

  const paidQualifies = source === 'free' || paidSpendQualifiesForConsolation(amountPence)
  if (!paidQualifies) {
    return { awarded: false, entryCount: 0, entryNumbers: [], reason: 'spend_below_threshold' }
  }

  if (await hasConsolationBeenAwarded(competitionEntryId)) {
    return { awarded: false, entryCount: 0, entryNumbers: [], reason: 'already_awarded' }
  }

  const count = CONSOLATION_SHIRT_ENTRY_COUNT
  const submissionIds = []
  const entryNumbers = []

  for (let i = 1; i <= count; i++) {
    const id = randomUUID()
    const entryNumber = await allocateShirtEntryNumber()
    const adminNotes = [
      'Consolation prize — Ronaldo Legacy Bundle (incorrect skill answers)',
      `Competition entry: ${competitionEntryId}`,
      `Source: ${source}`,
      `Entry ${i} of ${count}`,
      `Entry number: ${entryNumber}`,
      orderRef ? `Order: ${orderRef}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    await query(
      `INSERT INTO kickup_submissions (id, full_name, email, video_ref, video_filename, admin_notes, entry_number, competition)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        fullName.trim(),
        email.trim().toLowerCase(),
        'consolation:ronaldo-shirt-giveaway',
        `Consolation shirt entry ${i}/${count}`,
        adminNotes,
        entryNumber,
        COMPETITION_SHIRT_GIVEAWAY,
      ],
    )
    submissionIds.push(id)
    entryNumbers.push(entryNumber)
  }

  await logEntryAttempt(req, {
    competition: COMPETITION_SHIRT_GIVEAWAY,
    flow: 'consolation_shirt',
    fullName,
    email,
    outcome: 'success',
    metadata: {
      competitionEntryId,
      source,
      entryCount: count,
      submissionIds,
      entryNumbers,
      orderRef: orderRef || null,
    },
  })

  return { awarded: true, entryCount: count, submissionIds, entryNumbers }
}
