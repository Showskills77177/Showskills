import { randomBytes } from 'node:crypto'
import { query, isDbConfigured } from './db.mjs'
import { formatShirtEntryNumber } from '../../../shared/shirtEntryNumber.mjs'
import { COMPETITION_SHIRT_GIVEAWAY } from '../../../shared/freeEntryLimits.mjs'

let schemaEnsured = false

export async function ensureShirtEntrySchema() {
  if (schemaEnsured) return
  if (!isDbConfigured()) return

  try {
    await query(`ALTER TABLE kickup_submissions ADD COLUMN entry_number TEXT`)
  } catch {
    /* column exists */
  }
  try {
    await query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_kickups_entry_number ON kickup_submissions (entry_number)`,
    )
  } catch {
    /* ignore */
  }
  try {
    await query(`ALTER TABLE kickup_submissions ADD COLUMN competition TEXT`)
  } catch {
    /* column exists */
  }
  await query(
    `UPDATE kickup_submissions SET competition = $1 WHERE competition IS NULL OR competition = ''`,
    [COMPETITION_SHIRT_GIVEAWAY],
  )
  try {
    await query(
      `CREATE INDEX IF NOT EXISTS idx_kickups_competition ON kickup_submissions (competition, created_at DESC)`,
    )
  } catch {
    try {
      await query(
        `CREATE INDEX IF NOT EXISTS idx_kickups_competition ON kickup_submissions (competition, created_at)`,
      )
    } catch {
      /* ignore */
    }
  }

  schemaEnsured = true
}

export async function allocateShirtEntryNumber() {
  if (!isDbConfigured()) {
    return formatShirtEntryNumber(randomBytes(4).toString('hex'))
  }

  await ensureShirtEntrySchema()

  for (let attempt = 0; attempt < 12; attempt++) {
    const entryNumber = formatShirtEntryNumber(randomBytes(4).toString('hex'))
    const exists = await query(
      `SELECT 1 FROM kickup_submissions WHERE entry_number = $1 LIMIT 1`,
      [entryNumber],
    )
    if (!exists.rows[0]) return entryNumber
  }

  throw new Error('Could not allocate unique shirt entry number')
}
