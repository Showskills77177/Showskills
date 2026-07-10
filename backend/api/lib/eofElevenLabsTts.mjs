/**
 * ElevenLabs TTS for EOF production (Brian voice).
 * Docs: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
 */
import { writeFile } from 'node:fs/promises'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/** Premade “Brian — Deep, Resonant and Comforting” */
export const ELEVENLABS_BRIAN_VOICE_ID = 'nPczCjzI2devNBz1zQrb'

export function getElevenLabsApiKey() {
  return (process.env.ELEVENLABS_API_KEY || process.env.EOF_ELEVENLABS_API_KEY || '').trim()
}

export function isEofElevenLabsConfigured() {
  return Boolean(getElevenLabsApiKey())
}

/**
 * @param {{
 *   text: string,
 *   outPath: string,
 *   voiceId?: string,
 *   modelId?: string,
 *   stability?: number,
 *   similarityBoost?: number,
 *   style?: number,
 * }} opts
 */
export async function synthesizeElevenLabsSpeech({
  text,
  outPath,
  voiceId = ELEVENLABS_BRIAN_VOICE_ID,
  modelId,
  stability = 0.45,
  similarityBoost = 0.75,
  style = 0.35,
}) {
  const key = getElevenLabsApiKey()
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set on the server.')

  const line = String(text || '').trim()
  if (!line) throw new Error('Empty narration text.')

  const model =
    (modelId || process.env.ELEVENLABS_MODEL || process.env.EOF_ELEVENLABS_MODEL || 'eleven_multilingual_v2').trim()
  const vid = String(voiceId || ELEVENLABS_BRIAN_VOICE_ID).trim() || ELEVENLABS_BRIAN_VOICE_ID
  const outputFormat = (process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128').trim()

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vid)}?output_format=${encodeURIComponent(outputFormat)}`

  const maxAttempts = 3
  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: line,
          model_id: model,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: true,
          },
        }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`ElevenLabs ${res.status}: ${errText.slice(0, 240) || res.statusText}`)
      }

      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 500) throw new Error('ElevenLabs returned empty audio.')

      mkdirSync(dirname(outPath), { recursive: true })
      await writeFile(outPath, buf)
      return outPath
    } catch (e) {
      lastError = e
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * attempt))
      }
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError || 'TTS failed')
  throw new Error(`ElevenLabs TTS failed after ${maxAttempts} attempts: ${msg}`)
}
