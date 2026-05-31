import { createReadStream, writeFileSync } from 'node:fs'
import { mkdirSync, existsSync, unlinkSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

/** Local disk only — same pattern as kickup uploads. */
export const COMPETITION_UPLOAD_DIR = join(process.cwd(), 'uploads', 'competitions')

export function ensureCompetitionUploadDir() {
  mkdirSync(COMPETITION_UPLOAD_DIR, { recursive: true })
}

export function localCompetitionImageRef(storedBasename) {
  const safe = basename(storedBasename)
  return `local:${safe}`
}

export function getLocalCompetitionDiskPathFromRef(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('local:')) return null
  const name = basename(ref.slice('local:'.length))
  if (!name || name.includes('..')) return null
  const full = resolve(COMPETITION_UPLOAD_DIR, name)
  const root = resolve(COMPETITION_UPLOAD_DIR)
  if (!full.startsWith(root)) return null
  return full
}

export function resolveCompetitionImagePathFromRef(ref) {
  const full = getLocalCompetitionDiskPathFromRef(ref)
  if (!full || !existsSync(full)) return null
  return full
}

export function deleteLocalCompetitionImageFromRef(ref) {
  const full = getLocalCompetitionDiskPathFromRef(ref)
  if (!full) return
  try {
    unlinkSync(full)
  } catch (e) {
    if (e && e.code === 'ENOENT') return
    throw e
  }
}

export function streamCompetitionImage(filePath, res) {
  const stream = createReadStream(filePath)
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).end()
  })
  stream.pipe(res)
}

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

export function storeCompetitionImageBuffer(buffer, mimeType) {
  ensureCompetitionUploadDir()
  const ext = EXT_BY_MIME[mimeType] || '.jpg'
  const storedBasename = `${randomUUID()}${ext}`
  const full = join(COMPETITION_UPLOAD_DIR, storedBasename)
  writeFileSync(full, buffer)
  return localCompetitionImageRef(storedBasename)
}
