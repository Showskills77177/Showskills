#!/usr/bin/env node
/**
 * Master + compress EOF music beds for fast preview loads without audible quality loss.
 *
 * - EBU loudnorm to a consistent Shorts-friendly bed level (I=-16 LUFS)
 * - High-quality 160 kbps MP3 — clean under VO, fast preview loads
 *
 * Usage: npm run master:eof-music
 */
import { readdir, rename, unlink, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const musicDir = join(root, 'public', 'eof', 'music')

/** Soft bed target — leaves headroom under narration when mixed at ~22% volume. */
const LOUDNORM = 'loudnorm=I=-16:TP=-1.5:LRA=11'

async function main() {
  const { runFfmpeg, isFfmpegAvailable } = await import('../backend/api/lib/eofFfmpeg.mjs')
  if (!(await isFfmpegAvailable())) {
    throw new Error('ffmpeg is not available (ffmpeg-static).')
  }

  const files = (await readdir(musicDir)).filter(
    (f) => f.endsWith('.mp3') && !f.startsWith('.') && !f.startsWith('default-'),
  )
  if (!files.length) {
    console.log('No MP3s in public/eof/music/')
    return
  }

  let savedBytes = 0
  for (const file of files) {
    const src = join(musicDir, file)
    const tmp = join(musicDir, `.mastering-${file}`)
    const before = (await stat(src)).size
    process.stdout.write(`Mastering ${file} (${(before / 1024).toFixed(0)} KB)… `)
    try {
      await runFfmpeg(
        [
          '-y',
          '-i',
          src,
          '-af',
          LOUDNORM,
          '-ar',
          '44100',
          '-ac',
          '2',
          '-c:a',
          'libmp3lame',
          // 128 kbps stereo — clean under Shorts VO, fast mixer previews
          '-b:a',
          '128k',
          tmp,
        ],
        { maxBuffer: 32 * 1024 * 1024 },
      )
      if (!existsSync(tmp)) throw new Error('mastered file missing')
      const after = (await stat(tmp)).size
      await rename(tmp, src)
      const delta = before - after
      savedBytes += Math.max(0, delta)
      const pct = before > 0 ? Math.round((1 - after / before) * 100) : 0
      console.log(`${(after / 1024).toFixed(0)} KB (${pct > 0 ? `−${pct}%` : 're-encoded'})`)
    } catch (e) {
      if (existsSync(tmp)) await unlink(tmp).catch(() => {})
      console.log('FAILED')
      console.error(' ', e instanceof Error ? e.message : e)
    }
  }

  console.log(`\nDone. Freed ~${(savedBytes / 1024 / 1024).toFixed(2)} MB. Mix also auto-masters beds at render.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
