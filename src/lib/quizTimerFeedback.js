import { QUIZ_VOICEOVER } from '../../shared/quizVoiceover.mjs'

let audioContext = null
const cueAudio = new Map()

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    audioContext = new Ctx()
  }
  return audioContext
}

function getCueAudio(src) {
  if (typeof window === 'undefined') return null
  if (!cueAudio.has(src)) {
    const audio = new Audio(src)
    audio.preload = 'auto'
    cueAudio.set(src, audio)
  }
  return cueAudio.get(src)
}

async function playVoiceClip(src) {
  const audio = getCueAudio(src)
  if (!audio) return
  try {
    audio.pause()
    audio.currentTime = 0
    await audio.play()
  } catch {
    /* autoplay blocked until user gesture */
  }
}

/** Call once after a user gesture so clock ticks and voice clips are allowed. */
export function primeQuizTimerAudio() {
  const ctx = getAudioContext()
  if (ctx?.state === 'suspended') void ctx.resume()
  for (const src of Object.values(QUIZ_VOICEOVER)) {
    getCueAudio(src)?.load()
  }
}

/** Mechanical clock tick — filtered click plus a short wooden block tone. */
export function playClockTick({ accent = false } = {}) {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()

    const now = ctx.currentTime
    const duration = accent ? 0.032 : 0.026
    const sampleRate = ctx.sampleRate
    const length = Math.max(1, Math.floor(sampleRate * duration))
    const buffer = ctx.createBuffer(1, length, sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < length; i += 1) {
      const env = Math.exp(-i / (length * 0.2))
      data[i] = (Math.random() * 2 - 1) * env
    }

    const tickGain = ctx.createGain()
    tickGain.connect(ctx.destination)
    tickGain.gain.setValueAtTime(accent ? 0.11 : 0.085, now)
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = accent ? 2600 : 2050
    filter.Q.value = accent ? 2.8 : 2.1
    noise.connect(filter)
    filter.connect(tickGain)
    noise.start(now)
    noise.stop(now + duration)

    const body = ctx.createOscillator()
    const bodyGain = ctx.createGain()
    body.type = 'triangle'
    body.frequency.setValueAtTime(accent ? 560 : 480, now)
    body.frequency.exponentialRampToValueAtTime(160, now + 0.014)
    body.connect(bodyGain)
    bodyGain.connect(ctx.destination)
    bodyGain.gain.setValueAtTime(accent ? 0.055 : 0.04, now)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022)
    body.start(now)
    body.stop(now + 0.024)
  } catch {
    /* audio blocked or unavailable */
  }
}

/** Neural voice clip when the question timer reaches 5 seconds. */
export function speakFiveSecondsWarning() {
  void playVoiceClip(QUIZ_VOICEOVER.fiveSeconds)
}

/** Neural voice clip when the one-off time-out extension starts. */
export function speakBonusUsed() {
  playClockTick({ accent: true })
  window.setTimeout(() => {
    void playVoiceClip(QUIZ_VOICEOVER.bonusUsed)
  }, 140)
}

/** @deprecated use playClockTick */
export function playTimerTick(options) {
  playClockTick(options)
}
