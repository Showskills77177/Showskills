import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, mock, before, after, beforeEach } from 'node:test'
import { buildEofStorySceneImagePrompt } from '../backend/api/lib/eofImageGenPrompt.mjs'

describe('buildEofStorySceneImagePrompt', () => {
  it('builds an illustrated per-scene prompt from scene text, not a real subject', () => {
    const p = buildEofStorySceneImagePrompt({
      sceneText: 'A young goalkeeper practices alone under floodlights after everyone else has gone home.',
      topic: 'The keeper who never gave up',
    })
    assert.match(p, /goalkeeper practices alone/)
    assert.match(p, /9:16/)
    assert.match(p, /no text/i)
    // Must NOT use the photorealistic press-photo framing (that's for real people).
    assert.doesNotMatch(p, /press photograph/i)
  })

  it('falls back to topic when no sceneText is given', () => {
    const p = buildEofStorySceneImagePrompt({ topic: 'A dragon learns to play football' })
    assert.match(p, /dragon learns to play football/)
  })

  it('accepts a custom style hint', () => {
    const p = buildEofStorySceneImagePrompt({
      sceneText: 'Two rivals shake hands after the final whistle.',
      styleHint: 'flat 2D cartoon style, bold outlines, bright colors',
    })
    assert.match(p, /flat 2D cartoon style/)
  })

  // Regression: multi-figure illustrated scenes (locker rooms, press conferences)
  // sometimes came back rotated 90° sideways from Grok Imagine. Ask explicitly
  // for upright, non-rotated portrait framing.
  it('asks for upright, non-rotated portrait framing', () => {
    const p = buildEofStorySceneImagePrompt({
      sceneText: 'A packed locker room full of teammates getting ready before training.',
    })
    assert.match(p, /upright/i)
    assert.match(p, /rotate|tilt/i)
  })
})

describe('generateEofStorySceneImage (mocked HTTP)', () => {
  let workDir
  const prevXaiKey = process.env.XAI_API_KEY
  const prevFreeGen = process.env.EOF_FREE_GEN
  const prevFetch = globalThis.fetch

  before(() => {
    workDir = mkdtempSync(join(tmpdir(), 'eof-story-images-'))
  })

  after(() => {
    globalThis.fetch = prevFetch
    if (prevXaiKey === undefined) delete process.env.XAI_API_KEY
    else process.env.XAI_API_KEY = prevXaiKey
    if (prevFreeGen === undefined) delete process.env.EOF_FREE_GEN
    else process.env.EOF_FREE_GEN = prevFreeGen
    try {
      rmSync(workDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  beforeEach(() => {
    globalThis.fetch = prevFetch
  })

  it('generates one scene via Grok using that scene\u2019s own narration (no shared subject)', async () => {
    process.env.XAI_API_KEY = 'test-xai-key'
    delete process.env.EOF_FREE_GEN
    let seenPrompt = null
    globalThis.fetch = mock.fn(async (url, init) => {
      if (String(url).includes('api.x.ai')) {
        seenPrompt = JSON.parse(init.body).prompt
        const buf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(8_200)])
        return {
          ok: true,
          async json() {
            return { data: [{ b64_json: buf.toString('base64') }] }
          },
          async text() {
            return ''
          },
        }
      }
      throw new Error(`unexpected fetch ${url}`)
    })

    const { generateEofStorySceneImage } = await import('../backend/api/lib/eofStoryImages.mjs')
    const outPath = join(workDir, 'scene-1.jpg')
    const result = await generateEofStorySceneImage({
      caption: 'The keeper dives for a ball nobody expected him to reach.',
      narration: 'The keeper dives for a ball nobody expected him to reach.',
      topic: 'Daily Stories: The Unlikely Save',
      workDir,
      outPath,
      index: 0,
    })

    assert.ok(result, 'should return a result')
    assert.equal(result.path, outPath)
    assert.equal(result.source, 'grok-imagine')
    assert.match(seenPrompt, /keeper dives/i)
    assert.ok(existsSync(outPath), 'image should be written to outPath')
  })

  it('falls back to free-gen when Grok is not configured', async () => {
    delete process.env.XAI_API_KEY
    process.env.EOF_FREE_GEN = 'on'
    globalThis.fetch = mock.fn(async (url) => {
      if (String(url).includes('image.pollinations.ai')) {
        // Minimal valid JPEG header + padding so looksLikeImageBuffer + size check pass.
        const buf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(8_200)])
        return {
          ok: true,
          async arrayBuffer() {
            return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
          },
        }
      }
      throw new Error(`unexpected fetch ${url}`)
    })

    const { generateEofStorySceneImage } = await import('../backend/api/lib/eofStoryImages.mjs')
    const outPath = join(workDir, 'scene-2.jpg')
    const result = await generateEofStorySceneImage({
      caption: 'A crowd gasps as the underdog team scores in the final minute.',
      topic: 'Daily Stories: Final Minute',
      workDir,
      outPath,
      index: 1,
      genProvider: 'free',
    })

    assert.ok(result, 'should return a result via free-gen fallback')
    assert.equal(result.source, 'free-gen')
    assert.ok(existsSync(outPath))
  })

  it('returns null when no gen provider is configured (caller falls back to search pipeline)', async () => {
    delete process.env.XAI_API_KEY
    process.env.EOF_FREE_GEN = 'off'
    const { generateEofStorySceneImage } = await import('../backend/api/lib/eofStoryImages.mjs')
    const outPath = join(workDir, 'scene-3.jpg')
    const result = await generateEofStorySceneImage({
      caption: 'Nothing configured.',
      workDir,
      outPath,
      index: 2,
    })
    assert.equal(result, null)
    assert.equal(existsSync(outPath), false)
  })
})
