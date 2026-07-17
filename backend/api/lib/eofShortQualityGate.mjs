/**
 * Short quality gate — heuristic (+ optional AI vision) QA after EOF Production render.
 * Runs before auto-publish so defective Shorts do not burn platform credits.
 *
 * Env:
 *   EOF_SHORT_QUALITY_GATE=auto|on|off   (default auto — heuristics always on unless off)
 *   EOF_SHORT_QUALITY_VISION=off|auto|on (default off — optional xAI still re-check; costs credits)
 *   EOF_SHORT_QUALITY_MAX_PLACEHOLDER=0.34  max fraction of placeholder stills before fail
 *
 * Cheaper text/timing checks always run when the gate is enabled.
 * Vision only runs when EOF_SHORT_QUALITY_VISION is auto/on and XAI is configured.
 */
import {
  EOF_CAPTION_LAYOUT_Y_MIN,
  EOF_CAPTION_LAYOUT_Y_MAX,
  EOF_CAPTION_LAYOUT_SCALE_MIN,
  EOF_CAPTION_LAYOUT_SCALE_MAX,
  normalizeEofCaptionLayout,
} from '../../../shared/eofCaptionLayout.mjs'
import { resolveEofCaptionStyle } from '../../../shared/eofCaptionStyles.mjs'
import { resolveEofOverlayMoments, planEofOverlayMoments, EOF_OVERLAY_LAYOUT } from '../../../shared/eofOverlayMoments.mjs'
import { normalizeEofMusicTrim } from '../../../shared/eofMusicTrim.mjs'
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
 *   checkedAt: string,
 *   reasons: string[],
 *   warnings: string[],
 *   checks: EofQualityCheck[],
 *   visionUsed: boolean,
 * }} EofQualityGateResult
 */

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
  return {
    pass: obj.pass !== false && reasons.length === 0,
    blocked: Boolean(obj.blocked),
    mode: obj.mode === 'auto' || obj.mode === 'off' ? obj.mode : 'manual',
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
  if (gate.pass) {
    const w = gate.warnings?.length ? ` (${gate.warnings.length} warning${gate.warnings.length === 1 ? '' : 's'})` : ''
    return `Quality gate passed${w}`
  }
  const n = gate.reasons?.length || 0
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
 * Heuristic scene-still checks from script + narration manifest (+ optional render meta).
 * @param {{
 *   topic?: string,
 *   script?: { scenes?: Array<{ caption?: string, narration?: string, durationSec?: number }> },
 *   narrationManifest?: Array<{
 *     index?: number,
 *     caption?: string,
 *     durationSec?: number,
 *     imageSource?: string | null,
 *     imageKey?: string | null,
 *     imageTitle?: string | null,
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
 * }} job
 * @param {{
 *   overlayCount?: number,
 *   overlayMoments?: Array<{ sceneIndex?: number, absoluteStartSec?: number, absoluteEndSec?: number }>,
 *   hasSecondarySubject?: boolean,
 *   secondarySceneIndex?: number | null,
 *   captionEngine?: string | null,
 * }} [renderMeta]
 * @returns {EofQualityCheck[]}
 */
export function collectEofShortQualityHeuristicChecks(job, renderMeta = {}) {
  /** @type {EofQualityCheck[]} */
  const checks = []
  const scenes = Array.isArray(job?.script?.scenes) ? job.script.scenes : []
  const manifest = Array.isArray(job?.narrationManifest) ? job.narrationManifest : []
  const captionStyle = resolveEofCaptionStyle(job?.captionStyle)
  const captionsOn = captionStyle !== 'off'

  // —— Scene stills ——
  const sources = manifest.length
    ? manifest.map((m) => String(m?.imageSource || ''))
    : []
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
    // Duplicate consecutive keys often look like a stuck/wrong crop swap.
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
  } else if (scenes.length > 0 && job?.renderOutputPath) {
    checks.push({
      id: 'stills_no_manifest',
      severity: 'warn',
      message: 'No narration manifest image metadata to verify stills',
      detail: null,
    })
  }

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
    // CapCut mid-frame pack should not sit in the extreme lower third (looks misplaced under pop).
    if (['pop', 'karaoke', 'beast'].includes(captionStyle) && layout.yNorm > 0.82) {
      checks.push({
        id: 'captions_layout_mid_low',
        severity: 'warn',
        message: `Mid-frame caption style “${captionStyle}” is placed too low (yNorm=${layout.yNorm})`,
        detail: null,
      })
    }

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

  // —— Voiceover / timing ——
  if (!job?.mixedAudioPath && job?.renderOutputPath) {
    checks.push({
      id: 'voiceover_missing_mix',
      severity: 'fail',
      message: 'Mixed voiceover path missing after render',
      detail: null,
    })
  }
  const durs = (manifest.length ? manifest : scenes).map((s) => Number(s?.durationSec))
  let totalDur = 0
  for (let i = 0; i < durs.length; i += 1) {
    const d = durs[i]
    if (!Number.isFinite(d) || d < 1.2) {
      checks.push({
        id: `timing_scene_${i}`,
        severity: 'fail',
        message: `Scene ${i + 1} duration is missing or too short for a proper beat`,
        detail: `durationSec=${d}`,
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
  // Caption length vs beat: long on-screen text on a tiny beat looks like bad overlay timing.
  for (let i = 0; i < scenes.length; i += 1) {
    const words = tokenize(scenes[i]?.caption || scenes[i]?.narration).length
    const d = Number(manifest[i]?.durationSec ?? scenes[i]?.durationSec)
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

  // —— Pop inset / overlay moments ——
  const overlayMode = resolveEofOverlayMoments(job?.overlayMoments)
  const overlayCount =
    renderMeta?.overlayCount != null
      ? Number(renderMeta.overlayCount)
      : Array.isArray(renderMeta?.overlayMoments)
        ? renderMeta.overlayMoments.length
        : null

  if (overlayMode !== 'off') {
    const planned =
      overlayCount != null
        ? null
        : planEofOverlayMoments({
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
    }

    // Static layout sanity — bad sizing looks like a cropped postage stamp or full-frame glitch.
    if (EOF_OVERLAY_LAYOUT.widthFrac < 0.4 || EOF_OVERLAY_LAYOUT.widthFrac > 0.85) {
      checks.push({
        id: 'overlay_size_width',
        severity: 'fail',
        message: `Pop inset widthFrac looks wrong (${EOF_OVERLAY_LAYOUT.widthFrac})`,
        detail: null,
      })
    }
    if (EOF_OVERLAY_LAYOUT.heightFrac < 0.45 || EOF_OVERLAY_LAYOUT.heightFrac > 0.95) {
      checks.push({
        id: 'overlay_size_height',
        severity: 'fail',
        message: `Pop inset heightFrac looks wrong (${EOF_OVERLAY_LAYOUT.heightFrac})`,
        detail: null,
      })
    }
  }

  return checks
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
 * @param {{ mode?: 'auto'|'manual', blockOnFail?: boolean }} [opts]
 * @returns {EofQualityGateResult}
 */
export function finalizeEofQualityGate(checks, opts = {}) {
  const mode = opts.mode === 'auto' ? 'auto' : 'manual'
  const fails = checks.filter((c) => c.severity === 'fail')
  const warnings = checks.filter((c) => c.severity === 'warn').map((c) => c.message)
  const reasons = fails.map((c) => c.message)
  const pass = reasons.length === 0
  const blockOnFail = opts.blockOnFail !== false
  return {
    pass,
    blocked: Boolean(!pass && mode === 'auto' && blockOnFail),
    mode,
    checkedAt: new Date().toISOString(),
    reasons,
    warnings,
    checks,
    visionUsed: checks.some((c) => String(c.id).startsWith('vision_') && c.severity !== 'skip'),
  }
}

/**
 * Run the full gate (heuristics + optional vision) against a job snapshot.
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
    return {
      pass: true,
      blocked: false,
      mode: 'off',
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

  const heuristic = collectEofShortQualityHeuristicChecks(job, opts.renderMeta || {})
  const vision = opts.skipVision ? [] : await collectEofShortQualityVisionChecks(job)
  return finalizeEofQualityGate([...heuristic, ...vision], {
    mode: opts.mode === 'auto' ? 'auto' : 'manual',
    blockOnFail: opts.blockOnFail,
  })
}

/**
 * Human-readable block message for scheduler / admin error_message.
 * @param {EofQualityGateResult} gate
 */
export function formatEofQualityGateBlockMessage(gate) {
  const reasons = gate?.reasons?.length ? gate.reasons : ['Quality checks failed']
  const head = reasons.slice(0, 3).join('; ')
  const more = reasons.length > 3 ? ` (+${reasons.length - 3} more)` : ''
  return `Quality gate blocked publish: ${head}${more}`.slice(0, 500)
}
