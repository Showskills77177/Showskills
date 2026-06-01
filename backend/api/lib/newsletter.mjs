import { randomUUID } from 'node:crypto'
import { query, dbIsPostgres } from './db.mjs'

export async function ensureNewsletterSchema() {
  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        source TEXT,
        subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        source TEXT,
        subscribed_at TEXT NOT NULL
      )
    `)
  }
}

export async function subscribeNewsletter(email, { source = 'shirt_giveaway' } = {}) {
  await ensureNewsletterSchema()
  const em = String(email || '')
    .trim()
    .toLowerCase()
  if (!em.includes('@')) return { ok: false, error: 'Valid email required for newsletter.' }
  const id = randomUUID()
  const now = new Date().toISOString()
  try {
    await query(
      `INSERT INTO newsletter_subscribers (id, email, source, subscribed_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [id, em, source, now],
    )
    return { ok: true, email: em }
  } catch (e) {
    console.error(e)
    return { ok: false, error: 'Could not subscribe to newsletter.' }
  }
}
