import Database from 'better-sqlite3'
import { e2eSqlitePath } from './env.mjs'

export function openE2eDb() {
  return new Database(e2eSqlitePath, { readonly: true, fileMustExist: true })
}

export function countTickets(db) {
  const r = db.prepare(`SELECT COUNT(*) AS c FROM tickets WHERE payment_status = 'paid'`).get()
  return r?.c ?? 0
}

export function countKickups(db) {
  const r = db.prepare(`SELECT COUNT(*) AS c FROM kickup_submissions`).get()
  return r?.c ?? 0
}

export function latestCompetitionEntryByEmail(db, email) {
  return db
    .prepare(
      `SELECT ce.* FROM competition_entries ce
       JOIN users u ON u.id = ce.user_id
       WHERE lower(u.email) = lower(?)
       ORDER BY ce.created_at DESC LIMIT 1`,
    )
    .get(email)
}

export function latestKickupByEmail(db, email) {
  return db
    .prepare(`SELECT * FROM kickup_submissions WHERE lower(email) = lower(?) ORDER BY created_at DESC LIMIT 1`)
    .get(email)
}
