/**
 * "Daily Stories" per-scene image generation.
 *
 * Unlike the normal EOF Shorts pipeline (one shared real-photo subject pool,
 * claimed per scene, filtered by vision/name-cue checks), Daily Stories has no
 * real-world subject to photograph — it's a fictional / narrative script.
 * So every scene gets its own bespoke illustrated still, generated directly
 * from that scene's own narration/caption text, completely bypassing the
 * scrape + vision + subject-pool machinery.
 */
import { mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  isEofGrokImagineConfigured,
  generateEofGrokImagineHit,
  copyEofGenHitToScene,
} from './eofGrokImagineImages.mjs'
import { isEofFreeGenConfigured, generateEofFreeGenHit } from './eofFreeGenImages.mjs'
import { buildEofStorySceneImagePrompt } from './eofImageGenPrompt.mjs'

/** True when at least one AI image generator is configured for Daily Stories. */
export function isEofStoryGenConfigured() {
  return isEofGrokImagineConfigured() || isEofFreeGenConfigured()
}

/**
 * Generate (or reuse) one AI-illustrated still for a single Daily Stories scene.
 * @param {{
 *   caption?: string,
 *   narration?: string,
 *   topic?: string,
 *   styleHint?: string,
 *   genProvider?: 'auto'|'grok'|'free',
 *   workDir: string,
 *   outPath: string,
 *   index?: number,
 *   signal?: AbortSignal,
 * }} opts
 * @returns {Promise<{ path: string, source: string, imageQuery: string, imageTitle: string|null, imageUrl: string|null }|null>}
 */
export async function generateEofStorySceneImage(opts = {}) {
  const workDir = String(opts.workDir || '').trim()
  const outPath = String(opts.outPath || '').trim()
  if (!workDir || !outPath) throw new Error('workDir and outPath are required for story scene generation')
  const index = Math.max(0, Number(opts.index) || 0)
  const sceneText = String(opts.narration || opts.caption || opts.topic || '').trim()
  const prompt = buildEofStorySceneImagePrompt({
    sceneText,
    topic: opts.topic,
    styleHint: opts.styleHint,
  })

  const genProvider = String(opts.genProvider || 'auto').toLowerCase()
  const tryGrok = genProvider !== 'free' && isEofGrokImagineConfigured()
  const tryFree = genProvider !== 'grok' && isEofFreeGenConfigured()

  let hit = null
  if (tryGrok) {
    try {
      hit = await generateEofGrokImagineHit({ prompt, workDir, index, signal: opts.signal })
    } catch (e) {
      console.warn(
        '[eof-story-images] grok imagine failed for scene',
        index + 1,
        e instanceof Error ? e.message : e,
      )
    }
  }
  if (!hit && tryFree) {
    try {
      hit = await generateEofFreeGenHit({ prompt, workDir, index, signal: opts.signal })
    } catch (e) {
      console.warn(
        '[eof-story-images] free-gen failed for scene',
        index + 1,
        e instanceof Error ? e.message : e,
      )
    }
  }
  if (!hit) return null

  mkdirSync(dirname(outPath), { recursive: true })
  const copied = await copyEofGenHitToScene(hit, outPath)
  if (!copied || !existsSync(outPath)) return null

  return {
    path: outPath,
    source: hit.source || 'gen',
    imageQuery: prompt,
    imageTitle: hit.title || null,
    imageUrl: hit.url || null,
  }
}
