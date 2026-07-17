import { useEffect, useMemo, useRef, useState } from 'react'
import { formatEofMusicTrimLabel, normalizeEofMusicTrim } from '../../../../shared/eofMusicTrim.mjs'

function fmtTime(sec) {
  const s = Math.max(0, Number(sec) || 0)
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 10)
  return `${m}:${String(r).padStart(2, '0')}.${ms}`
}

/**
 * YouTube-style music segment picker — drag the window to choose which part of the bed plays.
 */
export default function EofMusicSegmentMixer({
  track,
  startSec = 0,
  endSec = null,
  onChange,
  disabled = false,
}) {
  const audioRef = useRef(null)
  const trimRef = useRef({ startSec: 0, endSec: null, duration: 0 })
  const railRef = useRef(null)
  const dragRef = useRef(null)
  const [duration, setDuration] = useState(
    track?.durationSeconds != null && Number(track.durationSeconds) > 0
      ? Number(track.durationSeconds)
      : 0,
  )
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(0)

  const trim = useMemo(
    () =>
      normalizeEofMusicTrim({
        musicStartSec: startSec,
        musicEndSec: endSec,
        trackDurationSec: duration || track?.durationSeconds,
      }),
    [startSec, endSec, duration, track?.durationSeconds],
  )

  const effectiveEnd = trim.endSec != null ? trim.endSec : duration || trim.startSec + 30
  const span = Math.max(0.5, (duration || effectiveEnd) - 0)

  trimRef.current = { startSec: trim.startSec, endSec: trim.endSec, duration }

  // Always rebuild the Audio element when the track changes so preview isn't stuck on the last song.
  useEffect(() => {
    const prev = audioRef.current
    if (prev) {
      try {
        prev.pause()
        prev.removeAttribute('src')
        prev.load()
      } catch {
        /* ignore */
      }
      audioRef.current = null
    }
    setPlaying(false)
    setPlayhead(0)
    setDuration(
      track?.durationSeconds != null && Number(track.durationSeconds) > 0
        ? Number(track.durationSeconds)
        : 0,
    )

    const url = track?.publicUrl
    if (!url) return undefined

    const a = new Audio()
    a.preload = 'metadata'
    a.src = url
    const onMeta = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) setDuration(a.duration)
    }
    const onTime = () => {
      setPlayhead(a.currentTime)
      const t = trimRef.current
      const stopAt = t.endSec != null ? t.endSec : t.duration || a.duration
      if (Number.isFinite(stopAt) && a.currentTime >= stopAt - 0.04) {
        a.pause()
        setPlaying(false)
      }
    }
    const onEnded = () => setPlaying(false)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnded)
    audioRef.current = a

    return () => {
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnded)
      try {
        a.pause()
        a.removeAttribute('src')
        a.load()
      } catch {
        /* ignore */
      }
      if (audioRef.current === a) audioRef.current = null
    }
  }, [track?.id, track?.publicUrl, track?.durationSeconds])

  function emit(nextStart, nextEnd) {
    if (typeof onChange !== 'function' || disabled) return
    const n = normalizeEofMusicTrim({
      musicStartSec: nextStart,
      musicEndSec: nextEnd,
      trackDurationSec: duration || undefined,
    })
    onChange(n)
  }

  function pctToSec(clientX) {
    const rail = railRef.current
    if (!rail || !duration) return 0
    const rect = rail.getBoundingClientRect()
    const x = Math.min(Math.max(0, clientX - rect.left), rect.width)
    return (x / rect.width) * duration
  }

  function onPointerDown(kind, e) {
    if (disabled || !duration) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = { kind, startTrim: trim }
    if (kind === 'move') {
      dragRef.current.grabOffset = pctToSec(e.clientX) - trim.startSec
    }
  }

  function onPointerMove(e) {
    const drag = dragRef.current
    if (!drag || !duration) return
    const t = pctToSec(e.clientX)
    const minLen = Math.min(3, duration)
    if (drag.kind === 'start') {
      const nextStart = Math.min(Math.max(0, t), (trim.endSec ?? duration) - minLen)
      emit(nextStart, trim.endSec)
    } else if (drag.kind === 'end') {
      const nextEnd = Math.max(trim.startSec + minLen, Math.min(duration, t))
      emit(trim.startSec, nextEnd)
    } else if (drag.kind === 'move') {
      const len = (trim.endSec ?? duration) - trim.startSec
      let nextStart = t - (drag.grabOffset || 0)
      nextStart = Math.max(0, Math.min(duration - len, nextStart))
      emit(nextStart, nextStart + len)
    }
  }

  function onPointerUp() {
    dragRef.current = null
  }

  async function togglePreview() {
    if (!track?.publicUrl || disabled) return
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
      return
    }
    try {
      a.currentTime = trim.startSec
      await a.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  if (!track?.id) {
    return (
      <p className="mt-3 text-xs text-[#717171]">
        Pick a bed track to choose which part of the song plays under the voiceover.
      </p>
    )
  }

  const leftPct = duration ? (trim.startSec / span) * 100 : 0
  const widthPct = duration ? ((effectiveEnd - trim.startSec) / span) * 100 : 100
  const playPct = duration ? (playhead / span) * 100 : 0

  return (
    <div className="mt-4 rounded-xl border border-[#303030] bg-[#121212] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#d4d4d4]">
            Song segment · mixer
          </p>
          <p className="mt-0.5 text-xs text-[#aaa]">
            {track.title} — {formatEofMusicTrimLabel({ ...trim, trackDurationSec: duration })}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || !duration}
          onClick={togglePreview}
          className="rounded-lg border border-[#303030] bg-[#272727] px-3 py-1.5 text-xs text-white hover:bg-[#3f3f3f] disabled:opacity-40"
        >
          {playing ? 'Stop preview' : 'Preview segment'}
        </button>
      </div>

      {!duration ? (
        <p className="mt-3 text-xs text-[#717171]">Loading track length…</p>
      ) : (
        <>
          <div
            ref={railRef}
            className="relative mt-4 h-12 select-none touch-none rounded-lg bg-[#0d0d0d] ring-1 ring-[#303030]"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              className="pointer-events-none absolute inset-y-0 left-0 rounded-l-lg bg-black/55"
              style={{ width: `${leftPct}%` }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 rounded-r-lg bg-black/55"
              style={{ width: `${Math.max(0, 100 - leftPct - widthPct)}%` }}
            />
            <div
              className="absolute inset-y-1 cursor-grab rounded-md border border-white/40 bg-[#3ea6ff]/25 active:cursor-grabbing"
              style={{ left: `${leftPct}%`, width: `${Math.max(2, widthPct)}%` }}
              onPointerDown={(e) => onPointerDown('move', e)}
              title="Drag to move segment"
            />
            <button
              type="button"
              aria-label="Segment start"
              disabled={disabled}
              className="absolute top-0 z-10 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded-sm bg-white shadow"
              style={{ left: `${leftPct}%` }}
              onPointerDown={(e) => onPointerDown('start', e)}
            />
            <button
              type="button"
              aria-label="Segment end"
              disabled={disabled}
              className="absolute top-0 z-10 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded-sm bg-white shadow"
              style={{ left: `${leftPct + widthPct}%` }}
              onPointerDown={(e) => onPointerDown('end', e)}
            />
            {playing ? (
              <div
                className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-[#fbbf24]"
                style={{ left: `${playPct}%` }}
              />
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[#aaa]">
            <label className="flex items-center gap-1.5">
              Start
              <input
                type="number"
                min={0}
                max={duration}
                step={0.1}
                value={Number(trim.startSec.toFixed(1))}
                disabled={disabled}
                onChange={(e) => emit(Number(e.target.value), trim.endSec)}
                className="w-20 rounded-md border border-[#303030] bg-[#1a1a1a] px-2 py-1 text-white"
              />
            </label>
            <label className="flex items-center gap-1.5">
              End
              <input
                type="number"
                min={0}
                max={duration}
                step={0.1}
                value={Number(effectiveEnd.toFixed(1))}
                disabled={disabled}
                onChange={(e) => emit(trim.startSec, Number(e.target.value))}
                className="w-20 rounded-md border border-[#303030] bg-[#1a1a1a] px-2 py-1 text-white"
              />
            </label>
            <span className="tabular-nums text-[#717171]">
              Track {fmtTime(duration)} · clip {fmtTime(effectiveEnd - trim.startSec)}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => emit(0, duration)}
              className="text-[#8ab4f8] hover:underline disabled:opacity-40"
            >
              Use full track
            </button>
          </div>
        </>
      )}
    </div>
  )
}
