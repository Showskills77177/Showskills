import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { EdgeTTS } from 'node-edge-tts'
import { EOF_VOICE_PRESETS, EOF_DEFAULT_VOICE_PRESET } from '../../../shared/eofProduction.mjs'
import { resolveElevenLabsVoiceSettings } from '../../../shared/eofElevenLabsVoice.mjs'
import { runFfmpeg, runFfprobe } from './eofFfmpeg.mjs'
import { isEofElevenLabsConfigured, synthesizeElevenLabsSpeech } from './eofElevenLabsTts.mjs'
import {
  eofProductionJobDirPath,
  eofProductionWorkDir,
  eofProductionMixedAudioRelPath,
} from './eofProductionPaths.mjs'

export { eofProductionJobDirPath, eofProductionWorkDir, eofProductionMixedAudioRelPath }

function resolveVoicePreset(voicePreset) {
  const id = String(voicePreset || EOF_DEFAULT_VOICE_PRESET).trim()
  return EOF_VOICE_PRESETS[id] || EOF_VOICE_PRESETS[EOF_DEFAULT_VOICE_PRESET] || EOF_VOICE_PRESETS.brian
}

/**
 * @param {{
 *   text: string,
 *   voicePreset: string,
 *   voiceSettings?: Record<string, unknown> | null,
 *   regenerateFromRequestId?: string | null,
 *   outPath: string,
 * }} opts
 */
export async function synthesizeEofSceneNarration({
  text,
  voicePreset,
  voiceSettings,
  regenerateFromRequestId,
  outPath,
}) {
  const preset = resolveVoicePreset(voicePreset)
  const line = String(text || '').trim()
  if (!line) throw new Error('Empty narration text.')

  mkdirSync(dirname(outPath), { recursive: true })

  if (preset.engine === 'elevenlabs') {
    if (!isEofElevenLabsConfigured()) {
      throw new Error(
        'Brian (ElevenLabs) needs ELEVENLABS_API_KEY on the server. Add it in Vercel env, or pick a free Edge voice (British / British calm / American).',
      )
    }
    const resolved = resolveElevenLabsVoiceSettings(preset, voiceSettings)
    const result = await synthesizeElevenLabsSpeech({
      text: line,
      outPath,
      voiceId: preset.voiceId,
      modelId: preset.modelId,
      voiceSettings: resolved,
      regenerateFromRequestId,
    })
    return result
  }

  return synthesizeWithEdgeTts({ text: line, preset, outPath })
}

/** @returns {Promise<string | { outPath: string, requestId?: string | null }>} */
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
  try {
    const { stdout } = await runFfprobe(
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath],
      { maxBuffer: 1024 * 1024 },
    )
    const n = Number.parseFloat(String(stdout).trim())
    if (Number.isFinite(n) && n > 0) return n
  } catch {
    /* fall through — Vercel often has ffmpeg-static but no ffprobe binary */
  }

  try {
    await runFfmpeg(['-i', audioPath], { maxBuffer: 2 * 1024 * 1024 })
  } catch (err) {
    const blob = `${err?.stderr || ''}\n${err?.message || ''}`
    const m = blob.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i)
    if (m) {
      const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number.parseFloat(m[3])
      if (Number.isFinite(sec) && sec > 0) return sec
    }
  }
  return 0
}
