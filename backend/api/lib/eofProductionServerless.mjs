/**
 * EOF Production Shorts — Vercel Pro vs Hobby adaptation.
 *
 * Default (Pro / full quality on local):
 *   waitUntil + 202, CapCut-style pipeline under vercel.json maxDuration 300.
 *
 * Vercel Pro "reliable" encode (runtime VERCEL=1, not Hobby slim):
 *   Hard cuts, no Ken Burns / logo blur / inset overlays. Full xfade+KB+blur
 *   routinely blows the 300s isolate after Serp + vision + 4 scene encodes.
 *
 * Hobby / slim:
 *   Admin UI "Build mode: Hobby" (persisted) OR env EOF_FORCE_SLIM=1
 *   (legacy alias: EOF_SERVERLESS_SLIM=1). Env always wins as a hard override.
 *   Then: 4-scene cap, hard cuts, overlays off, and continue-build self-fetch chaining.
 *
 * Slim is never implied by VERCEL alone (cannot reliably detect Hobby vs Pro).
 */

/** Match vercel.json functions.maxDuration — leave headroom for DB/persist. */
export const EOF_SERVERLESS_MAX_DURATION_SEC =
  Number(process.env.EOF_SERVERLESS_MAX_DURATION_SEC) || 280

/** Cap scene count when slim/Hobby mode is forced. */
export const EOF_SERVERLESS_MAX_SCENES =
  Number(process.env.EOF_SERVERLESS_MAX_SCENES) || 4

/**
 * Decide which expensive ffmpeg extras to drop so a Short finishes under maxDuration.
 * Pure — safe for unit tests.
 *
 * Local/dev: full CapCut. Hobby slim: everything off.
 * Vercel Pro: always drop logo blur + Ken Burns (biggest per-clip cost).
 * Overlays + xfade stay unless sceneCount ≥ threshold (threatens 300s with Serp+TTS).
 *
 * @param {{ sceneCount?: number, vercel?: boolean, slim?: boolean }} [opts]
 */
export function resolveEofProEncodeCaps(opts = {}) {
  const slim = opts.slim === true
  const vercel = opts.vercel === true
  const sceneCount = Math.max(0, Number(opts.sceneCount) || 0)
  const sceneThreshold = Math.max(3, Number(process.env.EOF_PRO_ENCODE_BUDGET_SCENE_THRESHOLD) || 5)
  if (slim) {
    return {
      skipLogoBlur: true,
      skipKenBurns: true,
      skipXfade: true,
      skipOverlays: true,
      threatenBudget: true,
      profile: 'hobby-slim',
      preserveOverlays: false,
      preserveTransitions: false,
    }
  }
  if (vercel) {
    // 5+ full scenes with xfade+overlay after Serp routinely push past 280–300s.
    const heavy = sceneCount >= sceneThreshold
    return {
      skipLogoBlur: true,
      skipKenBurns: true,
      // Preserve transitions/overlays when we can still fit under maxDuration.
      skipXfade: heavy,
      skipOverlays: heavy,
      threatenBudget: true,
      profile: heavy ? 'pro-budget' : 'pro-reliable',
      preserveOverlays: !heavy,
      preserveTransitions: !heavy,
    }
  }
  return {
    skipLogoBlur: false,
    skipKenBurns: false,
    skipXfade: false,
    skipOverlays: false,
    threatenBudget: false,
    profile: 'full',
    preserveOverlays: true,
    preserveTransitions: true,
  }
}

/** Running on Vercel (Pro or Hobby) — does NOT imply slim. */
export function isEofVercelRuntime() {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV)
}

/**
 * Env hard override for Hobby-slim (sync). Prefer isEofSlimBuildEnabled() for
 * full resolution including the admin UI setting.
 */
export function isEofForceSlim() {
  return (
    process.env.EOF_FORCE_SLIM === '1' ||
    process.env.EOF_SERVERLESS_SLIM === '1'
  )
}

/**
 * Sync Hobby-slim check for env-only call sites (deadlines).
 * For builds, use isEofSlimBuildEnabled() from eofBuildModeSettings.mjs.
 */
export function isEofServerlessEnv() {
  return isEofForceSlim()
}

/** Public origin for self-continue fetches (no trailing slash). */
export function eofProductionPublicOrigin() {
  const site = String(process.env.SITE_URL || '').trim().replace(/\/$/, '')
  if (site) return site
  const vercel = String(process.env.VERCEL_URL || '').trim().replace(/\/$/, '')
  if (!vercel) return ''
  return vercel.startsWith('http') ? vercel : `https://${vercel}`
}

/**
 * Fire-and-forget the next build step as a NEW serverless invocation (Hobby/slim only).
 * Uses CRON_SECRET bearer (continue-build allows it).
 * @param {string} jobId
 * @param {'audio'|'video'} step
 * @param {{ imageProvider?: string|null }} [opts]
 */
export async function scheduleEofBuildContinue(jobId, step, opts = {}) {
  const origin = eofProductionPublicOrigin()
  const secret = String(process.env.CRON_SECRET || process.env.EOF_CRON_SECRET || '').trim()
  if (!origin || !secret || !jobId) {
    console.warn(
      '[eof-production] cannot schedule continue — need SITE_URL (or VERCEL_URL) + CRON_SECRET',
      { hasOrigin: Boolean(origin), hasSecret: Boolean(secret), jobId, step },
    )
    return { ok: false, reason: 'missing_origin_or_secret' }
  }
  const url = `${origin}/api/admin/eof-production`
  const body = {
    action: 'continue-build',
    jobId,
    step: step === 'video' ? 'video' : 'audio',
  }
  if (opts.imageProvider) body.imageProvider = opts.imageProvider
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    })
    console.info('[eof-production] scheduled continue', step, jobId, res.status)
    return { ok: res.ok || res.status === 202, status: res.status }
  } catch (e) {
    console.warn(
      '[eof-production] schedule continue failed',
      step,
      jobId,
      e instanceof Error ? e.message : e,
    )
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Slice script scenes for a slim/Hobby build. Pure — does not mutate input.
 * @param {{ scenes?: unknown[] } | null | undefined} script
 * @param {number} [maxScenes]
 * @returns {{ script: object, trimmed: boolean, before: number, after: number }}
 */
export function capEofScriptScenesForServerless(script, maxScenes = EOF_SERVERLESS_MAX_SCENES) {
  const max = Math.max(1, Math.min(8, Number(maxScenes) || EOF_SERVERLESS_MAX_SCENES))
  const scenes = Array.isArray(script?.scenes) ? script.scenes : []
  const before = scenes.length
  if (before <= max) {
    return { script: script || { scenes: [] }, trimmed: false, before, after: before }
  }
  return {
    script: { ...(script || {}), scenes: scenes.slice(0, max) },
    trimmed: true,
    before,
    after: max,
  }
}

/**
 * Slim look for Hobby: hard cuts, no Ken Burns, no inset overlays.
 * @param {Record<string, unknown>} [opts]
 * @param {boolean} [slim] — when omitted, falls back to env EOF_FORCE_SLIM only.
 */
export function eofServerlessSlimRenderOpts(opts = {}, slim) {
  const useSlim = slim === undefined ? isEofForceSlim() : Boolean(slim)
  if (!useSlim) return opts
  return {
    ...opts,
    // Force hard cuts — xfade filtergraphs are slow on ffmpeg-static.
    transitionStyle: 'cut',
    // Inset pop cards add filter_complex cost per scene.
    overlayMoments: 'off',
    // Explicit: never enable zoompan on Hobby slim.
    kenBurns: false,
  }
}
