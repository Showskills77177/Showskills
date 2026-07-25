/**
 * EOF Production on-disk paths (no ffmpeg / TTS imports).
 * Keep path helpers here so hub GET / job CRUD stay light on Vercel.
 */
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

function eofProductionStorageRoot() {
  if (process.env.EOF_PRODUCTION_WORK_ROOT) return process.env.EOF_PRODUCTION_WORK_ROOT
  if (process.env.VERCEL) return join('/tmp', 'showskills-eof')
  return join(root, 'storage', 'eof')
}

export function eofProductionJobDirPath(jobId) {
  return join(eofProductionStorageRoot(), 'jobs', jobId)
}

export function eofProductionWorkDir(jobId) {
  const dir = eofProductionJobDirPath(jobId)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Logical path stored on the job record (display / local dev). */
export function eofProductionMixedAudioRelPath(jobId) {
  if (process.env.VERCEL) return `tmp/showskills-eof/jobs/${jobId}/mixed.mp3`
  return `storage/eof/jobs/${jobId}/mixed.mp3`
}
