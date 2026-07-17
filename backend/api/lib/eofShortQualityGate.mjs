/**
 * Short quality gate — plan-time preflight + post-render QA for EOF Production.
 *
 * Phases:
 *   preflight — before image fetch / TTS / ffmpeg (script, captions, music, timing, pop geometry)
 *   stills    — after stills assigned, before ffmpeg (placeholders, clickbait pop sources)
 *   post      — after render (full heuristics + optional vision; blocks auto-publish)
 *
 * Env:
 *   EOF_SHORT_QUALITY_GATE=auto|on|off   (default auto — heuristics always on unless off)
 *   EOF_SHORT_QUALITY_VISION=off|auto|on (default off — optional xAI still re-check; costs credits)
 *   EOF_SHORT_QUALITY_MAX_PLACEHOLDER=0.34  max fraction of placeholder stills before fail
 *
 * Vision only runs on the post-render pass when EOF_SHORT_QUALITY_VISION is auto/on.
 */
import {
  EOF_CAPTION_LAYOUT_Y_MIN,
  EOF_CAPTION_LAYOUT_Y_MAX,
  EOF_CAPTION_LAYOUT_SCALE_MIN,
  EOF_CAPTION_LAYOUT_SCALE_MAX,
  normalizeEofCaptionLayout,
} from '../../../shared/eofCaptionLayout.mjs'
import { resolveEofCaptionStyle } from '../../../shared/eofCaptionStyles.mjs'
import {
  resolveEofOverlayMoments,
  planEofOverlayMoments,
  EOF_OVERLAY_LAYOUT,
  eofOverlayCardRect,
  eofOverlayCoversFaceZone,
  eofOverlayLayoutIsFaceSafe,
  isBadEofOverlayStill,
} from '../../../shared/eofOverlayMoments.mjs'
import { normalizeEofMusicTrim } from '../../../shared/eofMusicTrim.mjs'
import { estimateCaptionDurationSec } from '../../../shared/eofScriptTemplates.mjs'
import { isEofImageVisionConfigured, rankEofPoolHitsWithVision, MIN_EOF_VISION_SCORE } from './eofImageVision.mjs'

