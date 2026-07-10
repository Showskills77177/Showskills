/**
 * TikTok / Reels style captions for EOF Shorts.
 * Word/chunk pop-ins with scale bounce — not static subtitle bars.
 */

/** Escape text for ffmpeg drawtext `text=` values. */
export function escapeDrawtext(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
}

/**
 * Split caption into punchy on-screen chunks (1–3 words).
 * @param {string} caption
 * @returns {string[]}
 */
export function chunkCaptionForTikTok(caption) {
  const words = String(caption || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
  if (!words.length) return ['…']

  const chunks = []
  let i = 0
  while (i < words.length) {
    const w1 = words[i]
    const w2 = words[i + 1]
    const w3 = words[i + 2]
    // Prefer 2-word beats; allow 3 if all short; single word if long/emphasis
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

/**
 * Build timed caption beats across a scene duration.
 * @param {string} caption
 * @param {number} durationSec
 */
export function buildTikTokCaptionBeats(caption, durationSec) {
  const chunks = chunkCaptionForTikTok(caption)
  const dur = Math.max(1.6, Number(durationSec) || 3)
  // Leave a tiny lead-in so the first pop is visible after the cut
  const leadIn = Math.min(0.12, dur * 0.04)
  const usable = Math.max(0.8, dur - leadIn - 0.08)
  const beat = usable / chunks.length

  return chunks.map((text, i) => {
    const start = leadIn + i * beat
    const end = i === chunks.length - 1 ? dur : leadIn + (i + 1) * beat
    return { text, start, end, index: i }
  })
}

/**
 * ffmpeg drawtext filters: one popping chunk at a time, mid-frame, thick outline.
 * Active beat scales up then settles (TikTok bounce).
 * @param {{ beats: Array<{ text: string, start: number, end: number }>, captionFont: string }} opts
 */
export function buildTikTokDrawtextFilters({ beats, captionFont }) {
  if (!captionFont || !beats?.length) return []

  const escapedFont = captionFont.replace(/'/g, "'\\''")
  const filters = []

  for (const beat of beats) {
    const text = escapeDrawtext(beat.text.toUpperCase())
    const start = Math.max(0, Number(beat.start) || 0)
    const end = Math.max(start + 0.15, Number(beat.end) || start + 0.5)
    const local = `t-${start.toFixed(3)}`
    // Bounce: grow fast, settle slightly smaller
    const fontsize = `if(lt(${local}\\,0.10)\\,78+${local}*320\\,if(lt(${local}\\,0.18)\\,110\\,96))`
    const alpha = `if(lt(${local}\\,0.06)\\,${local}/0.06\\,if(gt(t\\,${(end - 0.08).toFixed(3)})\\,(${end.toFixed(3)}-t)/0.08\\,1))`
    const flashEnd = Math.min(end, start + 0.16)

    // Yellow highlight flash on pop-in (TikTok accent)
    filters.push(
      `drawtext=fontfile='${escapedFont}':text='${text}':fontsize='${fontsize}':fontcolor=0xFFE566:borderw=12:bordercolor=black@0.9:shadowcolor=black@0.5:shadowx=0:shadowy=4:alpha='${alpha}':x=(w-text_w)/2:y=(h-text_h)/2+80:enable='between(t\\,${start.toFixed(3)}\\,${flashEnd.toFixed(3)})'`,
    )

    // Hold as bold white for the rest of the beat
    filters.push(
      `drawtext=fontfile='${escapedFont}':text='${text}':fontsize=96:fontcolor=white:borderw=10:bordercolor=black@0.92:shadowcolor=black@0.55:shadowx=0:shadowy=4:alpha='${alpha}':x=(w-text_w)/2:y=(h-text_h)/2+80:enable='between(t\\,${flashEnd.toFixed(3)}\\,${end.toFixed(3)})'`,
    )
  }

  return filters
}
