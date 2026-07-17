import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { query, dbIsPostgres } from './db.mjs'
import { ensureEofProductionSchema } from './ensureEofProductionSchema.mjs'
import { EOF_MUSIC_SOURCE_YOUTUBE_LIBRARY } from '../../../shared/eofProduction.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/**
 * Default Shorts music-bed registry (royalty-safe slots only).
 *
 * Drop cleared YouTube Audio Library (or other licensed) MP3s into `public/eof/music/`:
 *   - default-neutral.mp3   — general narration bed (ships as soft placeholder stub)
 *   - default-dramatic.mp3  — facts / records / hype (ships as soft placeholder stub)
 *   - default-upbeat.mp3    — empty slot — add your cleared upbeat bed later
 *   - default-calm.mp3      — empty slot — add your cleared calm bed later
 *   - champions-rise.mp3    — Champions Rise (custom bed)
 *
 * Do NOT register Spotify/YouTube chart tracks. Placeholders are for pipeline testing only.
 * Env override: EOF_MUSIC_BEDS_JSON = JSON array of { title, mood, publicUrl, isDefault?, licenseNote? }
 */
const PLATFORM_LICENSE =
  'Platform music bed — confirm you have rights to use on YouTube before publishing.'

export const EOF_DEFAULT_MUSIC_BEDS = [
  {
    id: 'neutral',
    title: 'Neutral bed',
    mood: 'neutral',
    publicUrl: '/eof/music/default-neutral.mp3',
    fileName: 'default-neutral.mp3',
    isDefault: true,
    required: true,
    licenseNote:
      'Placeholder stub for pipeline testing. Replace with a cleared YouTube Audio Library (or other licensed) MP3 before publishing.',
  },
  {
    id: 'dramatic',
    title: 'Dramatic bed',
    mood: 'dramatic',
    publicUrl: '/eof/music/default-dramatic.mp3',
    fileName: 'default-dramatic.mp3',
    isDefault: false,
    required: true,
    licenseNote:
      'Placeholder stub for pipeline testing. Replace with a cleared dramatic bed before publishing.',
  },
  {
    id: 'upbeat',
    title: 'Upbeat bed',
    mood: 'upbeat',
    publicUrl: '/eof/music/default-upbeat.mp3',
    fileName: 'default-upbeat.mp3',
    isDefault: false,
    required: false,
    licenseNote:
      'Empty slot — drop a cleared upbeat Shorts bed at public/eof/music/default-upbeat.mp3, then seed/register.',
  },
  {
    id: 'calm',
    title: 'Calm bed',
    mood: 'calm',
    publicUrl: '/eof/music/default-calm.mp3',
    fileName: 'default-calm.mp3',
    isDefault: false,
    required: false,
    licenseNote:
      'Empty slot — drop a cleared calm Shorts bed at public/eof/music/default-calm.mp3, then seed/register.',
  },
  {
    id: 'champions-rise',
    title: 'Champions Rise',
    mood: 'dramatic',
    publicUrl: '/eof/music/champions-rise.mp3',
    fileName: 'champions-rise.mp3',
    isDefault: false,
    required: false,
    licenseNote: PLATFORM_LICENSE,
  },
  {
    id: 'build-different-inst',
    title: 'Build Different (Inst)',
    mood: 'upbeat',
    publicUrl: '/eof/music/build-different-inst.mp3',
    fileName: 'build-different-inst.mp3',
    isDefault: false,
    required: false,
    licenseNote: PLATFORM_LICENSE,
  },
  {
    id: 'built-different-no-vocal',
    title: 'Built Different (No Lead Vocal)',
    mood: 'upbeat',
    publicUrl: '/eof/music/built-different-no-vocal.mp3',
    fileName: 'built-different-no-vocal.mp3',
    isDefault: false,
    required: false,
    licenseNote: PLATFORM_LICENSE,
  },
  {
    id: 'champion-mind',
    title: 'Champion Mind',
    mood: 'dramatic',
    publicUrl: '/eof/music/champion-mind.mp3',
    fileName: 'champion-mind.mp3',
    isDefault: false,
    required: false,
    licenseNote: PLATFORM_LICENSE,
  },
  {
    id: 'dream-chaser-no-vocal',
    title: 'Dream Chaser (No Lead Vocal)',
    mood: 'upbeat',
    publicUrl: '/eof/music/dream-chaser-no-vocal.mp3',
    fileName: 'dream-chaser-no-vocal.mp3',
    isDefault: false,
    required: false,
    licenseNote: PLATFORM_LICENSE,
  },
  {
    id: 'eternal',
    title: 'Eternal',
    mood: 'calm',
    publicUrl: '/eof/music/eternal.mp3',
    fileName: 'eternal.mp3',
    isDefault: false,
    required: false,
    licenseNote: PLATFORM_LICENSE,
  },
  {
    id: 'lets-go',
    title: "Let's Go",
    mood: 'upbeat',
    publicUrl: '/eof/music/lets-go.mp3',
    fileName: 'lets-go.mp3',
    isDefault: false,
    required: false,
    licenseNote: PLATFORM_LICENSE,
  },
  {
    id: 'my-lane-no-vocal',
    title: 'My Lane (No Lead Vocal)',
    mood: 'upbeat',
    publicUrl: '/eof/music/my-lane-no-vocal.mp3',
    fileName: 'my-lane-no-vocal.mp3',
    isDefault: false,
    required: false,
    licenseNote: PLATFORM_LICENSE,
  },
  {
    id: 'my-lane',
    title: 'My Lane',
    mood: 'upbeat',
    publicUrl: '/eof/music/my-lane.mp3',
    fileName: 'my-lane.mp3',
    isDefault: false,
    required: false,
    licenseNote: PLATFORM_LICENSE,
  },
  {
    id: 'my-lane-lyrics',
    title: 'My Lane (Lyrics)',
    mood: 'upbeat',
    publicUrl: '/eof/music/my-lane-lyrics.mp3',
    fileName: 'my-lane-lyrics.mp3',
    isDefault: false,
    required: false,
    licenseNote: PLATFORM_LICENSE,
  },
  {
    id: 'rise-up',
    title: 'Rise Up',
    mood: 'dramatic',
    publicUrl: '/eof/music/rise-up.mp3',
    fileName: 'rise-up.mp3',
    isDefault: false,
    required: false,
    licenseNote: PLATFORM_LICENSE,
  },
  {
    id: 'this-is-my-moment-1',
    title: 'This Is My Moment 1',
    mood: 'dramatic',
    publicUrl: '/eof/music/this-is-my-moment-1.mp3',
    fileName: 'this-is-my-moment-1.mp3',
    isDefault: false,
    required: false,
    licenseNote: PLATFORM_LICENSE,
  },
  {
    id: 'this-is-my-moment-2',
    title: 'This Is My Moment 2',
    mood: 'dramatic',
    publicUrl: '/eof/music/this-is-my-moment-2.mp3',
    fileName: 'this-is-my-moment-2.mp3',
    isDefault: false,
    required: false,
    licenseNote: PLATFORM_LICENSE,
  },
]

