import { createReadStream } from 'node:fs'
import { mkdirSync, existsSync, unlinkSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

/** Local disk only. On Vercel serverless, use a small VPS/Fly/Render API or S3/R2 and store https URLs in `video_ref`. */
export const KICKUP_UPLOAD_DIR = join(process.cwd(), 'uploads', 'kickups')

export function ensureKickupUploadDir() {
  mkdirSync(KICKUP_UPLOAD_DIR, { recursive: true })
}

/** Stored in DB as `local:<filename>` where filename is basename only (e.g. uuid.mp4). */
export function localVideoRef(storedBasename) {
  const safe = basename(storedBasename)
  return `local:${safe}`
}

/** Resolved path for a `local:` ref, or null if ref invalid (does not check file exists). */
export function getLocalKickupDiskPathFromRef(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('local:')) return null
  const name = basename(ref.slice('local:'.length))
  if (!name || name.includes('..')) return null
  const full = resolve(KICKUP_UPLOAD_DIR, name)
  const root = resolve(KICKUP_UPLOAD_DIR)
  if (!full.startsWith(root)) return null
  return full
}

export function resolveKickupFilePathFromRef(ref) {
  const full = getLocalKickupDiskPathFromRef(ref)
  if (!full || !existsSync(full)) return null
  return full
}

/** Remove file for `local:` refs; no-op for https or missing path. Ignores ENOENT. */
export function deleteLocalKickupFileFromRef(ref) {
  const full = getLocalKickupDiskPathFromRef(ref)
  if (!full) return
  try {
    unlinkSync(full)
  } catch (e) {
    if (e && e.code === 'ENOENT') return
    throw e
  }
}

export function streamKickupFile(filePath, res) {
  const stream = createReadStream(filePath)
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).end()
  })
  stream.pipe(res)
}
