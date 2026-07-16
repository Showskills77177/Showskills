import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

let ffmpegPathCache
let ffprobePathCache

const MAX_ERROR_MESSAGE = 1400
const STDERR_EXCERPT = 700

/**
 * Prefer a short stderr excerpt over Node's giant "Command failed: …argv…" message
 * so admin job error_message stays actionable.
 */
function formatBinaryError(binLabel, err) {
  const stderr = String(err?.stderr || err?.message || '').trim()
  const excerpt = stderr.slice(-STDERR_EXCERPT).trim() || String(err?.message || err || 'unknown error')
  const code = err?.code != null ? ` (code ${err.code})` : ''
  const msg = `${binLabel} failed${code}: ${excerpt}`
  const wrapped = new Error(msg.length > MAX_ERROR_MESSAGE ? `${msg.slice(0, MAX_ERROR_MESSAGE - 1)}…` : msg)
  wrapped.code = err?.code
  wrapped.stderr = err?.stderr
  wrapped.stdout = err?.stdout
  wrapped.cause = err
  return wrapped
}

async function resolveFfmpegPath() {
  if (ffmpegPathCache) return ffmpegPathCache

  const envPath = process.env.FFMPEG_PATH || process.env.EOF_FFMPEG_PATH
  if (envPath && existsSync(envPath)) {
    ffmpegPathCache = envPath
    return envPath
  }

  try {
    const mod = await import('ffmpeg-static')
    const bundled = mod.default || mod
    if (bundled && existsSync(bundled)) {
      ffmpegPathCache = bundled
      return bundled
    }
  } catch {
    // optional dependency — fall back to PATH
  }

  ffmpegPathCache = 'ffmpeg'
  return ffmpegPathCache
}

async function resolveFfprobePath() {
  if (ffprobePathCache) return ffprobePathCache

  const envPath = process.env.FFPROBE_PATH || process.env.EOF_FFPROBE_PATH
  if (envPath && existsSync(envPath)) {
    ffprobePathCache = envPath
    return envPath
  }

  try {
    const mod = await import('ffprobe-static')
    const bundled = mod.path || mod.default?.path || mod.default
    if (bundled && existsSync(bundled)) {
      ffprobePathCache = bundled
      return bundled
    }
  } catch {
    // optional dependency — fall back to PATH
  }

  ffprobePathCache = 'ffprobe'
  return ffprobePathCache
}

/**
 * @param {string[]} args
 * @param {import('node:child_process').ExecFileOptions} [opts]
 */
export async function runFfmpeg(args, opts) {
  const bin = await resolveFfmpegPath()
  try {
    return await execFileAsync(bin, args, opts)
  } catch (err) {
    throw formatBinaryError('ffmpeg', err)
  }
}

/**
 * @param {string[]} args
 * @param {import('node:child_process').ExecFileOptions} [opts]
 */
export async function runFfprobe(args, opts) {
  const bin = await resolveFfprobePath()
  try {
    return await execFileAsync(bin, args, opts)
  } catch (err) {
    throw formatBinaryError('ffprobe', err)
  }
}

export async function hasBundledFfmpeg() {
  try {
    const mod = await import('ffmpeg-static')
    const bundled = mod.default || mod
    return Boolean(bundled && existsSync(bundled))
  } catch {
    return false
  }
}

export async function isFfmpegAvailable({ timeoutMs = 15000 } = {}) {
  if (await hasBundledFfmpeg()) return true

  const envPath = process.env.FFMPEG_PATH || process.env.EOF_FFMPEG_PATH
  if (envPath && existsSync(envPath)) return true

  return Promise.race([
    (async () => {
      try {
        await runFfmpeg(['-version'], { maxBuffer: 1024 * 1024 })
        return true
      } catch {
        return false
      }
    })(),
    new Promise((resolve) => {
      setTimeout(() => resolve(false), timeoutMs)
    }),
  ])
}
