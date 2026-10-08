/**
 * Orchestrator for "Daily Stories" AI cartoon-video scene clips (Pollinations
 * text-to-video). Mirrors eofSceneVideoFootage.mjs's shape (generate -> probe
 * -> finish via processEofVideoSceneClip -> finished standalone MP4) but the
 * source clip comes from a generative model instead of a downloaded real
 * video, so there is no search/download/copyright-gate step.
 *
 * Never throws — any failure returns `null` so the caller keeps that scene's
 * already-generated illustrated still instead (generated first, cheaply, as a
 * fallback before this upgrade is attempted).
 */
import path from 'node:path'
import { unlink } from 'node:fs/promises'
import {
  isEofPollinationsVideoConfigured,
  generateEofPollinationsVideoClip,
} from './eofPollinationsVideo.mjs'
import { probeEofVideoFile } from './eofVideoQualityGate.mjs'
import { processEofVideoSceneClip } from './eofVideoProcess.mjs'
import { buildEofStorySceneVideoPrompt } from './eofImageGenPrompt.mjs'
import { isEofVercelRuntime } from './eofProductionServerless.mjs'

/**
 * Generate one finished Daily Stories AI video clip for a single scene.
 * @param {{
 *   workDir: string,
 *   sceneIndex: number,
 *   caption?: string,
 *   narration?: string,
 *   topic?: string,
 *   styleHint?: string,
 *   targetDurationSec: number,
 *   captionStyle?: string,
 *   captionLayout?: object,
 *   textDir?: string,
 *   signal?: AbortSignal,
 * }} opts
 * @returns {Promise<string|null>}
 */
export async function getEofStorySceneVideoClip({
  workDir,
  sceneIndex,
  caption,
  narration,
  topic = '',
  styleHint,
  targetDurationSec,
  captionStyle,
  captionLayout,
  textDir,
  signal,
}) {
  // Each clip can take 30-180s to generate (single blocking HTTP call) — multiplied
  // across scenes this easily blows a Vercel function's time budget. Only attempt
  // this on the Railway worker, same restriction as the real-footage pipeline.
  if (isEofVercelRuntime()) return null
  if (!isEofPollinationsVideoConfigured()) return null

  const sceneText = String(narration || caption || topic || '').trim()
  if (!sceneText) return null

  const prompt = buildEofStorySceneVideoPrompt({ sceneText, topic, styleHint })
  const rawPath = path.join(workDir, 'ai-video', `scene-${sceneIndex}-raw.mp4`)

  try {
    const generated = await generateEofPollinationsVideoClip({
      prompt,
      outPath: rawPath,
      durationSec: targetDurationSec,
      aspectRatio: '9:16',
      signal,
    })
    if (!generated) return null

    const probe = await probeEofVideoFile(generated.path)
    if (!probe.durationSec || !probe.width || !probe.height) {
      console.warn('[eof-story-video] generated clip failed to probe — using still for scene', sceneIndex)
      return null
    }

    const outPath = path.join(workDir, 'ai-video', `scene-${sceneIndex}-clip.mp4`)
    await processEofVideoSceneClip({
      inputPath: generated.path,
      startSec: 0,
      endSec: probe.durationSec,
      targetDurationSec,
      outPath,
      caption,
      captionStyle,
      captionLayout,
      textDir,
      sourceWidth: probe.width,
      sourceHeight: probe.height,
    })

    await unlink(generated.path).catch(() => {}) // keep only the finished clip
    console.info('[eof-story-video] AI video clip built for scene', sceneIndex, 'via', generated.model)
    return outPath
  } catch (err) {
    console.warn(
      '[eof-story-video] unexpected failure — falling back to still',
      sceneIndex,
      err instanceof Error ? err.message : err,
    )
    return null
  }
}
