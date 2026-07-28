import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { ytDlpDownload } from './eofYtDlp.mjs'

/**
 * Download a single ranked candidate to disk. Never uses the file as-is
 * afterward — this only fetches; Quality Gate + processing happen elsewhere.
 * @param {{ id: string, webpage_url?: string }} candidate
 * @param {string} workDir
 * @param {{ maxHeight?: number, maxFilesizeBytes?: number, timeoutMs?: number }} [opts]
 * @returns {Promise<{ path: string, sizeBytes: number } | null>}
 */
export async function downloadEofVideoCandidate(candidate, workDir, opts = {}) {
  const url = candidate?.webpage_url || (candidate?.id ? `https://www.youtube.com/watch?v=${candidate.id}` : null)
  if (!url) return null

  const footageDir = path.join(workDir, 'footage')
  mkdirSync(footageDir, { recursive: true })
  const outPath = path.join(footageDir, `${String(candidate.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`)

  try {
    await ytDlpDownload(url, outPath, opts)
  } catch (err) {
    cleanupEofVideoFile(outPath)
    throw err
  }

  if (!existsSync(outPath)) return null
  const sizeBytes = statSync(outPath).size
  return { path: outPath, sizeBytes }
}

export function cleanupEofVideoFile(filePath) {
  try {
    if (filePath && existsSync(filePath)) unlinkSync(filePath)
  } catch {
    /* best-effort cleanup */
  }
}
