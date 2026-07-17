import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { probeAudioDurationSec } from './eofSceneTts.mjs'
import { isFfmpegAvailable, runFfmpeg } from './eofFfmpeg.mjs'

export { isFfmpegAvailable }

const BUNDLED_WHOOSH_SFX = join(
  dirname(fileURLToPath(import.meta.url)),
  '../assets/sfx/whoosh.wav',
)

/** Soft CapCut-style UI swish for image-over-image pops (bundled PCM wav). */
export function resolveEofWhooshSfxPath() {
  const envPath = process.env.EOF_OVERLAY_WHOOSH_PATH
  if (envPath && existsSync(envPath)) return envPath
  if (existsSync(BUNDLED_WHOOSH_SFX)) return BUNDLED_WHOOSH_SFX
  return null
}

function musicVolumeToDb(volume) {
  const v = Math.max(0.05, Math.min(1, Number(volume) || 0.22))
  return 20 * Math.log10(v)
}

/**
 * Concatenate scene narration MP3s then mix with background music bed.
 * @param {{
 *   sceneAudioPaths: string[],
 *   musicFilePath: string | null,
 *   musicVolume: number,
 *   outputPath: string,
 * }} opts
 */
export async function mixEofNarrationWithMusic({
  sceneAudioPaths,
  musicFilePath,
  musicVolume,
  outputPath,
}) {
  const paths = sceneAudioPaths.filter((p) => p && existsSync(p))
  if (!paths.length) throw new Error('No narration audio to mix.')

  mkdirSync(dirname(outputPath), { recursive: true })

  const listFile = outputPath.replace(/\.mp3$/i, '.concat.txt')
  const narrationOnly = outputPath.replace(/\.mp3$/i, '.narration.mp3')

  const listBody = paths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  await import('node:fs/promises').then((fs) => fs.writeFile(listFile, listBody, 'utf8'))

  await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', narrationOnly], {
    maxBuffer: 8 * 1024 * 1024,
  })

  if (!musicFilePath || !existsSync(musicFilePath)) {
    await runFfmpeg(['-y', '-i', narrationOnly, '-c:a', 'libmp3lame', '-q:a', '4', outputPath], {
      maxBuffer: 8 * 1024 * 1024,
    })
    return { outputPath, durationSec: await probeAudioDurationSec(outputPath), hasMusicBed: false }
  }

  const narrDur = await probeAudioDurationSec(narrationOnly)
  const fadeOutStart = Math.max(0, narrDur - 2)
  const musicDb = musicVolumeToDb(musicVolume)

  await runFfmpeg(
    [
      '-y',
      '-i',
      narrationOnly,
      '-stream_loop',
      '-1',
      '-i',
      musicFilePath,
      '-filter_complex',
      `[1:a]volume=${musicDb}dB,afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOutStart}:d=2[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[out]`,
      '-map',
      '[out]',
      '-c:a',
      'libmp3lame',
      '-q:a',
      '4',
      outputPath,
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  )

  return {
    outputPath,
    durationSec: await probeAudioDurationSec(outputPath),
    hasMusicBed: true,
  }
}

/**
 * Mix short whoosh SFX onto an existing bed at absolute timestamps (under VO).
 * @param {{
 *   mixedAudioPath: string,
 *   sfxPath: string,
 *   events: Array<{ atSec: number, volume?: number }>,
 *   outputPath: string,
 * }} opts
 * @returns {Promise<string>} outputPath
 */
export async function mixOverlaySfxIntoAudio({ mixedAudioPath, sfxPath, events, outputPath }) {
  if (!mixedAudioPath || !existsSync(mixedAudioPath)) return mixedAudioPath
  if (!sfxPath || !existsSync(sfxPath)) return mixedAudioPath
  const timed = (Array.isArray(events) ? events : [])
    .map((e) => ({
      atSec: Math.max(0, Number(e?.atSec) || 0),
      volume: Math.max(0.05, Math.min(1, Number(e?.volume) || 0.28)),
    }))
    .filter((e) => Number.isFinite(e.atSec))
    .slice(0, 6)
  if (!timed.length) return mixedAudioPath

  mkdirSync(dirname(outputPath), { recursive: true })

  const inputs = ['-y', '-i', mixedAudioPath]
  for (let i = 0; i < timed.length; i += 1) {
    inputs.push('-i', sfxPath)
  }

  const parts = []
  for (let i = 0; i < timed.length; i += 1) {
    const delayMs = Math.round(timed[i].atSec * 1000)
    const vol = timed[i].volume
    // adelay needs channel count; mono|stereo form keeps ffmpeg happy across builds
    parts.push(
      `[${i + 1}:a]volume=${vol.toFixed(3)},adelay=${delayMs}|${delayMs},aformat=sample_fmts=fltp:channel_layouts=stereo[sfx${i}]`,
    )
  }
  const amixInputs = ['[0:a]', ...timed.map((_, i) => `[sfx${i}]`)].join('')
  const n = 1 + timed.length
  parts.push(
    `${amixInputs}amix=inputs=${n}:duration=first:dropout_transition=0:normalize=0[out]`,
  )

  await runFfmpeg(
    [
      ...inputs,
      '-filter_complex',
      parts.join(';'),
      '-map',
      '[out]',
      '-c:a',
      'libmp3lame',
      '-q:a',
      '4',
      outputPath,
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  )

  return outputPath
}