function catalogFromEnvOrDefault() {
  const raw = process.env.EOF_MUSIC_BEDS_JSON
  if (!raw || !String(raw).trim()) return EOF_DEFAULT_MUSIC_BEDS
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length) return EOF_DEFAULT_MUSIC_BEDS
    return parsed.map((row, i) => ({
      id: String(row.id || row.mood || `bed-${i}`),
      title: String(row.title || 'Music bed').trim() || 'Music bed',
      mood: String(row.mood || 'neutral').trim() || 'neutral',
      publicUrl: String(row.publicUrl || '').trim(),
      fileName: String(row.fileName || '').trim() || null,
      isDefault: Boolean(row.isDefault),
      required: row.required !== false,
      licenseNote: row.licenseNote || null,
    })).filter((row) => row.publicUrl)
  } catch {
    return EOF_DEFAULT_MUSIC_BEDS
  }
}

/** Public registry for admin UI — which slots exist, which files are on disk. */
export function listEofDefaultMusicBeds() {
  return catalogFromEnvOrDefault().map((bed) => {
    const abs = join(root, 'public', bed.publicUrl.replace(/^\/+/, ''))
    return {
      id: bed.id,
      title: bed.title,
      mood: bed.mood,
      publicUrl: bed.publicUrl,
      fileName: bed.fileName,
      isDefault: Boolean(bed.isDefault),
      required: Boolean(bed.required),
      licenseNote: bed.licenseNote,
      filePresent: existsSync(abs),
    }
  })
}

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
  const byUrl = new Map(existing.map((t) => [t.publicUrl, t]))

  for (const item of catalogFromEnvOrDefault()) {
    const abs = join(root, 'public', item.publicUrl.replace(/^\/+/, ''))
    if (!existsSync(abs)) continue
    if (byUrl.has(item.publicUrl)) continue
    await createEofMusicTrack({
      title: item.title,
      mood: item.mood,
      publicUrl: item.publicUrl,
      isDefault: Boolean(item.isDefault),
      licenseNote: item.licenseNote,
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
