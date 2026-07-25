/**
 * Vercel Hobby / serverless constraints for EOF Production Shorts.
 *
 * Hobby kills detached waitUntil work silently — builds must run in-request
 * (await) under maxDuration, with slim ffmpeg and a hard scene cap.
 */

/** Match vercel.json functions.maxDuration — leave headroom for DB/persist. */
export const EOF_SERVERLESS_MAX_DURATION_SEC =
  Number(process.env.EOF_SERVERLESS_MAX_DURATION_SEC) || 280

/** Cap scene count so TTS + Serp + ffmpeg fit under Hobby maxDuration. */
export const EOF_SERVERLESS_MAX_SCENES =
  Number(process.env.EOF_SERVERLESS_MAX_SCENES) || 4

export function isEofServerlessEnv() {
  return Boolean(
    process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.EOF_SERVERLESS_SLIM === '1',
  )
}

/**
 * Slice script scenes for a serverless build. Pure — does not mutate input.
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
 * Slim look for serverless: hard cuts, no Ken Burns, no inset overlays.
 * @param {Record<string, unknown>} [opts]
 */
export function eofServerlessSlimRenderOpts(opts = {}) {
  if (!isEofServerlessEnv()) return opts
  return {
    ...opts,
    // Force hard cuts — xfade filtergraphs are slow on ffmpeg-static.
    transitionStyle: 'cut',
    // Inset pop cards add filter_complex cost per scene.
    overlayMoments: 'off',
    // Explicit: never enable zoompan on Hobby.
    kenBurns: false,
  }
}
