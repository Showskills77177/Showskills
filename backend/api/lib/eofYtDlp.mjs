import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

let ytDlpPathCache
let ytDlpAvailableCache

const MAX_ERROR_MESSAGE = 1400
const STDERR_EXCERPT = 700
/** Search/metadata calls should be quick; downloads get their own longer budget. */
const DEFAULT_SEARCH_TIMEOUT_MS = Number(process.env.EOF_YTDLP_SEARCH_TIMEOUT_MS) || 45_000
const DEFAULT_DOWNLOAD_TIMEOUT_MS = Number(process.env.EOF_YTDLP_DOWNLOAD_TIMEOUT_MS) || 120_000

function resolveExecTimeoutMs(optsTimeout, fallback) {
  const n = Number(optsTimeout)
  if (Number.isFinite(n) && n > 0) return Math.max(5_000, n)
  return Math.max(5_000, fallback)
}

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

function resolveYtDlpPath() {
  if (ytDlpPathCache) return ytDlpPathCache
  const envPath = process.env.YT_DLP_PATH
  if (envPath && existsSync(envPath)) {
    ytDlpPathCache = envPath
    return envPath
  }
  // Standalone binary is installed at this path by the Railway worker Dockerfile.
  const known = '/usr/local/bin/yt-dlp'
  if (existsSync(known)) {
    ytDlpPathCache = known
    return known
  }
  ytDlpPathCache = 'yt-dlp'
  return ytDlpPathCache
}

/**
 * True only when yt-dlp is actually reachable — used to gate the whole
 * real-footage feature so Vercel (which never ships yt-dlp) silently no-ops
 * instead of erroring, and so an un-provisioned Railway worker fails soft too.
 */
export async function isYtDlpAvailable() {
  if (ytDlpAvailableCache != null) return ytDlpAvailableCache
  try {
    const bin = resolveYtDlpPath()
    await execFileAsync(bin, ['--version'], { timeout: 10_000 })
    ytDlpAvailableCache = true
  } catch {
    ytDlpAvailableCache = false
  }
  return ytDlpAvailableCache
}

/**
 * @param {string[]} args
 * @param {import('node:child_process').ExecFileOptions & { timeoutMs?: number }} [opts]
 */
export async function runYtDlp(args, opts = {}) {
  const bin = resolveYtDlpPath()
  const { timeoutMs, ...rest } = opts
  const ms = resolveExecTimeoutMs(timeoutMs, DEFAULT_SEARCH_TIMEOUT_MS)
  try {
    return await execFileAsync(bin, args, {
      ...rest,
      timeout: ms,
      killSignal: 'SIGKILL',
      maxBuffer: 1024 * 1024 * 16,
    })
  } catch (err) {
    if (err?.killed || err?.signal === 'SIGKILL') {
      throw formatBinaryError('yt-dlp', new Error(`timed out after ${Math.round(ms / 1000)}s`))
    }
    throw formatBinaryError('yt-dlp', err)
  }
}

/**
 * Metadata-only search — never downloads. Returns parsed candidate metadata
 * objects from yt-dlp's `ytsearchN:` pseudo-URL, newline-delimited JSON.
 * @param {string} searchQuery
 * @param {{ maxResults?: number }} [opts]
 */
export async function ytDlpSearchMetadata(searchQuery, opts = {}) {
  const n = Math.max(1, Math.min(25, Number(opts.maxResults) || 8))
  const query = `ytsearch${n}:${searchQuery}`
  const { stdout } = await runYtDlp(
    [
      query,
      '--dump-json',
      '--skip-download',
      '--no-warnings',
      '--ignore-errors',
      '--no-playlist',
    ],
    { timeoutMs: DEFAULT_SEARCH_TIMEOUT_MS },
  )
  const lines = String(stdout || '').split('\n').filter((l) => l.trim())
  const out = []
  for (const line of lines) {
    try {
      const meta = JSON.parse(line)
      out.push({
        id: meta.id,
        title: meta.title,
        channel: meta.channel || meta.uploader,
        uploader: meta.uploader,
        duration: meta.duration,
        upload_date: meta.upload_date,
        webpage_url: meta.webpage_url || meta.original_url,
        view_count: meta.view_count,
        width: meta.width,
        height: meta.height,
      })
    } catch {
      /* skip unparseable line */
    }
  }
  return out
}

/**
 * Download a single video by URL with format/size constraints. Caller is
 * responsible for the Quality Gate — this just fetches the file.
 * @param {string} url
 * @param {string} outPath
 * @param {{ maxHeight?: number, maxFilesizeBytes?: number, timeoutMs?: number }} [opts]
 */
export async function ytDlpDownload(url, outPath, opts = {}) {
  const maxHeight = Math.max(240, Number(opts.maxHeight) || 1080)
  const maxFilesizeBytes = Math.max(1, Number(opts.maxFilesizeBytes) || 150 * 1024 * 1024)
  const format = `bv*[height<=${maxHeight}][ext=mp4]+ba[ext=m4a]/b[height<=${maxHeight}][ext=mp4]/b[ext=mp4]/b`
  await runYtDlp(
    [
      url,
      '-f', format,
      '--max-filesize', `${maxFilesizeBytes}`,
      '--no-playlist',
      '--no-warnings',
      '--merge-output-format', 'mp4',
      '-o', outPath,
    ],
    { timeoutMs: opts.timeoutMs || DEFAULT_DOWNLOAD_TIMEOUT_MS },
  )
  if (!existsSync(outPath)) {
    throw new Error('yt-dlp reported success but output file is missing')
  }
  return outPath
}
