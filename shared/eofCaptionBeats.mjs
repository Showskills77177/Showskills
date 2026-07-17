/**
 * Character-weighted word beats for CapCut-style free burns (pop / karaoke / beast).
 * Shared by ffmpeg burn-in and Production UI motion thumbnails.
 */

export function sanitizeCaptionPunctuation(caption) {
  return String(caption || '')
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B`]/g, '\u2019')
    .replace(/'/g, '\u2019')
}

function wordsOf(caption) {
  return String(caption || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 24)
}

/**
 * Timed word beats — weight by character length so longer words hold longer.
 * @returns {Array<{ text: string, start: number, end: number, index: number }>}
 */
export function buildWordBeats(caption, durationSec) {
  const words = wordsOf(sanitizeCaptionPunctuation(caption))
  if (!words.length) {
    return [{ text: '…', start: 0.08, end: Math.max(1.2, Number(durationSec) || 3), index: 0 }]
  }

  const dur = Math.max(1.6, Number(durationSec) || 3)
  const leadIn = Math.min(0.1, dur * 0.03)
  const usable = Math.max(0.8, dur - leadIn - 0.06)
  const weights = words.map((w) => Math.max(3, w.replace(/[^a-zA-Z0-9]/g, '').length || 3))
  const total = weights.reduce((a, b) => a + b, 0)

  let t = leadIn
  return words.map((text, i) => {
    const slice = usable * (weights[i] / total)
    const start = t
    const end = i === words.length - 1 ? dur : t + slice
    t = end
    return { text, start, end, index: i }
  })
}
