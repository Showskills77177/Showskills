/**
 * Music-bed segment trim for EOF Production (YouTube-style “pick this part”).
 * startSec / endSec are offsets into the source track (seconds).
 */

/**
 * @param {{ musicStartSec?: unknown, musicEndSec?: unknown, trackDurationSec?: unknown }} opts
 * @returns {{ startSec: number, endSec: number | null }}
 */
export function normalizeEofMusicTrim(opts = {}) {
  const trackDur =
    opts.trackDurationSec != null && Number.isFinite(Number(opts.trackDurationSec))
      ? Math.max(0.5, Number(opts.trackDurationSec))
      : null

  let start = Math.max(0, Number(opts.musicStartSec) || 0)
  if (trackDur != null) start = Math.min(start, Math.max(0, trackDur - 0.5))

  let end = null
  if (opts.musicEndSec != null && opts.musicEndSec !== '' && Number.isFinite(Number(opts.musicEndSec))) {
    end = Number(opts.musicEndSec)
  }
  if (end != null) {
    if (trackDur != null) end = Math.min(end, trackDur)
    if (end <= start + 0.25) end = null
  }

  return {
    startSec: Number(start.toFixed(3)),
    endSec: end == null ? null : Number(end.toFixed(3)),
  }
}

/** Human label for the mixer UI. */
export function formatEofMusicTrimLabel({ startSec, endSec, trackDurationSec } = {}) {
  const t = normalizeEofMusicTrim({
    musicStartSec: startSec,
    musicEndSec: endSec,
    trackDurationSec,
  })
  const fmt = (s) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }
  if (t.endSec == null) {
    return t.startSec <= 0.05 ? 'Full track' : `From ${fmt(t.startSec)} → end`
  }
  return `${fmt(t.startSec)} – ${fmt(t.endSec)} (${fmt(t.endSec - t.startSec)} clip)`
}
