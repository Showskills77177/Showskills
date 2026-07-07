import { mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EdgeTTS } from 'node-edge-tts'
import { EOF_VOICE_PRESETS } from '../../../shared/eofProduction.mjs'
import { runFfprobe } from './eofFfmpeg.mjs'

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

/**
 * @param {{ text: string, voicePreset: string, outPath: string }} opts
 */
export async function synthesizeEofSceneNarration({ text, voicePreset, outPath }) {
  const preset = EOF_VOICE_PRESETS[voicePreset] || EOF_VOICE_PRESETS.british
  const line = String(text || '').trim()
  if (!line) throw new Error('Empty narration text.')

  mkdirSync(dirname(outPath), { recursive: true })

  const lang = preset.voice.startsWith('en-GB') ? 'en-GB' : 'en-US'
  const tts = new EdgeTTS({
    voice: preset.voice,
    lang,
    rate: preset.rate,
    timeout: 45000,
  })

  await tts.ttsPromise(line, outPath)
  if (!existsSync(outPath)) throw new Error('TTS output file missing.')
  return outPath
}

/**
 * @param {string} audioPath
 */
export async function probeAudioDurationSec(audioPath) {
  const { stdout } = await runFfprobe(
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath],
    { maxBuffer: 1024 * 1024 },
  )
  const n = Number.parseFloat(String(stdout).trim())
  return Number.isFinite(n) ? n : 0
}
