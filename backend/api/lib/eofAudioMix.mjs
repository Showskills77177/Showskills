import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import { promisify } from 'node:util'
import { probeAudioDurationSec } from './eofSceneTts.mjs'

const execFileAsync = promisify(execFile)

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

  await execFileAsync(
    'ffmpeg',
    ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', narrationOnly],
    { maxBuffer: 8 * 1024 * 1024 },
  )

  if (!musicFilePath || !existsSync(musicFilePath)) {
    await execFileAsync('ffmpeg', ['-y', '-i', narrationOnly, '-c:a', 'libmp3lame', '-q:a', '4', outputPath], {
      maxBuffer: 8 * 1024 * 1024,
    })
    return { outputPath, durationSec: await probeAudioDurationSec(outputPath), hasMusicBed: false }
  }

  const narrDur = await probeAudioDurationSec(narrationOnly)
  const fadeOutStart = Math.max(0, narrDur - 2)
  const musicDb = musicVolumeToDb(musicVolume)

  await execFileAsync(
    'ffmpeg',
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

export async function isFfmpegAvailable() {
  try {
    await execFileAsync('ffmpeg', ['-version'], { maxBuffer: 1024 * 1024 })
    return true
  } catch {
    return false
  }
}
