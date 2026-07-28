/**
 * Orchestrator for the real-footage pipeline: search -> download -> Quality
 * Gate (technical + copyright risk + vision moment-match) -> process ->
 * finished clip. Never throws — any failure anywhere returns `null` so the
 * caller falls back to the existing image pipeline for that scene.
 */
import path from 'node:path'
import { isYtDlpAvailable } from './eofYtDlp.mjs'
import { searchEofVideoCandidates } from './eofVideoSearch.mjs'
import { downloadEofVideoCandidate, cleanupEofVideoFile } from './eofVideoDownload.mjs'
import { runEofVideoQualityGate, probeEofVideoFile } from './eofVideoQualityGate.mjs'
import { processEofVideoSceneClip } from './eofVideoProcess.mjs'
import { resolveEofVideoClipWindow } from '../../../shared/eofVideoFootage.mjs'
import { isEofVercelRuntime } from './eofProductionServerless.mjs'

/** Max ranked candidates to actually download+gate per scene — bounds cost/latency. */
const MAX_CANDIDATE_ATTEMPTS = 3

/**
 * Try to build a finished, standalone video clip for one scene from real
 * footage. Returns a clip file path on success, or null to signal "fall back
 * to the image pipeline for this scene" (never throws).
 * @param {{
 *   jobId: string,
 *   workDir: string,
 *   sceneIndex: number,
 *   subject: string,
 *   topic?: string,
 *   sceneCaption: string,
 *   targetDurationSec: number,
 *   captionStyle?: string,
 *   captionLayout?: object,
 *   textDir?: string,
 * }} input
 * @returns {Promise<string|null>}
 */
export async function getEofSceneVideoClip({
  jobId,
  workDir,
  sceneIndex,
  subject,
  topic = '',
  sceneCaption,
  targetDurationSec,
  captionStyle,
  captionLayout,
  textDir,
}) {
  // Real footage is a heavy, potentially-multi-minute operation (search + download
  // + ffprobe + frame sampling + vision calls) — never attempt this on Vercel's
  // constrained isolate. This pipeline only ever runs on the Railway worker.
  if (isEofVercelRuntime()) return null

  try {
    if (!(await isYtDlpAvailable())) {
      console.warn('[eof-video-footage] yt-dlp not available — skipping real footage, using images')
      return null
    }

    const candidates = await searchEofVideoCandidates({ subject, sceneCaption, topic })
    if (!candidates.length) {
      console.info('[eof-video-footage] no candidates found for', subject, '— falling back to images')
      return null
    }

    for (const candidate of candidates.slice(0, MAX_CANDIDATE_ATTEMPTS)) {
      let downloaded = null
      try {
        downloaded = await downloadEofVideoCandidate(candidate, workDir, { maxHeight: 1080 })
        if (!downloaded) continue

        const gate = await runEofVideoQualityGate({
          candidate,
          filePath: downloaded.path,
          sceneCaption,
          subject,
        })
        if (!gate.pass) {
          console.info('[eof-video-footage] candidate rejected', candidate.id, gate.reason)
          cleanupEofVideoFile(downloaded.path)
          continue
        }

        const probe = await probeEofVideoFile(downloaded.path)
        const window = resolveEofVideoClipWindow({
          sourceDurationSec: gate.durationSec,
          targetDurationSec,
          bestTimestampSec: gate.bestTimestampSec,
        })

        const outPath = path.join(workDir, 'footage', `scene-${sceneIndex}-clip.mp4`)
        await processEofVideoSceneClip({
          inputPath: downloaded.path,
          startSec: window.startSec,
          endSec: window.endSec,
          targetDurationSec,
          outPath,
          caption: sceneCaption,
          captionStyle,
          captionLayout,
          textDir,
          sourceWidth: probe.width,
          sourceHeight: probe.height,
        })

        cleanupEofVideoFile(downloaded.path) // never keep the raw source around
        console.info('[eof-video-footage] real footage clip built for scene', sceneIndex, 'from', candidate.id)
        return outPath
      } catch (err) {
        console.warn('[eof-video-footage] candidate failed', candidate?.id, err instanceof Error ? err.message : err)
        if (downloaded?.path) cleanupEofVideoFile(downloaded.path)
        continue
      }
    }

    console.info('[eof-video-footage] no candidate passed the gate for scene', sceneIndex, '— using images')
    return null
  } catch (err) {
    // Defense in depth: this pipeline must NEVER block a Short from rendering.
    console.warn('[eof-video-footage] unexpected failure — falling back to images', err instanceof Error ? err.message : err)
    return null
  }
}