function envKey(...names) {
  for (const name of names) {
    const v = (process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

/** @typedef {'pass'|'fail'|'warn'|'skip'} EofQualitySeverity */

/**
 * @typedef {{
 *   id: string,
 *   severity: EofQualitySeverity,
 *   message: string,
 *   detail?: string | null,
 * }} EofQualityCheck
 */

/**
 * @typedef {{
 *   pass: boolean,
 *   blocked: boolean,
 *   mode: 'auto'|'manual'|'off',
 *   phase?: 'preflight'|'stills'|'post',
 *   checkedAt: string,
 *   reasons: string[],
 *   warnings: string[],
 *   checks: EofQualityCheck[],
 *   visionUsed: boolean,
 * }} EofQualityGateResult
 */

/** Error thrown when a hard quality-gate fail stops the pipeline. */
export class EofQualityGateBlockedError extends Error {
  /**
   * @param {EofQualityGateResult} gate
   * @param {string} [message]
   */
  constructor(gate, message) {
    super(message || formatEofQualityGateBlockMessage(gate, gate?.phase))
    this.name = 'EofQualityGateBlockedError'
    this.gate = gate
  }
}

export function isEofShortQualityGateEnabled() {
  const raw = String(envKey('EOF_SHORT_QUALITY_GATE') || 'auto').toLowerCase()
  return raw !== '0' && raw !== 'off' && raw !== 'false' && raw !== 'disabled'
}

export function isEofShortQualityVisionEnabled() {
  const raw = String(envKey('EOF_SHORT_QUALITY_VISION') || 'off').toLowerCase()
  if (raw === '0' || raw === 'off' || raw === 'false' || raw === 'disabled') return false
  if (raw === 'on' || raw === '1' || raw === 'true' || raw === 'force') return true
  // auto → only when image vision is already configured
  return isEofImageVisionConfigured()
}

export function maxPlaceholderFraction() {
  const n = Number(envKey('EOF_SHORT_QUALITY_MAX_PLACEHOLDER') || 0.34)
  if (!Number.isFinite(n)) return 0.34
  return Math.min(0.95, Math.max(0, n))
}

/**
 * @param {unknown} raw
 * @returns {EofQualityGateResult | null}
 */
export function parseEofQualityGate(raw) {
  if (!raw) return null
  let obj = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!obj || typeof obj !== 'object') return null
  const reasons = Array.isArray(obj.reasons) ? obj.reasons.map(String) : []
  const warnings = Array.isArray(obj.warnings) ? obj.warnings.map(String) : []
  const checks = Array.isArray(obj.checks) ? obj.checks : []
  const phase =
    obj.phase === 'preflight' || obj.phase === 'stills' || obj.phase === 'post' ? obj.phase : 'post'
  return {
    pass: obj.pass !== false && reasons.length === 0,
    blocked: Boolean(obj.blocked),
    mode: obj.mode === 'auto' || obj.mode === 'off' ? obj.mode : 'manual',
    phase,
    checkedAt: String(obj.checkedAt || ''),
    reasons,
    warnings,
    checks,
    visionUsed: Boolean(obj.visionUsed),
  }
}

/**
 * One-line admin summary.
 * @param {EofQualityGateResult | null | undefined} gate
 */
export function summarizeEofQualityGate(gate) {
  if (!gate) return null
  if (gate.mode === 'off') return 'Quality gate skipped'
  const phaseLabel =
    gate.phase === 'preflight' ? 'preflight' : gate.phase === 'stills' ? 'stills preflight' : null
  if (gate.pass) {
    const w = gate.warnings?.length ? ` (${gate.warnings.length} warning${gate.warnings.length === 1 ? '' : 's'})` : ''
    return phaseLabel ? `Quality ${phaseLabel} passed${w}` : `Quality gate passed${w}`
  }
  const n = gate.reasons?.length || 0
  if (phaseLabel) {
    return `Quality ${phaseLabel} failed (${n} issue${n === 1 ? '' : 's'})`
  }
  return `Quality gate failed (${n} issue${n === 1 ? '' : 's'})`
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2)
}

/** Word overlap 0–1 (Jaccard on caption tokens vs narration). */
export function captionNarrationOverlap(caption, narration) {
  const cap = new Set(tokenize(caption))
  const nar = new Set(tokenize(narration))
  if (!cap.size) return 0
  if (!nar.size) return 0
  let hit = 0
  for (const w of cap) {
    if (nar.has(w)) hit += 1
  }
  return hit / cap.size
}

/**
 * Rough “looks like a typo / wrong script” when caption diverges from VO.
 * @param {string} caption
 * @param {string} narration
 */
export function captionLooksMismatched(caption, narration) {
  const c = String(caption || '').trim()
  const n = String(narration || '').trim()
  if (!c || !n) return false
  // Short captions that are intentional hooks can differ — only flag longer captions.
  if (tokenize(c).length < 4) return false
  const overlap = captionNarrationOverlap(c, n)
  // Caption should mostly reuse VO words when both are present.
  return overlap < 0.35
}

/**
 * @typedef {{
 *   topic?: string,
 *   script?: { scenes?: Array<{ caption?: string, narration?: string, durationSec?: number }> },
 *   narrationManifest?: Array<{
 *     index?: number,
 *     caption?: string,
 *     durationSec?: number,
 *     imageSource?: string | null,
 *     imageKey?: string | null,
 *     imageTitle?: string | null,
 *     imageQuery?: string | null,
 *     imageQueryUsed?: string | null,
 *   }> | null,
 *   captionStyle?: string,
 *   captionLayout?: { yNorm?: number, fontScale?: number } | null,
 *   musicTrackId?: string | null,
 *   musicVolume?: number,
 *   musicStartSec?: number,
 *   musicEndSec?: number | null,
 *   mixedAudioPath?: string | null,
 *   renderOutputPath?: string | null,
 *   overlayMoments?: string,
 *   captionEngine?: string | null,
 * }} EofQualityJobSnapshot
 *
 * @typedef {{
 *   overlayCount?: number,
 *   overlayMoments?: Array<{
 *     sceneIndex?: number,
 *     overlaySceneIndex?: number,
 *     absoluteStartSec?: number,
 *     absoluteEndSec?: number,
 *     startSec?: number,
 *     endSec?: number,
 *   }>,
 *   hasSecondarySubject?: boolean,
 *   secondarySceneIndex?: number | null,
 *   captionEngine?: string | null,
 * }} EofQualityRenderMeta
 */

/**
 * Plan-time checks — safe before image fetch / TTS / ffmpeg.
 * Captions vs VO, layout, music bed, scene timing, pop geometry.
 * @param {EofQualityJobSnapshot} job
 * @param {EofQualityRenderMeta} [renderMeta]
 * @returns {EofQualityCheck[]}
 */
export function collectEofShortQualityPlanChecks(job, renderMeta = {}) {
  /** @type {EofQualityCheck[]} */
  const checks = []
  const scenes = Array.isArray(job?.script?.scenes) ? job.script.scenes : []
  const manifest = Array.isArray(job?.narrationManifest) ? job.narrationManifest : []
  const captionStyle = resolveEofCaptionStyle(job?.captionStyle)
  const captionsOn = captionStyle !== 'off'

  // —— Captions vs script / layout ——
  if (captionsOn) {
    if (scenes.length === 0) {
      checks.push({
        id: 'captions_no_scenes',
        severity: 'fail',
        message: 'Captions enabled but script has no scenes',
        detail: null,
      })
    }
    for (let i = 0; i < scenes.length; i += 1) {
      const scene = scenes[i]
      const cap = String(scene?.caption || '').trim()
      const nar = String(scene?.narration || '').trim()
      const man = manifest.find((m) => m.index === i) || manifest[i]
      const manCap = String(man?.caption || '').trim()
      const effectiveCap = cap || manCap
      if (!effectiveCap) {
        checks.push({
          id: `captions_empty_${i}`,
          severity: 'fail',
          message: `Scene ${i + 1} has empty caption while captions are on`,
          detail: null,
        })
        continue
      }
      if (nar && captionLooksMismatched(effectiveCap, nar)) {
        checks.push({
          id: `captions_mismatch_${i}`,
          severity: 'fail',
          message: `Scene ${i + 1} caption does not match voiceover text (possible wrong script / spelling)`,
          detail: `overlap=${captionNarrationOverlap(effectiveCap, nar).toFixed(2)}`,
        })
      }
    }

    const layout = normalizeEofCaptionLayout(job?.captionLayout, captionStyle)
    if (
      layout.yNorm < EOF_CAPTION_LAYOUT_Y_MIN - 0.001 ||
      layout.yNorm > EOF_CAPTION_LAYOUT_Y_MAX + 0.001
    ) {
      checks.push({
        id: 'captions_layout_y',
        severity: 'fail',
        message: `Caption vertical position out of safe range (yNorm=${layout.yNorm})`,
        detail: `expected ${EOF_CAPTION_LAYOUT_Y_MIN}–${EOF_CAPTION_LAYOUT_Y_MAX}`,
      })
    }
    if (
      layout.fontScale < EOF_CAPTION_LAYOUT_SCALE_MIN - 0.001 ||
      layout.fontScale > EOF_CAPTION_LAYOUT_SCALE_MAX + 0.001
    ) {
      checks.push({
        id: 'captions_layout_scale',
        severity: 'fail',
        message: `Caption size out of safe range (fontScale=${layout.fontScale})`,
        detail: null,
      })
    }
    if (['pop', 'karaoke', 'beast'].includes(captionStyle) && layout.yNorm > 0.82) {
      checks.push({
        id: 'captions_layout_mid_low',
        severity: 'warn',
        message: `Mid-frame caption style “${captionStyle}” is placed too low (yNorm=${layout.yNorm})`,
        detail: null,
      })
    }
  }

  // —— Scene timing (script / prior manifest; estimate when TTS has not filled durations yet) ——
  const timingRows = manifest.length ? manifest : scenes
  const durs = timingRows.map((s, i) => {
    const raw = Number(s?.durationSec)
    if (Number.isFinite(raw) && raw > 0) return raw
    const scene = scenes[i] || s
    return estimateCaptionDurationSec(scene?.caption || scene?.narration || '')
  })
  let totalDur = 0
  for (let i = 0; i < durs.length; i += 1) {
    const raw = Number(timingRows[i]?.durationSec)
    const d = durs[i]
    // Only hard-fail when an explicit duration is nonsense (missing → estimated above).
    if (Number.isFinite(raw) && raw > 0 && raw < 1.2) {
      checks.push({
        id: `timing_scene_${i}`,
        severity: 'fail',
        message: `Scene ${i + 1} duration is missing or too short for a proper beat`,
        detail: `durationSec=${raw}`,
      })
    } else if (d > 28) {
      checks.push({
        id: `timing_scene_long_${i}`,
        severity: 'warn',
        message: `Scene ${i + 1} is unusually long (${d.toFixed?.(1) ?? d}s) — may feel stuck`,
        detail: null,
      })
      totalDur += d
    } else {
      totalDur += d
    }
  }
  if (durs.length >= 2 && totalDur > 0 && totalDur < 8) {
    checks.push({
      id: 'timing_total_short',
      severity: 'warn',
      message: `Total Short duration is very short (${totalDur.toFixed(1)}s)`,
      detail: null,
    })
  }
  for (let i = 0; i < scenes.length; i += 1) {
    const words = tokenize(scenes[i]?.caption || scenes[i]?.narration).length
    const d = durs[i] ?? Number(manifest[i]?.durationSec ?? scenes[i]?.durationSec)
    if (Number.isFinite(d) && d > 0 && words >= 14 && words / d > 4.5) {
      checks.push({
        id: `timing_caption_density_${i}`,
        severity: 'warn',
        message: `Scene ${i + 1} caption is dense for its beat (likely hard to read / mistimed)`,
        detail: `${words} words / ${d}s`,
      })
    }
  }

  // —— Music ——
  if (!job?.musicTrackId) {
    checks.push({
      id: 'music_missing_track',
      severity: 'fail',
      message: 'No music bed selected — Short expected a bed under the VO',
      detail: null,
    })
  } else {
    const vol = Number(job.musicVolume)
    if (!Number.isFinite(vol) || vol <= 0.01) {
      checks.push({
        id: 'music_volume_silent',
        severity: 'fail',
        message: 'Music volume is effectively muted while a bed is selected',
        detail: `musicVolume=${job.musicVolume}`,
      })
    } else if (vol > 0.85) {
      checks.push({
        id: 'music_volume_hot',
        severity: 'warn',
        message: 'Music volume is very high and may drown the voiceover',
        detail: `musicVolume=${vol}`,
      })
    }
    const trim = normalizeEofMusicTrim({
      musicStartSec: job.musicStartSec,
      musicEndSec: job.musicEndSec,
    })
    if (trim.endSec != null && trim.endSec - trim.startSec < 3) {
      checks.push({
        id: 'music_trim_short',
        severity: 'fail',
        message: 'Music trim window is too short to cover a Short',
        detail: `${trim.startSec}–${trim.endSec}s`,
      })
    }
  }

  // —— Pop inset geometry (config-time; no stills required) ——
  const overlayMode = resolveEofOverlayMoments(job?.overlayMoments)
  if (overlayMode !== 'off') {
    if (overlayMode === 'always' || overlayMode === 'auto') {
      const rect = eofOverlayCardRect(EOF_OVERLAY_LAYOUT)
      if (eofOverlayCoversFaceZone(EOF_OVERLAY_LAYOUT) || !eofOverlayLayoutIsFaceSafe(EOF_OVERLAY_LAYOUT)) {
        checks.push({
          id: 'overlay_covers_face',
          severity: 'fail',
          message: 'Pop inset layout covers the subject face zone (must sit mid/lower, not over eyes)',
          detail: `x=${rect.x.toFixed(3)} y=${rect.y.toFixed(3)} w=${rect.w.toFixed(3)} h=${rect.h.toFixed(3)} bottom=${rect.bottom.toFixed(3)}`,
        })
      }
    }
    if (EOF_OVERLAY_LAYOUT.widthFrac < 0.55 || EOF_OVERLAY_LAYOUT.widthFrac > 0.92) {
      checks.push({
        id: 'overlay_size_width',
        severity: 'fail',
        message: `Pop inset widthFrac looks wrong (${EOF_OVERLAY_LAYOUT.widthFrac})`,
        detail: 'Prefer a large readable card (~0.75–0.85)',
      })
    }
    if (EOF_OVERLAY_LAYOUT.heightFrac < 0.35 || EOF_OVERLAY_LAYOUT.heightFrac > 0.7) {
      checks.push({
        id: 'overlay_size_height',
        severity: 'fail',
        message: `Pop inset heightFrac looks wrong (${EOF_OVERLAY_LAYOUT.heightFrac})`,
        detail: 'Too tall covers faces; too short looks like a glitch',
      })
    }

    // Timing sanity from planned moments (scene durations only — no image credits).
    const planned = planEofOverlayMoments({
      mode: overlayMode,
      scenes: (manifest.length ? manifest : scenes).map((m, i) => ({
        index: m.index ?? i,
        durationSec: m.durationSec,
        imagePath: m.imageKey || m.imageSource || `scene-${i}`,
        imageSource: m.imageSource,
        imageKey: m.imageKey,
      })),
      hasSecondarySubject: Boolean(renderMeta?.hasSecondarySubject),
      secondarySceneIndex: renderMeta?.secondarySceneIndex ?? null,
    })
    for (const m of planned || []) {
      const start = Number(m.absoluteStartSec ?? m.startSec)
      const end = Number(m.absoluteEndSec ?? m.endSec)
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start + 0.35) {
        checks.push({
          id: 'overlay_timing_bad',
          severity: 'fail',
          message: 'Pop inset timing is invalid or too short',
          detail: `start=${start} end=${end}`,
        })
      }
    }
  }

  return checks
}

