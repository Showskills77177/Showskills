/**
 * Caption burn-in for EOF Shorts (ffmpeg drawtext).
 * - live / punch: free bottom / lower-third sports bars
 * - pop / karaoke / beast: CapCut mid-frame looks (free local burn on Build)
 * Works with ffmpeg-static (no libass required).
 *
 * Prefer `textfile=` (via textDir) for production burns so commas/apostrophes
 * in captions cannot break Linux ffmpeg-static filter parsing.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getEofCaptionStyle,
  resolveEofCaptionStyle,
} from '../../../shared/eofCaptionStyles.mjs'
import {
  captionLayoutFontSize,
  captionLayoutYExpr,
  normalizeEofCaptionLayout,
} from '../../../shared/eofCaptionLayout.mjs'

/** Escape font/file paths for drawtext single-quoted values (not filter-text escaping). */
export function escapeFilterPath(value) {
  return String(value || '').replace(/'/g, "'\\''")
}

/**
 * Sanitize curly / smart punctuation so caption text is filter-safe.
 * Converts smart quotes to ASCII or typographic apostrophe before beat building.
 */
export function sanitizeCaptionPunctuation(caption) {
  return String(caption || '')
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B`]/g, '\u2019')
    .replace(/'/g, '\u2019')
}

/**
 * Escape text for ffmpeg drawtext inline `text=` values (commas split filter chains).
 * Apostrophes become U+2019 so Linux ffmpeg-static does not choke on `\'`.
 */
export function escapeDrawtext(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/:/g, '\\:')
    .replace(/['\u2018\u2019\u201A\u201B`]/g, '\u2019')
    .replace(/%/g, '\\%')
}

/**
 * Prefer textfile= when textDir is available (production); fall back to escaped text=.
 * @returns {string} e.g. `textfile='/tmp/c-0.txt'` or `text='Hello\\, world'`
 */
function drawtextTextOption({ text, textDir, fileBase }) {
  const raw = String(text || '')
  if (textDir) {
    const filePath = join(textDir, `${fileBase}.txt`)
    writeFileSync(filePath, raw, 'utf8')
    return `textfile='${escapeFilterPath(filePath)}'`
  }
  return `text='${escapeDrawtext(raw)}'`
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
  const words = wordsOf(sanitizeCaptionPunctuation(caption))
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
function buildPopFilters({ beats, captionFont, displayWords, textDir, layout }) {
  const escapedFont = escapeFilterPath(captionFont)
  const filters = []
  const n = Math.max(1, Math.min(3, displayWords || 2))
  const y = captionLayoutYExpr(layout)
  const hold = captionLayoutFontSize(92, layout)
  const peak = captionLayoutFontSize(108, layout)
  const startFs = captionLayoutFontSize(72, layout)

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

  for (let gi = 0; gi < groups.length; gi++) {
    const beat = groups[gi]
    const upper = beat.text.toUpperCase()
    const textOpt = drawtextTextOption({ text: upper, textDir, fileBase: `pop-${gi}` })
    const start = Math.max(0, beat.start)
    const end = Math.max(start + 0.15, beat.end)
    const local = `t-${start.toFixed(3)}`
    const fontsize = `if(lt(${local}\\,0.09)\\,${startFs}+${local}*380\\,if(lt(${local}\\,0.16)\\,${peak}\\,${hold}))`
    const alpha = `if(lt(${local}\\,0.05)\\,${local}/0.05\\,if(gt(t\\,${(end - 0.07).toFixed(3)})\\,(${end.toFixed(3)}-t)/0.07\\,1))`
    const flashEnd = Math.min(end, start + 0.14)

    filters.push(
      `drawtext=${fontExpr(escapedFont)}:${textOpt}:fontsize='${fontsize}':fontcolor=0xFFE566:borderw=14:bordercolor=black@0.92:shadowcolor=black@0.55:shadowx=0:shadowy=5:alpha='${alpha}':x=(w-text_w)/2:y=${y}:enable='between(t\\,${start.toFixed(3)}\\,${flashEnd.toFixed(3)})'`,
    )
    filters.push(
      `drawtext=${fontExpr(escapedFont)}:${textOpt}:fontsize=${hold}:fontcolor=white:borderw=12:bordercolor=black@0.94:shadowcolor=black@0.55:shadowx=0:shadowy=5:alpha='${alpha}':x=(w-text_w)/2:y=${y}:enable='between(t\\,${flashEnd.toFixed(3)}\\,${end.toFixed(3)})'`,
    )
  }
  return filters
}

/**
 * Karaoke — phrase window; active word yellow + larger, others white.
 * Approximate horizontal layout via character-width estimate.
 */
function buildKaraokeFilters({ beats, captionFont, displayWords, textDir, layout }) {
  const escapedFont = escapeFilterPath(captionFont)
  const filters = []
  const windowSize = Math.max(3, Math.min(5, displayWords || 4))
  const baseSize = captionLayoutFontSize(78, layout)
  const activeSize = captionLayoutFontSize(92, layout)
  const charW = 0.58 // fraction of fontsize for Latin bold
  const y = captionLayoutYExpr(layout)

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
      const textOpt = drawtextTextOption({
        text: p.text,
        textDir,
        fileBase: `karaoke-${i}-${j}`,
      })
      const fs = sizes[j]
      const wEst = widths[j]
      // Center the window, place each word
      const x = `(w-${totalW.toFixed(1)})/2+${offset.toFixed(1)}`
      const color = p.active ? '0xFFE566' : '0xF5F5F5'
      const border = p.active ? 13 : 10
      const alpha = `if(lt(t-${start.toFixed(3)}\\,0.04)\\,(t-${start.toFixed(3)})/0.04\\,1)`
      filters.push(
        `drawtext=${fontExpr(escapedFont)}:${textOpt}:fontsize=${fs}:fontcolor=${color}:borderw=${border}:bordercolor=black@0.93:shadowcolor=black@0.5:shadowx=0:shadowy=4:alpha='${alpha}':x=${x}:y=${y}:enable='between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})'`,
      )
      offset += wEst
    }
  }
  return filters
}

/**
 * Beast bounce — one huge word at a time, neon yellow with cyan flash.
 */
function buildBeastFilters({ beats, captionFont, textDir, layout }) {
  const escapedFont = escapeFilterPath(captionFont)
  const filters = []
  const y = captionLayoutYExpr(layout)
  const hold = captionLayoutFontSize(118, layout)
  const peak = captionLayoutFontSize(136, layout)
  const startFs = captionLayoutFontSize(90, layout)

  for (let bi = 0; bi < beats.length; bi++) {
    const beat = beats[bi]
    const upper = beat.text.toUpperCase()
    const textOpt = drawtextTextOption({ text: upper, textDir, fileBase: `beast-${bi}` })
    const start = Math.max(0, beat.start)
    const end = Math.max(start + 0.15, beat.end)
    const local = `t-${start.toFixed(3)}`
    const fontsize = `if(lt(${local}\\,0.08)\\,${startFs}+${local}*520\\,if(lt(${local}\\,0.15)\\,${peak}\\,${hold}))`
    const alpha = `if(lt(${local}\\,0.04)\\,${local}/0.04\\,if(gt(t\\,${(end - 0.06).toFixed(3)})\\,(${end.toFixed(3)}-t)/0.06\\,1))`
    const flashEnd = Math.min(end, start + 0.11)

    // Cyan neon flash
    filters.push(
      `drawtext=${fontExpr(escapedFont)}:${textOpt}:fontsize='${fontsize}':fontcolor=0x5CFFF5:borderw=16:bordercolor=black@0.95:shadowcolor=0x5CFFF5@0.35:shadowx=0:shadowy=0:alpha='${alpha}':x=(w-text_w)/2:y=${y}:enable='between(t\\,${start.toFixed(3)}\\,${flashEnd.toFixed(3)})'`,
    )
    // Hold yellow beast look
    filters.push(
      `drawtext=${fontExpr(escapedFont)}:${textOpt}:fontsize=${hold}:fontcolor=0xFFE566:borderw=15:bordercolor=black@0.95:shadowcolor=black@0.6:shadowx=0:shadowy=6:alpha='${alpha}':x=(w-text_w)/2:y=${y}:enable='between(t\\,${flashEnd.toFixed(3)}\\,${end.toFixed(3)})'`,
    )
  }
  return filters
}

/**
 * Free live-style subtitles: short phrases along the bottom safe zone
 * (above Subscribe watermark), white + heavy stroke — TV / YouTube CC.
 */
export function buildLiveSubtitleFilters({ beats, captionFont, displayWords = 5, textDir, layout }) {
  if (!captionFont || !beats?.length) return []
  const escapedFont = escapeFilterPath(captionFont)
  const chunk = Math.max(3, Math.min(7, Number(displayWords) || 5))
  const y = captionLayoutYExpr(layout)
  const fs = captionLayoutFontSize(54, layout)
  const filters = []
  for (let i = 0, gi = 0; i < beats.length; i += chunk, gi++) {
    const group = beats.slice(i, i + chunk)
    const phrase = group.map((b) => b.text).join(' ')
    if (!phrase) continue
    const textOpt = drawtextTextOption({ text: phrase, textDir, fileBase: `live-${gi}` })
    const start = group[0].start
    const end = group[group.length - 1].end
    filters.push(
      `drawtext=${fontExpr(escapedFont)}:${textOpt}:fontsize=${fs}:fontcolor=white:borderw=7:bordercolor=black@0.94:shadowcolor=black@0.65:shadowx=0:shadowy=4:x=(w-text_w)/2:y=${y}:enable='between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})'`,
    )
  }
  return filters
}

/**
 * Free sports “match bar”: uppercase lower-third in stadium yellow — football Shorts graphic.
 */
export function buildPunchSubtitleFilters({ beats, captionFont, displayWords = 4, textDir, layout }) {
  if (!captionFont || !beats?.length) return []
  const escapedFont = escapeFilterPath(captionFont)
  const chunk = Math.max(2, Math.min(5, Number(displayWords) || 4))
  const y = captionLayoutYExpr(layout)
  const fs = captionLayoutFontSize(56, layout)
  const filters = []
  for (let i = 0, gi = 0; i < beats.length; i += chunk, gi++) {
    const group = beats.slice(i, i + chunk)
    const phrase = group
      .map((b) => b.text)
      .join(' ')
      .toUpperCase()
    if (!phrase) continue
    const textOpt = drawtextTextOption({ text: phrase, textDir, fileBase: `punch-${gi}` })
    const start = group[0].start
    const end = group[group.length - 1].end
    const local = `t-${start.toFixed(3)}`
    const alpha = `if(lt(${local}\\,0.06)\\,${local}/0.06\\,if(gt(t\\,${(end - 0.08).toFixed(3)})\\,(${end.toFixed(3)}-t)/0.08\\,1))`
    filters.push(
      `drawtext=${fontExpr(escapedFont)}:${textOpt}:fontsize=${fs}:fontcolor=0xFFE566:borderw=9:bordercolor=black@0.96:shadowcolor=black@0.7:shadowx=0:shadowy=5:alpha='${alpha}':x=(w-text_w)/2:y=${y}:enable='between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})'`,
    )
  }
  return filters
}

/**
 * Build drawtext filters for a caption style.
 * @param {{ caption: string, durationSec: number, captionFont: string, style?: string, textDir?: string, layout?: object }} opts
 */
export function buildCaptionDrawtextFilters({
  caption,
  durationSec,
  captionFont,
  style,
  textDir,
  layout,
}) {
  if (!captionFont) return []
  const styleId = resolveEofCaptionStyle(style)
  const meta = getEofCaptionStyle(styleId)
  const beats = buildWordBeats(caption, durationSec)
  if (!beats.length) return []
  const lay = normalizeEofCaptionLayout(layout, styleId)

  if (styleId === 'live') {
    return buildLiveSubtitleFilters({
      beats,
      captionFont,
      displayWords: meta.displayWords,
      textDir,
      layout: lay,
    })
  }
  if (styleId === 'punch') {
    return buildPunchSubtitleFilters({
      beats,
      captionFont,
      displayWords: meta.displayWords,
      textDir,
      layout: lay,
    })
  }
  if (styleId === 'karaoke') {
    return buildKaraokeFilters({
      beats,
      captionFont,
      displayWords: meta.displayWords,
      textDir,
      layout: lay,
    })
  }
  if (styleId === 'beast') {
    return buildBeastFilters({ beats, captionFont, textDir, layout: lay })
  }
  return buildPopFilters({
    beats,
    captionFont,
    displayWords: meta.displayWords,
    textDir,
    layout: lay,
  })
}

/** Back-compat alias used by older callers. */
export function buildTikTokDrawtextFilters({ beats, captionFont, textDir }) {
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
    textDir,
  })
}
