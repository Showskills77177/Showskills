import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../../../lib/api'
import {
  productionJobStatusLabel,
  estimateEofVideoRenderDurationSec,
  estimateEofRenderDurationSec,
  estimateEofVoiceoverRemuxDurationSec,
  refreshEofRenderProgress,
  buildFallbackRenderProgress,
  EOF_DEFAULT_VOICE_PRESET,
  EOF_DEFAULT_MUSIC_VOLUME,
} from '../../../../shared/eofProduction.mjs'
import EofMusicSegmentMixer from './EofMusicSegmentMixer'
import {
  EOF_DEFAULT_SCRIPT_FORMAT,
  createEofScene,
  EOF_MAX_SCENES,
  EOF_MIN_SCENES,
} from '../../../../shared/eofScriptTemplates.mjs'
import {
  EOF_ELEVENLABS_VOICE_FIELDS,
  EOF_ELEVENLABS_VOICE_LIMITS,
  normalizeElevenLabsVoiceSettings,
} from '../../../../shared/eofElevenLabsVoice.mjs'
import { eofVoiceRegenerationStatus } from '../../../../shared/eofVoiceRegeneration.mjs'
import {
  EOF_DEFAULT_CAPTION_STYLE,
  isBottomBarCaptionStyle,
  isLocalCaptionStyle,
  isZapcapCaptionStyle,
} from '../../../../shared/eofCaptionStyles.mjs'
import { buildWordBeats } from '../../../../shared/eofCaptionBeats.mjs'
import {
  defaultEofCaptionLayout,
  normalizeEofCaptionLayout,
  EOF_CAPTION_LAYOUT_Y_MIN,
  EOF_CAPTION_LAYOUT_Y_MAX,
  EOF_CAPTION_LAYOUT_SCALE_MIN,
  EOF_CAPTION_LAYOUT_SCALE_MAX,
} from '../../../../shared/eofCaptionLayout.mjs'
import {
  EOF_DEFAULT_TRANSITION_STYLE,
  EOF_DEFAULT_COLOR_GRADE,
  EOF_DEFAULT_ENHANCE_STYLE,
  EOF_TRANSITION_STYLES,
  EOF_COLOR_GRADES,
  EOF_ENHANCE_STYLES,
} from '../../../../shared/eofVideoLook.mjs'
import {
  EOF_DEFAULT_OVERLAY_MOMENTS,
  EOF_OVERLAY_MOMENTS_OPTIONS,
} from '../../../../shared/eofOverlayMoments.mjs'
import {
  EOF_DEFAULT_VIDEO_EFFECTS,
  EOF_EFFECT_STACKING_RULE,
  EOF_MOTION_EFFECTS,
  EOF_LIGHT_EFFECTS,
  EOF_COLOUR_EFFECTS,
  EOF_EFFECT_PRESETS,
  normalizeEofVideoEffects,
  pickEofVideoEffect,
  summarizeEofVideoEffects,
} from '../../../../shared/eofVideoEffects.mjs'
import {
  EOF_DEFAULT_STICKERS,
  EOF_MAX_STICKERS,
  EOF_STICKERS_STACKING_RULE,
  EOF_STICKERS_CATALOG,
  EOF_STICKER_POSITIONS,
  normalizeEofStickers,
  pickEofSticker,
  setEofStickerPosition,
  summarizeEofStickers,
  listEofStickersByCategory,
} from '../../../../shared/eofStickersElements.mjs'

/** Clean Production chrome — keep Studio gray panels so cards don’t blend into page black. */
const PX = {
  surface: 'rounded-2xl border border-[#303030] bg-[#212121]',
  surfaceInset: 'rounded-2xl border border-[#303030] bg-[#1a1a1a]',
  title: 'text-[22px] font-medium tracking-tight text-white',
  subtitle: 'text-sm text-[#aaaaaa]',
  label: 'text-[13px] font-medium text-[#aaaaaa]',
  muted: 'text-[#aaaaaa]',
  hairline: 'border-[#303030]',
  btnPrimary:
    'rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-[#e8e8e8] disabled:opacity-40',
  btnGhost:
    'rounded-xl border border-[#303030] bg-transparent px-3.5 py-2 text-sm text-[#e5e5e5] transition hover:bg-[#2a2a2a] disabled:opacity-40',
  btnSoft:
    'rounded-xl bg-[#272727] px-3.5 py-2 text-sm text-white transition hover:bg-[#3f3f3f] disabled:opacity-40',
  btnDanger:
    'rounded-xl border border-[#303030] px-3.5 py-2 text-sm text-[#ff9b95] transition hover:bg-[#2a1515] disabled:opacity-40',
}

const inputCls =
  'mt-1.5 w-full rounded-xl border border-[#303030] bg-[#121212] px-3.5 py-2.5 text-sm text-white placeholder:text-[#717171] outline-none transition focus:border-[#555]'
const SELECTED_JOB_KEY = 'eof_production_selected_job'

const FREE_CAPTION_PREVIEW_SAMPLE = 'Spain beat Belgium last night'
const FREE_CAPTION_PREVIEW_LOOP_SEC = 3.2

/** Looping clock for free CapCut-style caption thumbs (no video decode). */
function useLoopClock(durationSec) {
  const [t, setT] = useState(0)
  useEffect(() => {
    const dur = Math.max(1.2, Number(durationSec) || 3)
    let raf = 0
    const start = performance.now()
    const tick = (now) => {
      setT(((now - start) / 1000) % dur)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [durationSec])
  return t
}

/**
 * In-place motion thumb for free Pop / Karaoke / Beast burns.
 * Uses the same character-weighted word beats as the ffmpeg path.
 */
function FreeCaptionMotionThumb({ styleId }) {
  const t = useLoopClock(FREE_CAPTION_PREVIEW_LOOP_SEC)
  const beats = useMemo(
    () => buildWordBeats(FREE_CAPTION_PREVIEW_SAMPLE, FREE_CAPTION_PREVIEW_LOOP_SEC),
    [],
  )
  const activeIdx = Math.max(
    0,
    beats.findIndex((b) => t >= b.start && t < b.end),
  )
  const active = beats[activeIdx] || beats[0]
  const local = Math.max(0, t - (active?.start || 0))

  if (styleId === 'pop') {
    const n = 2
    const groupStart = Math.floor(activeIdx / n) * n
    const group = beats.slice(groupStart, groupStart + n)
    const text = group.map((b) => b.text).join(' ').toUpperCase()
    const flash = local < 0.14
    const scale = local < 0.09 ? 0.82 + local * 2.2 : local < 0.16 ? 1.08 : 1
    return (
      <span
        className={`inline-block rounded-[3px] px-1.5 py-0.5 text-[13px] font-black uppercase leading-none tracking-wide transition-transform duration-75 ${
          flash ? 'bg-[#FFE566] text-black' : 'bg-transparent text-white [text-shadow:0_1px_2px_#000,0_0_1px_#000]'
        }`}
        style={{ transform: `scale(${scale})` }}
      >
        {text}
      </span>
    )
  }

  if (styleId === 'karaoke') {
    const windowSize = 4
    const winStart = Math.max(0, activeIdx - Math.floor((windowSize - 1) / 2))
    const window = beats.slice(winStart, winStart + windowSize)
    return (
      <span className="flex flex-wrap items-end justify-center gap-x-1 px-1 leading-none">
        {window.map((b) => {
          const on = b.index === activeIdx
          return (
            <span
              key={b.index}
              className={`font-black uppercase transition-all duration-100 ${
                on
                  ? 'text-[13px] text-[#FFE566] [text-shadow:0_1px_2px_#000]'
                  : 'text-[11px] text-white/70 [text-shadow:0_1px_1px_#000]'
              }`}
            >
              {b.text}
            </span>
          )
        })}
      </span>
    )
  }

  // beast
  const popScale = local < 0.1 ? 0.7 + local * 4 : local < 0.18 ? 1.12 : 1
  return (
    <span
      className="inline-block text-[18px] font-black uppercase leading-none text-[#FFE566] drop-shadow-[0_1px_2px_#000]"
      style={{ transform: `scale(${popScale})` }}
    >
      {String(active?.text || 'GOAL').toUpperCase()}
    </span>
  )
}

/** Static free-subtitle chip art (non-animated looks). */
function FreeCaptionStaticThumb({ preview }) {
  if (preview === 'live') {
    return (
      <div className="w-full bg-black/60 px-1 py-1 text-center">
        <span className="text-[11px] font-bold leading-none text-white">Tuchel</span>
      </div>
    )
  }
  if (preview === 'classic') {
    return (
      <span className="px-1 text-[11px] font-semibold leading-none text-white [text-shadow:0_1px_1px_#000]">
        still running
      </span>
    )
  }
  if (preview === 'softbar') {
    return (
      <span className="rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        Spain beat
      </span>
    )
  }
  if (preview === 'broadcast') {
    return (
      <span className="text-[11px] font-bold text-white [text-shadow:-0.5px_0_#000,0.5px_0_#000]">
        Full-time
      </span>
    )
  }
  if (preview === 'desk') {
    return (
      <div className="w-[90%] bg-black/35 px-1 py-1 text-center">
        <span className="text-[12px] font-bold text-white">Rooney</span>
      </div>
    )
  }
  if (preview === 'elegant') {
    return (
      <span className="text-[11px] font-semibold text-[#F5E6C8] [text-shadow:0_1px_2px_#000]">
        remember
      </span>
    )
  }
  if (preview === 'punch') {
    return (
      <div className="rounded-[2px] bg-black/55 px-1.5 py-1 text-center">
        <span className="text-[10px] font-black uppercase leading-none text-[#FFE566]">Spain</span>
        <div className="mx-auto mt-0.5 h-px w-3/4 bg-[#FFE566]" />
      </div>
    )
  }
  return <span className="text-[10px] uppercase tracking-wide text-white/40">off</span>
}

/**
 * Animated caption-style preview (CapCut-like). Plays ZapCap's looping mp4/webm demo,
 * shows a gif/image when that's what's provided, and falls back to a labelled tile.
 */
function CaptionTemplatePreview({
  template,
  className = '',
  muted = 'text-[#888]',
  playMode = 'hover',
  /** Zoom into caption band so sample text reads larger vs empty frame. */
  emphasizeCaptions = false,
}) {
  const url = template?.previewUrl || ''
  const type =
    template?.previewType ||
    (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
      ? 'video'
      : /\.(gif|webp|png|jpe?g|avif)(\?|$)/i.test(url)
        ? 'image'
        : url
          ? 'video'
          : null)

  const isVideo = Boolean(url) && type === 'video'
  const isImage = Boolean(url) && type === 'image'
  const poster = template?.posterUrl || (isImage ? url : '')
  const mediaCls = emphasizeCaptions
    ? 'h-full w-full origin-bottom scale-[2.55] object-cover object-[center_84%]'
    : 'h-full w-full object-cover'

  const [hovered, setHovered] = useState(false)
  const videoRef = useRef(null)
  // Only mount/decode a <video> when this card is actually being previewed.
  // "always" is for the selected look + active grid cell; others play on hover/focus
  // so we never decode dozens of mp4s at once (that was crashing the tab on memory).
  const shouldPlay = isVideo && (playMode === 'always' || hovered)

  useEffect(() => {
    if (!shouldPlay && videoRef.current) {
      try {
        videoRef.current.pause()
        videoRef.current.removeAttribute('src')
        videoRef.current.load()
      } catch {
        /* releasing decoder */
      }
    }
  }, [shouldPlay])

  if (isVideo) {
    const idleFallback = poster ? (
      <img src={poster} alt="" loading="lazy" className={mediaCls} />
    ) : (
      <div className="flex h-full w-full flex-col items-center justify-end gap-1 bg-[#0d0d12] px-1.5 pb-2.5">
        <span className="rounded bg-yellow-400 px-2.5 py-1 text-[13px] font-black uppercase tracking-wide text-black shadow">
          {String(template?.name || 'CapCut').split(/\s+/)[0]?.slice(0, 10) || 'CAP'}
        </span>
        {playMode !== 'always' ? (
          <span className={`text-center text-[10px] font-semibold ${muted}`}>Hover to play</span>
        ) : null}
      </div>
    )
    return (
      <div
        className={`relative overflow-hidden ${className}`}
        onMouseEnter={playMode === 'hover' ? () => setHovered(true) : undefined}
        onMouseLeave={playMode === 'hover' ? () => setHovered(false) : undefined}
        onFocus={playMode === 'hover' ? () => setHovered(true) : undefined}
        onBlur={playMode === 'hover' ? () => setHovered(false) : undefined}
      >
        {shouldPlay ? (
          <video
            ref={videoRef}
            src={url}
            poster={poster || undefined}
            className={mediaCls}
            autoPlay
            loop
            muted
            playsInline
            preload="none"
          />
        ) : (
          idleFallback
        )}
      </div>
    )
  }
  if (isImage) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img src={url} alt="" loading="lazy" className={mediaCls} />
      </div>
    )
  }
  return (
    <div className={`flex flex-col items-center justify-end gap-1 bg-[#0d0d12] px-1.5 pb-2.5 ${className}`}>
      <span className="rounded bg-yellow-400 px-2.5 py-1 text-[13px] font-black uppercase tracking-wide text-black shadow">
        {String(template?.name || 'CapCut').split(/\s+/)[0]?.slice(0, 10) || 'CAP'}
      </span>
      <span className={`text-center text-[10px] font-bold ${muted}`}>Preview soon</span>
    </div>
  )
}

/** ZapCap picker cell — larger in-place preview; active cell autoplays (no sticky flyout). */
function ZapCapTemplateCell({ template, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.()}
      className={`group relative overflow-hidden rounded-lg border text-left transition ${
        active
          ? 'border-white/40 bg-[#272727] ring-1 ring-white/20'
          : 'border-[#2a2a2a] bg-[#161616] hover:border-[#555]'
      }`}
      title={template.description || template.name || template.id}
    >
      <div className="relative mx-auto h-[4.5rem] w-full overflow-hidden rounded-md bg-[#0d0d12] sm:h-20">
        <CaptionTemplatePreview
          template={template}
          className="h-full w-full transition-transform duration-150 group-hover:scale-[1.02]"
          emphasizeCaptions
          playMode={active ? 'always' : 'hover'}
        />
        {active ? (
          <span className="absolute right-1 top-1 rounded bg-white px-1 py-px text-[8px] font-semibold text-black">
            ✓
          </span>
        ) : null}
      </div>
      <div className="px-1 py-1">
        <span
          className={`block truncate text-[10px] font-medium leading-tight ${
            active ? 'text-white' : 'text-[#e5e5e5]'
          }`}
        >
          {template.name}
        </span>
      </div>
    </button>
  )
}

/* ── Video-look previews (transitions + color grades) ───────────────────────
 * Pure CSS/JS mini-previews so the picker stays lightweight (no looping media —
 * we learned autoplaying many <video>s crashes the tab on memory). Transitions
 * loop a cheap CSS animation between two sample frames; grades apply a CSS
 * filter/overlay to a sample frame to approximate the ffmpeg look. */

const EOF_LOOK_CSS = `
.eoftx-stage{position:relative;overflow:hidden;background:#000}
.eoftx-frame{position:absolute;inset:0}
.eoftx-a{z-index:1;opacity:1}
.eoftx-b{z-index:2;opacity:0;will-change:transform,opacity,clip-path}
@media (prefers-reduced-motion: no-preference){
 .eoftx-a-dip{animation:eoftx-dip 3s ease-in-out infinite}
 .eoftx-b-fade{animation:eoftx-fade 3s ease-in-out infinite}
 .eoftx-b-dissolve{animation:eoftx-dissolve 3s ease-in-out infinite}
 .eoftx-b-fadeblack{animation:eoftx-fadeblack 3s ease-in-out infinite}
 .eoftx-b-slideleft{animation:eoftx-slideleft 3s cubic-bezier(.4,0,.2,1) infinite}
 .eoftx-b-slideright{animation:eoftx-slideright 3s cubic-bezier(.4,0,.2,1) infinite}
 .eoftx-b-slideup{animation:eoftx-slideup 3s cubic-bezier(.4,0,.2,1) infinite}
 .eoftx-b-wipeleft{animation:eoftx-wipeleft 3s ease-in-out infinite}
 .eoftx-b-circle{animation:eoftx-circle 3s ease-in-out infinite}
 .eoftx-b-zoom{animation:eoftx-zoom 3s ease-in-out infinite}
 .eoftx-b-pixel{animation:eoftx-pixel 3s steps(6,end) infinite}
 .eoftx-b-cut{animation:eoftx-cut 2s steps(1,end) infinite}
}
@keyframes eoftx-fade{0%,15%{opacity:0}45%,80%{opacity:1}100%{opacity:0}}
@keyframes eoftx-dissolve{0%,15%{opacity:0;filter:blur(4px)}45%,80%{opacity:1;filter:blur(0)}100%{opacity:0;filter:blur(4px)}}
@keyframes eoftx-fadeblack{0%,18%{opacity:0}40%{opacity:0}60%,80%{opacity:1}100%{opacity:0}}
@keyframes eoftx-dip{0%,12%{opacity:1}30%,58%{opacity:0}82%,100%{opacity:1}}
@keyframes eoftx-slideleft{0%,15%{transform:translateX(100%);opacity:1}45%,80%{transform:translateX(0);opacity:1}100%{transform:translateX(0);opacity:0}}
@keyframes eoftx-slideright{0%,15%{transform:translateX(-100%);opacity:1}45%,80%{transform:translateX(0);opacity:1}100%{transform:translateX(0);opacity:0}}
@keyframes eoftx-slideup{0%,15%{transform:translateY(100%);opacity:1}45%,80%{transform:translateY(0);opacity:1}100%{transform:translateY(0);opacity:0}}
@keyframes eoftx-wipeleft{0%,15%{clip-path:inset(0 0 0 100%);opacity:1}45%,80%{clip-path:inset(0 0 0 0);opacity:1}100%{clip-path:inset(0 0 0 0);opacity:0}}
@keyframes eoftx-circle{0%,15%{clip-path:circle(0% at 50% 50%);opacity:1}45%,80%{clip-path:circle(75% at 50% 50%);opacity:1}100%{clip-path:circle(75% at 50% 50%);opacity:0}}
@keyframes eoftx-zoom{0%,15%{transform:scale(.2);opacity:0}45%,80%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}
@keyframes eoftx-pixel{0%,15%{opacity:0;filter:blur(5px) contrast(1.5)}45%,80%{opacity:1;filter:blur(0) contrast(1)}100%{opacity:0;filter:blur(5px)}}
@keyframes eoftx-cut{0%,49%{opacity:0}50%,100%{opacity:1}}
`

let eofLookStylesInjected = false
function useEofLookStyles() {
  useEffect(() => {
    if (eofLookStylesInjected || typeof document === 'undefined') return
    if (document.getElementById('eof-look-preview-styles')) {
      eofLookStylesInjected = true
      return
    }
    const el = document.createElement('style')
    el.id = 'eof-look-preview-styles'
    el.textContent = EOF_LOOK_CSS
    document.head.appendChild(el)
    eofLookStylesInjected = true
  }, [])
}

/** Cheap gradient "stadium" frame used by transition + grade previews (no image asset). */
function SampleMiniFrame({ variant = 'a' }) {
  const bg =
    variant === 'b'
      ? 'linear-gradient(180deg,#0b2a4a 0%,#123a63 42%,#0f5132 42%,#0a3d27 100%)'
      : 'linear-gradient(180deg,#2b6cb0 0%,#5aa9e6 40%,#2f9e5f 40%,#26794a 100%)'
  return (
    <div className="relative h-full w-full" style={{ background: bg }}>
      <div className="absolute left-0 top-[42%] h-px w-full bg-white/40" />
      <div className="absolute left-1/2 top-[46%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/90" />
      <div className="absolute bottom-1 left-1/2 h-4 w-6 -translate-x-1/2 rounded-t-md bg-white/10" />
    </div>
  )
}

const TRANSITION_EFFECTS = {
  auto: 'fade',
  cut: 'cut',
  fade: 'fade',
  fadeblack: 'fadeblack',
  dissolve: 'dissolve',
  slideleft: 'slideleft',
  slideright: 'slideright',
  slideup: 'slideup',
  wipeleft: 'wipeleft',
  circleopen: 'circle',
  radial: 'zoom',
  pixelize: 'pixel',
}

/** Looping CSS preview of a scene-to-scene transition between two sample frames. */
function TransitionPreview({ styleId, className = '' }) {
  useEofLookStyles()
  const effect = TRANSITION_EFFECTS[styleId] || 'fade'
  return (
    <div className={`eoftx-stage ${className}`}>
      <div className={`eoftx-frame eoftx-a ${effect === 'fadeblack' ? 'eoftx-a-dip' : ''}`}>
        <SampleMiniFrame variant="a" />
      </div>
      <div className={`eoftx-frame eoftx-b eoftx-b-${effect}`}>
        <SampleMiniFrame variant="b" />
      </div>
      {styleId === 'auto' ? (
        <span className="absolute bottom-0.5 left-1/2 z-10 -translate-x-1/2 rounded bg-black/60 px-1 text-[8px] font-bold uppercase tracking-wide text-white">
          Auto
        </span>
      ) : null}
    </div>
  )
}

/** CSS approximation of each ffmpeg color grade, applied to a sample frame. */
const COLOR_GRADE_PREVIEW = {
  auto: { filter: 'contrast(1.05) saturate(1.1)', overlay: null, badge: 'Auto' },
  off: { filter: 'none', overlay: null },
  match: { filter: 'contrast(1.06) saturate(1.1) brightness(1.02)', overlay: null },
  punchy: { filter: 'contrast(1.14) saturate(1.4) brightness(1.03)', overlay: null },
  cinematic: {
    filter: 'contrast(1.18) saturate(1.02) brightness(0.95)',
    overlay: 'linear-gradient(180deg, rgba(0,45,70,.30), rgba(70,35,0,.28))',
  },
  warm: {
    filter: 'contrast(1.08) saturate(1.2) brightness(1.03)',
    overlay: 'linear-gradient(180deg, rgba(255,150,40,.30), rgba(255,90,0,.16))',
  },
  cool: {
    filter: 'contrast(1.09) saturate(1.15)',
    overlay: 'linear-gradient(180deg, rgba(40,120,255,.30), rgba(0,60,180,.18))',
  },
}

/** CSS approximation of CapCut-style HD / enhance looks. */
const ENHANCE_STYLE_PREVIEW = {
  auto: { filter: 'contrast(1.04) saturate(1.05) brightness(1.01)', badge: 'Auto' },
  off: { filter: 'none' },
  hd: { filter: 'contrast(1.05) saturate(1.06) brightness(1.01)' },
  soft: { filter: 'contrast(1.02) saturate(1.03) brightness(1.02) blur(0.2px)' },
  crisp: { filter: 'contrast(1.08) saturate(1.08) brightness(1.01)' },
  clean: { filter: 'contrast(1.03) saturate(1.04) brightness(1.01)' },
}

/** Still sample frame with the grade's CSS filter + tint overlay so the mood is visible. */
function ColorGradePreview({ gradeId, className = '' }) {
  const g = COLOR_GRADE_PREVIEW[gradeId] || COLOR_GRADE_PREVIEW.off
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="h-full w-full" style={{ filter: g.filter }}>
        <SampleMiniFrame variant="a" />
      </div>
      {g.overlay ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: g.overlay, mixBlendMode: 'soft-light' }}
        />
      ) : null}
      {g.badge ? (
        <span className="absolute bottom-0.5 left-1/2 z-10 -translate-x-1/2 rounded bg-black/60 px-1 text-[8px] font-bold uppercase tracking-wide text-white">
          {g.badge}
        </span>
      ) : null}
    </div>
  )
}

function EnhanceStylePreview({ styleId, className = '' }) {
  const g = ENHANCE_STYLE_PREVIEW[styleId] || ENHANCE_STYLE_PREVIEW.off
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="h-full w-full" style={{ filter: g.filter }}>
        <SampleMiniFrame variant="b" />
      </div>
      {g.badge ? (
        <span className="absolute bottom-0.5 left-1/2 z-10 -translate-x-1/2 rounded bg-black/60 px-1 text-[8px] font-bold uppercase tracking-wide text-white">
          {g.badge}
        </span>
      ) : null}
      {styleId === 'hd' ? (
        <span className="absolute left-1 top-1 z-10 rounded bg-white/90 px-1 text-[8px] font-bold text-black">
          HD
        </span>
      ) : null}
    </div>
  )
}

/* CapCut-style FX card previews — contained so shake never moves the page. */
const EOF_FX_CSS = `
.eoffx-stage{contain:layout paint;isolation:isolate;overflow:hidden;transform:translateZ(0)}
.eoffx-stage .eoffx-inner{transform-origin:center center;will-change:transform,filter}
@media (prefers-reduced-motion: no-preference){
 .eoffx-shake-soft{animation:eoffx-shake 0.55s ease-in-out infinite}
 .eoffx-shake-hard{animation:eoffx-shake-hard 0.4s ease-in-out infinite}
 .eoffx-wave{animation:eoffx-wave 1.4s ease-in-out infinite}
 .eoffx-flash{animation:eoffx-flash 1.1s ease-in-out infinite}
 .eoffx-glow{animation:eoffx-glow 1.6s ease-in-out infinite}
 .eoffx-rgb::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,0,80,.22),transparent 40%,rgba(0,180,255,.22));mix-blend-mode:screen;animation:eoffx-rgb 1.2s ease-in-out infinite;pointer-events:none}
}
@keyframes eoffx-shake{0%,100%{transform:translate3d(0,0,0)}25%{transform:translate3d(1px,-0.5px,0)}75%{transform:translate3d(-1px,0.5px,0)}}
@keyframes eoffx-shake-hard{0%,100%{transform:translate3d(0,0,0) rotate(0)}25%{transform:translate3d(1.5px,-1px,0) rotate(-0.6deg)}75%{transform:translate3d(-1.5px,1px,0) rotate(0.6deg)}}
@keyframes eoffx-wave{0%,100%{transform:rotate(-0.8deg) scale(1.02)}50%{transform:rotate(0.8deg) scale(1.02)}}
@keyframes eoffx-flash{0%,70%,100%{filter:brightness(1)}80%{filter:brightness(1.45)}}
@keyframes eoffx-glow{0%,100%{filter:brightness(1.05) saturate(1.1)}50%{filter:brightness(1.2) saturate(1.15)}}
@keyframes eoffx-rgb{0%,100%{opacity:.35;transform:translateX(-1px)}50%{opacity:.65;transform:translateX(1px)}}
`