/**
 * Stills-assignment checks — after image fetch/assignment, before ffmpeg.
 * @param {EofQualityJobSnapshot} job
 * @param {EofQualityRenderMeta} [renderMeta]
 * @returns {EofQualityCheck[]}
 */
export function collectEofShortQualityStillsChecks(job, renderMeta = {}) {
  /** @type {EofQualityCheck[]} */
  const checks = []
  const scenes = Array.isArray(job?.script?.scenes) ? job.script.scenes : []
  const manifest = Array.isArray(job?.narrationManifest) ? job.narrationManifest : []

  const sources = manifest.length ? manifest.map((m) => String(m?.imageSource || '')) : []
  const placeholderIdx = []
  for (let i = 0; i < sources.length; i += 1) {
    if (sources[i].startsWith('placeholder')) placeholderIdx.push(i + 1)
  }
  if (sources.length > 0) {
    const frac = placeholderIdx.length / sources.length
    if (placeholderIdx.length > 0) {
      const msg = `Placeholder still(s) on scene${placeholderIdx.length === 1 ? '' : 's'} ${placeholderIdx.join(', ')}`
      checks.push({
        id: 'stills_placeholder',
        severity: frac > maxPlaceholderFraction() ? 'fail' : 'warn',
        message: msg,
        detail: `${placeholderIdx.length}/${sources.length} scenes used placeholders`,
      })
    }
    const missing = sources.filter((s) => !s.trim()).length
    if (missing > 0) {
      checks.push({
        id: 'stills_missing_source',
        severity: 'fail',
        message: `${missing} scene(s) missing image source after render`,
        detail: null,
      })
    }
    const keys = manifest.map((m) => String(m?.imageKey || '').trim()).filter(Boolean)
    let dupPairs = 0
    for (let i = 1; i < keys.length; i += 1) {
      if (keys[i] && keys[i] === keys[i - 1]) dupPairs += 1
    }
    if (dupPairs > 0 && keys.length >= 3) {
      checks.push({
        id: 'stills_duplicate_keys',
        severity: 'warn',
        message: 'Consecutive scenes reuse the same still key (looks stuck / wrong crop)',
        detail: `${dupPairs} duplicate adjacent pair(s)`,
      })
    }
  }

  const overlayMode = resolveEofOverlayMoments(job?.overlayMoments)
  if (overlayMode === 'off' || !manifest.length) return checks

  const overlayCount =
    renderMeta?.overlayCount != null
      ? Number(renderMeta.overlayCount)
      : Array.isArray(renderMeta?.overlayMoments)
        ? renderMeta.overlayMoments.length
        : null

  const planned =
    overlayCount != null
      ? null
      : planEofOverlayMoments({
          mode: overlayMode,
          scenes: manifest.map((m, i) => ({
            index: m.index ?? i,
            durationSec: m.durationSec,
            imagePath: m.imageKey || m.imageSource || `scene-${i}`,
            imageSource: m.imageSource,
            imageKey: m.imageKey,
          })),
          hasSecondarySubject: Boolean(renderMeta?.hasSecondarySubject),
          secondarySceneIndex: renderMeta?.secondarySceneIndex ?? null,
        })

  const count = overlayCount != null ? overlayCount : planned?.length || 0

  if (overlayMode === 'always' && count === 0 && (manifest.length >= 2 || scenes.length >= 2)) {
    checks.push({
      id: 'overlay_missing_always',
      severity: 'fail',
      message: 'Pop inset set to Always but no inset moment was rendered',
      detail: 'Distinct stills missing or overlay plan empty',
    })
  }
  if (
    overlayMode === 'auto' &&
    count === 0 &&
    renderMeta?.hasSecondarySubject &&
    (manifest.length >= 3 || scenes.length >= 3)
  ) {
    checks.push({
      id: 'overlay_missing_auto_secondary',
      severity: 'fail',
      message: 'Pop inset expected for secondary subject but none was shown',
      detail: null,
    })
  }

  const moments = Array.isArray(renderMeta?.overlayMoments) ? renderMeta.overlayMoments : planned || []
  for (const m of moments) {
    const start = Number(m.absoluteStartSec ?? m.startSec)
    const end = Number(m.absoluteEndSec ?? m.endSec)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start + 0.35) {
      checks.push({
        id: 'overlay_timing_bad',
        severity: 'fail',
        message: 'Pop inset timing is invalid or too short',
        detail: `start=${start} end=${end}`,
      })
    }
    const overlayIdx = m.overlaySceneIndex
    if (overlayIdx != null) {
      const man = manifest.find((row) => row.index === overlayIdx) || manifest[overlayIdx]
      if (
        man &&
        isBadEofOverlayStill({
          imagePath: man.imageKey || man.imageSource,
          imageSource: man.imageSource,
          imageTitle: man.imageTitle,
          imageQuery: man.imageQueryUsed || man.imageQuery,
        })
      ) {
        checks.push({
          id: 'overlay_bad_still',
          severity: 'fail',
          message:
            'Pop inset uses a poor/captioned secondary still (baked text / clickbait thumbnail)',
          detail: String(man.imageTitle || '').slice(0, 80) || null,
        })
      }
    }
  }

  return checks
}

