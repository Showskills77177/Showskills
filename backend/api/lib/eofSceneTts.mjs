import { mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EdgeTTS } from 'node-edge-tts'
import { EOF_VOICE_PRESETS, EOF_DEFAULT_VOICE_PRESET } from '../../../shared/eofProduction.mjs'
import { resolveElevenLabsVoiceSettings } from '../../../shared/eofElevenLabsVoice.mjs'
import { runFfprobe } from './eofFfmpeg.mjs'
import { isEofElevenLabsConfigured, synthesizeElevenLabsSpeech } from './eofElevenLabsTts.mjs'

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

function resolveVoicePreset(voicePreset) {
  const id = String(voicePreset || EOF_DEFAULT_VOICE_PRESET).trim()
  return EOF_VOICE_PRESETS[id] || EOF_VOICE_PRESETS[EOF_DEFAULT_VOICE_PRESET] || EOF_VOICE_PRESETS.brian
}

/**
 * @param {{ text: string, voicePreset: string, voiceSettings?: Record<string, unknown> | null, outPath: string }} opts
 */
export async function synthesizeEofSceneNarration({ text, voicePreset, voiceSettings, outPath }) {
  const preset = resolveVoicePreset(voicePreset)
  const line = String(text || '').trim()
  if (!line) throw new Error('Empty narration text.')

  mkdirSync(dirname(outPath), { recursive: true })

  if (preset.engine === 'elevenlabs') {
    if (!isEofElevenLabsConfigured()) {
      throw new Error(
        'Brian (ElevenLabs) needs ELEVENLABS_API_KEY on the server. Add it in Vercel env, or pick a free Edge voice.',
      )
    }
    const resolved = resolveElevenLabsVoiceSettings(preset, voiceSettings)
    const result = await synthesizeElevenLabsSpeech({
      text: line,
      outPath,
      voiceId: preset.voiceId,
      modelId: preset.modelId,
      voiceSettings: resolved,
    })
    return result.outPath
  }

  return synthesizeWithEdgeTts({ text: line, preset, outPath })
}

async function synthesizeWithEdgeTts({ text, preset, outPath }) {
  const lang = String(preset.voice || '').startsWith('en-GB') ? 'en-GB' : 'en-US'
  const maxAttempts = 3
  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const tts = new EdgeTTS({
        voice: preset.voice,
        lang,
        rate: preset.rate || '-8%',
        timeout: 22000,
      })
      await tts.ttsPromise(text, outPath)
      if (existsSync(outPath)) return outPath
      throw new Error('TTS output file missing.')
    } catch (e) {
      lastError = e
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 400 * attempt))
      }
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError || 'TTS failed')
  throw new Error(`Edge TTS failed after ${maxAttempts} attempts: ${msg}`)
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