let eofFxStylesInjected = false
function useEofFxStyles() {
  useEffect(() => {
    if (eofFxStylesInjected || typeof document === 'undefined') return
    if (document.getElementById('eof-fx-preview-styles')) {
      eofFxStylesInjected = true
      return
    }
    const el = document.createElement('style')
    el.id = 'eof-fx-preview-styles'
    el.textContent = EOF_FX_CSS
    document.head.appendChild(el)
    eofFxStylesInjected = true
  }, [])
}

const EFFECT_PREVIEW_LOOK = {
  none: { filter: 'none', anim: '' },
  shake_subtle: { filter: 'none', anim: 'eoffx-shake-soft' },
  shake_strong: { filter: 'none', anim: 'eoffx-shake-hard' },
  blur_soft: { filter: 'blur(1.4px)', anim: '' },
  blur_motion: { filter: 'blur(0.9px) contrast(1.05)', anim: 'eoffx-shake-soft' },
  wave_gentle: { filter: 'none', anim: 'eoffx-wave' },
  wave_rgb: { filter: 'contrast(1.05) saturate(1.15)', anim: 'eoffx-rgb' },
  light_leak: {
    filter: 'saturate(1.15) brightness(1.05)',
    overlay: 'linear-gradient(135deg,rgba(255,140,40,.45),transparent 55%)',
    anim: 'eoffx-glow',
  },
  flash: { filter: 'none', anim: 'eoffx-flash' },
  glow_pulse: { filter: 'brightness(1.08)', anim: 'eoffx-glow' },
  cold: {
    filter: 'contrast(1.06) saturate(1.1)',
    overlay: 'linear-gradient(180deg,rgba(40,120,255,.28),rgba(0,60,180,.16))',
  },
  warm: {
    filter: 'contrast(1.05) saturate(1.15)',
    overlay: 'linear-gradient(180deg,rgba(255,150,40,.28),rgba(255,90,0,.14))',
  },
  contrast_punch: { filter: 'contrast(1.2) saturate(1.25) brightness(1.02)' },
  noir: { filter: 'grayscale(1) contrast(1.2) brightness(0.95)' },
  teal_orange: {
    filter: 'contrast(1.08) saturate(1.15)',
    overlay: 'linear-gradient(180deg,rgba(0,160,170,.22),rgba(255,120,40,.2))',
  },
  hdr_pop: {
    filter: 'contrast(1.18) saturate(1.2) brightness(1.04)',
    overlay: 'radial-gradient(circle at 50% 35%,rgba(255,255,255,.18),transparent 55%)',
  },
  hdr_glow: {
    filter: 'brightness(1.1) saturate(1.15) contrast(1.06)',
    overlay: 'radial-gradient(circle at 50% 30%,rgba(255,240,200,.35),transparent 50%)',
    anim: 'eoffx-glow',
  },
  hdr_crisp: { filter: 'contrast(1.22) saturate(1.12) brightness(1.02)' },
}

function EffectCardPreview({ effectId, className = '' }) {
  useEofFxStyles()
  const look = EFFECT_PREVIEW_LOOK[effectId] || EFFECT_PREVIEW_LOOK.none
  return (
    <div className={`eoffx-stage relative overflow-hidden bg-black ${className}`}>
      <div
        className={`eoffx-inner h-full w-full ${look.anim || ''}`}
        style={{ filter: look.filter || 'none' }}
      >
        <SampleMiniFrame variant="a" />
      </div>
      {look.overlay ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: look.overlay, mixBlendMode: 'soft-light' }}
        />
      ) : null}
    </div>
  )
}

/** Compact colour/HDR chip — shows the grade, not a tall phone frame. */
const EFFECT_COLOUR_SWATCH = {
  none: { background: '#3a3a3a' },
  cold: { background: 'linear-gradient(135deg,#1e3a5f 0%,#3b82f6 100%)' },
  warm: { background: 'linear-gradient(135deg,#92400e 0%,#fbbf24 55%,#fde68a 100%)' },
  contrast_punch: {
    background: 'linear-gradient(135deg,#000 0%,#fff 45%,#000 100%)',
  },
  noir: { background: 'linear-gradient(135deg,#0a0a0a 0%,#6b7280 50%,#111 100%)' },
  teal_orange: { background: 'linear-gradient(135deg,#0f766e 0%,#14b8a6 40%,#f97316 100%)' },
  hdr_pop: { background: 'linear-gradient(135deg,#f8fafc 0%,#38bdf8 40%,#0f172a 100%)' },
  hdr_glow: { background: 'radial-gradient(circle at 40% 30%,#fef9c3 0%,#f59e0b 45%,#78350f 100%)' },
  hdr_crisp: { background: 'linear-gradient(135deg,#e2e8f0 0%,#7dd3fc 50%,#0ea5e9 100%)' },
}

function EffectColourSwatch({ effectId, className = 'h-3.5 w-3.5' }) {
  const style = EFFECT_COLOUR_SWATCH[effectId] || EFFECT_COLOUR_SWATCH.none
  return (
    <span
      className={`inline-block shrink-0 rounded-sm border border-white/15 ${className}`}
      style={style}
      aria-hidden
    />
  )
}

/**
 * Compact CapCut-style effect picker.
 * mode: "motion" = tiny preview · "swatch" = colour chip · "label" = text-only (presets/lights)
 */