/**
 * Checks that need a finished render (or post-burn caption engine).
 * @param {EofQualityJobSnapshot} job
 * @param {EofQualityRenderMeta} [renderMeta]
 * @returns {EofQualityCheck[]}
 */
export function collectEofShortQualityPostRenderChecks(job, renderMeta = {}) {
  /** @type {EofQualityCheck[]} */
  const checks = []
  const scenes = Array.isArray(job?.script?.scenes) ? job.script.scenes : []
  const manifest = Array.isArray(job?.narrationManifest) ? job.narrationManifest : []
  const captionStyle = resolveEofCaptionStyle(job?.captionStyle)
  const captionsOn = captionStyle !== 'off'

  if (!manifest.length && scenes.length > 0 && job?.renderOutputPath) {
    checks.push({
      id: 'stills_no_manifest',
      severity: 'warn',
      message: 'No narration manifest image metadata to verify stills',
      detail: null,
    })
  }

  if (captionsOn) {
    const engine = String(renderMeta?.captionEngine || job?.captionEngine || '')
    if (engine === 'zapcap-failed') {
      checks.push({
        id: 'captions_zapcap_failed',
        severity: 'warn',
        message: 'ZapCap caption burn failed — Short exported without animated captions',
        detail: null,
      })
    }
  }

  if (!job?.mixedAudioPath && job?.renderOutputPath) {
    checks.push({
      id: 'voiceover_missing_mix',
      severity: 'fail',
      message: 'Mixed voiceover path missing after render',
      detail: null,
    })
  }

  return checks
}

