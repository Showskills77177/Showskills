import { query, dbIsPostgres } from './db.mjs'

let ensured = false

export async function ensureEofProductionSchema() {
  if (ensured) return

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS eof_music_tracks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        mood TEXT NOT NULL DEFAULT 'neutral',
        source TEXT NOT NULL DEFAULT 'youtube_audio_library',
        public_url TEXT,
        storage_path TEXT,
        duration_seconds REAL,
        is_default INTEGER NOT NULL DEFAULT 0,
        license_note TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS eof_production_jobs (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        script_json TEXT,
        music_track_id TEXT REFERENCES eof_music_tracks (id) ON DELETE SET NULL,
        music_volume REAL NOT NULL DEFAULT 0.22,
        voice_preset TEXT NOT NULL DEFAULT 'british',
        narration_manifest_json TEXT,
        mixed_audio_path TEXT,
        render_output_path TEXT,
        youtube_project_id TEXT,
        error_message TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_eof_production_jobs_status ON eof_production_jobs (status, created_at DESC)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_eof_music_tracks_mood ON eof_music_tracks (mood, active)`)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS eof_music_tracks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        mood TEXT NOT NULL DEFAULT 'neutral',
        source TEXT NOT NULL DEFAULT 'youtube_audio_library',
        public_url TEXT,
        storage_path TEXT,
        duration_seconds REAL,
        is_default INTEGER NOT NULL DEFAULT 0,
        license_note TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS eof_production_jobs (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        script_json TEXT,
        music_track_id TEXT,
        music_volume REAL NOT NULL DEFAULT 0.22,
        voice_preset TEXT NOT NULL DEFAULT 'british',
        narration_manifest_json TEXT,
        mixed_audio_path TEXT,
        render_output_path TEXT,
        youtube_project_id TEXT,
        error_message TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_eof_production_jobs_status ON eof_production_jobs (status, created_at)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_eof_music_tracks_mood ON eof_music_tracks (mood, active)`)
  }

  ensured = true
}
