import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, afterEach, before, describe, it } from 'node:test'
import { getEofStorySceneVideoClip } from '../backend/api/lib/eofStoryVideoClips.mjs'

describe('getEofStorySceneVideoClip (fail-soft gating)', () => {
  let tmpDir
  const prevVercel = process.env.VERCEL
  const prevVercelEnv = process.env.VERCEL_ENV
  const prevKey = process.env.POLLINATIONS_API_KEY
  const prevKeyAlt = process.env.EOF_POLLINATIONS_API_KEY

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'eof-story-video-clips-'))
  })

  after(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  afterEach(() => {
    if (prevVercel === undefined) delete process.env.VERCEL
    else process.env.VERCEL = prevVercel
    if (prevVercelEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = prevVercelEnv
    if (prevKey === undefined) delete process.env.POLLINATIONS_API_KEY
    else process.env.POLLINATIONS_API_KEY = prevKey
    if (prevKeyAlt === undefined) delete process.env.EOF_POLLINATIONS_API_KEY
    else process.env.EOF_POLLINATIONS_API_KEY = prevKeyAlt
  })

  it('returns null on Vercel runtime, even if configured (must only run on the Railway worker)', async () => {
    process.env.VERCEL = '1'
    process.env.POLLINATIONS_API_KEY = 'sk_test_key'
    const out = await getEofStorySceneVideoClip({
      workDir: tmpDir,
      sceneIndex: 0,
      caption: 'Big win',
      narration: 'The striker scored a stunning goal.',
      targetDurationSec: 4,
    })
    assert.equal(out, null)
  })

  it('returns null when not configured (no Pollinations API key), off Vercel', async () => {
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
    delete process.env.POLLINATIONS_API_KEY
    delete process.env.EOF_POLLINATIONS_API_KEY
    const out = await getEofStorySceneVideoClip({
      workDir: tmpDir,
      sceneIndex: 0,
      caption: 'Big win',
      narration: 'The striker scored a stunning goal.',
      targetDurationSec: 4,
    })
    assert.equal(out, null)
  })

  it('returns null when there is no scene text to build a prompt from', async () => {
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
    process.env.POLLINATIONS_API_KEY = 'sk_test_key'
    const out = await getEofStorySceneVideoClip({
      workDir: tmpDir,
      sceneIndex: 0,
      targetDurationSec: 4,
    })
    assert.equal(out, null)
  })
})
