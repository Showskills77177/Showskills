import { execFile } from 'node:child_process'
import { mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { EOF_VOICE_PRESETS } from '../../../shared/eofProduction.mjs'

const execFileAsync = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

export function eofProductionWorkDir(jobId) {
  const dir = join(root, 'storage', 'eof', 'jobs', jobId)
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * @param {{ text: string, voicePreset: string, outPath: string }} opts
 */
export async function synthesizeEofSceneNarration({ text, voicePreset, outPath }) {
  const preset = EOF_VOICE_PRESETS[voicePreset] || EOF_VOICE_PRESETS.british
  const line = String(text || '').trim()
  if (!line) throw new Error('Empty narration text.')

  mkdirSync(dirname(outPath), { recursive: true })

  const args = [
    '--yes',
    'node-edge-tts',
    '-t',
    line,
    '-v',
    preset.voice,
    '-l',
    preset.voice.startsWith('en-GB') ? 'en-GB' : 'en-US',
    '-r',
    preset.rate,
    '-f',
    outPath,
  ]

  await execFileAsync('npx', args, { cwd: root, maxBuffer: 8 * 1024 * 1024 })
  if (!existsSync(outPath)) throw new Error('TTS output file missing.')
  return outPath
}

/**
 * @param {string} audioPath
 */
export async function probeAudioDurationSec(audioPath) {
  const { stdout } = await execFileAsync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath],
    { maxBuffer: 1024 * 1024 },
  )
  const n = Number.parseFloat(String(stdout).trim())
  return Number.isFinite(n) ? n : 0
}
