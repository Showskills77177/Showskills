/**
 * Caption burn-in for EOF Shorts (ffmpeg drawtext).
 * - live: free bottom subtitles
 * - pop / karaoke / beast: CapCut mid-frame looks (local fallback only)
 * Works with ffmpeg-static (no libass required).
 */
import {
  getEofCaptionStyle,
  resolveEofCaptionStyle,
} from '../../../shared/eofCaptionStyles.mjs'

/** Escape text for ffmpeg drawtext `text=` values (commas split filter chains). */
export function escapeDrawtext(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
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
  const words = wordsOf(caption)
  if (!words.length) return [{ text: '…', start: 0.08, end: Math.max(1.2, Number(durationSec) || 3), index: 0 }]

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

/** @deprecated use buildWordBeats + style filters */
export function chunkCaptionForTikTok(caption) {
  const words = wordsOf(caption)
  if (!words.length) return ['…']
  const chunks = []
  let i = 0
  while (i < words.length) {
    const w1 = words[i]
    const w2 = words[i + 1]
    const w3 = words[i + 2]
    if (w2 && w1.length + w2.length <= 16) {
      if (w3 && w1.length + w2.length + w3.length <= 18 && w3.length <= 5) {
        chunks.push(`${w1} ${w2} ${w3}`)
        i += 3
      } else {
        chunks.push(`${w1} ${w2}`)
        i += 2
      }
    } else {
      chunks.push(w1)
      i += 1
    }
  }
  return chunks.slice(0, 12)
}

/** @deprecated */
export function buildTikTokCaptionBeats(caption, durationSec) {
  const chunks = chunkCaptionForTikTok(caption)
  const words = chunks.join(' ')
  return buildWordBeats(words, durationSec).map((b, i) => ({
    ...b,
    text: chunks[i] || b.text,
  })).slice(0, chunks.length)
}

function fontExpr(escapedFont) {
  return `fontfile='${escapedFont}'`
}

/**
 * Pop / Hormozi — 1–2 words flash yellow then hold white with bounce.
 */
function buildPopFilters({ beats, captionFont, displayWords }) {
  const escapedFont = captionFont.replace(/'/g, "'\\''")
  const filters = []
  const n = Math.max(1, Math.min(3, displayWords || 2))

  // Group into n-word chunks using word beats
  const groups = []
  for (let i = 0; i < beats.length; i += n) {
    const slice = beats.slice(i, i + n)
    groups.push({
      text: slice.map((b) => b.text).join(' '),
      start: slice[0].start,
      end: slice[slice.length - 1].end,
    })
  }

  for (const beat of groups) {
    const text = escapeDrawtext(beat.text.toUpperCase())
    const start = Math.max(0, beat.start)
    const end = Math.max(start + 0.15, beat.end)
    const local = `t-${start.toFixed(3)}`
    const fontsize = `if(lt(${local}\\,0.09)\\,72+${local}*380\\,if(lt(${local}\\,0.16)\\,108\\,92))`
    const alpha = `if(lt(${local}\\,0.05)\\,${local}/0.05\\,if(gt(t\\,${(end - 0.07).toFixed(3)})\\,(${end.toFixed(3)}-t)/0.07\\,1))`
    const flashEnd = Math.min(end, start + 0.14)
    const y = '(h-text_h)/2+90'

    filters.push(
      `drawtext=${fontExpr(escapedFont)}:text='${text}':fontsize='${fontsize}':fontcolor=0xFFE566:borderw=14:bordercolor=black@0.92:shadowcolor=black@0.55:shadowx=0:shadowy=5:alpha='${alpha}':x=(w-text_w)/2:y=${y}:enable='between(t\\,${start.toFixed(3)}\\,${flashEnd.toFixed(3)})'`,
    )
    filters.push(
      `drawtext=${fontExpr(escapedFont)}:text='${text}':fontsize=92:fontcolor=white:borderw=12:bordercolor=black@0.94:shadowcolor=black@0.55:shadowx=0:shadowy=5:alpha='${alpha}':x=(w-text_w)/2:y=${y}:enable='between(t\\,${flashEnd.toFixed(3)}\\,${end.toFixed(3)})'`,
    )
  }
  return filters
}

/**
 * Karaoke — phrase window; active word yellow + larger, others white.
 * Approximate horizontal layout via character-width estimate.
 */
function buildKaraokeFilters({ beats, captionFont, displayWords }) {
  const escapedFont = captionFont.replace(/'/g, "'\\''")
  const filters = []
  const windowSize = Math.max(3, Math.min(5, displayWords || 4))
  const baseSize = 78
  const activeSize = 92
  const charW = 0.58 // fraction of fontsize for Latin bold

  for (let i = 0; i < beats.length; i++) {
    const active = beats[i]
    const start = Math.max(0, active.start)
    const end = Math.max(start + 0.12, active.end)
    const winStart = Math.max(0, i - Math.floor((windowSize - 1) / 2))
    const winEnd = Math.min(beats.length, winStart + windowSize)
    const window = beats.slice(winStart, winEnd)
    const activeInWin = i - winStart

    const parts = window.map((b, j) => ({
      text: b.text.toUpperCase(),
      active: j === activeInWin,
    }))
    const sizes = parts.map((p) => (p.active ? activeSize : baseSize))
    const widths = parts.map((p, j) => Math.max(1, p.text.length) * sizes[j] * charW + 18)
    const totalW = widths.reduce((a, b) => a + b, 0)

    let offset = 0
    for (let j = 0; j < parts.length; j++) {
      const p = parts[j]
      const text = escapeDrawtext(p.text)
      const fs = sizes[j]
      const wEst = widths[j]
      // Center the window, place each word
      const x = `(w-${totalW.toFixed(1)})/2+${offset.toFixed(1)}`
      const y = '(h-text_h)/2+100'
      const color = p.active ? '0xFFE566' : '0xF5F5F5'
      const border = p.active ? 13 : 10
      const alpha = `if(lt(t-${start.toFixed(3)}\\,0.04)\\,(t-${start.toFixed(3)})/0.04\\,1)`
      filters.push(
        `drawtext=${fontExpr(escapedFont)}:text='${text}':fontsize=${fs}:fontcolor=${color}:borderw=${border}:bordercolor=black@0.93:shadowcolor=black@0.5:shadowx=0:shadowy=4:alpha='${alpha}':x=${x}:y=${y}:enable='between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})'`,
      )
      offset += wEst
    }
  }
  return filters
}

/**
 * Beast bounce — one huge word at a time, neon yellow with cyan flash.
 */
function buildBeastFilters({ beats, captionFont }) {
  const escapedFont = captionFont.replace(/'/g, "'\\''")
  const filters = []

  for (const beat of beats) {
    const text = escapeDrawtext(beat.text.toUpperCase())
    const start = Math.max(0, beat.start)
    const end = Math.max(start + 0.15, beat.end)
    const local = `t-${start.toFixed(3)}`
    const fontsize = `if(lt(${local}\\,0.08)\\,90+${local}*520\\,if(lt(${local}\\,0.15)\\,136\\,118))`
    const alpha = `if(lt(${local}\\,0.04)\\,${local}/0.04\\,if(gt(t\\,${(end - 0.06).toFixed(3)})\\,(${end.toFixed(3)}-t)/0.06\\,1))`
    const flashEnd = Math.min(end, start + 0.11)
    const y = '(h-text_h)/2+70'

    // Cyan neon flash
    filters.push(
      `drawtext=${fontExpr(escapedFont)}:text='${text}':fontsize='${fontsize}':fontcolor=0x5CFFF5:borderw=16:bordercolor=black@0.95:shadowcolor=0x5CFFF5@0.35:shadowx=0:shadowy=0:alpha='${alpha}':x=(w-text_w)/2:y=${y}:enable='between(t\\,${start.toFixed(3)}\\,${flashEnd.toFixed(3)})'`,
    )
    // Hold yellow beast look
    filters.push(
      `drawtext=${fontExpr(escapedFont)}:text='${text}':fontsize=118:fontcolor=0xFFE566:borderw=15:bordercolor=black@0.95:shadowcolor=black@0.6:shadowx=0:shadowy=6:alpha='${alpha}':x=(w-text_w)/2:y=${y}:enable='between(t\\,${flashEnd.toFixed(3)}\\,${end.toFixed(3)})'`,
    )
  }
  return filters
}

/**
 * Free live-style subtitles: short phrases along the bottom safe zone
 * (above Subscribe watermark), white on dark bar — like TV / YouTube CC.
 */
export function buildLiveSubtitleFilters({ beats, captionFont, displayWords = 6 }) {
  if (!captionFont || !beats?.length) return []
  const escapedFont = escapeDrawtext(captionFont)
  const chunk = Math.max(3, Math.min(8, Number(displayWords) || 6))
  const filters = []
  for (let i = 0; i < beats.length; i += chunk) {
    const group = beats.slice(i, i + chunk)
    const text = escapeDrawtext(group.map((b) => b.text).join(' '))
    if (!text) continue
    const start = group[0].start
    const end = group[group.length - 1].end
    // Bottom third, leave room for Subscribe CTA (~bottom 12%)
    filters.push(
      `drawtext=${fontExpr(escapedFont)}:text='${text}':fontsize=46:fontcolor=white:borderw=5:bordercolor=black@0.92:shadowcolor=black@0.55:shadowx=0:shadowy=3:x=(w-text_w)/2:y=h*0.78:enable='between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})'`,
    )
  }
  return filters
}

/**
 * Build drawtext filters for a caption style.
 * @param {{ caption: string, durationSec: number, captionFont: string, style?: string }} opts
 */
export function buildCaptionDrawtextFilters({ caption, durationSec, captionFont, style }) {
  if (!captionFont) return []
  const styleId = resolveEofCaptionStyle(style)
  const meta = getEofCaptionStyle(styleId)
  const beats = buildWordBeats(caption, durationSec)
  if (!beats.length) return []

  if (styleId === 'live') {
    return buildLiveSubtitleFilters({
      beats,
      captionFont,
      displayWords: meta.displayWords,
    })
  }
  if (styleId === 'karaoke') {
    return buildKaraokeFilters({ beats, captionFont, displayWords: meta.displayWords })
  }
  if (styleId === 'beast') {
    return buildBeastFilters({ beats, captionFont })
  }
  return buildPopFilters({ beats, captionFont, displayWords: meta.displayWords })
}

/** Back-compat alias used by older callers. */
export function buildTikTokDrawtextFilters({ beats, captionFont }) {
  if (!captionFont || !beats?.length) return []
  return buildPopFilters({
    beats: beats.map((b) => ({
      text: String(b.text || ''),
      start: b.start,
      end: b.end,
      index: b.index || 0,
    })),
    captionFont,
    displayWords: 2,
  })
}
