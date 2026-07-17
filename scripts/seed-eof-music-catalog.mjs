#!/usr/bin/env node
/**
 * Register default + platform music beds (place MP3s in public/eof/music/ first).
 * Usage: npm run seed:eof-music
 */
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
process.env.SQLITE_PATH = process.env.SQLITE_PATH || 'db/db.sqlite'

async function main() {
  const { ensureEofProductionSchema } = await import('../backend/api/lib/ensureEofProductionSchema.mjs')
  const {
    listEofMusicTracks,
    createEofMusicTrack,
    EOF_DEFAULT_MUSIC_BEDS,
  } = await import('../backend/api/lib/eofMusicTracks.mjs')
  const { probeAudioDurationSec } = await import('../backend/api/lib/eofSceneTts.mjs')

  await ensureEofProductionSchema()
  const existing = await listEofMusicTracks({ activeOnly: false })
  const byUrl = new Map(existing.map((t) => [t.publicUrl, t]))

  for (const item of EOF_DEFAULT_MUSIC_BEDS) {
    const filePath = join(root, 'public', item.publicUrl.replace(/^\//, ''))
    if (!existsSync(filePath)) {
      if (item.required) {
        console.warn(`Skip ${item.title} — missing file: ${filePath}`)
      }
      continue
    }
    if (byUrl.has(item.publicUrl)) {
      console.log(`Already registered: ${item.title}`)
      continue
    }
    let durationSeconds = null
    try {
      durationSeconds = await probeAudioDurationSec(filePath)
    } catch {
      /* optional */
    }
    await createEofMusicTrack({
      title: item.title,
      mood: item.mood,
      publicUrl: item.publicUrl,
      isDefault: Boolean(item.isDefault),
      durationSeconds,
      licenseNote: item.licenseNote || 'Platform / YouTube Audio Library — YouTube use only.',
    })
    console.log(`Registered: ${item.title}${durationSeconds ? ` (${durationSeconds.toFixed(1)}s)` : ''}`)
  }

  console.log('\nDone. Open EOF admin → Music / Production mixer to pick a song segment.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
