/**
 * Image Studio generation history — every image a user generates is persisted (Postgres on
 * Vercel/Neon, SQLite locally) and stays available until that user explicitly deletes it. Scoped
 * per-user (by admin/editor username) so different EOF operators don't see each other's history.
 */
import crypto from 'node:crypto'
import { query, dbIsPostgres } from './db.mjs'

const DEFAULT_LIST_LIMIT = 60
const MAX_LIST_LIMIT = 200

let schemaReady = false

export async function ensureEofImageStudioHistorySchema() {
  if (schemaReady) return
  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS eof_image_studio_history (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        prompt TEXT NOT NULL,
        user_prompt TEXT NOT NULL,
        aspect_ratio TEXT NOT NULL,
        mime TEXT NOT NULL,
        bytes INTEGER NOT NULL DEFAULT 0,
        image_base64 TEXT NOT NULL,
        reference_image_used INTEGER NOT NULL DEFAULT 0,
        reference_image_count INTEGER NOT NULL DEFAULT 0,
        reference_description TEXT NOT NULL DEFAULT '',
        reference_image_warning TEXT NOT NULL DEFAULT '',
        document_excerpt_used INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS eof_image_studio_history (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        prompt TEXT NOT NULL,
        user_prompt TEXT NOT NULL,
        aspect_ratio TEXT NOT NULL,
        mime TEXT NOT NULL,
        bytes INTEGER NOT NULL DEFAULT 0,
        image_base64 TEXT NOT NULL,
        reference_image_used INTEGER NOT NULL DEFAULT 0,
        reference_image_count INTEGER NOT NULL DEFAULT 0,
        reference_description TEXT NOT NULL DEFAULT '',
        reference_image_warning TEXT NOT NULL DEFAULT '',
        document_excerpt_used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `)
  }
  await query(
    `CREATE INDEX IF NOT EXISTS eof_image_studio_history_user_idx ON eof_image_studio_history (username, created_at DESC)`,
  )
  schemaReady = true
}

function normalizeRow(row) {
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    prompt: row.prompt,
    userPrompt: row.user_prompt,
    aspectRatio: row.aspect_ratio,
    mime: row.mime,
    bytes: Number(row.bytes) || 0,
    imageBase64: row.image_base64,
    referenceImageUsed: Boolean(Number(row.reference_image_used)),
    referenceImageCount: Number(row.reference_image_count) || 0,
    referenceDescription: row.reference_description || '',
    referenceImageWarning: row.reference_image_warning || '',
    documentExcerptUsed: Boolean(Number(row.document_excerpt_used)),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

/**
 * @param {{
 *   username: string, prompt: string, userPrompt: string, aspectRatio: string, mime: string,
 *   bytes?: number, imageBase64: string, referenceImageUsed?: boolean, referenceImageCount?: number,
 *   referenceDescription?: string, referenceImageWarning?: string, documentExcerptUsed?: boolean,
 * }} entry
 */
export async function addEofImageStudioHistoryEntry(entry) {
  await ensureEofImageStudioHistorySchema()
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  await query(
    `INSERT INTO eof_image_studio_history
      (id, username, prompt, user_prompt, aspect_ratio, mime, bytes, image_base64,
       reference_image_used, reference_image_count, reference_description, reference_image_warning,
       document_excerpt_used, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      id,
      entry.username,
      entry.prompt,
      entry.userPrompt,
      entry.aspectRatio,
      entry.mime,
      entry.bytes || 0,
      entry.imageBase64,
      entry.referenceImageUsed ? 1 : 0,
      entry.referenceImageCount || 0,
      entry.referenceDescription || '',
      entry.referenceImageWarning || '',
      entry.documentExcerptUsed ? 1 : 0,
      createdAt,
    ],
  )
  return normalizeRow({
    id,
    username: entry.username,
    prompt: entry.prompt,
    user_prompt: entry.userPrompt,
    aspect_ratio: entry.aspectRatio,
    mime: entry.mime,
    bytes: entry.bytes || 0,
    image_base64: entry.imageBase64,
    reference_image_used: entry.referenceImageUsed ? 1 : 0,
    reference_image_count: entry.referenceImageCount || 0,
    reference_description: entry.referenceDescription || '',
    reference_image_warning: entry.referenceImageWarning || '',
    document_excerpt_used: entry.documentExcerptUsed ? 1 : 0,
    created_at: createdAt,
  })
}

export async function listEofImageStudioHistory(username, { limit = DEFAULT_LIST_LIMIT } = {}) {
  await ensureEofImageStudioHistorySchema()
  const safeLimit = Math.max(1, Math.min(MAX_LIST_LIMIT, Number(limit) || DEFAULT_LIST_LIMIT))
  const r = await query(
    `SELECT * FROM eof_image_studio_history WHERE username = $1 ORDER BY created_at DESC LIMIT $2`,
    [username, safeLimit],
  )
  return (r.rows || []).map(normalizeRow)
}

/** Deletes one entry, scoped to `username` so a user can only delete their own history. */
export async function deleteEofImageStudioHistoryEntry(username, id) {
  await ensureEofImageStudioHistorySchema()
  const r = await query(`DELETE FROM eof_image_studio_history WHERE username = $1 AND id = $2`, [username, id])
  return (r.rowCount || 0) > 0
}

export async function clearEofImageStudioHistory(username) {
  await ensureEofImageStudioHistorySchema()
  const r = await query(`DELETE FROM eof_image_studio_history WHERE username = $1`, [username])
  return r.rowCount || 0
}
