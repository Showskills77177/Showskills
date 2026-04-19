/**
 * Copy a video from disk into uploads/kickups and insert a kickup_submissions row.
 *
 * Usage:
 *   KICKUP_SEED_VIDEO_PATH="/path/to/video.mp4" npm run seed:kickup
 * Optional: KICKUP_SEED_NAME, KICKUP_SEED_EMAIL
 */
import { copyFileSync, existsSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env.local') })
config({ path: join(root, '.env') })

const src = process.env.KICKUP_SEED_VIDEO_PATH?.trim()
if (!src || !existsSync(src)) {
  console.error('Missing file. Example:')
  console.error(
    '  KICKUP_SEED_VIDEO_PATH="/Users/you/Desktop/my-video.mp4" npm run seed:kickup',
  )
  process.exit(1)
}

const { ensureKickupUploadDir, KICKUP_UPLOAD_DIR, localVideoRef } = await import(
  '../backend/api/lib/kickupUploads.mjs'
)
const { query } = await import('../backend/api/lib/db.mjs')

const ext = extname(src) || '.mp4'
const id = randomUUID()
const stored = `${id}${ext}`
ensureKickupUploadDir()
const dest = join(KICKUP_UPLOAD_DIR, stored)
copyFileSync(src, dest)

const name = (process.env.KICKUP_SEED_NAME || 'Seed tester').trim().slice(0, 200)
const email = (process.env.KICKUP_SEED_EMAIL || 'seed-test@example.com').trim().toLowerCase().slice(0, 320)

await query(
  `INSERT INTO kickup_submissions (id, full_name, email, video_ref, video_filename)
   VALUES ($1, $2, $3, $4, $5)`,
  [id, name, email, localVideoRef(stored), basename(src).slice(0, 500)],
)

console.log('Kick-up row inserted:', id)
console.log('Admin → Video submissions → use “View upload” for this row.')