function EffectPickerGrid({ title, hint, items, activeId, onPick, disabled, mode = 'label' }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-[#d4d4d4]">{title}</p>
      {hint ? <p className={`mt-0.5 text-[10px] leading-snug ${PX.muted}`}>{hint}</p> : null}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {(Array.isArray(items) ? items : []).map((fx) => {
          const active = Boolean(activeId) && activeId === fx.id
          return (
            <button
              key={fx.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(fx.id)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                active
                  ? 'border-white/50 bg-[#2a2a2a] ring-1 ring-white/25'
                  : 'border-[#333] bg-[#161616] hover:border-[#666] hover:bg-[#1c1c1c]'
              }`}
              title={fx.detail || fx.label}
            >
              {mode === 'motion' ? (
                <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-sm bg-black">
                  <EffectCardPreview effectId={fx.id} className="h-full w-full" />
                </span>
              ) : null}
              {mode === 'swatch' ? <EffectColourSwatch effectId={fx.id} /> : null}
              <span
                className={`text-[11px] font-medium leading-tight ${
                  active ? 'text-white' : 'text-[#e5e5e5]'
                }`}
              >
                {fx.label}
              </span>
              {active ? (
                <span className="rounded bg-white px-1 py-px text-[8px] font-semibold leading-none text-black">
                  ✓
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Compact sticker/element icon — no decorative stadium/phone background. */
function StickerCardPreview({ stickerId, className = '' }) {
  const id = String(stickerId || '')
  return (
    <div className={`relative flex items-center justify-center bg-transparent ${className}`}>
      {id === 'btn_subscribe_yt' ? (
        <span className="rounded-[3px] bg-[#ff0000] px-1 py-0.5 text-[7px] font-black tracking-wide text-white">
          SUB
        </span>
      ) : null}
      {id === 'btn_follow_tt' ? (
        <span className="rounded-full border-l-2 border-[#25F4EE] bg-black px-1.5 py-0.5 text-[8px] font-bold text-white">
          Follow
        </span>
      ) : null}
      {id.startsWith('arrow_') ? (
        <span className="text-base font-black leading-none text-white">
          {id === 'arrow_left' ? '←' : id === 'arrow_right' ? '→' : id === 'arrow_up' ? '↑' : '↓'}
        </span>
      ) : null}
      {id === 'shape_square' ? <span className="h-3.5 w-3.5 bg-white/90" /> : null}
      {id === 'shape_square_outline' ? (
        <span className="h-3.5 w-3.5 border-2 border-white" />
      ) : null}
      {id === 'shape_circle' ? <span className="h-3.5 w-3.5 rounded-full bg-white/90" /> : null}
      {id === 'shape_circle_outline' ? (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-white" />
      ) : null}
      {id === 'shape_rounded' ? <span className="h-2.5 w-5 rounded-md bg-white/85" /> : null}
      {id === 'shape_line' ? <span className="h-0.5 w-5 rounded-full bg-[#FFE566]" /> : null}
      {id === 'sticker_fire' ? (
        <span className="h-4 w-3 rounded-t-full bg-gradient-to-t from-orange-600 to-yellow-300" />
      ) : null}
      {id === 'sticker_new' ? (
        <span className="rounded border border-[#FFE566] bg-black px-1 py-px text-[7px] font-black text-[#FFE566]">
          NEW
        </span>
      ) : null}
      {id === 'sticker_tap' ? <span className="h-4 w-1.5 rounded-full bg-white/90" /> : null}
    </div>
  )
}

function StickerPickerGrid({ title, hint, items, selectedIds, onPick, disabled }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-[#d4d4d4]">{title}</p>
      {hint ? <p className={`mt-0.5 text-[10px] leading-snug ${PX.muted}`}>{hint}</p> : null}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => {
          const active = selectedIds.includes(item.id)
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-1 transition disabled:opacity-40 ${
                active
                  ? 'border-white/40 bg-[#272727] ring-1 ring-white/20'
                  : 'border-[#2a2a2a] bg-[#161616] hover:border-[#555]'
              }`}
              title={item.detail || item.label}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded bg-[#0e0e0e]">
                <StickerCardPreview stickerId={item.id} className="h-full w-full" />
              </span>
              <span
                className={`max-w-[4.5rem] truncate text-[10px] font-medium leading-tight ${
                  active ? 'text-white' : 'text-[#e5e5e5]'
                }`}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const SCRIPT_PROVIDER_KEY = 'eof_script_provider'
/** One-time bump: older sessions stored Groq as default before Claude shipped. */
const SCRIPT_PROVIDER_CLAUDE_MIGRATE_KEY = 'eof_script_provider_claude_v1'

/** @returns {string|null} stored pick, or null when never set (server preferred applies). */
function readStoredScriptProvider() {
  try {
    const v = localStorage.getItem(SCRIPT_PROVIDER_KEY)
    if (v == null || v === '') return null
    if (v === 'claude') return 'anthropic'
    if (v === 'auto' || v === 'groq' || v === 'xai' || v === 'openai' || v === 'anthropic') return v
  } catch {
    /* ignore */
  }
  return null
}

function writeStoredScriptProvider(id) {
  try {
    localStorage.setItem(SCRIPT_PROVIDER_KEY, id)
  } catch {
    /* ignore */
  }
}

/** Human label for the Script AI the agent chat / regenerate will hit. */
function activeScriptAiLabel(scriptProvider, preferred, providers, options) {
  const pick = scriptProvider === 'auto' || !scriptProvider ? preferred || 'auto' : scriptProvider
  const fromOptions = Array.isArray(options) ? options.find((p) => p.id === pick)?.label : null
  if (fromOptions && pick !== 'auto') return fromOptions
  if (pick === 'anthropic' || (pick === 'auto' && providers?.anthropic)) {
    return 'Claude Sonnet 5 (Anthropic)'
  }
  if (pick === 'groq' || (pick === 'auto' && providers?.groq)) return 'Groq (free)'
  if (pick === 'openai' || (pick === 'auto' && providers?.openai)) return 'OpenAI'
  if (pick === 'xai' || (pick === 'auto' && providers?.xai)) return 'xAI Grok'
  if (pick === 'auto') return 'Auto (best quality)'
  return String(pick || 'Script AI')
}

/**
 * Default Script AI to Claude when keyed. One-time migrates stale Groq/Auto picks
 * so "Send to AI" chat actually hits Anthropic after ANTHROPIC_API_KEY is deployed.
 */
function applyClaudeScriptProviderDefault(preferred, providers) {
  if (!providers?.anthropic || preferred !== 'anthropic') return null
  try {
    const migrated = localStorage.getItem(SCRIPT_PROVIDER_CLAUDE_MIGRATE_KEY)
    const stored = readStoredScriptProvider()
    if (!migrated) {
      localStorage.setItem(SCRIPT_PROVIDER_CLAUDE_MIGRATE_KEY, '1')
      // Upgrade first-visit / Auto / legacy Groq → explicit Claude.
      if (stored == null || stored === 'auto' || stored === 'groq') {
        writeStoredScriptProvider('anthropic')
        return 'anthropic'
      }
      return stored
    }
    if (stored == null) {
      writeStoredScriptProvider('anthropic')
      return 'anthropic'
    }
  } catch {
    return 'anthropic'
  }
  return null
}

function readStoredSelectedId() {
  try {
    return sessionStorage.getItem(SELECTED_JOB_KEY) || null
  } catch {
    return null
  }
}

function formatDuration(sec) {
  const total = Math.max(0, Math.round(Number(sec) || 0))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function EofRenderProgressBar({ progress, stuck, onCancel, cancelBusy }) {
  if (!progress) return null
  const percent = Math.min(100, Math.max(0, Math.round(progress.percent || 0)))

  return (
    <div className={`${PX.surfaceInset} p-4`} role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#d4d4d4]">
        <span>{progress.message || 'Building…'}</span>
        <span className="tabular-nums text-[#8e8e8e]">{percent}%</span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#303030]">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[#717171]">
        Elapsed {formatDuration(progress.elapsedSeconds)}
        {progress.etaLabel ? ` · ${progress.etaLabel}` : ''}
      </p>
      {stuck ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-xs text-[#fbbf24]">This build may have timed out. Reset, then try again.</p>
          <button type="button" disabled={cancelBusy} onClick={onCancel} className={PX.btnGhost}>
            Reset & retry
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function EofProductionPanel({
  isOwner,
  active = true,
  onSendToStudio,
  openJobId = null,
  onOpenJobConsumed,
}) {
  const [jobs, setJobs] = useState([])
  const [scriptFormats, setScriptFormats] = useState([])
  const [format, setFormat] = useState(EOF_DEFAULT_SCRIPT_FORMAT)
  const [captionStyles, setCaptionStyles] = useState([])
  const [captionStyle, setCaptionStyle] = useState(EOF_DEFAULT_CAPTION_STYLE)
  const [captionLayout, setCaptionLayout] = useState(() => defaultEofCaptionLayout(EOF_DEFAULT_CAPTION_STYLE))
  const [activeCaptionScene, setActiveCaptionScene] = useState(0)
  const [captionEditOpen, setCaptionEditOpen] = useState(false)
  const videoRef = useRef(null)
  const [transitionStyles, setTransitionStyles] = useState([])
  const [transitionStyle, setTransitionStyle] = useState(EOF_DEFAULT_TRANSITION_STYLE)
  const [colorGrades, setColorGrades] = useState([])
  const [colorGrade, setColorGrade] = useState(EOF_DEFAULT_COLOR_GRADE)
  const [enhanceStyles, setEnhanceStyles] = useState([])
  const [enhanceStyle, setEnhanceStyle] = useState(EOF_DEFAULT_ENHANCE_STYLE)
  const [overlayMomentsOptions, setOverlayMomentsOptions] = useState([])
  const [overlayMoments, setOverlayMoments] = useState(EOF_DEFAULT_OVERLAY_MOMENTS)
  const [videoEffects, setVideoEffects] = useState(() => ({ ...EOF_DEFAULT_VIDEO_EFFECTS }))
  const [videoEffectsMotion, setVideoEffectsMotion] = useState([])
  const [videoEffectsLight, setVideoEffectsLight] = useState([])
  const [videoEffectsColour, setVideoEffectsColour] = useState([])
  const [videoEffectPresets, setVideoEffectPresets] = useState([])
  const [videoEffectsStackingRule, setVideoEffectsStackingRule] = useState(EOF_EFFECT_STACKING_RULE)
  const [stickers, setStickers] = useState(() => ({ items: [] }))
  const [stickersButtons, setStickersButtons] = useState([])
  const [stickersShapes, setStickersShapes] = useState([])
  const [stickersArrows, setStickersArrows] = useState([])
  const [stickersExtras, setStickersExtras] = useState([])
  const [stickerPositions, setStickerPositions] = useState([])
  const [stickersStackingRule, setStickersStackingRule] = useState(EOF_STICKERS_STACKING_RULE)
  const [stickersMax, setStickersMax] = useState(EOF_MAX_STICKERS)
  const [activeStickerId, setActiveStickerId] = useState('')
  const [musicTracks, setMusicTracks] = useState([])
  const [defaultMusicBeds, setDefaultMusicBeds] = useState([])
  const [musicTrackId, setMusicTrackId] = useState('')
  const [musicVolume, setMusicVolume] = useState(EOF_DEFAULT_MUSIC_VOLUME)
  const [musicStartSec, setMusicStartSec] = useState(0)
  const [musicEndSec, setMusicEndSec] = useState(null)
  const [zapcapTemplates, setZapcapTemplates] = useState([])
  const [zapcapTemplatesError, setZapcapTemplatesError] = useState('')
  const [zapcapTemplateId, setZapcapTemplateId] = useState('')
  const [zapcapTemplateFilter, setZapcapTemplateFilter] = useState('')
  const [captionEngine, setCaptionEngine] = useState({ engine: 'local', zapcap: false, local: true })
  const [voicePresets, setVoicePresets] = useState([])
  const [voicePreset, setVoicePreset] = useState(EOF_DEFAULT_VOICE_PRESET)
  const [elevenLabsConfigured, setElevenLabsConfigured] = useState(false)
  const [elevenLabsVoiceDefaults, setElevenLabsVoiceDefaults] = useState(() =>
    normalizeElevenLabsVoiceSettings(null),
  )
  const [voiceSettings, setVoiceSettings] = useState(() => normalizeElevenLabsVoiceSettings(null))
  const [manualVoiceoverUploading, setManualVoiceoverUploading] = useState(false)
  const [manualVoiceoverStatus, setManualVoiceoverStatus] = useState('')
  const [openAiScriptEnabled, setOpenAiScriptEnabled] = useState(false)
  const [scriptProviders, setScriptProviders] = useState({
    xai: false,
    openai: false,
    anthropic: false,
    groq: false,
    newsdata: false,
    guardian: false,
    perplexity: false,
    judge: { enabled: false },
  })
  const [scriptProviderOptions, setScriptProviderOptions] = useState([])
  const [scriptProvider, setScriptProvider] = useState(() => readStoredScriptProvider() || 'auto')
  const [preferredScriptProvider, setPreferredScriptProvider] = useState('template')
  const [ffmpegAvailable, setFfmpegAvailable] = useState(false)
  const [topic, setTopic] = useState('')
  const [useOwnScript, setUseOwnScript] = useState(false)
  const [manualDraft, setManualDraft] = useState('')
  const [selectedId, setSelectedId] = useState(readStoredSelectedId)
  const [draftScript, setDraftScript] = useState(null)
  const [draftDirty, setDraftDirty] = useState(false)
  const hydratedJobIdRef = useRef(null)
  const [scriptBillingNote, setScriptBillingNote] = useState('')
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  /** 'draft' | 'rewrite' | '' — so Regenerate button can show its own label */
  const [scriptBusy, setScriptBusy] = useState('')
  const [scriptChat, setScriptChat] = useState('')
  const [scriptChatLog, setScriptChatLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [renderNote, setRenderNote] = useState('')
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('')
  const [renderPhase, setRenderPhase] = useState('')
  const [renderProgress, setRenderProgress] = useState(null)
  const [renderStack, setRenderStack] = useState(null)
  const [imageSources, setImageSources] = useState({
    ap: false,
    serpapi: false,
    oxylabs: false,
    google: false,
    pexels: false,
    pinterestApi: false,
    pinterestPinUrl: true,
    wikimedia: true,
  })
  const [imagesNote, setImagesNote] = useState('')
  const [imageProvider, setImageProvider] = useState('auto')
  const [imageProviderOptions, setImageProviderOptions] = useState([
    { id: 'auto', label: 'Auto (SerpAPI → gen → Wikimedia)', configured: true },
    { id: 'serpapi', label: 'SerpAPI', configured: false },
    { id: 'oxylabs', label: 'Oxylabs (opt-in)', configured: false },
  ])
  /** Per-build override for Google Images on Build / Rebuild (defaults to the saved admin preference). */
  const [rebuildImageProvider, setRebuildImageProvider] = useState('auto')
  const [imageProviderBusy, setImageProviderBusy] = useState(false)
  const [imageGenMode, setImageGenMode] = useState('auto')
  const [imageGenProvider, setImageGenProvider] = useState('auto')
  const [imageGenModeOptions, setImageGenModeOptions] = useState([
    { id: 'off', label: 'Off' },
    { id: 'auto', label: 'Auto (gapfill)' },
    { id: 'always', label: 'Always' },
  ])
  const [imageGenProviderOptions, setImageGenProviderOptions] = useState([
    { id: 'auto', label: 'Auto (Grok → Free)', configured: true },
    { id: 'grok', label: 'Grok Imagine', configured: false },
    { id: 'free', label: 'Free (Pollinations)', configured: true },
  ])
  const [imageGenNote, setImageGenNote] = useState('')
  const [imageGenBusy, setImageGenBusy] = useState(false)
  const [buildMode, setBuildMode] = useState('pro')
  const [buildModeSaved, setBuildModeSaved] = useState('pro')
  const [buildModeOptions, setBuildModeOptions] = useState([
    { id: 'pro', label: 'Pro' },
    { id: 'hobby', label: 'Hobby (slim)' },
  ])
  const [buildModeEnvForced, setBuildModeEnvForced] = useState(false)
  const [buildModeNote, setBuildModeNote] = useState('')
  const [buildModeMaxScenesHobby, setBuildModeMaxScenesHobby] = useState(4)
  const [buildModeBusy, setBuildModeBusy] = useState(false)
  const [pinterestStatus, setPinterestStatus] = useState(null)
  const [serpapiStatus, setSerpapiStatus] = useState(null)
  const [oxylabsStatus, setOxylabsStatus] = useState(null)
  const [progressTick, setProgressTick] = useState(0)
  const [deletingId, setDeletingId] = useState(null)
  const renderPollRef = useRef(null)
  const resultPanelRef = useRef(null)

  const fetchProduction = useCallback(async () => {
    const res = await apiFetch('/api/admin/eof-production')
    const text = await res.text()
    let j = {}
    try {
      j = text ? JSON.parse(text) : {}
    } catch {
      /* non-JSON */
    }
    if (!res.ok) {
      const detail =
        typeof j.error === 'string'
          ? j.error
          : text.trim()
            ? `${res.status}: ${text.trim().slice(0, 160)}`
            : `Request failed (HTTP ${res.status})`
      throw new Error(detail)
    }
    return j
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const j = await fetchProduction()
      setJobs(j.jobs || [])
      setScriptFormats(Array.isArray(j.scriptFormats) ? j.scriptFormats : [])
      if (j.defaultScriptFormat) setFormat((prev) => prev || j.defaultScriptFormat)
      setCaptionStyles(Array.isArray(j.captionStyles) ? j.captionStyles : [])
      if (j.defaultCaptionStyle) setCaptionStyle((prev) => prev || j.defaultCaptionStyle)
      setTransitionStyles(Array.isArray(j.transitionStyles) ? j.transitionStyles : [])
      if (j.defaultTransitionStyle) setTransitionStyle((prev) => prev || j.defaultTransitionStyle)
      setOverlayMomentsOptions(Array.isArray(j.overlayMomentsOptions) ? j.overlayMomentsOptions : [])
      if (j.defaultOverlayMoments) setOverlayMoments((prev) => prev || j.defaultOverlayMoments)
      setVideoEffectsMotion(Array.isArray(j.videoEffectsMotion) ? j.videoEffectsMotion : [])
      setVideoEffectsLight(Array.isArray(j.videoEffectsLight) ? j.videoEffectsLight : [])
      setVideoEffectsColour(Array.isArray(j.videoEffectsColour) ? j.videoEffectsColour : [])
      setVideoEffectPresets(Array.isArray(j.videoEffectPresets) ? j.videoEffectPresets : [])
      if (typeof j.videoEffectsStackingRule === 'string' && j.videoEffectsStackingRule) {
        setVideoEffectsStackingRule(j.videoEffectsStackingRule)
      }
      if (j.defaultVideoEffects) {
        setVideoEffects((prev) =>
          prev?.motion || prev?.light || prev?.colour
            ? prev
            : normalizeEofVideoEffects(j.defaultVideoEffects),
        )
      }
      setStickersButtons(Array.isArray(j.stickersButtons) ? j.stickersButtons : [])
      setStickersShapes(Array.isArray(j.stickersShapes) ? j.stickersShapes : [])
      setStickersArrows(Array.isArray(j.stickersArrows) ? j.stickersArrows : [])
      setStickersExtras(Array.isArray(j.stickersExtras) ? j.stickersExtras : [])
      setStickerPositions(Array.isArray(j.stickerPositions) ? j.stickerPositions : [])
      if (typeof j.stickersStackingRule === 'string' && j.stickersStackingRule) {
        setStickersStackingRule(j.stickersStackingRule)
      }
      if (Number.isFinite(Number(j.stickersMax))) setStickersMax(Number(j.stickersMax))
      if (j.defaultStickers) {
        setStickers((prev) => (prev?.items?.length ? prev : normalizeEofStickers(j.defaultStickers)))
      }
      setColorGrades(Array.isArray(j.colorGrades) ? j.colorGrades : [])
      if (j.defaultColorGrade) setColorGrade((prev) => prev || j.defaultColorGrade)
      setEnhanceStyles(Array.isArray(j.enhanceStyles) ? j.enhanceStyles : [])
      if (j.defaultEnhanceStyle) setEnhanceStyle((prev) => prev || j.defaultEnhanceStyle)
      setMusicTracks(Array.isArray(j.tracks) ? j.tracks : [])
      setDefaultMusicBeds(Array.isArray(j.defaultMusicBeds) ? j.defaultMusicBeds : [])
      if (typeof j.defaultMusicVolume === 'number' && Number.isFinite(j.defaultMusicVolume)) {
        setMusicVolume((prev) => (prev === EOF_DEFAULT_MUSIC_VOLUME ? j.defaultMusicVolume : prev))
      }
      if (j.captionEngine && typeof j.captionEngine === 'object') setCaptionEngine(j.captionEngine)
      setZapcapTemplates(Array.isArray(j.zapcapTemplates) ? j.zapcapTemplates : [])
      setZapcapTemplatesError(typeof j.zapcapTemplatesError === 'string' ? j.zapcapTemplatesError : '')
      setVoicePresets(Array.isArray(j.voicePresets) ? j.voicePresets : [])
      if (j.defaultVoicePreset) setVoicePreset((prev) => prev || j.defaultVoicePreset)
      setElevenLabsConfigured(Boolean(j.elevenLabsConfigured))
      if (j.elevenLabsVoiceDefaults) {
        setElevenLabsVoiceDefaults(normalizeElevenLabsVoiceSettings(j.elevenLabsVoiceDefaults))
      }
      setOpenAiScriptEnabled(Boolean(j.openAiScriptEnabled))
      setScriptProviders(
        j.scriptProviders && typeof j.scriptProviders === 'object'
          ? j.scriptProviders
          : { xai: false, openai: false, groq: false, newsdata: false, guardian: false, perplexity: false },
      )
      setScriptProviderOptions(Array.isArray(j.scriptProviderOptions) ? j.scriptProviderOptions : [])
      if (j.preferredScriptProvider) {
        setPreferredScriptProvider(j.preferredScriptProvider)
        const providers =
          j.scriptProviders && typeof j.scriptProviders === 'object' ? j.scriptProviders : null
        const claudeDefault = applyClaudeScriptProviderDefault(j.preferredScriptProvider, providers)
        if (claudeDefault) {
          setScriptProvider(claudeDefault)
        } else if (readStoredScriptProvider() == null && j.preferredScriptProvider !== 'template') {
          // First visit: server preferred (Claude when ANTHROPIC_API_KEY is set).
          setScriptProvider(j.preferredScriptProvider)
          writeStoredScriptProvider(j.preferredScriptProvider)
        }
      }
      setScriptBillingNote(typeof j.scriptBillingNote === 'string' ? j.scriptBillingNote : '')
      setFfmpegAvailable(Boolean(j.ffmpegAvailable))
      setRenderNote(typeof j.renderNote === 'string' ? j.renderNote : '')
      setImageSources(
        j.imageSources && typeof j.imageSources === 'object'
          ? j.imageSources
          : {
              ap: false,
              serpapi: false,
              oxylabs: false,
              google: false,
              pexels: Boolean(j.pexelsConfigured),
              pinterestApi: false,
              pinterestPinUrl: true,
              wikimedia: true,
            },
      )
      setImagesNote(typeof j.imagesNote === 'string' ? j.imagesNote : '')
      if (typeof j.imageProvider === 'string' && j.imageProvider.trim()) {
        const nextProvider = j.imageProvider.trim().toLowerCase()
        setImageProvider(nextProvider)
        setRebuildImageProvider(nextProvider)
      }
      if (Array.isArray(j.imageProviderOptions) && j.imageProviderOptions.length) {
        setImageProviderOptions(j.imageProviderOptions)
      }
      if (typeof j.imageGenMode === 'string' && j.imageGenMode.trim()) {
        setImageGenMode(j.imageGenMode.trim().toLowerCase())
      }
      if (typeof j.imageGenProvider === 'string' && j.imageGenProvider.trim()) {
        setImageGenProvider(j.imageGenProvider.trim().toLowerCase())
      }
      if (Array.isArray(j.imageGenModeOptions) && j.imageGenModeOptions.length) {
        setImageGenModeOptions(j.imageGenModeOptions)
      }
      if (Array.isArray(j.imageGenProviderOptions) && j.imageGenProviderOptions.length) {
        setImageGenProviderOptions(j.imageGenProviderOptions)
      }
      setImageGenNote(typeof j.imageGenNote === 'string' ? j.imageGenNote : '')
      if (typeof j.buildMode === 'string' && j.buildMode.trim()) {
        setBuildMode(j.buildMode.trim().toLowerCase())
      }
      if (typeof j.buildModeSaved === 'string' && j.buildModeSaved.trim()) {
        setBuildModeSaved(j.buildModeSaved.trim().toLowerCase())
      }
      if (Array.isArray(j.buildModeOptions) && j.buildModeOptions.length) {
        setBuildModeOptions(j.buildModeOptions)
      }
      setBuildModeEnvForced(Boolean(j.buildModeEnvForced))
      setBuildModeNote(typeof j.buildModeNote === 'string' ? j.buildModeNote : '')
      if (Number.isFinite(Number(j.buildModeMaxScenesHobby))) {
        setBuildModeMaxScenesHobby(Math.max(1, Number(j.buildModeMaxScenesHobby)))
      }
      setPinterestStatus(j.pinterest && typeof j.pinterest === 'object' ? j.pinterest : null)
      setSerpapiStatus(j.serpapi && typeof j.serpapi === 'object' ? j.serpapi : null)
      setOxylabsStatus(j.oxylabs && typeof j.oxylabs === 'object' ? j.oxylabs : null)
      setRenderStack(j.renderStack || null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [fetchProduction])

  const refreshJobsQuiet = useCallback(async () => {
    try {
      const j = await fetchProduction()
      setJobs(j.jobs || [])
    } catch {
      /* background */
    }
  }, [fetchProduction])

  const saveBuildMode = useCallback(
    async (next) => {
      const value = String(next || '').trim().toLowerCase()
      if (!value || value === buildModeSaved) return
      if (buildModeEnvForced) {
        setErr('Build mode is locked to Hobby (slim) by EOF_FORCE_SLIM on the server.')
        return
      }
      const prev = buildModeSaved
      setBuildMode(value)
      setBuildModeSaved(value)
      setBuildModeBusy(true)
      setErr('')
      try {
        const res = await apiFetch('/api/admin/eof-production', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update-build-mode', buildMode: value }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Could not save build mode')
        if (typeof j.buildMode === 'string') setBuildMode(j.buildMode)
        if (typeof j.buildModeSaved === 'string') setBuildModeSaved(j.buildModeSaved)
        if (Array.isArray(j.buildModeOptions)) setBuildModeOptions(j.buildModeOptions)
        setBuildModeEnvForced(Boolean(j.buildModeEnvForced))
        if (typeof j.buildModeNote === 'string') setBuildModeNote(j.buildModeNote)
        setSuccess(
          (j.buildMode || value) === 'hobby'
            ? 'Build mode: Hobby (slim) — 4-scene cap, hard cuts'
            : 'Build mode: Pro — full quality pipeline',
        )
      } catch (e) {
        setBuildMode(prev)
        setBuildModeSaved(prev)
        setErr(e instanceof Error ? e.message : 'Could not save build mode')
      } finally {
        setBuildModeBusy(false)
      }
    },
    [buildModeSaved, buildModeEnvForced],
  )

  const saveImageProvider = useCallback(
    async (next) => {
      const value = String(next || '').trim().toLowerCase()
      if (!value || value === imageProvider) return
      const prev = imageProvider
      setImageProvider(value)
      setImageProviderBusy(true)
      setErr('')
      try {
        const res = await apiFetch('/api/admin/eof-production', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update-image-provider', imageProvider: value }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Could not save Google Images provider')
        if (typeof j.imageProvider === 'string') {
          setImageProvider(j.imageProvider)
          setRebuildImageProvider(j.imageProvider)
        }
        if (Array.isArray(j.imageProviderOptions)) setImageProviderOptions(j.imageProviderOptions)
        if (typeof j.imagesNote === 'string') setImagesNote(j.imagesNote)
        setSuccess(
          j.imageProvider === 'oxylabs'
            ? 'Google Images provider: Oxylabs (opt-in)'
            : j.imageProvider === 'serpapi'
              ? 'Google Images provider: SerpAPI'
              : 'Google Images provider: Auto (SerpAPI → gen → Wikimedia)',
        )
      } catch (e) {
        setImageProvider(prev)
        setErr(e instanceof Error ? e.message : 'Could not save Google Images provider')
      } finally {
        setImageProviderBusy(false)
      }
    },
    [imageProvider],
  )

  const saveImageGenSettings = useCallback(
    async (patch) => {
      const nextMode =
        patch.imageGenMode !== undefined
          ? String(patch.imageGenMode || '').trim().toLowerCase()
          : imageGenMode
      const nextProvider =
        patch.imageGenProvider !== undefined
          ? String(patch.imageGenProvider || '').trim().toLowerCase()
          : imageGenProvider
      if (nextMode === imageGenMode && nextProvider === imageGenProvider) return
      const prevMode = imageGenMode
      const prevProvider = imageGenProvider
      setImageGenMode(nextMode)
      setImageGenProvider(nextProvider)
      setImageGenBusy(true)
      setErr('')
      try {
        const res = await apiFetch('/api/admin/eof-production', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update-image-gen',
            imageGenMode: nextMode,
            imageGenProvider: nextProvider,
          }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Could not save image gen settings')
        if (typeof j.imageGenMode === 'string') setImageGenMode(j.imageGenMode)
        if (typeof j.imageGenProvider === 'string') setImageGenProvider(j.imageGenProvider)
        if (Array.isArray(j.imageGenModeOptions)) setImageGenModeOptions(j.imageGenModeOptions)
        if (Array.isArray(j.imageGenProviderOptions)) setImageGenProviderOptions(j.imageGenProviderOptions)
        if (typeof j.imageGenNote === 'string') setImageGenNote(j.imageGenNote)
        setSuccess(
          `Image gen: ${j.imageGenMode || nextMode} / ${j.imageGenProvider || nextProvider}`,
        )
      } catch (e) {
        setImageGenMode(prevMode)
        setImageGenProvider(prevProvider)
        setErr(e instanceof Error ? e.message : 'Could not save image gen settings')
      } finally {
        setImageGenBusy(false)
      }
    },
    [imageGenMode, imageGenProvider],
  )

  useEffect(() => {
    load()
  }, [load])

  /** Script Maker / Scheduler "Open job" / "Send to Production" focuses a concrete job. */
  useEffect(() => {
    const id = typeof openJobId === 'string' ? openJobId.trim() : ''
    if (!id) return
    setSelectedId(id)
    hydratedJobIdRef.current = null
    try {
      sessionStorage.setItem(SELECTED_JOB_KEY, id)
    } catch {
      /* ignore */
    }
    if (typeof onOpenJobConsumed === 'function') onOpenJobConsumed()
    // Refresh list so a freshly approved Script Maker draft is present.
    load().catch(() => {})
  }, [openJobId, onOpenJobConsumed, load])

  useEffect(() => {
    if (!selectedId) {
      try {
        sessionStorage.removeItem(SELECTED_JOB_KEY)
      } catch {
        /* ignore */
      }
      return
    }
    try {
      sessionStorage.setItem(SELECTED_JOB_KEY, selectedId)
    } catch {
      /* ignore */
    }
  }, [selectedId])

  const selected = jobs.find((j) => j.id === selectedId) || null

  /** Preview overlay only while drafting caption changes — never stack on a burned Short. */
  const showCaptionPreviewOverlay = (() => {
    if (captionStyle === 'off') return false
    // No finished Short yet — overlay is the only way to preview captions on a plate.
    if (!selected || selected.status !== 'video_rendered') return Boolean(videoPreviewUrl)
    // Burned Short on screen: overlay OFF unless local draft differs from what was burned.
    // Require an explicit dirty edit so style-picker clicks alone cannot false-positive
    // and stack a full-line overlay on beast/karaoke word burns.
    if (!draftDirty) return false
    if (captionStyle !== (selected.captionStyle || EOF_DEFAULT_CAPTION_STYLE)) return true
    const jobLay = normalizeEofCaptionLayout(selected.captionLayout, selected.captionStyle || captionStyle)
    if (Math.abs(jobLay.yNorm - captionLayout.yNorm) > 0.005) return true
    if (Math.abs(jobLay.fontScale - captionLayout.fontScale) > 0.02) return true
    const jobScenes = selected.script?.scenes || []
    const draftScenes = draftScript?.scenes || []
    if (draftScenes.length !== jobScenes.length) return true
    for (let i = 0; i < draftScenes.length; i += 1) {
      const a = String(draftScenes[i]?.caption || draftScenes[i]?.narration || '').trim()
      const b = String(jobScenes[i]?.caption || jobScenes[i]?.narration || '').trim()
      if (a !== b) return true
    }
    return false
  })()
  const hasPlainDraft = String(draftScript?.plainTextDraft || '').trim().length >= 40
  const regenerateScriptLabel = scriptBusy === 'draft'
    ? 'Regenerating…'
    : hasPlainDraft
      ? 'Regenerate script'
      : 'Generate script'

  const voiceRegen = useMemo(() => {
    if (!selected || !draftScript) {
      return { canRegenerate: false, remaining: 0, limit: 3, blockedReason: null }
    }
    return eofVoiceRegenerationStatus({ ...selected, script: draftScript })
  }, [selected, draftScript])

  function hydrateDraftFromJob(job) {
    setDraftScript(job.script ? JSON.parse(JSON.stringify(job.script)) : null)
    if (job.script?.format) setFormat(job.script.format)
    if (job.voicePreset) setVoicePreset(job.voicePreset)
    if (job.captionStyle) setCaptionStyle(job.captionStyle)
    if (job.captionLayout || job.captionStyle) {
      setCaptionLayout(normalizeEofCaptionLayout(job.captionLayout, job.captionStyle || captionStyle))
    }
    if (job.transitionStyle) setTransitionStyle(job.transitionStyle)
    if (job.colorGrade) setColorGrade(job.colorGrade)
    if (job.enhanceStyle) setEnhanceStyle(job.enhanceStyle)
    if (job.overlayMoments) setOverlayMoments(job.overlayMoments)
    setVideoEffects(normalizeEofVideoEffects(job.videoEffects || EOF_DEFAULT_VIDEO_EFFECTS))
    {
      const nextStickers = normalizeEofStickers(job.stickers || EOF_DEFAULT_STICKERS)
      setStickers(nextStickers)
      setActiveStickerId(nextStickers.items[0]?.id || '')
    }
    setMusicTrackId(job.musicTrackId || '')
    if (job.musicVolume != null && Number.isFinite(Number(job.musicVolume))) {
      setMusicVolume(Number(job.musicVolume))
    }
    setMusicStartSec(
      job.musicStartSec != null && Number.isFinite(Number(job.musicStartSec))
        ? Number(job.musicStartSec)
        : 0,
    )
    setMusicEndSec(
      job.musicEndSec != null && Number.isFinite(Number(job.musicEndSec))
        ? Number(job.musicEndSec)
        : null,
    )
    setZapcapTemplateId(job.zapcapTemplateId || '')
    if (job.voiceSettings) {
      setVoiceSettings(normalizeElevenLabsVoiceSettings(job.voiceSettings))
    } else if (job.voicePreset === 'brian') {
      setVoiceSettings(normalizeElevenLabsVoiceSettings(elevenLabsVoiceDefaults))
    }
    if (job.status !== 'video_rendered') setVideoPreviewUrl('')
    setDraftDirty(false)
  }

  function selectJob(jobId) {
    hydratedJobIdRef.current = null
    setSelectedId(jobId)
  }

  useEffect(() => {
    if (!selectedId) {
      setDraftScript(null)
      setDraftDirty(false)
      hydratedJobIdRef.current = null
      setVideoPreviewUrl('')
      return
    }
    if (hydratedJobIdRef.current === selectedId) return
    const job = jobs.find((j) => j.id === selectedId)
    if (!job) return
    hydratedJobIdRef.current = selectedId
    hydrateDraftFromJob(job)
  }, [selectedId, jobs])

  useEffect(() => {
    if (!selectedId || !selected || busy) return undefined
    if (selected.status === 'video_rendered' && !videoPreviewUrl) {
      void loadVideoPreview()
    }
    return undefined
  }, [selectedId, selected?.status, busy])

  useEffect(() => {
    return () => {
      if (renderPollRef.current) clearInterval(renderPollRef.current)
    }
  }, [])

  const isRendering =
    selected?.status === 'rendering' ||
    selected?.status === 'rendering_video' ||
    busy ||
    renderPhase === 'rendering' ||
    renderPhase === 'rendering-video'

  useEffect(() => {
    if (!isRendering) return undefined
    const timer = setInterval(() => setProgressTick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [isRendering])

  const displayProgress = useMemo(() => {
    void progressTick
    if (renderProgress) return refreshEofRenderProgress(renderProgress)
    if (selected?.renderProgress) return refreshEofRenderProgress(selected.renderProgress)
    if ((selected?.status === 'rendering' || selected?.status === 'rendering_video') && draftScript) {
      return buildFallbackRenderProgress(selected, draftScript, 'video')
    }
    return null
  }, [
    progressTick,
    renderProgress,
    selected?.renderProgress,
    selected?.status,
    selected?.updatedAt,
    draftScript,
  ])

  // Never offer Reset before the server would give up (Pro maxAge ~300s / Hobby ~280s),
  // or the operator cancels a live encode and the next Build starts from scratch.
  const isRenderStuck =
    (selected?.status === 'rendering' || selected?.status === 'rendering_video') &&
    displayProgress &&
    displayProgress.elapsedSeconds > (buildMode === 'pro' ? 300 : 120)

  useEffect(() => {
    if (!active || !selectedId) return undefined
    if (
      selected?.status !== 'rendering' &&
      selected?.status !== 'rendering_video' &&
      renderPhase !== 'rendering' &&
      renderPhase !== 'rendering-video'
    ) {
      return undefined
    }

    const poll = async () => {
      try {
        const j = await fetchProduction()
        const fresh = (j.jobs || []).find((row) => row.id === selectedId)
        if (!fresh) return
        upsertJob(fresh)
        if (fresh.renderProgress) setRenderProgress(fresh.renderProgress)
      } catch {
        /* polling */
      }
    }

    poll()
    renderPollRef.current = setInterval(poll, 1200)
    return () => {
      if (renderPollRef.current) {
        clearInterval(renderPollRef.current)
        renderPollRef.current = null
      }
    }
  }, [active, selectedId, selected?.status, renderPhase, fetchProduction])

  function stopRenderPolling() {
    if (renderPollRef.current) {
      clearInterval(renderPollRef.current)
      renderPollRef.current = null
    }
  }

  async function cancelStuckRender() {
    if (!selectedId) return
    setBusy(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel-render', jobId: selectedId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not reset build')
      setRenderProgress(null)
      if (j.job) upsertJob(j.job)
      setSuccess('Build reset — you can click Build Short again.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function resetBuildState() {
    if (!selectedId) return
    setBusy(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-build-state', jobId: selectedId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not reset build state')
      setRenderProgress(null)
      if (j.job) upsertJob(j.job)
      setSuccess(
        'Build state cleared (TTS budget + Serp avoid history). Click Build Short once in Pro mode.',
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  function markDraftDirty() {
    setDraftDirty(true)
  }

  function updateVoiceSetting(key, value) {
    setVoiceSettings((prev) => normalizeElevenLabsVoiceSettings({ ...prev, [key]: value }))
    markDraftDirty()
  }

  function resetBrianVoiceSettings() {
    setVoiceSettings(normalizeElevenLabsVoiceSettings(elevenLabsVoiceDefaults))
    markDraftDirty()
  }

  function workflowStepState(step) {
    if (!selected) return step === 1 ? 'current' : 'upcoming'
    const status = selected.status
    const hasScenes = (draftScript?.scenes?.length || selected?.script?.scenes?.length || 0) >= 1
    const hasDraft = Boolean(String(draftScript?.plainTextDraft || selected?.script?.plainTextDraft || '').trim())
    if (step === 1) {
      // Write draft
      if (status === 'draft' || (hasDraft && !hasScenes)) return 'current'
      if (hasDraft || hasScenes || status === 'ready_script' || status === 'video_rendered') return 'done'
      return 'current'
    }
    if (step === 2) {
      // Adapt to scenes
      if (!hasDraft && !hasScenes) return 'upcoming'
      if (hasScenes && ['ready_script', 'rendering', 'rendering_video', 'video_rendered', 'rendered'].includes(status)) {
        return status === 'ready_script' || status === 'rendered' ? 'current' : 'done'
      }
      if (hasDraft && !hasScenes) return 'current'
      return 'upcoming'
    }
    if (step === 3) {
      if (['rendering', 'rendering_video'].includes(status)) return 'current'
      if (status === 'video_rendered') return 'done'
      if (status === 'failed') return 'failed'
      if (hasScenes) return 'upcoming'
      return 'upcoming'
    }
    if (step === 4) return status === 'video_rendered' ? 'current' : 'upcoming'
    return 'upcoming'
  }

  function sceneStillUrl(sceneNumber) {
    if (!selectedId) return ''
    const bust = selected?.updatedAt ? encodeURIComponent(String(selected.updatedAt)) : String(Date.now())
    return `/api/admin/eof-production-scene-image?jobId=${encodeURIComponent(selectedId)}&scene=${sceneNumber}&v=${bust}`
  }

  async function downloadShort() {
    if (!selectedId) return
    setErr('')
    try {
      let blobUrl = videoPreviewUrl
      if (!blobUrl) {
        const videoRes = await apiFetch(
          `/api/admin/eof-production-video?jobId=${encodeURIComponent(selectedId)}&download=1`,
        )
        if (!videoRes.ok) {
          const j = await videoRes.json().catch(() => ({}))
          throw new Error(j.error || 'Could not download video')
        }
        const blob = await videoRes.blob()
        blobUrl = URL.createObjectURL(blob)
        setVideoPreviewUrl(blobUrl)
      }
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${String(selected?.title || selected?.topic || 'eof-short').replace(/[^\w\-]+/g, '-').slice(0, 60)}.mp4`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setSuccess('Download started.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Download failed')
    }
  }

  async function sendToYoutubeStudio() {
    if (!selectedId || typeof onSendToStudio !== 'function') return
    setBusy(true)
    setErr('')
    try {
      let blob
      if (videoPreviewUrl) {
        const r = await fetch(videoPreviewUrl)
        blob = await r.blob()
      } else {
        const videoRes = await apiFetch(`/api/admin/eof-production-video?jobId=${encodeURIComponent(selectedId)}`)
        if (!videoRes.ok) {
          const j = await videoRes.json().catch(() => ({}))
          throw new Error(j.error || 'Could not load video for Studio')
        }
        blob = await videoRes.blob()
        setVideoPreviewUrl(URL.createObjectURL(blob))
      }
      const title = String(draftScript?.title || selected?.title || selected?.topic || 'EOF Short').trim()
      const file = new File([blob], `${title.replace(/[^\w\-]+/g, '-').slice(0, 60) || 'eof-short'}.mp4`, {
        type: 'video/mp4',
      })

      let thumbnailBase64 = null
      let thumbnailSceneIndex = null
      try {
        const thumbRes = await apiFetch(
          `/api/admin/eof-production-scene-image?jobId=${encodeURIComponent(selectedId)}&thumbnail=1&format=base64`,
        )
        const thumbJson = await thumbRes.json().catch(() => ({}))
        if (thumbRes.ok && thumbJson.thumbnailBase64) {
          thumbnailBase64 = thumbJson.thumbnailBase64
          thumbnailSceneIndex = thumbJson.sceneIndex
        }
      } catch (e) {
        console.warn('[eof-production] thumbnail adapt skipped', e)
      }

      onSendToStudio({
        file,
        title,
        description: String(draftScript?.description || '').trim(),
        tags: Array.isArray(draftScript?.tags) ? draftScript.tags.join(', ') : '',
        productionJobId: selectedId,
        thumbnailBase64,
        thumbnailSceneIndex,
      })
      setSuccess(
        thumbnailBase64
          ? 'Opened Studio with this Short + adapted thumbnail — review and upload.'
          : 'Opened YouTube Studio with this Short — review and upload.',
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send to Studio')
    } finally {
      setBusy(false)
    }
  }

  async function waitForJobComplete(jobId, acceptableStatuses = ['video_rendered'], opts = {}) {
    const baselineUpdatedAt = opts.baselineUpdatedAt != null ? String(opts.baselineUpdatedAt) : null
    const deadline = Date.now() + 12 * 60 * 1000
    let sawRendering = false
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      const j = await fetchProduction()
      const job = (j.jobs || []).find((row) => row.id === jobId)
      if (!job) throw new Error('Job disappeared during build.')
      upsertJob(job)
      if (job.renderProgress) setRenderProgress(job.renderProgress)
      if (job.status === 'rendering' || job.status === 'rendering_video') sawRendering = true
      if (job.status === 'failed') throw new Error(job.errorMessage || 'Build failed')
      if (acceptableStatuses.includes(job.status)) {
        // Replace Captions must not accept the pre-replace video_rendered snapshot.
        if (baselineUpdatedAt) {
          const movedOn =
            sawRendering || (job.updatedAt != null && String(job.updatedAt) !== baselineUpdatedAt)
          if (!movedOn) continue
        }
        return job
      }
    }
    throw new Error('Build timed out — click Reset & retry, then try again.')
  }

  async function waitForVideoComplete(jobId, opts = {}) {
    return waitForJobComplete(jobId, ['video_rendered'], opts)
  }

  async function buildShort() {
    if (!selectedId || !draftScript) return
    const imagesVia = rebuildImageProvider || imageProvider || 'auto'
    const imagesViaLabel =
      imagesVia === 'serpapi' ? 'SerpAPI' : imagesVia === 'oxylabs' ? 'Oxylabs' : 'Auto'
    setBusy(true)
    setErr('')
    setSuccess(`Building Short — voiceover, photos via ${imagesViaLabel}, captions…`)
    setRenderPhase('rendering')
    setVideoPreviewUrl('')

    try {
      const saved = await saveJob({ silent: true })
      if (!saved) {
        setErr((prev) => prev || 'Could not save script — fix errors and try again.')
        return
      }

      const estSec =
        estimateEofRenderDurationSec(draftScript) +
        estimateEofVideoRenderDurationSec(draftScript?.scenes?.length || 5)
      setRenderProgress({
        percent: 3,
        message: 'Starting voiceover…',
        etaLabel: `~${formatDuration(estSec)} est.`,
        elapsedSeconds: 0,
        estimatedTotalSec: estSec,
        startedAt: new Date().toISOString(),
        sceneCount: draftScript?.scenes?.length || 5,
        stage: 'tts',
        pipeline: 'audio',
      })

      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'build-short',
          jobId: selectedId,
          imageProvider: imagesVia,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 202) {
        throw new Error(j.error || `Build failed to start (HTTP ${res.status})`)
      }
      if (j.job) {
        upsertJob(j.job)
        if (j.job.renderProgress) setRenderProgress(j.job.renderProgress)
      }

      const finishedJob = await waitForVideoComplete(selectedId)
      if (finishedJob.status !== 'video_rendered') {
        throw new Error(finishedJob.errorMessage || 'Build did not finish with a video')
      }

      await loadVideoPreview()
      setRenderProgress({ percent: 100, message: 'Short ready', etaLabel: '0:00 left', pipeline: 'video' })
      setSuccess(`Your Short is ready — voiceover, images via ${imagesViaLabel}, and captions.`)
      upsertJob(finishedJob)
      hydratedJobIdRef.current = selectedId
      hydrateDraftFromJob(finishedJob)

      setTimeout(() => {
        resultPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    } catch (e) {
      setRenderPhase('failed')
      setRenderProgress(null)
      setErr(e instanceof Error ? e.message : 'Error')
      await refreshJobsQuiet()
    } finally {
      stopRenderPolling()
      setBusy(false)
      setRenderPhase('')
    }
  }

  /** Post-build: remux with current CapCut-style stickers — keeps stills + VO (no image re-scrape). */
  async function applyStickers() {
    if (!selectedId || !draftScript?.scenes?.length) return
    setBusy(true)
    setErr('')
    setSuccess('Applying stickers (keeping images + voiceover)…')
    setRenderPhase('rendering-video')
    if (videoPreviewUrl) {
      try {
        URL.revokeObjectURL(videoPreviewUrl)
      } catch {
        /* ignore */
      }
    }
    setVideoPreviewUrl('')

    const baselineUpdatedAt = selected?.updatedAt || null

    try {
      const estSec = Math.max(40, (draftScript.scenes.length || 4) * 12)
      setRenderProgress({
        percent: 5,
        message: 'Applying stickers…',
        etaLabel: `~${formatDuration(estSec)} est.`,
        elapsedSeconds: 0,
        estimatedTotalSec: estSec,
        startedAt: new Date().toISOString(),
        sceneCount: draftScript.scenes.length,
        stage: 'video',
        pipeline: 'video',
      })

      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply-stickers',
          jobId: selectedId,
          stickers: normalizeEofStickers(stickers),
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 202) {
        throw new Error(j.error || `Apply stickers failed to start (HTTP ${res.status})`)
      }
      if (j.job) {
        upsertJob(j.job)
        if (j.job.renderProgress) setRenderProgress(j.job.renderProgress)
      }

      const finishedJob = await waitForVideoComplete(selectedId, { baselineUpdatedAt })
      if (finishedJob.status !== 'video_rendered') {
        throw new Error(finishedJob.errorMessage || 'Apply stickers did not finish with a video')
      }

      await loadVideoPreview({ bust: finishedJob.updatedAt || Date.now() })
      setRenderProgress({ percent: 100, message: 'Short ready', etaLabel: '0:00 left', pipeline: 'video' })
      setSuccess(
        `Stickers applied (${summarizeEofStickers(finishedJob.stickers || stickers)}) — images and voiceover kept.`,
      )
      upsertJob(finishedJob)
      hydratedJobIdRef.current = selectedId
      hydrateDraftFromJob(finishedJob)
    } catch (e) {
      setRenderPhase('failed')
      setRenderProgress(null)
      setErr(e instanceof Error ? e.message : 'Error')
      await refreshJobsQuiet()
    } finally {
      stopRenderPolling()
      setBusy(false)
      setRenderPhase('')
    }
  }

  /** Post-build: remux with current CapCut-style effects — keeps stills + VO (no image re-scrape). */
  async function applyEffects() {
    if (!selectedId || !draftScript?.scenes?.length) return
    setBusy(true)
    setErr('')
    setSuccess('Applying effects (keeping images + voiceover)…')
    setRenderPhase('rendering-video')
    if (videoPreviewUrl) {
      try {
        URL.revokeObjectURL(videoPreviewUrl)
      } catch {
        /* ignore */
      }
    }
    setVideoPreviewUrl('')

    const baselineUpdatedAt = selected?.updatedAt || null

    try {
      const estSec = Math.max(40, (draftScript.scenes.length || 4) * 12)
      setRenderProgress({
        percent: 5,
        message: 'Applying effects…',
        etaLabel: `~${formatDuration(estSec)} est.`,
        elapsedSeconds: 0,
        estimatedTotalSec: estSec,
        startedAt: new Date().toISOString(),
        sceneCount: draftScript.scenes.length,
        stage: 'video',
        pipeline: 'video',
      })

      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply-effects',
          jobId: selectedId,
          videoEffects: normalizeEofVideoEffects(videoEffects),
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 202) {
        throw new Error(j.error || `Apply effects failed to start (HTTP ${res.status})`)
      }
      if (j.job) {
        upsertJob(j.job)
        if (j.job.renderProgress) setRenderProgress(j.job.renderProgress)
      }

      const finishedJob = await waitForVideoComplete(selectedId, { baselineUpdatedAt })
      if (finishedJob.status !== 'video_rendered') {
        throw new Error(finishedJob.errorMessage || 'Apply effects did not finish with a video')
      }

      await loadVideoPreview({ bust: finishedJob.updatedAt || Date.now() })
      setRenderProgress({ percent: 100, message: 'Short ready', etaLabel: '0:00 left', pipeline: 'video' })
      setSuccess(
        `Effects applied (${summarizeEofVideoEffects(finishedJob.videoEffects || videoEffects)}) — images and voiceover kept.`,
      )
      upsertJob(finishedJob)
      hydratedJobIdRef.current = selectedId
      hydrateDraftFromJob(finishedJob)
    } catch (e) {
      setRenderPhase('failed')
      setRenderProgress(null)
      setErr(e instanceof Error ? e.message : 'Error')
      await refreshJobsQuiet()
    } finally {
      stopRenderPolling()
      setBusy(false)
      setRenderPhase('')
    }
  }

  /** Post-build: re-burn captions only (style / text / position / size) — keeps stills + VO. */
  async function replaceCaptions() {
    if (!selectedId || !draftScript?.scenes?.length) return
    setBusy(true)
    setErr('')
    setSuccess('Replacing captions (keeping images + voiceover)…')
    setRenderPhase('rendering-video')
    setCaptionEditOpen(false)
    if (videoPreviewUrl) {
      try {
        URL.revokeObjectURL(videoPreviewUrl)
      } catch {
        /* ignore */
      }
    }
    setVideoPreviewUrl('')

    const baselineUpdatedAt = selected?.updatedAt || null

    try {
      const estSec = Math.max(40, (draftScript.scenes.length || 4) * 12)
      setRenderProgress({
        percent: 5,
        message: 'Replacing captions…',
        etaLabel: `~${formatDuration(estSec)} est.`,
        elapsedSeconds: 0,
        estimatedTotalSec: estSec,
        startedAt: new Date().toISOString(),
        sceneCount: draftScript.scenes.length,
        stage: 'video',
        pipeline: 'video',
      })

      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replace-captions',
          jobId: selectedId,
          captionStyle,
          captionLayout: normalizeEofCaptionLayout(captionLayout, captionStyle),
          zapcapTemplateId: isZapcapCaptionStyle(captionStyle) ? zapcapTemplateId || null : null,
          sceneCaptions: draftScript.scenes.map((s, i) => ({
            index: i,
            caption: String(s.caption || s.narration || '').trim().slice(0, 140),
          })),
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 202) {
        throw new Error(j.error || `Caption replace failed to start (HTTP ${res.status})`)
      }
      if (j.job) {
        upsertJob(j.job)
        if (j.job.renderProgress) setRenderProgress(j.job.renderProgress)
      }

      const finishedJob = await waitForVideoComplete(selectedId, { baselineUpdatedAt })
      if (finishedJob.status !== 'video_rendered') {
        throw new Error(finishedJob.errorMessage || 'Caption replace did not finish with a video')
      }

      await loadVideoPreview({ bust: finishedJob.updatedAt || Date.now() })
      setRenderProgress({ percent: 100, message: 'Short ready', etaLabel: '0:00 left', pipeline: 'video' })
      setSuccess('Captions replaced — images and voiceover kept.')
      upsertJob(finishedJob)
      hydratedJobIdRef.current = selectedId
      hydrateDraftFromJob(finishedJob)
    } catch (e) {
      setRenderPhase('failed')
      setRenderProgress(null)
      setErr(e instanceof Error ? e.message : 'Error')
      await refreshJobsQuiet()
    } finally {
      stopRenderPolling()
      setBusy(false)
      setRenderPhase('')
    }
  }

  /** Clear the selected bed; on a built Short, remux VO-only (no image/TTS rebuild). */
  async function clearSelectedMusicBed() {
    if (!selectedId || !musicTrackId) return
    const prevTrackId = musicTrackId
    const prevStart = musicStartSec
    const prevEnd = musicEndSec
    const jobSnap = jobs.find((j) => j.id === selectedId) || selected
    const hadBuiltVideo =
      jobSnap?.status === 'video_rendered' || Boolean(jobSnap?.renderOutputPath)
    const canRemuxAudio =
      hadBuiltVideo ||
      Boolean(jobSnap?.mixedAudioPath) ||
      Boolean(jobSnap?.narrationManifest?.length)

    setBusy(true)
    setErr('')
    setSuccess('')
    setMusicTrackId('')
    setMusicStartSec(0)
    setMusicEndSec(null)
    let clearedOnServer = false
    try {
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedId,
          musicTrackId: null,
          musicStartSec: 0,
          musicEndSec: null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not clear song')
      clearedOnServer = true
      if (j.job) {
        upsertJob(j.job)
        hydratedJobIdRef.current = selectedId
        hydrateDraftFromJob(j.job)
      }

      // No built mix/video yet — field clear is enough.
      if (!canRemuxAudio) {
        setSuccess('Song cleared — pick another bed, then Build or Remix.')
        return
      }

      // Strip bed from mixed audio + remux existing Short (reuse stills / VO takes).
      setSuccess('Removing song from Short…')
      setRenderPhase('rendering')
      if (videoPreviewUrl) {
        try {
          URL.revokeObjectURL(videoPreviewUrl)
        } catch {
          /* ignore */
        }
      }
      setVideoPreviewUrl('')

      const estSec = Math.max(40, Math.round(estimateEofVoiceoverRemuxDurationSec(draftScript) * 0.7))
      setRenderProgress({
        percent: 5,
        message: 'Stripping music bed…',
        etaLabel: `~${formatDuration(estSec)} est.`,
        elapsedSeconds: 0,
        estimatedTotalSec: estSec,
        startedAt: new Date().toISOString(),
        sceneCount: draftScript?.scenes?.length || 5,
        stage: 'mix',
        pipeline: 'audio',
      })

      const remixRes = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remix-music',
          jobId: selectedId,
          musicTrackId: null,
          musicVolume,
          musicStartSec: 0,
          musicEndSec: null,
        }),
      })
      const remixJson = await remixRes.json().catch(() => ({}))
      if (!remixRes.ok && remixRes.status !== 202) {
        throw new Error(remixJson.error || `Remove song remux failed to start (HTTP ${remixRes.status})`)
      }
      if (remixJson.job) {
        upsertJob(remixJson.job)
        if (remixJson.job.renderProgress) setRenderProgress(remixJson.job.renderProgress)
      }

      // Audio mixing briefly reports `rendered`; a built Short is not finished until
      // the new durable MP4 has replaced the old one.
      const finishedJob = hadBuiltVideo
        ? await waitForVideoComplete(selectedId)
        : await waitForJobComplete(selectedId, ['video_rendered', 'rendered'])
      if (finishedJob.status !== 'video_rendered' && finishedJob.status !== 'rendered') {
        throw new Error(finishedJob.errorMessage || 'Remove song did not finish remixing audio')
      }

      if (finishedJob.status === 'video_rendered') {
        await loadVideoPreview({ bust: finishedJob.updatedAt || Date.now() })
      }
      setRenderProgress({ percent: 100, message: 'Short ready', etaLabel: '0:00 left', pipeline: 'video' })
      setSuccess('Song removed from Short — pick a new bed and Remix to add music.')
      upsertJob(finishedJob)
      hydratedJobIdRef.current = selectedId
      hydrateDraftFromJob(finishedJob)
    } catch (e) {
      // Keep UI cleared after a successful PATCH so Remix can retry VO-only / a new bed.
      if (!clearedOnServer) {
        setMusicTrackId(prevTrackId)
        setMusicStartSec(prevStart)
        setMusicEndSec(prevEnd)
      }
      setRenderPhase('failed')
      setRenderProgress(null)
      setErr(e instanceof Error ? e.message : 'Error')
      await refreshJobsQuiet()
    } finally {
      stopRenderPolling()
      setBusy(false)
      setRenderPhase('')
    }
  }

  /** Post-build: swap the selected/Auto bed under existing VO, remux Short (no image refetch). */
  async function remixMusicBed() {
    if (!selectedId) return
    setBusy(true)
    setErr('')
    setSuccess('Remixing music bed under voiceover…')
    setRenderPhase('rendering')
    setVideoPreviewUrl('')

    try {
      const estSec = Math.max(40, Math.round(estimateEofVoiceoverRemuxDurationSec(draftScript) * 0.7))
      setRenderProgress({
        percent: 5,
        message: 'Mixing music bed…',
        etaLabel: `~${formatDuration(estSec)} est.`,
        elapsedSeconds: 0,
        estimatedTotalSec: estSec,
        startedAt: new Date().toISOString(),
        sceneCount: draftScript?.scenes?.length || 5,
        stage: 'mix',
        pipeline: 'audio',
      })

      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remix-music',
          jobId: selectedId,
          musicTrackId: musicTrackId || null,
          musicVolume,
          musicStartSec,
          musicEndSec,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 202) {
        throw new Error(j.error || `Music remix failed to start (HTTP ${res.status})`)
      }
      if (j.job) {
        upsertJob(j.job)
        if (j.job.renderProgress) setRenderProgress(j.job.renderProgress)
      }

      const finishedJob = await waitForVideoComplete(selectedId)
      if (finishedJob.status !== 'video_rendered') {
        throw new Error(finishedJob.errorMessage || 'Music remix did not finish with a video')
      }

      await loadVideoPreview({ bust: finishedJob.updatedAt || Date.now() })
      setRenderProgress({ percent: 100, message: 'Short ready', etaLabel: '0:00 left', pipeline: 'video' })
      setSuccess('Music bed remixed under voiceover — preview refreshed.')
      upsertJob(finishedJob)
      hydratedJobIdRef.current = selectedId
      hydrateDraftFromJob(finishedJob)
    } catch (e) {
      setRenderPhase('failed')
      setRenderProgress(null)
      setErr(e instanceof Error ? e.message : 'Error')
      await refreshJobsQuiet()
    } finally {
      stopRenderPolling()
      setBusy(false)
      setRenderPhase('')
    }
  }

  // Free rebuild: reuse the EXISTING voiceover audio, refresh images, re-render video.
  // Hits the backend 'render-video' action which never calls TTS/ElevenLabs.
  async function rebuildVideo() {
    if (!selectedId || !draftScript) return
    const imagesVia = rebuildImageProvider || imageProvider || 'auto'
    setBusy(true)
    setErr('')
    setSuccess(
      `Rebuilding video — reusing voiceover, refreshing images via ${
        imagesVia === 'serpapi' ? 'SerpAPI' : imagesVia === 'oxylabs' ? 'Oxylabs' : 'Auto'
      } (free captions)…`,
    )
    setRenderPhase('rendering-video')
    setVideoPreviewUrl('')

    try {
      const saved = await saveJob({ silent: true })
      if (!saved) {
        setErr((prev) => prev || 'Could not save changes — fix errors and try again.')
        return
      }

      const estSec = estimateEofVideoRenderDurationSec(draftScript?.scenes?.length || 5)
      setRenderProgress({
        percent: 4,
        message: 'Refreshing images…',
        etaLabel: `~${formatDuration(estSec)} est.`,
        elapsedSeconds: 0,
        estimatedTotalSec: estSec,
        startedAt: new Date().toISOString(),
        sceneCount: draftScript?.scenes?.length || 5,
        stage: 'images',
        pipeline: 'video',
      })

      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'render-video',
          jobId: selectedId,
          imageProvider: imagesVia,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 202) {
        throw new Error(j.error || `Rebuild failed to start (HTTP ${res.status})`)
      }
      if (j.job) {
        upsertJob(j.job)
        if (j.job.renderProgress) setRenderProgress(j.job.renderProgress)
      }

      const finishedJob = await waitForVideoComplete(selectedId)
      if (finishedJob.status !== 'video_rendered') {
        throw new Error(finishedJob.errorMessage || 'Rebuild did not finish with a video')
      }

      await loadVideoPreview()
      setRenderProgress({ percent: 100, message: 'Short ready', etaLabel: '0:00 left', pipeline: 'video' })
      setSuccess(
        `Video rebuilt — same voiceover, fresh images via ${
          imagesVia === 'serpapi' ? 'SerpAPI' : imagesVia === 'oxylabs' ? 'Oxylabs' : 'Auto'
        }, free captions. No ElevenLabs or ZapCap charges.`,
      )
      upsertJob(finishedJob)
      hydratedJobIdRef.current = selectedId
      hydrateDraftFromJob(finishedJob)

      setTimeout(() => {
        resultPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    } catch (e) {
      setRenderPhase('failed')
      setRenderProgress(null)
      setErr(e instanceof Error ? e.message : 'Error')
      await refreshJobsQuiet()
    } finally {
      stopRenderPolling()
      setBusy(false)
      setRenderPhase('')
    }
  }

  // Paid ZapCap pass only — burns the selected template onto the current render (no TTS, no image refetch).
  async function applyZapcapCaptions() {
    if (!selectedId || !draftScript) return
    if (!isZapcapCaptionStyle(captionStyle)) {
      setErr('Pick a ZapCap caption template first.')
      return
    }
    if (!captionEngine.zapcap) {
      setErr('ZAPCAP_API_KEY is not set — add it in Vercel to apply ZapCap captions.')
      return
    }

    setBusy(true)
    setErr('')
    setSuccess('Applying ZapCap animated captions to your current video…')
    setRenderPhase('rendering-video')
    setVideoPreviewUrl('')

    try {
      const saved = await saveJob({ silent: true })
      if (!saved) {
        setErr((prev) => prev || 'Could not save caption settings — fix errors and try again.')
        return
      }

      const estSec = estimateEofVideoRenderDurationSec(draftScript?.scenes?.length || 5) + 90
      setRenderProgress({
        percent: 6,
        message: 'Applying ZapCap captions…',
        etaLabel: `~${formatDuration(estSec)} est.`,
        elapsedSeconds: 0,
        estimatedTotalSec: estSec,
        startedAt: new Date().toISOString(),
        sceneCount: draftScript?.scenes?.length || 5,
        stage: 'video',
        pipeline: 'video',
      })

      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply-zapcap-captions', jobId: selectedId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 202) {
        throw new Error(j.error || `ZapCap apply failed to start (HTTP ${res.status})`)
      }
      if (j.job) {
        upsertJob(j.job)
        if (j.job.renderProgress) setRenderProgress(j.job.renderProgress)
      }

      const finishedJob = await waitForVideoComplete(selectedId)
      if (finishedJob.status !== 'video_rendered') {
        throw new Error(finishedJob.errorMessage || 'ZapCap apply did not finish with a video')
      }

      await loadVideoPreview()
      setRenderProgress({ percent: 100, message: 'ZapCap captions applied', etaLabel: '0:00 left', pipeline: 'video' })
      setSuccess('ZapCap animated captions applied — this step uses ZapCap credits.')
      upsertJob(finishedJob)
      hydratedJobIdRef.current = selectedId
      hydrateDraftFromJob(finishedJob)

      setTimeout(() => {
        resultPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    } catch (e) {
      setRenderPhase('failed')
      setRenderProgress(null)
      setErr(e instanceof Error ? e.message : 'Error')
      await refreshJobsQuiet()
    } finally {
      stopRenderPolling()
      setBusy(false)
      setRenderPhase('')
    }
  }

  async function regenerateVoiceover() {
    if (!selectedId || !draftScript) return
    setBusy(true)
    setErr('')
    setSuccess(
      voicePreset === 'manual'
        ? 'Remixing with your uploaded voiceover — reusing scene photos…'
        : 'Regenerating voiceover with your Brian settings — reusing scene photos…',
    )
    setRenderPhase('rendering')
    setVideoPreviewUrl('')

    try {
      const saved = await saveJob({ silent: true })
      if (!saved) {
        setErr((prev) => prev || 'Could not save voice settings — fix errors and try again.')
        return
      }

      const estSec = estimateEofVoiceoverRemuxDurationSec(draftScript)
      setRenderProgress({
        percent: 3,
        message: 'Regenerating voiceover…',
        etaLabel: `~${formatDuration(estSec)} est.`,
        elapsedSeconds: 0,
        estimatedTotalSec: estSec,
        startedAt: new Date().toISOString(),
        sceneCount: draftScript?.scenes?.length || 5,
        stage: 'tts',
        pipeline: 'audio',
      })

      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate-voiceover',
          jobId: selectedId,
          voicePreset,
          voiceSettings: voicePreset === 'brian' ? voiceSettings : null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 202) {
        throw new Error(j.error || `Voiceover regeneration failed (HTTP ${res.status})`)
      }
      if (j.job) {
        upsertJob(j.job)
        if (j.job.renderProgress) setRenderProgress(j.job.renderProgress)
      }

      const finishedJob = await waitForJobComplete(selectedId, ['video_rendered', 'rendered'])
      if (finishedJob.status !== 'video_rendered' && finishedJob.status !== 'rendered') {
        throw new Error(finishedJob.errorMessage || 'Voiceover regeneration did not finish')
      }

      if (finishedJob.status === 'video_rendered') {
        await loadVideoPreview()
      }
      setRenderProgress({ percent: 100, message: 'Voiceover updated', etaLabel: '0:00 left', pipeline: 'video' })
      setSuccess(
        finishedJob.status === 'video_rendered'
          ? `Voiceover regenerated — same photos, new ${voicePreset === 'manual' ? 'uploaded' : 'Brian'} mix, Short remuxed.`
          : 'Voiceover regenerated — run Build Short once to create the video.',
      )
      upsertJob(finishedJob)
      hydratedJobIdRef.current = selectedId
      hydrateDraftFromJob(finishedJob)
    } catch (e) {
      setRenderPhase('failed')
      setRenderProgress(null)
      setErr(e instanceof Error ? e.message : 'Error')
      await refreshJobsQuiet()
    } finally {
      stopRenderPolling()
      setBusy(false)
      setRenderPhase('')
    }
  }

  /** Reads a File as base64 and uploads it as the job's voiceover — skips TTS entirely. */
  async function uploadManualVoiceover(file) {
    if (!selectedId || !file) return
    setManualVoiceoverUploading(true)
    setManualVoiceoverStatus('')
    setErr('')
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(reader.error || new Error('Could not read file'))
        reader.readAsDataURL(file)
      })

      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload-voiceover',
          jobId: selectedId,
          audioBase64: dataUrl,
          mimeType: file.type || '',
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Voiceover upload failed')

      setVoicePreset('manual')
      if (j.job) upsertJob(j.job)
      setManualVoiceoverStatus(`Uploaded “${file.name}” — click Regenerate voiceover (or Build Short) to use it.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Voiceover upload failed')
    } finally {
      setManualVoiceoverUploading(false)
    }
  }

  function upsertJob(job) {
    if (!job?.id) return
    setJobs((prev) => {
      const i = prev.findIndex((row) => row.id === job.id)
      if (i === -1) return [job, ...prev]
      const next = [...prev]
      next[i] = job
      return next
    })
  }

  async function createJob(e) {
    e.preventDefault()
    if (useOwnScript && manualDraft.trim().length < 20) {
      setErr('Paste the full narration (at least a sentence or two) before creating the job.')
      return
    }
    setBusy(true)
    setErr('')
    setSuccess('')
    try {
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          format,
          voicePreset,
          scriptProvider,
          captionStyle,
          zapcapTemplateId: isZapcapCaptionStyle(captionStyle) ? zapcapTemplateId : '',
          transitionStyle,
          colorGrade,
          enhanceStyle,
          overlayMoments,
          videoEffects: normalizeEofVideoEffects(videoEffects),
          stickers: normalizeEofStickers(stickers),
          plainTextDraft: useOwnScript ? manualDraft.trim() : '',
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not create script')
      setTopic('')
      setManualDraft('')
      selectJob(j.job.id)
      if (j.job?.script) hydrateDraftFromJob(j.job)
      hydratedJobIdRef.current = j.job.id
      if (j.job?.scriptSource === 'manual') {
        setSuccess(`Your script for “${j.job.topic}” is in — no AI writing used. Click Adapt to scenes next.`)
      } else if (j.scriptWarning) {
        setErr(j.scriptWarning)
        setSuccess(
          `Fallback draft ready for “${j.job.topic}”. Edit it, then Adapt to scenes — or fix AI billing and click Regenerate script.`,
        )
      } else {
        setSuccess(
          j.scriptProviderLabel
            ? `Plain-text draft written with ${j.scriptProviderLabel}. Edit it, then Adapt to scenes.`
            : `Plain-text draft ready for “${j.job.topic}”. Edit it, then Adapt to scenes.`,
        )
      }
      upsertJob(j.job)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function saveJob({ silent = false } = {}) {
    if (!selectedId || !draftScript) return false
    if (!silent) {
      setBusy(true)
      setErr('')
      setSuccess('')
    }
    try {
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedId,
          script: draftScript,
          voicePreset,
          captionStyle,
          zapcapTemplateId: isZapcapCaptionStyle(captionStyle) ? zapcapTemplateId : '',
          transitionStyle,
          colorGrade,
          enhanceStyle,
          overlayMoments,
          videoEffects: normalizeEofVideoEffects(videoEffects),
          stickers: normalizeEofStickers(stickers),
          musicTrackId: musicTrackId || null,
          musicVolume,
          musicStartSec,
          musicEndSec,
          voiceSettings: voicePreset === 'brian' ? voiceSettings : null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Save failed')
      if (!silent) {
        const hasScenes = (draftScript.scenes?.length || 0) >= 1
        setSuccess(hasScenes ? 'Script saved. Next: Build Short.' : 'Draft saved. Next: Adapt to scenes.')
      }
      if (j.job) {
        upsertJob(j.job)
        hydratedJobIdRef.current = selectedId
        hydrateDraftFromJob(j.job)
      }
      return true
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
      return false
    } finally {
      if (!silent) setBusy(false)
    }
  }

  async function regenerateDraft({ directorNote } = {}) {
    if (!selectedId) return
    const note = String(directorNote ?? scriptChat).trim().slice(0, 1200)
    setBusy(true)
    setScriptBusy('draft')
    setErr('')
    setSuccess('')
    const previousPlain = String(draftScript?.plainTextDraft || selected?.script?.plainTextDraft || '').trim()
    try {
      if (note) {
        setScriptChatLog((prev) => [...prev.slice(-8), { role: 'you', text: note }])
      }
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate-draft',
          jobId: selectedId,
          format,
          scriptProvider,
          directorNote: note || undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not regenerate draft')
      setVideoPreviewUrl('')
      setRenderProgress(null)
      if (j.job) {
        upsertJob(j.job)
        hydratedJobIdRef.current = selectedId
        hydrateDraftFromJob(j.job)
      }
      const nextPlain = String(j.job?.script?.plainTextDraft || '').trim()
      const ds = j.deskSources || j.job?.deskSources
      const sourced =
        ds && typeof ds === 'object'
          ? ` NewsData ${ds.newsdata || 0} · Guardian ${ds.guardian || 0} · RSS ${ds.rss || 0}.`
          : ''
      const judge = j.judge || j.job?.judge
      const judged =
        judge && !judge.skipped
          ? ` Judge ${judge.judgeProvider || ''} ${judge.pass ? 'pass' : 'soft'} ${judge.overall}/10 (merit ${judge.merit} · interest ${judge.interest} · value ${judge.value}).`
          : ''
      const tuned = j.autoTuned || j.job?.autoTuned
      const autoNote =
        tuned && typeof tuned === 'object'
          ? ` Auto-tuned temp ${tuned.draftTemperature} · bar ≥${tuned.excellentMin}.`
          : ''
      if (note) {
        setScriptChatLog((prev) => [
          ...prev.slice(-10),
          {
            role: 'ai',
            text: nextPlain
              ? `Updated draft (${j.scriptProviderLabel || 'AI'})${judge && !judge.skipped ? ` · judge ${judge.overall}/10` : ''}.`
              : 'Draft rewrite finished.',
          },
        ])
        setScriptChat('')
      }
      if (j.scriptWarning) {
        setErr(j.scriptWarning)
        setSuccess('Fallback draft loaded. Edit it, or fix AI billing and Regenerate again.')
      } else if (previousPlain && nextPlain && previousPlain === nextPlain) {
        setSuccess('Regenerate returned a similar draft — tweak your direction or click Regenerate again.')
      } else {
        setSuccess(
          j.scriptProviderLabel
            ? `${note ? 'Directed' : 'Fresh'} script from ${j.scriptProviderLabel}${j.job?.topic ? ` — “${j.job.topic}”` : ''}.${sourced}${judged}${autoNote} Edit, then Adapt to scenes.`
            : `${note ? 'Directed' : 'Fresh'} script loaded.${sourced}${judged}${autoNote} Edit if needed, then Adapt to scenes.`,
        )
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
      if (note) {
        setScriptChatLog((prev) => [
          ...prev.slice(-10),
          { role: 'ai', text: e instanceof Error ? e.message : 'Could not rewrite from your direction.' },
        ])
      }
    } finally {
      setBusy(false)
      setScriptBusy('')
    }
  }

  async function adaptToScenes() {
    if (!selectedId || !draftScript) return
    const plain = String(draftScript.plainTextDraft || '').trim()
    if (plain.length < 40) {
      setErr('Write a fuller plain-text script first (at least a short paragraph).')
      return
    }
    setBusy(true)
    setErr('')
    setSuccess('')
    try {
      // Save draft text first so Adapt uses the latest edits
      await saveJob({ silent: true })
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adapt-to-scenes',
          jobId: selectedId,
          format,
          plainTextDraft: plain,
          scriptProvider,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not adapt to scenes')
      setVideoPreviewUrl('')
      setRenderProgress(null)
      if (j.job) {
        upsertJob(j.job)
        hydratedJobIdRef.current = selectedId
        hydrateDraftFromJob(j.job)
      }
      setSuccess(
        j.scriptProviderLabel
          ? `Scenes adapted with ${j.scriptProviderLabel}. Tweak captions, then Build Short.`
          : 'Scenes ready. Tweak captions, then Build Short.',
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function regenerateScript() {
    if (!selectedId) return
    setBusy(true)
    setScriptBusy('rewrite')
    setErr('')
    setSuccess('')
    try {
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate-script', jobId: selectedId, format, scriptProvider }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not rewrite script')
      setVideoPreviewUrl('')
      setRenderProgress(null)
      if (j.job) {
        upsertJob(j.job)
        hydratedJobIdRef.current = selectedId
        hydrateDraftFromJob(j.job)
      }
      setSuccess('Full rewrite done (new draft + scenes). Review, then Build Short.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
      setScriptBusy('')
    }
  }

  async function loadVideoPreview(opts = {}) {
    if (!selectedId) return
    setErr('')
    try {
      const bust = opts.bust != null ? String(opts.bust) : String(Date.now())
      const videoRes = await apiFetch(
        `/api/admin/eof-production-video?jobId=${encodeURIComponent(selectedId)}&t=${encodeURIComponent(bust)}`,
      )
      if (!videoRes.ok) {
        const j = await videoRes.json().catch(() => ({}))
        throw new Error(j.error || 'Could not load video preview')
      }
      const blob = await videoRes.blob()
      const nextUrl = URL.createObjectURL(blob)
      setVideoPreviewUrl((prev) => {
        if (prev) {
          try {
            URL.revokeObjectURL(prev)
          } catch {
            /* ignore */
          }
        }
        return nextUrl
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load video preview')
    }
  }

  async function deleteJob(jobId) {
    const job = jobs.find((row) => row.id === jobId)
    const label = job?.title || job?.topic || 'this script'
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return

    setDeletingId(jobId)
    setErr('')
    setSuccess('')
    try {
      const res = await apiFetch('/api/admin/eof-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', jobId }),
      })
      const text = await res.text()
      let j = {}
      try {
        j = text ? JSON.parse(text) : {}
      } catch {
        /* non-JSON */
      }
      if (!res.ok) {
        throw new Error(j.error || text.trim() || `Could not delete script (HTTP ${res.status})`)
      }

      setJobs((prev) => prev.filter((row) => row.id !== jobId))
      if (selectedId === jobId) {
        hydratedJobIdRef.current = null
        setSelectedId(null)
        setDraftScript(null)
        setDraftDirty(false)
        setVideoPreviewUrl('')
        setRenderProgress(null)
      }
      setSuccess(`Deleted “${label}”.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setDeletingId(null)
    }
  }

  function updateScene(index, field, value) {
    markDraftDirty()
    setDraftScript((prev) => {
      if (!prev?.scenes) return prev
      const scenes = [...prev.scenes]
      const next = { ...scenes[index], [field]: value }
      // Keep narration aligned with on-screen caption for older rows / APIs
      if (field === 'caption') next.narration = value
      scenes[index] = next
      return { ...prev, scenes }
    })
  }

  function addScene(afterIndex = null) {
    markDraftDirty()
    setDraftScript((prev) => {
      if (!prev?.scenes) return prev
      if (prev.scenes.length >= EOF_MAX_SCENES) return prev
      const topic = prev.topic || selected?.topic || 'football'
      const insertAt =
        afterIndex == null || afterIndex < 0 ? prev.scenes.length : Math.min(prev.scenes.length, afterIndex + 1)
      const newScene = createEofScene({
        caption: 'New scene — write the on-screen line',
        imageQuery: `${topic} football`,
        role: insertAt === 0 ? 'hook' : 'body',
        durationSec: 3,
      })
      const scenes = [...prev.scenes]
      scenes.splice(insertAt, 0, newScene)
      // Keep last scene as CTA when possible
      if (scenes.length > 1) {
        scenes[scenes.length - 1] = { ...scenes[scenes.length - 1], role: 'cta' }
        if (scenes[0]) scenes[0] = { ...scenes[0], role: scenes[0].role || 'hook' }
      }
      return { ...prev, scenes }
    })
    setSuccess(`Scene added. Edit the caption, then Rebuild Short to include it.`)
  }

  function removeScene(index) {
    markDraftDirty()
    setDraftScript((prev) => {
      if (!prev?.scenes || prev.scenes.length <= EOF_MIN_SCENES) return prev
      const scenes = prev.scenes.filter((_, i) => i !== index)
      if (scenes[0]) scenes[0] = { ...scenes[0], role: 'hook' }
      if (scenes.length > 1) scenes[scenes.length - 1] = { ...scenes[scenes.length - 1], role: 'cta' }
      return { ...prev, scenes }
    })
    setSuccess('Scene removed. Rebuild Short to update voiceover, images, and video.')
  }

  function moveScene(index, direction) {
    markDraftDirty()
    setDraftScript((prev) => {
      if (!prev?.scenes) return prev
      const target = index + direction
      if (target < 0 || target >= prev.scenes.length) return prev
      const scenes = [...prev.scenes]
      const tmp = scenes[index]
      scenes[index] = scenes[target]
      scenes[target] = tmp
      return { ...prev, scenes }
    })
  }

  const sceneCount = draftScript?.scenes?.length || 0
  const wordCount = String(draftScript?.plainTextDraft || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
  const chatScriptAiLabel = activeScriptAiLabel(
    scriptProvider,
    preferredScriptProvider,
    scriptProviders,
    scriptProviderOptions,
  )
  const scriptSourceLabel =
    selected?.scriptSource && selected.scriptSource !== 'template'
      ? selected.scriptSource === 'xai'
        ? 'Grok'
        : selected.scriptSource === 'anthropic'
          ? 'Claude'
          : selected.scriptSource === 'groq'
            ? 'Groq'
            : selected.scriptSource === 'openai'
              ? 'OpenAI'
              : selected.scriptSource
      : preferredScriptProvider === 'xai' && !selected?.scriptSource
        ? 'Grok'
        : preferredScriptProvider === 'anthropic' && !selected?.scriptSource
          ? 'Claude'
          : selected?.scriptSource === 'template'
            ? 'template'
            : null

  const primaryAction = (() => {
    if (!selected || !draftScript) return null
    if (isRendering || scriptBusy) {
      return {
        label: scriptBusy === 'draft' ? 'Writing script…' : scriptBusy === 'rewrite' ? 'Rewriting…' : 'Building…',
        disabled: true,
        tone: 'busy',
      }
    }
    if (!hasPlainDraft) {
      return {
        label: regenerateScriptLabel,
        run: () => regenerateDraft({ directorNote: '' }),
        tone: 'primary',
        hint: 'Step 1 — write the voiceover',
      }
    }
    if (sceneCount < 1) {
      return { label: 'Adapt to scenes', run: adaptToScenes, tone: 'primary', hint: 'Step 2 — split into Short captions' }
    }
    if (selected.status !== 'video_rendered') {
      return { label: 'Build Short', run: buildShort, tone: 'success', hint: 'Step 3 — voice + images + video' }
    }
    return { label: 'Download MP4', run: downloadShort, tone: 'success', hint: 'Step 4 — download or publish' }
  })()

  const statusPill = (status) => {
    if (status === 'video_rendered') return 'border-[#303030] bg-[#272727] text-[#d4d4d4]'
    if (status === 'failed') return 'border-[#ff4e45]/40 bg-[#2a1515] text-[#ff9b95]'
    if (status === 'rendering' || status === 'rendering_video') return 'border-[#303030] bg-[#272727] text-white'
    if (status === 'ready_script') return 'border-[#303030] bg-[#272727] text-[#a3a3a3]'
    return 'border-[#303030] bg-transparent text-[#aaaaaa]'
  }

  if (!isOwner) {
    return <p className={`text-sm ${PX.muted}`}>Production automation is available to the channel owner.</p>
  }

  return (
    <div className="w-full max-w-none space-y-8">
      {loading ? <p className={`text-sm ${PX.muted}`}>Loading…</p> : null}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={PX.title}>Production</h2>
          <p className={`mt-1 ${PX.subtitle}`}>Write a Short, adapt scenes, then build.</p>
        </div>
        <details className="relative text-sm text-[#a3a3a3]">
          <summary className="cursor-pointer list-none rounded-xl border border-[#303030] px-3 py-1.5 hover:bg-[#2a2a2a]">
            Setup
          </summary>
          <div className={`absolute right-0 z-20 mt-2 w-[min(100vw-2rem,20rem)] space-y-2 ${PX.surface} p-4 text-xs shadow-2xl`}>
            <p>
              Script AI:{' '}
              {scriptProviders.anthropic
                ? 'Claude (default)'
                : scriptProviders.groq
                  ? 'Groq'
                  : openAiScriptEnabled
                    ? 'Configured'
                    : 'Add ANTHROPIC_API_KEY or GROQ_API_KEY'}
              {scriptProviders.anthropic && scriptProviders.groq ? ' · Groq' : ''}
              {scriptProviders.openai ? ' · OpenAI' : ''}
              {scriptProviders.xai ? ' · xAI' : ''}
            </p>
            <p className="text-[#8eb4d8]">Active: {chatScriptAiLabel}</p>
            <p>
              Script judge:{' '}
              {scriptProviders.judge?.enabled
                ? scriptProviders.judge.openai || scriptProviders.judge.xai
                  ? 'Second tier (merit · interest · value · directness)'
                  : 'Groq-only fallback'
                : 'Off / not keyed'}
            </p>
            {scriptProviders.judge?.note ? (
              <p className="text-[#fbbf24]">{scriptProviders.judge.note}</p>
            ) : null}
            <p>
              Articles:{' '}
              {scriptProviders.newsdata
                ? 'NewsData.io keyed (used on each draft/regenerate)'
                : 'NewsData.io not set'}
              {scriptProviders.guardian ? ' · Guardian' : ''}
              {' · RSS'}
            </p>
            <p>Video: {ffmpegAvailable ? 'Ready' : renderNote || 'ffmpeg missing'}</p>
            <div className="space-y-1.5">
              <span className="text-[#aaaaaa]">Build mode</span>
              <div className="flex overflow-hidden rounded-lg border border-[#303030]">
                {buildModeOptions.map((opt) => {
                  const active = buildMode === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={buildModeBusy || buildModeEnvForced}
                      title={opt.detail || opt.label}
                      onClick={() => saveBuildMode(opt.id)}
                      className={`flex-1 px-2.5 py-1.5 text-[11px] font-medium transition ${
                        active
                          ? 'bg-[#3a3a3a] text-white'
                          : 'bg-[#121212] text-[#8a8a8a] hover:bg-[#1c1c1c] hover:text-[#ccc]'
                      } disabled:opacity-50`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {buildModeNote ? <p className="text-[#8ab4f8]">{buildModeNote}</p> : null}
              {buildModeEnvForced ? (
                <p className="text-[#fbbf24]">Locked by EOF_FORCE_SLIM on the server.</p>
              ) : null}
            </div>
            <p>
              Images:{' '}
              {[
                imageSources.ap && 'AP (latest first)',
                imageSources.serpapi && 'SerpAPI',
                imageSources.oxylabs && 'Oxylabs',
                imageSources.google && 'Google',
                imageSources.pexels && 'Pexels',
                imageSources.pinterestApi && 'Pinterest',
                imageSources.grokImagine && 'Grok Imagine',
                imageSources.freeGen && 'Free gen (Pollinations)',
                'Wikimedia',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <label className="block space-y-1">
              <span className="text-[#aaaaaa]">Google Images provider</span>
              <select
                value={imageProvider}
                disabled={imageProviderBusy}
                onChange={(e) => saveImageProvider(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#303030] bg-[#121212] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#555] disabled:opacity-50"
              >
                {imageProviderOptions.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={p.id !== 'auto' && !p.configured}
                    title={p.detail}
                  >
                    {p.label}
                    {p.id !== 'auto' && !p.configured ? ' (not set)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[#aaaaaa]">Image gen</span>
              <select
                value={imageGenMode}
                disabled={imageGenBusy}
                onChange={(e) => saveImageGenSettings({ imageGenMode: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#303030] bg-[#121212] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#555] disabled:opacity-50"
              >
                {imageGenModeOptions.map((p) => (
                  <option key={p.id} value={p.id} title={p.detail}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[#aaaaaa]">Image gen provider</span>
              <select
                value={imageGenProvider}
                disabled={imageGenBusy || imageGenMode === 'off'}
                onChange={(e) => saveImageGenSettings({ imageGenProvider: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#303030] bg-[#121212] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#555] disabled:opacity-50"
              >
                {imageGenProviderOptions.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={p.id !== 'auto' && !p.configured}
                    title={p.detail}
                  >
                    {p.label}
                    {p.id !== 'auto' && !p.configured ? ' (not set)' : ''}
                  </option>
                ))}
              </select>
            </label>

            {imageProvider === 'serpapi' && !imageSources.serpapi ? (
              <p className="text-[#ff9b95]">SerpAPI selected but SERPAPI_API_KEY is not configured.</p>
            ) : null}
            {imageProvider === 'oxylabs' && !imageSources.oxylabs ? (
              <p className="text-[#ff9b95]">
                Oxylabs selected but off — needs OXYLABS_ENABLED=1 + credentials (opt-in when trial renewed).
              </p>
            ) : null}
            {imageGenProvider === 'grok' && !imageSources.grokImagine ? (
              <p className="text-[#ff9b95]">Grok Imagine selected but XAI_API_KEY is not configured.</p>
            ) : null}
            {imagesNote ? <p className="text-[#fbbf24]">{imagesNote}</p> : null}
            {imageGenNote ? <p className="text-[#8ab4f8]">{imageGenNote}</p> : null}
            {serpapiStatus?.configured ? (
              <p className={serpapiStatus.ok ? 'text-[#7ee787]' : 'text-[#ff9b95]'}>
                SerpAPI:{' '}
                {serpapiStatus.ok
                  ? `ready${serpapiStatus.detail ? ` — ${String(serpapiStatus.detail).slice(0, 60)}` : ''}`
                  : `check failed (${serpapiStatus.status || 'error'}${
                      serpapiStatus.detail ? `: ${String(serpapiStatus.detail).slice(0, 80)}` : ''
                    })`}
              </p>
            ) : (
              <p className="text-[#8a8a8a]">
                SerpAPI: not set — add <code className="text-[#aaa]">SERPAPI_API_KEY</code> (from{' '}
                <a
                  className="text-[#8ab4f8] underline"
                  href="https://serpapi.com/manage-api-key"
                  target="_blank"
                  rel="noreferrer"
                >
                  serpapi.com/manage-api-key
                </a>
                ) and redeploy.
              </p>
            )}
            {imageSources?.serpapiLastAttempt ? (
              <p className="text-[#8a8a8a]">
                Serp last search:{' '}
                <span className="text-[#ccc]">
                  {String(imageSources.serpapiLastAttempt.status || '?')}
                  {imageSources.serpapiLastAttempt.hits != null
                    ? ` · ${imageSources.serpapiLastAttempt.hits} hits`
                    : ''}
                  {imageSources.serpapiLastAttempt.query
                    ? ` · q=${String(imageSources.serpapiLastAttempt.query).slice(0, 50)}`
                    : ''}
                </span>
              </p>
            ) : null}
            {oxylabsStatus?.configured ? (
              <p className={oxylabsStatus.ok ? 'text-[#7ee787]' : 'text-[#ff9b95]'}>
                Oxylabs:{' '}
                {oxylabsStatus.ok
                  ? `ready${oxylabsStatus.detail ? ` — ${String(oxylabsStatus.detail).slice(0, 60)}` : ''}`
                  : `SEARCH DOWN (${oxylabsStatus.status || 'error'}) — soft-fallback to SerpAPI/gen/Wikimedia${
                      oxylabsStatus.detail ? `. ${String(oxylabsStatus.detail).slice(0, 100)}` : ''
                    }`}
              </p>
            ) : (
              <p className="text-[#8a8a8a]">
                Oxylabs: off (trial ended) — pipeline uses SerpAPI → gen → Wikimedia. Opt in later with{' '}
                <code className="text-[#aaa]">OXYLABS_ENABLED=1</code> + credentials; safe to remove{' '}
                <code className="text-[#aaa]">OXYLABS_*</code> from Vercel for now.
              </p>
            )}
            {pinterestStatus?.configured ? (
              <p className={pinterestStatus.ok ? 'text-[#7ee787]' : 'text-[#ff9b95]'}>
                Pinterest API:{' '}
                {pinterestStatus.ok
                  ? 'token valid — Rebuild will search Pinterest'
                  : `token rejected (${pinterestStatus.status || 'error'}${
                      pinterestStatus.detail ? `: ${String(pinterestStatus.detail).slice(0, 80)}` : ''
                    })`}
              </p>
            ) : (
              <p className="text-[#8a8a8a]">
                Pinterest API: not set — add <code className="text-[#aaa]">PINTEREST_ACCESS_TOKEN</code> in
                Vercel (staging) and redeploy.
              </p>
            )}
            <p>
              Captions:{' '}
              {captionEngine.zapcap
                ? 'ZapCap ready · free local styles'
                : 'Free local styles (ZapCap optional)'}
            </p>
            {captionEngine.note ? <p className="text-[#fbbf24]">{captionEngine.note}</p> : null}
            {scriptBillingNote ? <p className="text-[#fbbf24]">{scriptBillingNote}</p> : null}
          </div>
        </details>
      </header>

      <section className={`${PX.surface} p-6 sm:p-8`}>
        <form onSubmit={createJob} className="space-y-5">
          <label className={`block ${PX.label}`}>
            Topic
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={`${inputCls} text-base`}
              placeholder={
                format === 'quote'
                  ? 'e.g. Rooney on Ronaldo'
                  : format === 'news'
                    ? 'e.g. Spain beat Belgium at the World Cup'
                    : 'e.g. Cristiano Ronaldo'
              }
              minLength={2}
              required
              autoComplete="off"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-[#aaa]">
            <input
              type="checkbox"
              checked={useOwnScript}
              onChange={(e) => setUseOwnScript(e.target.checked)}
            />
            Post my own script (skip the AI writer)
          </label>

          {useOwnScript ? (
            <label className={`block ${PX.label}`}>
              Your script
              <textarea
                value={manualDraft}
                onChange={(e) => setManualDraft(e.target.value)}
                className={`${inputCls} min-h-[160px] text-base`}
                placeholder="Paste your already-written narration here. It's used as-is — no AI writing. Click Adapt to scenes afterward to build the timed shot list."
                minLength={20}
                required={useOwnScript}
              />
            </label>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className={PX.label}>
              Format
              <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputCls}>
                {(scriptFormats.length
                  ? scriptFormats
                  : [{ id: EOF_DEFAULT_SCRIPT_FORMAT, label: '5 facts listicle' }]
                ).map((f) => (
                  <option key={f.id} value={f.id} title={f.detail}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={PX.label}>
              Script AI
              <select
                value={scriptProvider}
                onChange={(e) => {
                  const next = e.target.value
                  setScriptProvider(next)
                  writeStoredScriptProvider(next)
                }}
                className={inputCls}
              >
                {(scriptProviderOptions.length
                  ? scriptProviderOptions
                  : [
                      { id: 'auto', label: 'Auto (best quality)', configured: true },
                      { id: 'anthropic', label: 'Claude Sonnet 5 (Anthropic)', configured: false },
                      { id: 'groq', label: 'Groq (free)', configured: false },
                      { id: 'xai', label: 'xAI Grok', configured: false },
                      { id: 'openai', label: 'OpenAI', configured: false },
                    ]
                ).map((p) => (
                  <option key={p.id} value={p.id} disabled={p.id !== 'auto' && !p.configured} title={p.detail}>
                    {p.label}
                    {p.id !== 'auto' && !p.configured ? ' (not set)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className={PX.label}>
              Google Images
              <select
                value={imageProvider}
                disabled={imageProviderBusy}
                onChange={(e) => saveImageProvider(e.target.value)}
                className={inputCls}
              >
                {imageProviderOptions.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={p.id !== 'auto' && !p.configured}
                    title={p.detail}
                  >
                    {p.label}
                    {p.id !== 'auto' && !p.configured ? ' (not set)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className={PX.label}>
              Image gen
              <select
                value={imageGenMode}
                disabled={imageGenBusy}
                onChange={(e) => saveImageGenSettings({ imageGenMode: e.target.value })}
                className={inputCls}
              >
                {imageGenModeOptions.map((p) => (
                  <option key={p.id} value={p.id} title={p.detail}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={PX.label}>
              Gen provider
              <select
                value={imageGenProvider}
                disabled={imageGenBusy || imageGenMode === 'off'}
                onChange={(e) => saveImageGenSettings({ imageGenProvider: e.target.value })}
                className={inputCls}
              >
                {imageGenProviderOptions.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={p.id !== 'auto' && !p.configured}
                    title={p.detail}
                  >
                    {p.label}
                    {p.id !== 'auto' && !p.configured ? ' (not set)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className={PX.label}>
              Voice
              <select value={voicePreset} onChange={(e) => setVoicePreset(e.target.value)} className={inputCls}>
                {(voicePresets.length
                  ? voicePresets
                  : [{ id: EOF_DEFAULT_VOICE_PRESET, label: 'British (Edge, free)' }]
                ).map((v) => (
                  <option key={v.id} value={v.id} title={v.detail}>
                    {v.label}
                  </option>
                ))}
              </select>
              {voicePreset === 'manual' ? (
                <span className="mt-1 block text-[10px] text-[#fbbf24]">
                  Upload your audio file on the job panel after creating it (below the Voice picker there).
                </span>
              ) : null}
            </label>
          </div>
          {imageProvider === 'serpapi' && !imageSources.serpapi ? (
            <p className={`text-xs ${PX.muted} text-[#ff9b95]`}>
              SerpAPI is selected but not keyed — add SERPAPI_API_KEY and redeploy, or pick Auto.
            </p>
          ) : null}
          {imageProvider === 'oxylabs' && !imageSources.oxylabs ? (
            <p className={`text-xs ${PX.muted} text-[#ff9b95]`}>
              Oxylabs is selected but off (opt-in) — set OXYLABS_ENABLED=1 + credentials when trial renewed, or
              pick SerpAPI / Auto.
            </p>
          ) : null}
          {imageGenProvider === 'grok' && !imageSources.grokImagine ? (
            <p className={`text-xs ${PX.muted} text-[#ff9b95]`}>
              Grok Imagine needs XAI_API_KEY — add it on Vercel staging and redeploy, or pick Free / Auto.
            </p>
          ) : null}
          {imageGenNote ? <p className={`text-xs ${PX.muted} text-[#8ab4f8]`}>{imageGenNote}</p> : null}
          <div
            className={
              selected
                ? 'space-y-5'
                : 'xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(15rem,17rem)] xl:items-start xl:gap-5'
            }
          >
            <div className="min-w-0 space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className={PX.label}>Transitions</p>
              <p className={`mt-1 text-xs ${PX.muted}`}>
                See the motion between scenes, then pick one. Auto picks CapCut fades / slides / wipes from
                the format.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(transitionStyles.length ? transitionStyles : EOF_TRANSITION_STYLES).map((t) => {
                  const active = transitionStyle === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTransitionStyle(t.id)}
                      className={`inline-flex items-center gap-1.5 overflow-hidden rounded-md border px-1.5 py-1 text-left transition ${
                        active
                          ? 'border-white/40 bg-[#272727] ring-1 ring-white/20'
                          : 'border-[#2a2a2a] bg-[#161616] hover:border-[#555]'
                      }`}
                      title={t.detail || t.label}
                    >
                      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-sm bg-black">
                        <TransitionPreview styleId={t.id} className="h-full w-full" />
                      </span>
                      <span
                        className={`text-[11px] font-medium leading-tight ${
                          active ? 'text-white' : 'text-[#e5e5e5]'
                        }`}
                      >
                        {t.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className={PX.label}>Color match</p>
              <p className={`mt-1 text-xs ${PX.muted}`}>
                Preview the grade, then pick one. Auto grades every scene so mixed stock stills look like one
                edit.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(colorGrades.length ? colorGrades : EOF_COLOR_GRADES).map((g) => {
                  const active = colorGrade === g.id
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setColorGrade(g.id)}
                      className={`inline-flex items-center gap-1.5 overflow-hidden rounded-md border px-1.5 py-1 text-left transition ${
                        active
                          ? 'border-white/40 bg-[#272727] ring-1 ring-white/20'
                          : 'border-[#2a2a2a] bg-[#161616] hover:border-[#555]'
                      }`}
                      title={g.detail || g.label}
                    >
                      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-sm bg-black">
                        <ColorGradePreview gradeId={g.id} className="h-full w-full" />
                      </span>
                      <span
                        className={`text-[11px] font-medium leading-tight ${
                          active ? 'text-white' : 'text-[#e5e5e5]'
                        }`}
                      >
                        {g.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className={PX.label}>Enhance / HD</p>
              <p className={`mt-1 text-xs ${PX.muted}`}>
                CapCut-style clarify after the 9:16 crop — mild denoise + soft sharpen. Stacks with color
                match. Apply before Rebuild.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(enhanceStyles.length ? enhanceStyles : EOF_ENHANCE_STYLES).map((e) => {
                  const active = enhanceStyle === e.id
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setEnhanceStyle(e.id)}
                      className={`inline-flex items-center gap-1.5 overflow-hidden rounded-md border px-1.5 py-1 text-left transition ${
                        active
                          ? 'border-white/40 bg-[#272727] ring-1 ring-white/20'
                          : 'border-[#2a2a2a] bg-[#161616] hover:border-[#555]'
                      }`}
                      title={e.detail || e.label}
                    >
                      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-sm bg-black">
                        <EnhanceStylePreview styleId={e.id} className="h-full w-full" />
                      </span>
                      <span
                        className={`text-[11px] font-medium leading-tight ${
                          active ? 'text-white' : 'text-[#e5e5e5]'
                        }`}
                      >
                        {e.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className={PX.label}>Image over image</p>
              <p className={`mt-1 text-xs ${PX.muted}`}>
                CapCut-style pop inset in the mid/lower safe zone (never over the face), soft rounded
                mask. Auto uses one middle beat when a secondary still exists. Save, then Rebuild Short
                / Apply effects to remux.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(overlayMomentsOptions.length
                  ? overlayMomentsOptions
                  : EOF_OVERLAY_MOMENTS_OPTIONS
                ).map((o) => {
                  const active = overlayMoments === o.id
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setOverlayMoments(o.id)}
                      className={`rounded-md border px-2.5 py-1.5 text-left transition ${
                        active
                          ? 'border-white/40 bg-[#272727] ring-1 ring-white/20'
                          : 'border-[#2a2a2a] bg-[#161616] hover:border-[#555]'
                      }`}
                      title={o.detail || o.label}
                    >
                      <span
                        className={`block text-[12px] font-medium ${
                          active ? 'text-white' : 'text-[#e5e5e5]'
                        }`}
                      >
                        {o.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
            </div>

            <aside
              className={`${selected ? 'hidden' : ''} ${PX.surfaceInset} mt-5 space-y-4 p-3 xl:mt-0 xl:sticky xl:top-4 xl:max-h-[calc(100vh-1.5rem)] xl:overflow-y-auto`}
            >
              <div>
                <p className={PX.label}>Effects</p>
                <p className={`mt-1 text-[11px] leading-snug ${PX.muted}`}>
                  Pick one-by-one (draft only). After a Short is built, use{' '}
                  <span className="text-[#d4d4d4]">Apply effects</span> beside the preview to remux.
                </p>
                <p className="mt-1.5 text-[10px] text-[#8e8e8e]">
                  Active: {summarizeEofVideoEffects(videoEffects)}
                </p>
                <div className="mt-2 space-y-3">
                  <EffectPickerGrid
                    title="Presets"
                    hint="Bundles fill motion + light + colour."
                    mode="label"
                    items={(videoEffectPresets.length ? videoEffectPresets : EOF_EFFECT_PRESETS).map(
                      (p) => ({
                        id: p.id,
                        label: p.label,
                        detail: p.detail,
                        vibe: p.vibe,
                      }),
                    )}
                    activeId={videoEffects.preset || 'none'}
                    onPick={(id) => {
                      setVideoEffects(pickEofVideoEffect(videoEffects, id, 'preset'))
                      markDraftDirty()
                    }}
                  />
                  <EffectPickerGrid
                    title="Motion"
                    hint="Tiny preview · pick one or Off."
                    mode="motion"
                    items={videoEffectsMotion.length ? videoEffectsMotion : EOF_MOTION_EFFECTS}
                    activeId={videoEffects.motion || 'none'}
                    onPick={(id) => {
                      setVideoEffects(pickEofVideoEffect(videoEffects, id, 'motion'))
                      markDraftDirty()
                    }}
                  />
                  <EffectPickerGrid
                    title="Lights"
                    hint="Leak / flash / glow."
                    mode="label"
                    items={videoEffectsLight.length ? videoEffectsLight : EOF_LIGHT_EFFECTS}
                    activeId={videoEffects.light || 'none'}
                    onPick={(id) => {
                      setVideoEffects(pickEofVideoEffect(videoEffects, id, 'light'))
                      markDraftDirty()
                    }}
                  />
                  <EffectPickerGrid
                    title="Colour"
                    hint="Warm = gold · punch = contrast · teal–orange cinema."
                    mode="swatch"
                    items={(videoEffectsColour.length ? videoEffectsColour : EOF_COLOUR_EFFECTS).filter(
                      (e) => e.subgroup !== 'hdr',
                    )}
                    activeId={
                      String(videoEffects.colour || '').startsWith('hdr_')
                        ? ''
                        : videoEffects.colour || 'none'
                    }
                    onPick={(id) => {
                      setVideoEffects(pickEofVideoEffect(videoEffects, id, 'colour'))
                      markDraftDirty()
                    }}
                  />
                  <EffectPickerGrid
                    title="HDR"
                    hint="Counts as colour slot."
                    mode="swatch"
                    items={(videoEffectsColour.length ? videoEffectsColour : EOF_COLOUR_EFFECTS).filter(
                      (e) => e.subgroup === 'hdr',
                    )}
                    activeId={
                      String(videoEffects.colour || '').startsWith('hdr_') ? videoEffects.colour : ''
                    }
                    onPick={(id) => {
                      setVideoEffects(pickEofVideoEffect(videoEffects, id, 'colour'))
                      markDraftDirty()
                    }}
                  />
                </div>
              </div>

              <div className="border-t border-[#2a2a2a] pt-3">
                <p className={PX.label}>Stickers</p>
                <p className={`mt-1 text-[11px] leading-snug ${PX.muted}`}>
                  Compact chips · up to {stickersMax}. Burned under captions.
                </p>
                <p className="mt-1.5 text-[10px] text-[#8e8e8e]">
                  Active: {summarizeEofStickers(stickers)}
                </p>
                <div className="mt-2 space-y-3">
                  <StickerPickerGrid
                    title="Buttons"
                    items={stickersButtons.length ? stickersButtons : listEofStickersByCategory('buttons')}
                    selectedIds={stickers.items.map((i) => i.id)}
                    onPick={(id) => {
                      const next = pickEofSticker(stickers, id)
                      setStickers(next)
                      setActiveStickerId(
                        next.items.some((i) => i.id === id) ? id : next.items[0]?.id || '',
                      )
                      markDraftDirty()
                    }}
                  />
                  <StickerPickerGrid
                    title="Arrows"
                    items={stickersArrows.length ? stickersArrows : listEofStickersByCategory('arrows')}
                    selectedIds={stickers.items.map((i) => i.id)}
                    onPick={(id) => {
                      const next = pickEofSticker(stickers, id)
                      setStickers(next)
                      setActiveStickerId(
                        next.items.some((i) => i.id === id) ? id : next.items[0]?.id || '',
                      )
                      markDraftDirty()
                    }}
                  />
                  <StickerPickerGrid
                    title="Shapes"
                    items={stickersShapes.length ? stickersShapes : listEofStickersByCategory('shapes')}
                    selectedIds={stickers.items.map((i) => i.id)}
                    onPick={(id) => {
                      const next = pickEofSticker(stickers, id)
                      setStickers(next)
                      setActiveStickerId(
                        next.items.some((i) => i.id === id) ? id : next.items[0]?.id || '',
                      )
                      markDraftDirty()
                    }}
                  />
                  <StickerPickerGrid
                    title="Stickers"
                    items={stickersExtras.length ? stickersExtras : listEofStickersByCategory('stickers')}
                    selectedIds={stickers.items.map((i) => i.id)}
                    onPick={(id) => {
                      const next = pickEofSticker(stickers, id)
                      setStickers(next)
                      setActiveStickerId(
                        next.items.some((i) => i.id === id) ? id : next.items[0]?.id || '',
                      )
                      markDraftDirty()
                    }}
                  />
                </div>
                {stickers.items.length ? (
                  <div className="mt-3 rounded-lg border border-[#2a2a2a] bg-[#141414] p-2.5">
                    <p className="text-[11px] font-medium text-[#d4d4d4]">Position</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {stickers.items.map((item) => {
                        const cat = EOF_STICKERS_CATALOG.find((c) => c.id === item.id)
                        const active = activeStickerId === item.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            disabled={busy}
                            onClick={() => setActiveStickerId(item.id)}
                            className={`rounded-md border px-2 py-1 text-[10px] ${
                              active
                                ? 'border-white/40 bg-[#272727] text-white'
                                : 'border-[#333] bg-[#1a1a1a] text-[#bbb]'
                            }`}
                          >
                            {cat?.label || item.id}
                          </button>
                        )
                      })}
                    </div>
                    {activeStickerId ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(stickerPositions.length ? stickerPositions : EOF_STICKER_POSITIONS).map((p) => {
                          const selectedItem = stickers.items.find((i) => i.id === activeStickerId)
                          const active = selectedItem?.position === p.id
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={busy}
                              title={p.detail}
                              onClick={() => {
                                setStickers(setEofStickerPosition(stickers, activeStickerId, p.id))
                                markDraftDirty()
                              }}
                              className={`rounded-md border px-2 py-1 text-[10px] ${
                                active
                                  ? 'border-white/40 bg-[#272727] text-white'
                                  : 'border-[#333] bg-[#1a1a1a] text-[#bbb] hover:border-[#555]'
                              }`}
                            >
                              {p.label}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      className={`mt-2 ${PX.btnGhost} !px-2 !py-1 !text-[11px]`}
                      onClick={() => {
                        setStickers({ items: [] })
                        setActiveStickerId('')
                        markDraftDirty()
                      }}
                    >
                      Clear stickers
                    </button>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>

          <div>
            <p className={PX.label}>Captions</p>
            {captionStyle === 'off' ? (
              <p className={`mt-1 text-xs ${PX.muted}`}>Captions off — clean plate, voiceover only.</p>
            ) : isLocalCaptionStyle(captionStyle) || isBottomBarCaptionStyle(captionStyle) ? (
              <p className={`mt-1 text-xs ${PX.muted}`}>
                Free local burn — no ZapCap cost or ZapCap watermark. Build/Rebuild uses this look.
              </p>
            ) : ['pop', 'karaoke', 'beast'].includes(captionStyle) ? (
              <p className={`mt-1 text-xs ${PX.muted}`}>
                Free CapCut-style burn on Build/Rebuild. Optional{' '}
                <span className="text-[#fbbf24]">Apply ZapCap</span> upgrades to animated templates
                {captionEngine.zapcap ? ' (~$0.10/min; free ZapCap credits are watermarked).' : ' when ZAPCAP_API_KEY is set.'}
              </p>
            ) : !captionEngine.zapcap ? (
              <p className="mt-1 text-xs text-[#fbbf24]">
                ZapCap catalog needs ZAPCAP_API_KEY. Use any Free style above for captions without it.
              </p>
            ) : (
              <p className={`mt-1 text-xs ${PX.muted}`}>
                Catalog template selected — Build uses a free local Pop preview; Apply ZapCap burns the
                animated template (~$0.10/min).
              </p>
            )}
            <div className="mt-2 grid gap-1.5 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-9">
              {[
                { id: 'live', label: 'Live subs', vibe: 'Bottom TV / CC', preview: 'live', free: true },
                { id: 'classic', label: 'Classic subs', vibe: 'Netflix / YouTube', preview: 'classic', free: true },
                { id: 'softbar', label: 'Soft bar', vibe: 'Pill background', preview: 'softbar', free: true },
                { id: 'broadcast', label: 'Broadcast', vibe: 'Thin stroke', preview: 'broadcast', free: true },
                { id: 'desk', label: 'Desk VO', vibe: 'Larger commentary', preview: 'desk', free: true },
                { id: 'elegant', label: 'Gold trim', vibe: 'Cream lower third', preview: 'elegant', free: true },
                { id: 'punch', label: 'Match bar', vibe: 'Sports lower-third', preview: 'punch', free: true },
                { id: 'pop', label: 'Pop punch', vibe: '1–2 word hooks', preview: 'pop', free: true, motion: true },
                { id: 'karaoke', label: 'Word highlight', vibe: 'Active word yellow', preview: 'karaoke', free: true, motion: true },
                { id: 'beast', label: 'Beast boom', vibe: 'Huge single word', preview: 'beast', free: true, motion: true },
                { id: 'off', label: 'Off', vibe: 'No captions', preview: 'off', free: true },
              ].map((s) => {
                const active = captionStyle === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setCaptionStyle(s.id)
                      setZapcapTemplateId('')
                      markDraftDirty()
                    }}
                    className={`overflow-hidden rounded-lg border text-left transition ${
                      active
                        ? 'border-white/35 bg-[#272727] ring-1 ring-white/20'
                        : 'border-[#303030] bg-[#121212] hover:border-[#555] hover:bg-[#1c1c1c]'
                    }`}
                    title={`${s.label} — ${s.vibe}`}
                  >
                    {/* Readable caption strip — motion for CapCut free burns */}
                    <div className="relative flex h-[3.75rem] w-full items-center justify-center overflow-hidden bg-gradient-to-b from-[#1a2a1a] to-[#0f1a30] sm:h-16">
                      {s.motion ? (
                        <FreeCaptionMotionThumb styleId={s.id} />
                      ) : (
                        <FreeCaptionStaticThumb preview={s.preview} />
                      )}
                      {active ? (
                        <span className="absolute right-1 top-1 rounded bg-white px-1 text-[7px] font-semibold leading-none text-black">
                          ✓
                        </span>
                      ) : null}
                    </div>
                    <div className="px-1.5 py-1">
                      <span
                        className={`block truncate text-[10px] font-medium leading-tight ${
                          active ? 'text-white' : 'text-[#e5e5e5]'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {captionEngine.zapcap ? (
              <div className="mt-4 space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <p className={PX.label}>
                    ZapCap templates{zapcapTemplates.length ? ` (${zapcapTemplates.length})` : ''} — click a
                    preview
                  </p>
                  <input
                    value={zapcapTemplateFilter}
                    onChange={(e) => setZapcapTemplateFilter(e.target.value)}
                    placeholder="Filter templates…"
                    className={`${inputCls} max-w-xs py-1.5 text-xs`}
                  />
                </div>
                {zapcapTemplatesError ? (
                  <p className="text-xs text-[#fbbf24]">{zapcapTemplatesError}</p>
                ) : null}
                {zapcapTemplates.length ? (
                  <div className="max-h-[22rem] overflow-y-auto overflow-x-visible rounded-xl border border-[#303030] bg-[#121212] p-2">
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                      {zapcapTemplates
                        .filter((t) => {
                          const q = zapcapTemplateFilter.trim().toLowerCase()
                          if (!q) return true
                          return (
                            String(t.name || '').toLowerCase().includes(q) ||
                            String(t.description || '').toLowerCase().includes(q) ||
                            String(t.category || '').toLowerCase().includes(q)
                          )
                        })
                        .map((t) => {
                          const active =
                            (captionStyle === 'zapcap' ||
                              captionStyle === 'pop' ||
                              captionStyle === 'karaoke' ||
                              captionStyle === 'beast') &&
                            zapcapTemplateId === t.id
                          return (
                            <ZapCapTemplateCell
                              key={t.id}
                              template={t}
                              active={active}
                              onSelect={() => {
                                setCaptionStyle('zapcap')
                                setZapcapTemplateId(t.id)
                              }}
                            />
                          )
                        })}
                    </div>
                  </div>
                ) : (
                  <p className={`text-xs ${PX.muted}`}>
                    No ZapCap templates returned yet — check the API key, or use Live / Off.
                  </p>
                )}
                {zapcapTemplateId ? (
                  <div className="flex items-center gap-3 rounded-lg border border-[#303030] bg-[#1a1a1a] px-3 py-2.5">
                    <div className="h-20 w-[7.5rem] shrink-0 overflow-hidden rounded-md bg-[#0d0d12]">
                      <CaptionTemplatePreview
                        template={zapcapTemplates.find((t) => t.id === zapcapTemplateId)}
                        className="h-full w-full"
                        playMode="always"
                        emphasizeCaptions
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-[#aaaaaa]">Selected look</p>
                      <p className="truncate text-xs font-medium text-white">
                        {zapcapTemplates.find((t) => t.id === zapcapTemplateId)?.name || zapcapTemplateId}
                      </p>
                    </div>
                  </div>
                ) : captionStyle === 'zapcap' ? (
                  <p className="text-xs text-[#fbbf24]">Choose a ZapCap template above before rendering.</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {!loading && voicePreset === 'brian' && !elevenLabsConfigured ? (
            <p className="text-xs text-[#fbbf24]">Brian needs ELEVENLABS_API_KEY — or pick Edge British.</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="submit" disabled={busy || loading} className={PX.btnPrimary}>
              {busy ? 'Starting…' : 'Create'}
            </button>
            <span className={`text-xs ${PX.muted}`}>Draft script is generated automatically.</span>
          </div>
        </form>

        {success ? (
          <p className="mt-5 rounded-xl border border-[#303030] bg-[#1a1a1a] px-4 py-3 text-sm text-[#e5e5e5]" role="status">
            {success}
          </p>
        ) : null}
        {err ? (
          <p className="mt-5 rounded-xl border border-[#ff4e45]/40 bg-[#2a1515] px-4 py-3 text-sm text-[#ff9b95]">{err}</p>
        ) : null}
        {displayProgress && !selected ? (
          <div className="mt-5">
            <EofRenderProgressBar
              progress={displayProgress}
              stuck={isRenderStuck}
              onCancel={cancelStuckRender}
              cancelBusy={busy}
            />
          </div>
        ) : null}
      </section>

      <div className="grid w-full max-w-none gap-5 lg:grid-cols-[minmax(13.75rem,16rem)_minmax(0,1fr)] xl:gap-5 2xl:gap-6">
        <aside className={`${PX.surfaceInset} p-3`}>
          <div className="mb-2 flex items-center justify-between px-1.5">
            <h3 className="text-xs font-medium text-[#aaaaaa]">Shorts</h3>
            <span className="tabular-nums text-xs text-[#525252]">{jobs.length}</span>
          </div>
          <ul className="max-h-[min(82vh,780px)] space-y-0.5 overflow-y-auto">
            {jobs.length === 0 ? (
              <li className={`px-2 py-8 text-center text-sm ${PX.muted}`}>No Shorts yet</li>
            ) : (
              jobs.map((j) => (
                <li key={j.id} className="group flex items-stretch gap-0.5">
                  <button
                    type="button"
                    onClick={() => selectJob(j.id)}
                    className={`min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left transition ${
                      selectedId === j.id ? 'bg-[#2a2a2a]' : 'hover:bg-[#272727]'
                    }`}
                  >
                    <div className="truncate text-sm text-[#ececec]">{j.title || j.topic}</div>
                    <div className="mt-1">
                      <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] ${statusPill(j.status)}`}>
                        {(j.status === 'rendering' || j.status === 'rendering_video') &&
                        j.renderProgress?.percent != null
                          ? `${Math.round(j.renderProgress.percent)}%`
                          : productionJobStatusLabel(j.status)}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteJob(j.id)}
                    disabled={deletingId === j.id}
                    title={`Delete ${j.title || j.topic}`}
                    aria-label={`Delete ${j.title || j.topic}`}
                    className="rounded-lg px-2 text-[#555] opacity-0 transition hover:text-[#ff9b95] group-hover:opacity-100 disabled:opacity-50"
                  >
                    ×
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        {selected && draftScript ? (
          <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(15rem,17rem)] xl:items-start xl:gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(16rem,18rem)] 2xl:gap-6">
          <div className="min-w-0 space-y-5">
            {/* Workspace header + primary CTA */}
            <div className={`${PX.surface} p-5 sm:p-6`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold text-white sm:text-lg">
                    {draftScript.title || selected.topic}
                  </h3>
                  <p className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${PX.muted}`}>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusPill(selected.status)}`}>
                      {productionJobStatusLabel(selected.status)}
                    </span>
                    {draftScript.format ? <span>{draftScript.format}</span> : null}
                    {scriptSourceLabel ? <span>AI: {scriptSourceLabel}</span> : null}
                    {draftDirty ? <span className="text-[#fbbf24]">Unsaved edits</span> : null}
                  </p>
                </div>
                {primaryAction ? (
                  <div className="flex flex-col items-stretch gap-1 sm:items-end">
                    <button
                      type="button"
                      disabled={Boolean(primaryAction.disabled) || busy}
                      onClick={() => primaryAction.run?.()}
                      className={`${
                        primaryAction.tone === 'busy' ? PX.btnSoft : PX.btnPrimary
                      } disabled:opacity-40`}
                    >
                      {primaryAction.label}
                    </button>
                    {primaryAction.hint ? (
                      <span className="text-[10px] text-[#717171]">{primaryAction.hint}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['1', 'Script'],
                  ['2', 'Scenes'],
                  ['3', 'Build'],
                  ['4', 'Ready'],
                ].map(([n, label]) => {
                  const state = workflowStepState(Number(n))
                  const cls =
                    state === 'done'
                      ? 'border-[#303030] bg-[#1a1a1a] text-[#aaaaaa]'
                      : state === 'current'
                        ? 'border-[#555] bg-[#272727] text-white'
                        : state === 'failed'
                          ? 'border-[#ff4e45]/40 bg-[#2a1515] text-[#ff9b95]'
                          : 'border-[#303030] text-[#717171]'
                  return (
                    <li key={n} className={`rounded-xl border px-3 py-2 text-center text-xs font-medium ${cls}`}>
                      <span className="block text-[10px] opacity-70">Step {n}</span>
                      {label}
                    </li>
                  )
                })}
              </ol>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#303030] pt-3">
                <label className="text-[10px] text-[#aaa]">
                  Voice
                  <select
                    value={voicePreset}
                    onChange={(e) => {
                      const next = e.target.value
                      setVoicePreset(next)
                      if (next === 'brian') {
                        setVoiceSettings((prev) =>
                          prev
                            ? normalizeElevenLabsVoiceSettings(prev)
                            : normalizeElevenLabsVoiceSettings(elevenLabsVoiceDefaults),
                        )
                      }
                      markDraftDirty()
                    }}
                    className={`${inputCls} mt-0.5 min-w-[150px] py-1.5 text-xs`}
                  >
                    {(voicePresets.length
                      ? voicePresets
                      : [{ id: EOF_DEFAULT_VOICE_PRESET, label: 'British (Edge, free)' }]
                    ).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] text-[#aaa]">
                  Captions
                  <select
                    value={
                      captionStyle === 'zapcap' && zapcapTemplateId
                        ? `zapcap:${zapcapTemplateId}`
                        : captionStyle
                    }
                    onChange={(e) => {
                      const v = e.target.value
                      if (v.startsWith('zapcap:')) {
                        setCaptionStyle('zapcap')
                        setZapcapTemplateId(v.slice('zapcap:'.length))
                      } else {
                        setCaptionStyle(v)
                        if (!isZapcapCaptionStyle(v)) setZapcapTemplateId('')
                      }
                      markDraftDirty()
                    }}
                    className={`${inputCls} mt-0.5 min-w-[180px] py-1.5 text-xs`}
                  >
                    <optgroup label="Free local">
                      <option value="live">Live subs</option>
                      <option value="classic">Classic subs</option>
                      <option value="softbar">Soft bar</option>
                      <option value="broadcast">Broadcast</option>
                      <option value="desk">Desk VO</option>
                      <option value="elegant">Gold trim</option>
                      <option value="punch">Match bar</option>
                      <option value="pop">Pop punch</option>
                      <option value="karaoke">Word highlight</option>
                      <option value="beast">Beast boom</option>
                      <option value="off">Off</option>
                    </optgroup>
                    {zapcapTemplates.length ? (
                      <optgroup label="ZapCap templates (paid apply)">
                        {zapcapTemplates.map((t) => (
                          <option key={t.id} value={`zapcap:${t.id}`}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveJob()}
                  className={`mt-4 ${PX.btnGhost}`}
                >
                  Save
                </button>
                {sceneCount >= 1 ? (
                  <label className="mt-4 text-[10px] text-[#aaa]">
                    Images
                    <select
                      value={rebuildImageProvider}
                      onChange={(e) => setRebuildImageProvider(e.target.value)}
                      disabled={busy || isRendering}
                      className={`${inputCls} mt-0.5 min-w-[140px] py-1.5 text-xs`}
                      title="Google Images provider for Build / Rebuild (overrides the Setup default for this run)"
                    >
                      {imageProviderOptions.map((p) => (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={p.id !== 'auto' && !p.configured}
                          title={p.detail}
                        >
                          {p.label}
                          {p.id !== 'auto' && !p.configured ? ' (not set)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {buildMode === 'hobby' && sceneCount > buildModeMaxScenesHobby ? (
                  <p className="mt-3 max-w-[14rem] text-[10px] leading-snug text-[#fbbf24]">
                    Hobby build uses first {buildModeMaxScenesHobby} scenes
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={busy || isRendering || sceneCount < 1}
                  onClick={selected.status === 'video_rendered' ? rebuildVideo : buildShort}
                  className={`mt-4 ${PX.btnSoft}`}
                  title={
                    selected.status === 'video_rendered'
                      ? `Refreshes images via ${rebuildImageProvider} + transitions with free captions — no ElevenLabs or ZapCap charges`
                      : `Generates voiceover + images via ${rebuildImageProvider} + video (free captions until you Apply ZapCap)`
                  }
                >
                  {selected.status === 'video_rendered' ? 'Rebuild video' : 'Build'}
                </button>
                <button
                  type="button"
                  disabled={busy || isRendering}
                  onClick={() => regenerateDraft()}
                  className={`mt-4 ${PX.btnGhost}`}
                >
                  {scriptBusy === 'draft' ? '…' : 'Regenerate'}
                </button>
                <button
                  type="button"
                  disabled={busy || isRendering}
                  onClick={regenerateScript}
                  title="New draft + scenes"
                  className={`mt-4 ${PX.btnGhost}`}
                >
                  {scriptBusy === 'rewrite' ? '…' : 'Full rewrite'}
                </button>
                <button
                  type="button"
                  disabled={deletingId === selected.id}
                  onClick={() => deleteJob(selected.id)}
                  className={`mt-4 ${PX.btnDanger}`}
                >
                  {deletingId === selected.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>

            {/* Ready result first when available */}
            {selected.status === 'video_rendered' || videoPreviewUrl ? (
              <div ref={resultPanelRef} className={`${PX.surface} p-6`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#d4d4d4]">
                      {selected.status === 'video_rendered' && selected.hasDurableVideo === false
                        ? 'Short encoded — preview missing'
                        : 'Short ready'}
                    </p>
                    <p className={`mt-0.5 text-xs ${PX.muted}`}>
                      {selected.status === 'video_rendered' && selected.hasDurableVideo === false
                        ? 'The MP4 was too large to keep on staging after the last render. Hit Rebuild video to compress and store a previewable Short.'
                        : `9:16 with voiceover and images${
                            selected.captionStyle === 'off' || selected.captionEngine === 'none'
                              ? ' · captions off'
                              : selected.captionStyle === 'live' || selected.captionEngine === 'local'
                                ? ' · live bottom subtitles'
                                : selected.captionEngine === 'zapcap' || selected.zapcapTemplateId
                                  ? ` · ZapCap${
                                      selected.zapcapTemplateId
                                        ? ` · ${
                                            zapcapTemplates.find((t) => t.id === selected.zapcapTemplateId)?.name ||
                                            `${String(selected.zapcapTemplateId).slice(0, 8)}…`
                                          }`
                                        : ''
                                    }`
                                  : ''
                          }.`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={downloadShort}
                      className={PX.btnGhost}
                    >
                      Download MP4
                    </button>
                    {typeof onSendToStudio === 'function' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={sendToYoutubeStudio}
                        className={PX.btnPrimary}
                      >
                        YouTube Studio
                      </button>
                    ) : null}
                  </div>
                </div>
                {videoPreviewUrl ? (
                  <div className="mt-4">
                    <div className="relative mx-auto max-h-[min(78vh,760px)] w-full max-w-[min(100%,480px)] overflow-hidden rounded-xl bg-black xl:max-w-[520px] 2xl:max-w-[560px]">
                      <video
                        key={videoPreviewUrl}
                        ref={videoRef}
                        controls
                        playsInline
                        className="max-h-[min(78vh,760px)] w-full cursor-pointer bg-black"
                        src={videoPreviewUrl}
                        onClick={() => {
                          setCaptionEditOpen(true)
                          const v = videoRef.current
                          if (!v || !draftScript?.scenes?.length) return
                          let t = v.currentTime || 0
                          let acc = 0
                          let idx = 0
                          for (let i = 0; i < draftScript.scenes.length; i += 1) {
                            const d = Math.max(1.5, Number(draftScript.scenes[i].durationSec) || 3)
                            if (t < acc + d) {
                              idx = i
                              break
                            }
                            acc += d
                            idx = i
                          }
                          setActiveCaptionScene(idx)
                        }}
                        onTimeUpdate={() => {
                          const v = videoRef.current
                          if (!v || !draftScript?.scenes?.length) return
                          let t = v.currentTime || 0
                          let acc = 0
                          for (let i = 0; i < draftScript.scenes.length; i += 1) {
                            const d = Math.max(1.5, Number(draftScript.scenes[i].durationSec) || 3)
                            if (t < acc + d) {
                              if (activeCaptionScene !== i) setActiveCaptionScene(i)
                              break
                            }
                            acc += d
                          }
                        }}
                      >
                        Your browser does not support video playback.
                      </video>
                      {showCaptionPreviewOverlay ? (
                        <div
                          className="pointer-events-none absolute inset-x-0 flex justify-center px-[10%]"
                          style={{
                            top: `${Math.round(captionLayout.yNorm * 100)}%`,
                            transform: 'translateY(-50%)',
                          }}
                        >
                          <p
                            className="max-w-full text-center font-bold uppercase leading-tight text-white"
                            style={{
                              fontSize: `${Math.round(18 * captionLayout.fontScale)}px`,
                              textShadow: '0 2px 0 #000, 0 0 8px #000',
                            }}
                          >
                            {String(
                              draftScript?.scenes?.[activeCaptionScene]?.caption ||
                                draftScript?.scenes?.[activeCaptionScene]?.narration ||
                                'Caption preview',
                            ).slice(0, 80)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <p className={`mt-2 text-center text-[11px] ${PX.muted}`}>
                      Click the video to edit caption text. Overlay preview only appears while you
                      change style/position/size/text — it stays off on a burned Short so it won&apos;t
                      stack on the burn.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={loadVideoPreview}
                    className={`mt-4 ${PX.btnPrimary}`}
                  >
                    Load preview
                  </button>
                )}

                {(selected.status === 'video_rendered' || videoPreviewUrl) && draftScript?.scenes?.length ? (
                  <div className="mt-5 rounded-xl border border-[#303030] bg-[#161616] p-4">
                    <p className={`mb-3 text-[11px] ${PX.muted}`}>
                      Effects &amp; stickers: pick + apply in the <span className="text-[#d4d4d4]">side panel</span>
                      {' '}(active: {summarizeEofVideoEffects(videoEffects)}
                      {stickers.items.length ? ` · ${summarizeEofStickers(stickers)}` : ''}).
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#303030] pt-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#d4d4d4]">
                          Captions · replace
                        </p>
                        <p className={`mt-1 text-xs ${PX.muted}`}>
                          Change style, edit text, move up/down, resize — then Replace captions. Keeps images +
                          voiceover (no new photos).
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy || isRendering}
                        onClick={replaceCaptions}
                        className={PX.btnPrimary}
                      >
                        {busy && renderPhase === 'rendering-video' ? 'Replacing…' : 'Replace captions'}
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs text-[#aaa]">
                        Vertical position
                        <input
                          type="range"
                          min={EOF_CAPTION_LAYOUT_Y_MIN}
                          max={EOF_CAPTION_LAYOUT_Y_MAX}
                          step={0.01}
                          value={captionLayout.yNorm}
                          onChange={(e) => {
                            setCaptionLayout((prev) =>
                              normalizeEofCaptionLayout(
                                { ...prev, yNorm: Number(e.target.value) },
                                captionStyle,
                              ),
                            )
                            markDraftDirty()
                          }}
                          disabled={busy || isRendering}
                          className="mt-2 w-full accent-white"
                        />
                        <span className="mt-0.5 block tabular-nums text-[10px] text-[#717171]">
                          {Math.round(captionLayout.yNorm * 100)}% from top
                        </span>
                      </label>
                      <label className="block text-xs text-[#aaa]">
                        Caption size
                        <input
                          type="range"
                          min={EOF_CAPTION_LAYOUT_SCALE_MIN}
                          max={EOF_CAPTION_LAYOUT_SCALE_MAX}
                          step={0.05}
                          value={captionLayout.fontScale}
                          onChange={(e) => {
                            setCaptionLayout((prev) =>
                              normalizeEofCaptionLayout(
                                { ...prev, fontScale: Number(e.target.value) },
                                captionStyle,
                              ),
                            )
                            markDraftDirty()
                          }}
                          disabled={busy || isRendering}
                          className="mt-2 w-full accent-white"
                        />
                        <span className="mt-0.5 block tabular-nums text-[10px] text-[#717171]">
                          {Math.round(captionLayout.fontScale * 100)}%
                        </span>
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={PX.btnGhost}
                        disabled={busy}
                        onClick={() => {
                          setCaptionLayout((prev) =>
                            normalizeEofCaptionLayout(
                              { ...prev, yNorm: Math.max(EOF_CAPTION_LAYOUT_Y_MIN, prev.yNorm - 0.03) },
                              captionStyle,
                            ),
                          )
                          markDraftDirty()
                        }}
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        className={PX.btnGhost}
                        disabled={busy}
                        onClick={() => {
                          setCaptionLayout((prev) =>
                            normalizeEofCaptionLayout(
                              { ...prev, yNorm: Math.min(EOF_CAPTION_LAYOUT_Y_MAX, prev.yNorm + 0.03) },
                              captionStyle,
                            ),
                          )
                          markDraftDirty()
                        }}
                      >
                        Move down
                      </button>
                      <button
                        type="button"
                        className={PX.btnGhost}
                        disabled={busy}
                        onClick={() => {
                          setCaptionLayout(defaultEofCaptionLayout(captionStyle))
                          markDraftDirty()
                        }}
                      >
                        Reset position
                      </button>
                      <button
                        type="button"
                        className={PX.btnSoft}
                        disabled={busy}
                        onClick={() => setCaptionEditOpen((o) => !o)}
                      >
                        {captionEditOpen ? 'Hide text editor' : 'Edit caption text'}
                      </button>
                    </div>
                    {captionEditOpen ? (
                      <div className="mt-3 space-y-2">
                        {draftScript.scenes.map((scene, i) => (
                          <label
                            key={scene.id || i}
                            className={`block rounded-lg border p-2 text-xs ${
                              i === activeCaptionScene
                                ? 'border-[#fbbf24]/60 bg-[#1f1a10]'
                                : 'border-[#303030] bg-[#121212]'
                            }`}
                          >
                            <span className="text-[10px] uppercase tracking-wide text-[#717171]">
                              Scene {i + 1}
                              {i === activeCaptionScene ? ' · playing' : ''}
                            </span>
                            <textarea
                              rows={2}
                              className={`${inputCls} mt-1`}
                              value={scene.caption || scene.narration || ''}
                              onChange={(e) => {
                                const caption = e.target.value.slice(0, 140)
                                setDraftScript((prev) => {
                                  if (!prev?.scenes) return prev
                                  const scenes = prev.scenes.map((s, idx) =>
                                    idx === i ? { ...s, caption, narration: caption } : s,
                                  )
                                  return { ...prev, scenes }
                                })
                                setActiveCaptionScene(i)
                                markDraftDirty()
                              }}
                              onFocus={() => setActiveCaptionScene(i)}
                            />
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {selected.narrationManifest?.length ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {selected.narrationManifest.map((scene, i) => (
                      <button
                        type="button"
                        key={scene.sceneId || i}
                        className={`overflow-hidden rounded-lg border bg-[#121212] text-left ${
                          i === activeCaptionScene ? 'border-[#fbbf24]' : 'border-[#303030]'
                        }`}
                        onClick={() => {
                          setActiveCaptionScene(i)
                          setCaptionEditOpen(true)
                        }}
                      >
                        <img
                          alt=""
                          className="h-24 w-full bg-[#1a1a1a] object-cover"
                          src={sceneStillUrl((scene.index ?? i) + 1)}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.opacity = '0.25'
                          }}
                        />
                        <p className="line-clamp-2 p-1.5 text-[9px] text-[#aaa]">
                          {draftScript?.scenes?.[i]?.caption || scene.caption}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Music mixer — always visible for the selected Short (not only after Build) */}
            <div className={`${PX.surface} p-5 sm:p-6`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#d4d4d4]">
                Music bed · mixer
              </p>
                  <p className={`mt-1 text-xs ${PX.muted}`}>
                    Pick a platform bed, drag the segment like YouTube (which part of the song), preview, then
                    Build or Remix. Remove song strips the bed from a built Short without rebuilding images/VO.
                    No music is the safe default; Auto-pick by mood only runs when selected. Beds are
                    auto-mastered for balanced Shorts volume — no Master button needed.
                  </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="block min-w-[220px] flex-1 text-xs text-[#aaa]">
                  Bed track
                  <select
                    className={inputCls}
                    value={musicTrackId}
                    onChange={(e) => {
                      setMusicTrackId(e.target.value)
                      setMusicStartSec(0)
                      setMusicEndSec(null)
                    }}
                    disabled={busy || isRendering}
                  >
                    <option value="">No music (voiceover only)</option>
                    <option value="auto">Auto-pick by mood</option>
                    {musicTracks
                      .filter((t) => t.active !== false)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                          {t.isDefault ? ' · default' : ''}
                          {t.mood ? ` · ${t.mood}` : ''}
                        </option>
                      ))}
                  </select>
                </label>
                {musicTrackId ? (
                  <button
                    type="button"
                    disabled={busy || isRendering}
                    onClick={clearSelectedMusicBed}
                    className={PX.btnDanger}
                    title={
                      selected?.status === 'video_rendered' || selected?.renderOutputPath
                        ? 'Strip this bed from the built Short (keeps images + voiceover), then pick another and Remix'
                        : 'Clear the selected bed so you can pick a different song before Build'
                    }
                  >
                    Remove song
                  </button>
                ) : null}
                <label className="block w-36 text-xs text-[#aaa]">
                  Bed volume
                  <input
                    type="range"
                    min={0.08}
                    max={0.45}
                    step={0.01}
                    value={musicVolume}
                    onChange={(e) => setMusicVolume(Number(e.target.value))}
                    disabled={busy || isRendering}
                    className="mt-2 w-full accent-white"
                  />
                  <span className="mt-0.5 block tabular-nums text-[10px] text-[#717171]">
                    {Math.round(musicVolume * 100)}% under VO
                  </span>
                </label>
                <button
                  type="button"
                  disabled={
                    busy ||
                    isRendering ||
                    !musicTracks.length ||
                    !(selected.status === 'video_rendered' || selected.mixedAudioPath || selected.narrationManifest?.length)
                  }
                  onClick={remixMusicBed}
                  className={PX.btnSoft}
                  title="Re-mix selected song segment under existing voiceover and remux the Short"
                >
                  {busy && renderPhase === 'rendering' ? 'Remixing…' : 'Remix music bed'}
                </button>
              </div>
              <EofMusicSegmentMixer
                key={musicTrackId || 'no-track'}
                track={musicTracks.find((t) => t.id === musicTrackId) || null}
                startSec={musicStartSec}
                endSec={musicEndSec}
                disabled={busy || isRendering}
                onChange={({ startSec, endSec }) => {
                  setMusicStartSec(startSec)
                  setMusicEndSec(endSec)
                }}
              />
              {!musicTracks.length ? (
                <p className="mt-2 text-xs text-[#fbbf24]">
                  No beds registered yet — open the Music tab or run npm run seed:eof-music after deploy.
                </p>
              ) : (
                <p className="mt-2 text-[10px] text-[#717171]">
                  {musicTracks.filter((t) => t.active !== false).length} beds loaded · Save / Build uses your
                  segment · Remix needs a built voiceover
                </p>
              )}
            </div>

            {displayProgress &&
            (selected.status === 'rendering' ||
              selected.status === 'rendering_video' ||
              renderPhase === 'rendering-video') ? (
              <EofRenderProgressBar
                progress={displayProgress}
                stuck={isRenderStuck}
                onCancel={cancelStuckRender}
                cancelBusy={busy}
              />
            ) : null}

            {/* Step 1 — Script */}
            <section className={`${PX.surfaceInset} p-5 sm:p-6 xl:p-7`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#d4d4d4]">Step 1 · Script</p>
                  <p className={`mt-0.5 text-xs ${PX.muted}`}>Spoken voiceover — edit freely, then go to scenes.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums text-[11px] text-[#717171]">{wordCount} words</span>
                  <button
                    type="button"
                    disabled={busy || isRendering}
                    onClick={() => regenerateDraft({ directorNote: '' })}
                    className={PX.btnPrimary}
                  >
                    {regenerateScriptLabel}
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-[#303030] bg-[#121212] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#aaa]">
                    Direct the AI · rewrite with direction
                  </p>
                  <p className="text-[10px] font-medium text-[#8eb4d8]" title="Uses the Script AI picker above">
                    {chatScriptAiLabel}
                  </p>
                </div>
                {scriptChatLog.length ? (
                  <div className="mt-2 max-h-28 space-y-1.5 overflow-y-auto">
                    {scriptChatLog.map((row, i) => (
                      <p
                        key={`${row.role}-${i}`}
                        className={`text-xs leading-snug ${row.role === 'you' ? 'text-[#e5e5e5]' : 'text-[#8ab4f8]'}`}
                      >
                        <span className="font-medium text-[#717171]">{row.role === 'you' ? 'You' : 'AI'}: </span>
                        {row.text}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className={`mt-1 text-xs ${PX.muted}`}>
                    e.g. “Open angry about Tuchel’s selection — name England XI debate — end asking who’s wrong”
                  </p>
                )}
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <textarea
                    value={scriptChat}
                    onChange={(e) => setScriptChat(e.target.value)}
                    rows={2}
                    disabled={busy || isRendering}
                    placeholder="What script do you want? Tone, angle, names to stress, opening line…"
                    className={`${inputCls} min-h-[56px] flex-1 text-sm`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !busy && !isRendering) {
                        e.preventDefault()
                        if (scriptChat.trim()) regenerateDraft({ directorNote: scriptChat })
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy || isRendering || !scriptChat.trim()}
                    onClick={() => regenerateDraft({ directorNote: scriptChat })}
                    className={`${PX.btnSoft} shrink-0 sm:mb-0.5`}
                  >
                    {scriptBusy === 'draft' ? 'Writing…' : 'Send to AI'}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-[#717171]">
                  ⌘/Ctrl + Enter to send · active model: {chatScriptAiLabel}
                  {selected?.topic ? ` · topic “${selected.topic}”` : ''}
                  {' · desk brief + producer direction'}
                </p>
              </div>

              <textarea
                value={draftScript.plainTextDraft || ''}
                onChange={(e) => {
                  const plainTextDraft = e.target.value
                  setDraftScript((prev) => (prev ? { ...prev, plainTextDraft } : prev))
                  markDraftDirty()
                }}
                rows={16}
                className={`${inputCls} mt-3 min-h-[26rem] w-full text-[15px] leading-relaxed text-[#ececec]`}
                placeholder="Write or regenerate a punchy Shorts voiceover here…"
              />
              {hasPlainDraft ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || isRendering}
                    onClick={adaptToScenes}
                    className={PX.btnPrimary}
                  >
                    Next: Adapt to scenes →
                  </button>
                  <button
                    type="button"
                    disabled={busy || isRendering}
                    onClick={regenerateScript}
                    className={PX.btnGhost}
                  >
                    Full rewrite (script + scenes)
                  </button>
                </div>
              ) : (
                <p className={`mt-2 text-xs ${PX.muted}`}>
                  Click <span className="text-[#d4d4d4]">Generate script</span> to pull desk notes and write the VO.
                </p>
              )}
            </section>

            {/* Voice tuning (Brian only) */}
            {voicePreset === 'brian' ? (
              <details className={`${PX.surface} p-4`}>
                <summary className="cursor-pointer text-xs font-semibold text-[#aaa]">
                  Brian voice tuning (optional)
                </summary>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={resetBrianVoiceSettings}
                    className="text-[10px] text-[#a3a3a3] hover:text-white hover:underline"
                  >
                    Reset to defaults
                  </button>
                </div>
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  {EOF_ELEVENLABS_VOICE_FIELDS.map((field) => {
                    const limits = EOF_ELEVENLABS_VOICE_LIMITS[field.key]
                    const val = voiceSettings[field.key] ?? limits.default
                    return (
                      <label key={field.key} className="block text-xs text-[#aaa]">
                        <span className="flex items-center justify-between gap-2">
                          <span>{field.label}</span>
                          <span className="tabular-nums text-[#d4d4d4]">{Number(val).toFixed(2)}</span>
                        </span>
                        <input
                          type="range"
                          min={limits.min}
                          max={limits.max}
                          step={limits.step}
                          value={val}
                          onChange={(e) => updateVoiceSetting(field.key, e.target.value)}
                          className="mt-1 w-full accent-white"
                        />
                        <span className="mt-0.5 block text-[10px] text-[#717171]">{field.hint}</span>
                      </label>
                    )
                  })}
                </div>
                {(selected.status === 'video_rendered' ||
                  selected.status === 'rendered' ||
                  selected.mixedAudioPath) &&
                sceneCount ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#303030] pt-3">
                    <button
                      type="button"
                      disabled={busy || isRendering || !voiceRegen.canRegenerate}
                      onClick={regenerateVoiceover}
                      title={voiceRegen.blockedReason || undefined}
                      className={PX.btnGhost}
                    >
                      {busy || isRendering
                        ? 'Regenerating…'
                        : `Regenerate voiceover (${voiceRegen.remaining}/${voiceRegen.limit})`}
                    </button>
                    {voiceRegen.blockedReason ? (
                      <span className="text-[10px] text-[#fbbf24]">{voiceRegen.blockedReason}</span>
                    ) : (
                      <span className="text-[10px] text-[#717171]">
                        Same captions &amp; photos — new voiceover only.
                        {voicePreset === 'brian' ? (
                          <span className="text-[#fbbf24]"> Uses ElevenLabs credits.</span>
                        ) : null}
                      </span>
                    )}
                  </div>
                ) : null}
              </details>
            ) : null}

            {/* Manual voiceover upload */}
            {voicePreset === 'manual' ? (
              <details className={`${PX.surface} p-4`} open>
                <summary className="cursor-pointer text-xs font-semibold text-[#aaa]">
                  Your own voiceover
                </summary>
                <p className={`mt-2 text-xs ${PX.muted}`}>
                  Upload an MP3/WAV/M4A of your narration. No TTS or AI voice runs — it&apos;s used as-is, and
                  scene timing is auto-split by how long each line of narration is.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept="audio/*"
                    disabled={manualVoiceoverUploading || busy || isRendering}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadManualVoiceover(file)
                      e.target.value = ''
                    }}
                    className="text-xs text-[#aaa] file:mr-3 file:rounded-md file:border-0 file:bg-[#272727] file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-[#333]"
                  />
                  {manualVoiceoverUploading ? (
                    <span className="text-[10px] text-[#717171]">Uploading…</span>
                  ) : null}
                </div>
                {manualVoiceoverStatus ? (
                  <p className="mt-2 text-[10px] text-[#4ade80]">{manualVoiceoverStatus}</p>
                ) : null}
                {(selected.status === 'video_rendered' ||
                  selected.status === 'rendered' ||
                  selected.mixedAudioPath) &&
                sceneCount ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#303030] pt-3">
                    <button
                      type="button"
                      disabled={busy || isRendering}
                      onClick={regenerateVoiceover}
                      className={PX.btnGhost}
                    >
                      {busy || isRendering ? 'Regenerating…' : 'Regenerate voiceover'}
                    </button>
                    <span className="text-[10px] text-[#717171]">
                      Same captions &amp; photos — remixes with your uploaded audio.
                    </span>
                  </div>
                ) : null}
              </details>
            ) : null}

            {/* Step 2 — Scenes */}
            <section className={`${PX.surface} p-5 sm:p-6 xl:p-7`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-[#aaaaaa]">
                    Step 2 · Scenes ({sceneCount}/{EOF_MAX_SCENES})
                  </p>
                  <p className={`mt-0.5 text-xs ${PX.muted}`}>On-screen captions + image search for each beat.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || isRendering || !hasPlainDraft}
                    onClick={adaptToScenes}
                    className={PX.btnGhost}
                  >
                    Adapt from script
                  </button>
                  <button
                    type="button"
                    disabled={busy || sceneCount >= EOF_MAX_SCENES}
                    onClick={() => addScene()}
                    className={PX.btnGhost}
                  >
                    + Add
                  </button>
                </div>
              </div>

              {!sceneCount ? (
                <p className={`mt-4 rounded-xl border border-dashed border-[#303030] px-4 py-8 text-center text-sm ${PX.muted}`}>
                  No scenes yet — finish the script, then tap <span className="text-[#d4d4d4]">Adapt to scenes</span>.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {draftScript.scenes.map((scene, i) => (
                    <div key={scene.id || i} className="rounded-xl border border-[#303030] bg-[#121212] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase text-[#717171]">
                          Scene {i + 1}
                          {scene.role ? ` · ${scene.role}` : ''}
                          {scene.durationSec ? (
                            <span className="ml-2 font-normal normal-case text-[#a3a3a3]">
                              ~{Number(scene.durationSec).toFixed(1)}s
                            </span>
                          ) : null}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busy || i === 0}
                            onClick={() => moveScene(i, -1)}
                            className="text-[10px] text-[#aaa] hover:text-white disabled:opacity-30"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={busy || i >= sceneCount - 1}
                            onClick={() => moveScene(i, 1)}
                            className="text-[10px] text-[#aaa] hover:text-white disabled:opacity-30"
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            disabled={busy || sceneCount <= EOF_MIN_SCENES}
                            onClick={() => removeScene(i)}
                            className="text-[10px] text-[#ff9b95] hover:underline disabled:opacity-30"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <label className="mt-2 block text-xs text-[#aaa]">
                        Caption
                        <textarea
                          rows={2}
                          value={scene.caption || ''}
                          onChange={(e) => updateScene(i, 'caption', e.target.value)}
                          className={inputCls}
                          maxLength={140}
                        />
                      </label>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_100px]">
                        <label className="block text-xs text-[#aaa]">
                          Image search / Pinterest URL
                          <input
                            value={scene.imageQuery || ''}
                            onChange={(e) => updateScene(i, 'imageQuery', e.target.value)}
                            className={inputCls}
                            placeholder="e.g. Ronaldo celebration or https://pin.it/…"
                          />
                        </label>
                        <label className="block text-xs text-[#aaa]">
                          Seconds
                          <input
                            type="number"
                            min={2}
                            max={8}
                            step={0.1}
                            value={scene.durationSec ?? ''}
                            onChange={(e) =>
                              updateScene(i, 'durationSec', e.target.value === '' ? null : Number(e.target.value))
                            }
                            className={inputCls}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sceneCount >= 1 ? (
                <div className="mt-4 space-y-3 border-t border-[#303030] pt-4">
                  <label className="block max-w-xs text-[10px] text-[#aaa]">
                    {selected.status === 'video_rendered' ? 'Images for this rebuild' : 'Images for this build'}
                    <select
                      value={rebuildImageProvider}
                      onChange={(e) => setRebuildImageProvider(e.target.value)}
                      disabled={busy || (isRendering && !isRenderStuck)}
                      className={`${inputCls} mt-0.5 py-1.5 text-xs`}
                      title="Override Google Images provider for this Build / Rebuild only"
                    >
                      {imageProviderOptions.map((p) => (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={p.id !== 'auto' && !p.configured}
                          title={p.detail}
                        >
                          {p.label}
                          {p.id !== 'auto' && !p.configured ? ' (not set)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {rebuildImageProvider === 'serpapi' && !imageSources.serpapi ? (
                    <p className="text-[11px] text-[#ff9b95]">
                      SerpAPI selected but SERPAPI_API_KEY is missing on the server — add it and redeploy,
                      or pick Auto.
                    </p>
                  ) : null}
                  {rebuildImageProvider === 'oxylabs' && !imageSources.oxylabs ? (
                    <p className="text-[11px] text-[#ff9b95]">
                      Oxylabs selected but off (need OXYLABS_ENABLED=1 + credentials) — or pick Auto /
                      SerpAPI.
                    </p>
                  ) : null}
                  {buildMode === 'hobby' && sceneCount > buildModeMaxScenesHobby ? (
                    <p className="text-[11px] text-[#fbbf24]">
                      Hobby build uses first {buildModeMaxScenesHobby} scenes
                    </p>
                  ) : null}
                  {selected.status === 'video_rendered' ? (
                    <>
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                        <button
                          type="button"
                          disabled={busy || (isRendering && !isRenderStuck)}
                          onClick={rebuildVideo}
                          className={`w-full ${PX.btnPrimary} sm:w-auto`}
                        >
                          {busy || isRendering ? 'Rebuilding…' : 'Rebuild video'}
                        </button>
                        <span className="text-[11px] text-[#8a8a8a]">
                          Refreshes images + applies transitions &amp; filters with{' '}
                          <span className="text-[#7ee787]">free captions</span> — no ElevenLabs or ZapCap
                          charges. Click again until photos look right.
                        </span>
                      </div>
                      {captionEngine.zapcap && isZapcapCaptionStyle(captionStyle) ? (
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                          <button
                            type="button"
                            disabled={busy || (isRendering && !isRenderStuck)}
                            onClick={applyZapcapCaptions}
                            title="Burns the selected ZapCap template onto the current video"
                            className={`w-full ${PX.btnSoft} sm:w-auto`}
                          >
                            {busy || isRendering ? '…' : 'Apply ZapCap captions'}
                          </button>
                          <span className="text-[11px] text-[#8a8a8a]">
                            When images &amp; transitions look good, apply the CapCut-style animated captions
                            once — <span className="text-[#fbbf24]">uses ZapCap credits</span>.
                          </span>
                        </div>
                      ) : null}
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                        <button
                          type="button"
                          disabled={busy || (isRendering && !isRenderStuck)}
                          onClick={buildShort}
                          title="Regenerates the voiceover from scratch, then images + video"
                          className={`w-full ${PX.btnGhost} sm:w-auto`}
                        >
                          {busy || isRendering ? '…' : 'Full rebuild (new voiceover)'}
                        </button>
                        <span className="text-[11px] text-[#8a8a8a]">
                          Regenerates the voiceover
                          {voicePreset === 'brian' ? (
                            <>
                              {' '}
                              — <span className="text-[#fbbf24]">uses ElevenLabs credits</span>
                            </>
                          ) : (
                            ' (free Edge voice — British / calm / American)'
                          )}
                          . Uses the Images picker above for Google Images.
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                      <button
                        type="button"
                        disabled={busy || (isRendering && !isRenderStuck)}
                        onClick={buildShort}
                        title={`Generates voiceover, images via ${rebuildImageProvider}, and video`}
                        className={`w-full ${PX.btnPrimary} sm:w-auto`}
                      >
                        {busy || isRendering ? 'Building…' : 'Next: Build Short →'}
                      </button>
                      <span className="text-[11px] text-[#8a8a8a]">
                        Voice + photos via the Images picker above + free captions. Override wins over the
                        Setup default for this run only.
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </section>

            {/* YouTube metadata */}
            <details className={`${PX.surface} p-4`}>
              <summary className="cursor-pointer text-xs font-semibold text-[#aaa]">
                YouTube title, description & tags
              </summary>
              <div className="mt-3 space-y-3">
                <label className="block text-xs text-[#aaa]">
                  Title
                  <input
                    value={draftScript.title || ''}
                    onChange={(e) => {
                      markDraftDirty()
                      setDraftScript((s) => ({ ...s, title: e.target.value }))
                    }}
                    className={inputCls}
                    maxLength={100}
                  />
                </label>
                <label className="block text-xs text-[#aaa]">
                  Description
                  <textarea
                    rows={2}
                    value={draftScript.description || ''}
                    onChange={(e) => {
                      markDraftDirty()
                      setDraftScript((s) => ({ ...s, description: e.target.value }))
                    }}
                    className={inputCls}
                  />
                </label>
                <label className="block text-xs text-[#aaa]">
                  Tags
                  <input
                    value={Array.isArray(draftScript.tags) ? draftScript.tags.join(', ') : ''}
                    onChange={(e) => {
                      markDraftDirty()
                      const tags = e.target.value
                        .split(/[,#]+/)
                        .map((t) => t.trim())
                        .filter(Boolean)
                      setDraftScript((s) => ({ ...s, tags }))
                    }}
                    className={inputCls}
                    placeholder="shortsfeed, football, shorts, …"
                  />
                </label>
              </div>
            </details>

            {selected.status === 'failed' && selected.errorMessage ? (
              <div className="space-y-2">
                <p className="rounded-xl border border-[#ff4e45]/40 bg-[#2a1515] px-4 py-3 text-sm text-[#ff9b95]">
                  Build failed: {selected.errorMessage}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || isRendering}
                    onClick={resetBuildState}
                    className={PX.btnGhost}
                    title="Clears TTS synth budget and Serp avoidKeys so Build Short can claim fresh stills"
                  >
                    Reset build state
                  </button>
                  <span className="text-[11px] text-[#8a8a8a]">
                    Clears this job&apos;s TTS budget and its used-stills list so Build Short can pick
                    fresh images again. Nothing to do with your SerpAPI plan. Then Build Short once.
                  </span>
                </div>
              </div>
            ) : null}

            {selected.qualityGate && selected.qualityGate.mode !== 'off' ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  selected.qualityGate.pass
                    ? selected.qualityGate.warnings?.length
                      ? 'border-[#c48a2a]/40 bg-[#1c1a12] text-[#e6d3a0]'
                      : 'border-[#2f5d3a]/50 bg-[#142018] text-[#9dcea8]'
                    : selected.qualityGate.blocked
                      ? 'border-[#ff4e45]/40 bg-[#2a1515] text-[#ff9b95]'
                      : 'border-[#c48a2a]/45 bg-[#2a2110] text-[#f0d39a]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {selected.qualityGate.pass
                      ? selected.qualityGate.warnings?.length
                        ? `Quality gate: pass with warnings (${selected.qualityGate.warnings.length})`
                        : 'Quality gate: passed'
                      : selected.qualityGate.blocked
                        ? selected.qualityGate.phase === 'preflight' ||
                          selected.qualityGate.phase === 'stills'
                          ? `Quality gate: blocked build (${selected.qualityGate.phase})`
                          : 'Quality gate: blocked publish'
                        : 'Quality gate: issues found'}
                  </p>
                  <p className="text-[11px] opacity-80">
                    {selected.qualityGate.visionUsed
                      ? 'Vision QA: used'
                      : selected.qualityGate.visionEnabled
                        ? 'Vision QA: on (not used this pass)'
                        : 'Vision QA: off'}
                    {selected.qualityGate.phase
                      ? ` · ${selected.qualityGate.phase}`
                      : ''}
                  </p>
                </div>
                {selected.qualityGate.reasons?.length ? (
                  <div className="mt-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">Fails</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px]">
                      {selected.qualityGate.reasons.slice(0, 8).map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {selected.qualityGate.warnings?.length ? (
                  <div className="mt-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">Warnings</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] opacity-90">
                      {selected.qualityGate.warnings.slice(0, 6).map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {selected.errorMessage &&
                /quality gate/i.test(String(selected.errorMessage)) &&
                selected.status === 'video_rendered' ? (
                  <p className="mt-2 text-[11px] text-[#c9b48a]">{selected.errorMessage}</p>
                ) : null}
                {Array.isArray(selected.qualityGateHistory) &&
                selected.qualityGateHistory.length ? (
                  <div className="mt-3 border-t border-white/10 pt-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">
                      Gate history
                    </p>
                    <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto text-[11px] opacity-90">
                      {[...selected.qualityGateHistory]
                        .slice(-8)
                        .reverse()
                        .map((h, i) => {
                          const when = h.checkedAt
                            ? new Date(h.checkedAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'
                          const verdict = h.pass
                            ? h.warnings?.length
                              ? 'warn'
                              : 'pass'
                            : h.blocked
                              ? 'fail'
                              : 'fail'
                          const reason =
                            h.reasons?.[0] ||
                            (h.warnings?.[0] ? `warn: ${h.warnings[0]}` : '')
                          return (
                            <li key={`${h.checkedAt || 't'}-${h.phase || 'p'}-${i}`}>
                              <span className="opacity-70">{when}</span>
                              {' · '}
                              <span>{h.phase || 'post'}</span>
                              {' · '}
                              <span
                                className={
                                  verdict === 'pass'
                                    ? 'text-[#9dcea8]'
                                    : verdict === 'warn'
                                      ? 'text-[#e6d3a0]'
                                      : 'text-[#ff9b95]'
                                }
                              >
                                {verdict}
                              </span>
                              {reason ? (
                                <span className="opacity-80"> — {String(reason).slice(0, 72)}</span>
                              ) : null}
                            </li>
                          )
                        })}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

            <aside
              className={`${PX.surfaceInset} space-y-4 p-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-1.5rem)] xl:overflow-y-auto`}
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={PX.label}>Effects</p>
                  <button
                    type="button"
                    disabled={busy || isRendering || !(selected.status === 'video_rendered' || videoPreviewUrl)}
                    onClick={applyEffects}
                    className={`${PX.btnPrimary} !px-3 !py-1.5 !text-xs`}
                    title="Remux current Short with selected effects — same stills + VO"
                  >
                    {busy && renderPhase === 'rendering-video' ? 'Applying…' : 'Apply effects'}
                  </button>
                </div>
                <p className={`mt-1 text-[11px] leading-snug ${PX.muted}`}>
                  Try one-by-one after Build. Selection is draft until you Apply (remux).
                </p>
                <p className="mt-1.5 rounded-md border border-[#333] bg-[#141414] px-2 py-1.5 text-[10px] text-[#cfcfcf]">
                  Active: {summarizeEofVideoEffects(videoEffects)}
                </p>
                <div className="mt-2 space-y-3">
                  <EffectPickerGrid
                    title="Presets"
                    mode="label"
                    items={(videoEffectPresets.length ? videoEffectPresets : EOF_EFFECT_PRESETS).map(
                      (p) => ({
                        id: p.id,
                        label: p.label,
                        detail: p.detail,
                        vibe: p.vibe,
                      }),
                    )}
                    activeId={videoEffects.preset || 'none'}
                    onPick={(id) => {
                      setVideoEffects(pickEofVideoEffect(videoEffects, id, 'preset'))
                      markDraftDirty()
                    }}
                  />
                  <EffectPickerGrid
                    title="Motion"
                    mode="motion"
                    items={videoEffectsMotion.length ? videoEffectsMotion : EOF_MOTION_EFFECTS}
                    activeId={videoEffects.motion || 'none'}
                    onPick={(id) => {
                      setVideoEffects(pickEofVideoEffect(videoEffects, id, 'motion'))
                      markDraftDirty()
                    }}
                  />
                  <EffectPickerGrid
                    title="Lights"
                    mode="label"
                    items={videoEffectsLight.length ? videoEffectsLight : EOF_LIGHT_EFFECTS}
                    activeId={videoEffects.light || 'none'}
                    onPick={(id) => {
                      setVideoEffects(pickEofVideoEffect(videoEffects, id, 'light'))
                      markDraftDirty()
                    }}
                  />
                  <EffectPickerGrid
                    title="Colour"
                    mode="swatch"
                    items={(videoEffectsColour.length ? videoEffectsColour : EOF_COLOUR_EFFECTS).filter(
                      (e) => e.subgroup !== 'hdr',
                    )}
                    activeId={
                      String(videoEffects.colour || '').startsWith('hdr_')
                        ? ''
                        : videoEffects.colour || 'none'
                    }
                    onPick={(id) => {
                      setVideoEffects(pickEofVideoEffect(videoEffects, id, 'colour'))
                      markDraftDirty()
                    }}
                  />
                  <EffectPickerGrid
                    title="HDR"
                    mode="swatch"
                    items={(videoEffectsColour.length ? videoEffectsColour : EOF_COLOUR_EFFECTS).filter(
                      (e) => e.subgroup === 'hdr',
                    )}
                    activeId={
                      String(videoEffects.colour || '').startsWith('hdr_') ? videoEffects.colour : ''
                    }
                    onPick={(id) => {
                      setVideoEffects(pickEofVideoEffect(videoEffects, id, 'colour'))
                      markDraftDirty()
                    }}
                  />
                </div>
              </div>

              <div className="border-t border-[#2a2a2a] pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={PX.label}>Stickers</p>
                  <button
                    type="button"
                    disabled={busy || isRendering || !(selected.status === 'video_rendered' || videoPreviewUrl)}
                    onClick={applyStickers}
                    className={`${PX.btnPrimary} !px-3 !py-1.5 !text-xs`}
                  >
                    {busy && renderPhase === 'rendering-video' ? 'Applying…' : 'Apply stickers'}
                  </button>
                </div>
                <p className="mt-1.5 rounded-md border border-[#333] bg-[#141414] px-2 py-1.5 text-[10px] text-[#cfcfcf]">
                  Active: {summarizeEofStickers(stickers)}
                </p>
                <div className="mt-2 space-y-3">
                  <StickerPickerGrid
                    title="Buttons"
                    items={stickersButtons.length ? stickersButtons : listEofStickersByCategory('buttons')}
                    selectedIds={stickers.items.map((i) => i.id)}
                    onPick={(id) => {
                      const next = pickEofSticker(stickers, id)
                      setStickers(next)
                      setActiveStickerId(
                        next.items.some((i) => i.id === id) ? id : next.items[0]?.id || '',
                      )
                      markDraftDirty()
                    }}
                  />
                  <StickerPickerGrid
                    title="Arrows"
                    items={stickersArrows.length ? stickersArrows : listEofStickersByCategory('arrows')}
                    selectedIds={stickers.items.map((i) => i.id)}
                    onPick={(id) => {
                      const next = pickEofSticker(stickers, id)
                      setStickers(next)
                      setActiveStickerId(
                        next.items.some((i) => i.id === id) ? id : next.items[0]?.id || '',
                      )
                      markDraftDirty()
                    }}
                  />
                  <StickerPickerGrid
                    title="Shapes"
                    items={stickersShapes.length ? stickersShapes : listEofStickersByCategory('shapes')}
                    selectedIds={stickers.items.map((i) => i.id)}
                    onPick={(id) => {
                      const next = pickEofSticker(stickers, id)
                      setStickers(next)
                      setActiveStickerId(
                        next.items.some((i) => i.id === id) ? id : next.items[0]?.id || '',
                      )
                      markDraftDirty()
                    }}
                  />
                  <StickerPickerGrid
                    title="Stickers"
                    items={stickersExtras.length ? stickersExtras : listEofStickersByCategory('stickers')}
                    selectedIds={stickers.items.map((i) => i.id)}
                    onPick={(id) => {
                      const next = pickEofSticker(stickers, id)
                      setStickers(next)
                      setActiveStickerId(
                        next.items.some((i) => i.id === id) ? id : next.items[0]?.id || '',
                      )
                      markDraftDirty()
                    }}
                  />
                </div>
                {stickers.items.length ? (
                  <div className="mt-3 rounded-lg border border-[#2a2a2a] bg-[#141414] p-2.5">
                    <p className="text-[11px] font-medium text-[#d4d4d4]">Position</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {stickers.items.map((item) => {
                        const cat = EOF_STICKERS_CATALOG.find((c) => c.id === item.id)
                        const active = activeStickerId === item.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            disabled={busy}
                            onClick={() => setActiveStickerId(item.id)}
                            className={`rounded-md border px-2 py-1 text-[10px] ${
                              active
                                ? 'border-white/40 bg-[#272727] text-white'
                                : 'border-[#333] bg-[#1a1a1a] text-[#bbb]'
                            }`}
                          >
                            {cat?.label || item.id}
                          </button>
                        )
                      })}
                    </div>
                    {activeStickerId ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(stickerPositions.length ? stickerPositions : EOF_STICKER_POSITIONS).map((p) => {
                          const selectedItem = stickers.items.find((i) => i.id === activeStickerId)
                          const active = selectedItem?.position === p.id
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={busy}
                              title={p.detail}
                              onClick={() => {
                                setStickers(setEofStickerPosition(stickers, activeStickerId, p.id))
                                markDraftDirty()
                              }}
                              className={`rounded-md border px-2 py-1 text-[10px] ${
                                active
                                  ? 'border-white/40 bg-[#272727] text-white'
                                  : 'border-[#333] bg-[#1a1a1a] text-[#bbb] hover:border-[#555]'
                              }`}
                            >
                              {p.label}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      className={`mt-2 ${PX.btnGhost} !px-2 !py-1 !text-[11px]`}
                      onClick={() => {
                        setStickers({ items: [] })
                        setActiveStickerId('')
                        markDraftDirty()
                      }}
                    >
                      Clear stickers
                    </button>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        ) : (
          <div className={`flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-[#303030] bg-[#121212] p-8`}>
            <p className={`max-w-sm text-center text-sm ${PX.muted}`}>
              Pick a Short from the list, or start a new one above.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
