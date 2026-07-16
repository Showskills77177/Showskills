#!/usr/bin/env node
/**
 * Register default YouTube Audio Library beds (place MP3s in public/eof/music/ first).
 * Usage: npm run seed:eof-music
 */
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
process.env.SQLITE_PATH = process.env.SQLITE_PATH || 'db/db.sqlite'

/** Mirrors EOF_DEFAULT_MUSIC_BEDS — only registers slots whose MP3 exists on disk. */
const CATALOG = [
  {
    title: 'EOF Neutral bed',
    mood: 'neutral',
    publicUrl: '/eof/music/default-neutral.mp3',
    isDefault: true,
  },
  {
    title: 'EOF Dramatic bed',
    mood: 'dramatic',
    publicUrl: '/eof/music/default-dramatic.mp3',
    isDefault: false,
  },
  {
    title: 'EOF Upbeat bed',
    mood: 'upbeat',
    publicUrl: '/eof/music/default-upbeat.mp3',
    isDefault: false,
  },
  {
    title: 'EOF Calm bed',
    mood: 'calm',
    publicUrl: '/eof/music/default-calm.mp3',
    isDefault: false,
  },
]

async function main() {
  const { ensureEofProductionSchema } = await import('../backend/api/lib/ensureEofProductionSchema.mjs')
  const { listEofMusicTracks, createEofMusicTrack } = await import('../backend/api/lib/eofMusicTracks.mjs')

  await ensureEofProductionSchema()
  const existing = await listEofMusicTracks({ activeOnly: false })
  const byUrl = new Map(existing.map((t) => [t.publicUrl, t]))

  for (const item of CATALOG) {
    const filePath = join(root, 'public', item.publicUrl.replace(/^\//, ''))
    if (!existsSync(filePath)) {
      console.warn(`Skip ${item.title} — missing file: ${filePath}`)
      console.warn('  Download from YouTube Studio → Audio library → save MP3 here.')
      continue
    }
    if (byUrl.has(item.publicUrl)) {
      console.log(`Already registered: ${item.title}`)
      continue
    }
    await createEofMusicTrack({
      ...item,
      licenseNote: 'YouTube Audio Library — YouTube use only.',
    })
    console.log(`Registered: ${item.title}`)
  }

  console.log('\nDone. Open EOF admin → Music to set default or add more tracks.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
