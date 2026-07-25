import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

let ffmpegPathCache
let ffprobePathCache

const MAX_ERROR_MESSAGE = 1400
const STDERR_EXCERPT = 700
/** Default kill timeout — serverless ffmpeg must never hang the Production UI forever. */
const DEFAULT_FFMPEG_TIMEOUT_MS = Number(process.env.EOF_FFMPEG_TIMEOUT_MS) || 90_000
const DEFAULT_FFPROBE_TIMEOUT_MS = Number(process.env.EOF_FFPROBE_TIMEOUT_MS) || 30_000

function resolveExecTimeoutMs(optsTimeout, fallback) {
  const n = Number(optsTimeout)
  if (Number.isFinite(n) && n > 0) return Math.max(5_000, n)
  return Math.max(5_000, fallback)
}

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

  // Do NOT import `ffprobe-static` — it ships ~300MB of multi-arch binaries and
  // Vercel NFT pulls it into every api/* function that statically imports EOF
  // video code (including /api/admin/login), causing FUNCTION_INVOCATION_FAILED.
  // Prefer PATH ffprobe, or the same dir as ffmpeg-static when present.
  try {
    const ffmpegBin = await resolveFfmpegPath()
    if (ffmpegBin && ffmpegBin !== 'ffmpeg') {
      const sibling = String(ffmpegBin).replace(/ffmpeg(\.exe)?$/i, (_, ext) => `ffprobe${ext || ''}`)
      if (sibling !== ffmpegBin && existsSync(sibling)) {
        ffprobePathCache = sibling
        return sibling
      }
    }
  } catch {
    /* fall through */
  }

  ffprobePathCache = 'ffprobe'
  return ffprobePathCache
}

/**
 * @param {string[]} args
 * @param {import('node:child_process').ExecFileOptions & { timeoutMs?: number }} [opts]
 */
export async function runFfmpeg(args, opts = {}) {
  const bin = await resolveFfmpegPath()
  const { timeoutMs, timeout, ...rest } = opts
  const ms = resolveExecTimeoutMs(timeoutMs ?? timeout, DEFAULT_FFMPEG_TIMEOUT_MS)
  try {
    return await execFileAsync(bin, args, {
      ...rest,
      timeout: ms,
      killSignal: 'SIGKILL',
    })
  } catch (err) {
    if (err?.killed || err?.signal === 'SIGKILL' || err?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      const timedOut = err?.killed || err?.signal === 'SIGKILL'
      if (timedOut) {
        throw formatBinaryError(
          'ffmpeg',
          new Error(`timed out after ${Math.round(ms / 1000)}s — scene encode hung; retry Build`),
        )
      }
    }
    throw formatBinaryError('ffmpeg', err)
  }
}

/**
 * @param {string[]} args
 * @param {import('node:child_process').ExecFileOptions & { timeoutMs?: number }} [opts]
 */
export async function runFfprobe(args, opts = {}) {
  const bin = await resolveFfprobePath()
  const { timeoutMs, timeout, ...rest } = opts
  const ms = resolveExecTimeoutMs(timeoutMs ?? timeout, DEFAULT_FFPROBE_TIMEOUT_MS)
  try {
    return await execFileAsync(bin, args, {
      ...rest,
      timeout: ms,
      killSignal: 'SIGKILL',
    })
  } catch (err) {
    if (err?.killed || err?.signal === 'SIGKILL') {
      throw formatBinaryError(
        'ffprobe',
        new Error(`timed out after ${Math.round(ms / 1000)}s`),
      )
    }
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
