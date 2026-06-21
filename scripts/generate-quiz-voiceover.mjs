#!/usr/bin/env node
/** Regenerate bundled quiz voiceover MP3s (Microsoft Edge neural TTS — no API key). */
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/audio/quiz')
const voice = process.env.QUIZ_VOICEOVER_VOICE || 'en-GB-ThomasNeural'
const lang = voice.startsWith('en-GB') ? 'en-GB' : 'en-US'

const clips = [
  { file: 'five-seconds.mp3', text: 'Five seconds.', rate: '+8%' },
  { file: 'bonus-used.mp3', text: 'Five second bonus used.', rate: '+5%' },
]

mkdirSync(outDir, { recursive: true })

for (const clip of clips) {
  const filepath = resolve(outDir, clip.file)
  const cmd = [
    'npx',
    '--yes',
    'node-edge-tts',
    '-t',
    JSON.stringify(clip.text),
    '-v',
    voice,
    '-l',
    lang,
    '-r',
    clip.rate,
    '-f',
    filepath,
  ].join(' ')
  console.log(`Generating ${clip.file}…`)
  execSync(cmd, { cwd: root, stdio: 'inherit' })
}

console.log(`\nQuiz voiceover clips written to public/audio/quiz/ (${voice})`)
