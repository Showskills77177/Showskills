import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

let ffmpegPathCache
let ffprobePathCache

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
  return execFileAsync(bin, args, opts)
}

/**
 * @param {string[]} args
 * @param {import('node:child_process').ExecFileOptions} [opts]
 */
export async function runFfprobe(args, opts) {
  const bin = await resolveFfprobePath()
  return execFileAsync(bin, args, opts)
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
