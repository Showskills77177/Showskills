import { query, dbIsPostgres } from './db.mjs'

let ensured = false

const EXTRA_COLUMNS = [
  ['content_type', "TEXT NOT NULL DEFAULT 'short'"],
  ['tags_json', "TEXT NOT NULL DEFAULT '[]'"],
  ['visibility', "TEXT NOT NULL DEFAULT 'private'"],
  ['made_for_kids', 'INTEGER NOT NULL DEFAULT 0'],
  ['category_id', "TEXT NOT NULL DEFAULT '17'"],
  ['channel_id', 'TEXT'],
  ['file_size_bytes', 'INTEGER'],
  ['duration_seconds', 'REAL'],
  ['contains_synthetic_media', 'INTEGER NOT NULL DEFAULT 0'],
  ['paid_promotion', 'INTEGER NOT NULL DEFAULT 0'],
  ['related_video_id', 'TEXT'],
  ['view_count', 'INTEGER NOT NULL DEFAULT 0'],
  ['processing_status', 'TEXT'],
  ['checks_json', 'TEXT'],
  ['thumbnail_uploaded', 'INTEGER NOT NULL DEFAULT 0'],
  ['width_pixels', 'INTEGER'],
  ['height_pixels', 'INTEGER'],
  ['aspect_ratio', 'REAL'],
  ['is_vertical_short', 'INTEGER NOT NULL DEFAULT 0'],
  ['license', "TEXT NOT NULL DEFAULT 'youtube'"],
  ['default_language', 'TEXT'],
  ['recording_date', 'TEXT'],
  ['embeddable', 'INTEGER NOT NULL DEFAULT 1'],
  ['public_stats_viewable', 'INTEGER NOT NULL DEFAULT 1'],
]

async function addColumnIfMissing(name, typeSql) {
  if (dbIsPostgres()) {
    try {
      await query(`ALTER TABLE eof_youtube_projects ADD COLUMN IF NOT EXISTS ${name} ${typeSql}`)
    } catch {
      /* ignore */
    }
  } else {
    try {
      await query(`ALTER TABLE eof_youtube_projects ADD COLUMN ${name} ${typeSql}`)
    } catch {
      /* column exists */
    }
  }
}

/** Eyes Of Football — Shorts / long-form project queue (staging). */
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

  for (const [name, typeSql] of EXTRA_COLUMNS) {
    await addColumnIfMissing(name, typeSql)
  }

  await query(`
    CREATE INDEX IF NOT EXISTS idx_eof_youtube_projects_status
    ON eof_youtube_projects (status, scheduled_at)
  `)
  ensured = true
}
