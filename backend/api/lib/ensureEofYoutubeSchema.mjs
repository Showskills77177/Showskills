import { query, dbIsPostgres } from './db.mjs'

let ensured = false

/** Eyes Of Football — Shorts project queue (staging). */
export async function ensureEofYoutubeSchema() {
  if (ensured) return

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS eof_youtube_projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        upload_source TEXT NOT NULL,
        status TEXT NOT NULL,
        submitted_by TEXT NOT NULL,
        scheduled_at TIMESTAMPTZ,
        published_at TIMESTAMPTZ,
        youtube_video_id TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS eof_youtube_projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        upload_source TEXT NOT NULL,
        status TEXT NOT NULL,
        submitted_by TEXT NOT NULL,
        scheduled_at TEXT,
        published_at TEXT,
        youtube_video_id TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  }

  await query(`
    CREATE INDEX IF NOT EXISTS idx_eof_youtube_projects_status
    ON eof_youtube_projects (status, scheduled_at)
  `)
  ensured = true
}
