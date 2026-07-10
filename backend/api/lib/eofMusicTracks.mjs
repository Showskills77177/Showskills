import { randomUUID } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { query, dbIsPostgres } from './db.mjs'
import { ensureEofProductionSchema } from './ensureEofProductionSchema.mjs'
import { EOF_MUSIC_SOURCE_YOUTUBE_LIBRARY } from '../../../shared/eofProduction.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const DEFAULT_EOF_MUSIC_CATALOG = [
  {
    title: 'Neutral bed',
    mood: 'neutral',
    publicUrl: '/eof/music/default-neutral.mp3',
    isDefault: true,
    licenseNote:
      'Placeholder bed ships for pipeline testing. Replace with a YouTube Audio Library MP3 before publishing to YouTube.',
  },
  {
    title: 'Dramatic bed',
    mood: 'dramatic',
    publicUrl: '/eof/music/default-dramatic.mp3',
    isDefault: false,
    licenseNote:
      'Placeholder bed ships for pipeline testing. Replace with a YouTube Audio Library MP3 before publishing to YouTube.',
  },
]

function normalizeTimestamp(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString()
}

function rowToTrack(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    mood: row.mood || 'neutral',
    source: row.source || EOF_MUSIC_SOURCE_YOUTUBE_LIBRARY,
    publicUrl: row.public_url || null,
    storagePath: row.storage_path || null,
    durationSeconds: row.duration_seconds ?? null,
    isDefault: Boolean(row.is_default),
    licenseNote: row.license_note || null,
    active: row.active !== 0 && row.active !== false,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }
}

/** Register placeholder catalog rows when the Music tab has never been set up. */
export async function ensureEofMusicCatalogSeeded() {
  await ensureEofProductionSchema()
  const existing = await listEofMusicTracks({ activeOnly: false })
  if (existing.length) return existing

  for (const item of DEFAULT_EOF_MUSIC_CATALOG) {
    await createEofMusicTrack({
      ...item,
      source: EOF_MUSIC_SOURCE_YOUTUBE_LIBRARY,
    }).catch(() => {})
  }

  return listEofMusicTracks({ activeOnly: false })
}

export async function listEofMusicTracks({ activeOnly = true } = {}) {
  await ensureEofProductionSchema()
  const sql = activeOnly
    ? `SELECT * FROM eof_music_tracks WHERE active != 0 ORDER BY is_default DESC, title ASC`
    : `SELECT * FROM eof_music_tracks ORDER BY is_default DESC, title ASC`
  const { rows } = await query(sql)
  return rows.map(rowToTrack)
}

export async function getEofMusicTrack(id) {
  await ensureEofProductionSchema()
  const { rows } = await query(`SELECT * FROM eof_music_tracks WHERE id = $1`, [id])
  return rowToTrack(rows[0])
}

/** Resolve absolute filesystem path for mixing/render. */
export function resolveEofMusicTrackFilePath(track) {
  if (!track) return null
  if (track.storagePath) {
    const rel = track.storagePath.replace(/^\/+/, '')
    return join(root, rel)
  }
  if (track.publicUrl?.startsWith('/')) {
    return join(root, 'public', track.publicUrl.replace(/^\/+/, ''))
  }
  return null
}

export async function createEofMusicTrack({
  title,
  mood = 'neutral',
  source = EOF_MUSIC_SOURCE_YOUTUBE_LIBRARY,
  publicUrl = null,
  storagePath = null,
  durationSeconds = null,
  isDefault = false,
  licenseNote = null,
}) {
  await ensureEofProductionSchema()
  const id = randomUUID()
  const t = String(title || '').trim()
  if (!t) throw new Error('Track title is required.')
  if (!publicUrl && !storagePath) throw new Error('publicUrl or storagePath is required.')

  if (isDefault) {
    await query(`UPDATE eof_music_tracks SET is_default = 0`)
  }

  await query(
    `INSERT INTO eof_music_tracks
     (id, title, mood, source, public_url, storage_path, duration_seconds, is_default, license_note, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)`,
    [
      id,
      t,
      mood,
      source,
      publicUrl,
      storagePath,
      durationSeconds,
      isDefault ? 1 : 0,
      licenseNote,
    ],
  )
  return getEofMusicTrack(id)
}

export async function updateEofMusicTrack(id, patch) {
  await ensureEofProductionSchema()
  const existing = await getEofMusicTrack(id)
  if (!existing) throw new Error('Track not found.')

  if (patch.isDefault === true) {
    await query(`UPDATE eof_music_tracks SET is_default = 0`)
  }

  const title = patch.title !== undefined ? String(patch.title).trim() : existing.title
  const mood = patch.mood !== undefined ? patch.mood : existing.mood
  const active = patch.active !== undefined ? (patch.active ? 1 : 0) : existing.active ? 1 : 0
  const isDefault = patch.isDefault !== undefined ? (patch.isDefault ? 1 : 0) : existing.isDefault ? 1 : 0
  const licenseNote = patch.licenseNote !== undefined ? patch.licenseNote : existing.licenseNote

  await query(
    `UPDATE eof_music_tracks
     SET title = $2, mood = $3, active = $4, is_default = $5, license_note = $6, updated_at = ${dbIsPostgres() ? 'now()' : `datetime('now')`}
     WHERE id = $1`,
    [id, title, mood, active, isDefault, licenseNote],
  )
  return getEofMusicTrack(id)
}

export async function pickEofMusicTrackForTopic(topic, explicitTrackId = null) {
  if (explicitTrackId) {
    const track = await getEofMusicTrack(explicitTrackId)
    if (track?.active) return track
  }

  const tracks = await listEofMusicTracks()
  if (!tracks.length) return null

  const defaultTrack = tracks.find((t) => t.isDefault)
  if (defaultTrack) return defaultTrack

  const { inferMusicMoodFromTopic } = await import('../../../shared/eofScriptTemplates.mjs')
  const mood = inferMusicMoodFromTopic(topic)
  const moodMatch = tracks.find((t) => t.mood === mood)
  return moodMatch || tracks[0]
}