/**
 * Full heuristic suite (plan + stills + post-render). Used after encode.
 * @param {EofQualityJobSnapshot} job
 * @param {EofQualityRenderMeta} [renderMeta]
 * @returns {EofQualityCheck[]}
 */
export function collectEofShortQualityHeuristicChecks(job, renderMeta = {}) {
  return [
    ...collectEofShortQualityPlanChecks(job, renderMeta),
    ...collectEofShortQualityStillsChecks(job, renderMeta),
    ...collectEofShortQualityPostRenderChecks(job, renderMeta),
  ]
}

/**
 * Optional vision pass — only when env enables it. Never throws.
 * @param {object} job
 * @returns {Promise<EofQualityCheck[]>}
 */
export async function collectEofShortQualityVisionChecks(job) {
  /** @type {EofQualityCheck[]} */
  const checks = []
  if (!isEofShortQualityVisionEnabled()) return checks

  const manifest = Array.isArray(job?.narrationManifest) ? job.narrationManifest : []
  const hits = manifest
    .map((m, i) => {
      const title = String(m?.imageTitle || m?.imageQueryUsed || m?.imageQuery || '').trim()
      const url = String(m?.imageUrl || '').trim()
      // Vision helper needs http(s) URLs — skip local/cache-only stills.
      if (!/^https?:\/\//i.test(url)) return null
      return { url, title: title || `scene ${i + 1}`, index: i }
    })
    .filter(Boolean)

  if (hits.length < 2) {
    checks.push({
      id: 'vision_skipped_no_urls',
      severity: 'skip',
      message: 'Vision QA skipped — no remote still URLs on the manifest',
      detail: null,
    })
    return checks
  }

  try {
    const scores = await rankEofPoolHitsWithVision({
      hits: hits.map((h) => ({ url: h.url, title: h.title })),
      subject: String(job?.topic || 'football person'),
      intent: 'quality-gate',
      maxImages: Math.min(8, hits.length),
    })
    if (!scores.size) {
      checks.push({
        id: 'vision_no_scores',
        severity: 'warn',
        message: 'Vision QA returned no scores',
        detail: null,
      })
      return checks
    }
    for (const h of hits) {
      const s = scores.get(h.url)
      if (s == null) continue
      if (s < MIN_EOF_VISION_SCORE) {
        checks.push({
          id: `vision_low_scene_${h.index}`,
          severity: 'fail',
          message: `Scene ${h.index + 1} still failed vision QA (score ${s}/${MIN_EOF_VISION_SCORE})`,
          detail: h.title?.slice(0, 80) || null,
        })
      }
    }
  } catch (e) {
    checks.push({
      id: 'vision_error',
      severity: 'warn',
      message: 'Vision QA errored — continuing with heuristics only',
      detail: e instanceof Error ? e.message.slice(0, 160) : String(e).slice(0, 160),
    })
  }

  return checks
}

/**
 * @param {EofQualityCheck[]} checks
 * @param {{
 *   mode?: 'auto'|'manual',
 *   blockOnFail?: boolean,
 *   phase?: 'preflight'|'stills'|'post',
 * }} [opts]
 * @returns {EofQualityGateResult}
 */
export function finalizeEofQualityGate(checks, opts = {}) {
  const mode = opts.mode === 'auto' ? 'auto' : 'manual'
  const phase =
    opts.phase === 'preflight' || opts.phase === 'stills' || opts.phase === 'post'
      ? opts.phase
      : 'post'
  const fails = checks.filter((c) => c.severity === 'fail')
  const warnings = checks.filter((c) => c.severity === 'warn').map((c) => c.message)
  const reasons = fails.map((c) => c.message)
  const pass = reasons.length === 0
  const blockOnFail = opts.blockOnFail !== false
  // Preflight/stills: block expensive work for both auto + manual on hard fails.
  // Post-render: only auto mode blocks publish (manual keeps a report).
  const blocked = Boolean(
    !pass &&
      blockOnFail &&
      (phase === 'preflight' || phase === 'stills' || mode === 'auto'),
  )
  return {
    pass,
    blocked,
    mode,
    phase,
    checkedAt: new Date().toISOString(),
    reasons,
    warnings,
    checks,
    visionUsed: checks.some((c) => String(c.id).startsWith('vision_') && c.severity !== 'skip'),
  }
}

function disabledGateResult() {
  return {
    pass: true,
    blocked: false,
    mode: 'off',
    phase: 'post',
    checkedAt: new Date().toISOString(),
    reasons: [],
    warnings: [],
    checks: [
      {
        id: 'gate_disabled',
        severity: 'skip',
        message: 'Quality gate disabled (EOF_SHORT_QUALITY_GATE=off)',
        detail: null,
      },
    ],
    visionUsed: false,
  }
}

/**
 * Plan-time preflight (before image fetch / TTS / ffmpeg).
 * @param {object} job
 * @param {{
 *   mode?: 'auto'|'manual',
 *   renderMeta?: object,
 *   blockOnFail?: boolean,
 * }} [opts]
 * @returns {EofQualityGateResult}
 */
export function runEofShortQualityPreflight(job, opts = {}) {
  if (!isEofShortQualityGateEnabled()) {
    return { ...disabledGateResult(), phase: 'preflight' }
  }
  const checks = collectEofShortQualityPlanChecks(job, opts.renderMeta || {})
  return finalizeEofQualityGate(checks, {
    mode: opts.mode === 'auto' ? 'auto' : 'manual',
    blockOnFail: opts.blockOnFail !== false,
    phase: 'preflight',
  })
}

/**
 * Stills-assignment preflight (after images, before ffmpeg).
 * @param {object} job
 * @param {{
 *   mode?: 'auto'|'manual',
 *   renderMeta?: object,
 *   blockOnFail?: boolean,
 * }} [opts]
 * @returns {EofQualityGateResult}
 */
export function runEofShortQualityStillsPreflight(job, opts = {}) {
  if (!isEofShortQualityGateEnabled()) {
    return { ...disabledGateResult(), phase: 'stills' }
  }
  const checks = collectEofShortQualityStillsChecks(job, opts.renderMeta || {})
  return finalizeEofQualityGate(checks, {
    mode: opts.mode === 'auto' ? 'auto' : 'manual',
    blockOnFail: opts.blockOnFail !== false,
    phase: 'stills',
  })
}

/**
 * Run the full post-render gate (heuristics + optional vision) against a job snapshot.
 * @param {object} job
 * @param {{
 *   mode?: 'auto'|'manual',
 *   renderMeta?: object,
 *   blockOnFail?: boolean,
 *   skipVision?: boolean,
 * }} [opts]
 * @returns {Promise<EofQualityGateResult>}
 */
export async function runEofShortQualityGate(job, opts = {}) {
  if (!isEofShortQualityGateEnabled()) {
    return disabledGateResult()
  }

  const heuristic = collectEofShortQualityHeuristicChecks(job, opts.renderMeta || {})
  const vision = opts.skipVision ? [] : await collectEofShortQualityVisionChecks(job)
  return finalizeEofQualityGate([...heuristic, ...vision], {
    mode: opts.mode === 'auto' ? 'auto' : 'manual',
    blockOnFail: opts.blockOnFail,
    phase: 'post',
  })
}

/**
 * Human-readable block message for scheduler / admin error_message.
 * @param {EofQualityGateResult} gate
 * @param {'preflight'|'stills'|'post'|string} [phaseHint]
 */
export function formatEofQualityGateBlockMessage(gate, phaseHint) {
  const reasons = gate?.reasons?.length ? gate.reasons : ['Quality checks failed']
  const head = reasons.slice(0, 3).join('; ')
  const more = reasons.length > 3 ? ` (+${reasons.length - 3} more)` : ''
  const phase = phaseHint || gate?.phase || 'post'
  const verb =
    phase === 'preflight' || phase === 'stills' ? 'blocked build' : 'blocked publish'
  return `Quality gate ${verb}: ${head}${more}`.slice(0, 500)
}
