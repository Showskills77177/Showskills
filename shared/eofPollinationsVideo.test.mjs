import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import {
  isEofPollinationsVideoConfigured,
  getEofPollinationsVideoModel,
  clampEofPollinationsVideoDuration,
  buildEofPollinationsVideoUrl,
  generateEofPollinationsVideoClip,
} from '../backend/api/lib/eofPollinationsVideo.mjs'

describe('clampEofPollinationsVideoDuration', () => {
  it('clamps into the 2-10s range supported by most models', () => {
    assert.equal(clampEofPollinationsVideoDuration(0), 2)
    assert.equal(clampEofPollinationsVideoDuration(-5), 2)
    assert.equal(clampEofPollinationsVideoDuration(1), 2)
    assert.equal(clampEofPollinationsVideoDuration(5), 5)
    assert.equal(clampEofPollinationsVideoDuration(5.6), 6)
    assert.equal(clampEofPollinationsVideoDuration(30), 10)
    assert.equal(clampEofPollinationsVideoDuration(Number.NaN), 2)
    assert.equal(clampEofPollinationsVideoDuration(undefined), 2)
  })
})

describe('getEofPollinationsVideoModel', () => {
  const prev = process.env.EOF_POLLINATIONS_VIDEO_MODEL

  afterEach(() => {
    if (prev === undefined) delete process.env.EOF_POLLINATIONS_VIDEO_MODEL
    else process.env.EOF_POLLINATIONS_VIDEO_MODEL = prev
  })

  it('defaults to google/veo-3.1-fast', () => {
    delete process.env.EOF_POLLINATIONS_VIDEO_MODEL
    assert.equal(getEofPollinationsVideoModel(), 'google/veo-3.1-fast')
  })

  it('honors EOF_POLLINATIONS_VIDEO_MODEL override', () => {
    process.env.EOF_POLLINATIONS_VIDEO_MODEL = 'bytedance/seedance-1-pro'
    assert.equal(getEofPollinationsVideoModel(), 'bytedance/seedance-1-pro')
  })
})

describe('buildEofPollinationsVideoUrl', () => {
  it('builds a gen.pollinations.ai URL with model/duration/aspectRatio params', () => {
    const url = buildEofPollinationsVideoUrl('a striker celebrating a goal', {
      model: 'google/veo-3.1-fast',
      durationSec: 6,
      aspectRatio: '9:16',
    })
    assert.match(url, /^https:\/\/gen\.pollinations\.ai\/video\//)
    assert.match(url, /striker/)
    assert.match(url, /model=google%2Fveo-3\.1-fast/)
    assert.match(url, /duration=6/)
    assert.match(url, /aspectRatio=9%3A16/)
  })

  it('clamps an out-of-range duration while building the URL', () => {
    const url = buildEofPollinationsVideoUrl('prompt', { durationSec: 999 })
    assert.match(url, /duration=10/)
  })

  it('defaults aspectRatio to 9:16 and model to the configured default', () => {
    const url = buildEofPollinationsVideoUrl('prompt')
    assert.match(url, /aspectRatio=9%3A16/)
    assert.match(url, /model=google%2Fveo-3\.1-fast/)
  })
})

describe('isEofPollinationsVideoConfigured', () => {
  const prevKey = process.env.POLLINATIONS_API_KEY
  const prevKeyAlt = process.env.EOF_POLLINATIONS_API_KEY

  afterEach(() => {
    if (prevKey === undefined) delete process.env.POLLINATIONS_API_KEY
    else process.env.POLLINATIONS_API_KEY = prevKey
    if (prevKeyAlt === undefined) delete process.env.EOF_POLLINATIONS_API_KEY
    else process.env.EOF_POLLINATIONS_API_KEY = prevKeyAlt
  })

  it('is false without a key and true once POLLINATIONS_API_KEY is set', () => {
    delete process.env.POLLINATIONS_API_KEY
    delete process.env.EOF_POLLINATIONS_API_KEY
    assert.equal(isEofPollinationsVideoConfigured(), false)
    process.env.POLLINATIONS_API_KEY = 'sk_test_key'
    assert.equal(isEofPollinationsVideoConfigured(), true)
  })
})

describe('generateEofPollinationsVideoClip (mocked HTTP)', () => {
  let tmpDir
  const prevFetch = globalThis.fetch
  const prevKey = process.env.POLLINATIONS_API_KEY

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'eof-pollinations-video-'))
  })

  after(() => {
    globalThis.fetch = prevFetch
    if (prevKey === undefined) delete process.env.POLLINATIONS_API_KEY
    else process.env.POLLINATIONS_API_KEY = prevKey
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  afterEach(() => {
    globalThis.fetch = prevFetch
  })

  it('returns null without throwing when no API key is configured', async () => {
    delete process.env.POLLINATIONS_API_KEY
    delete process.env.EOF_POLLINATIONS_API_KEY
    const out = await generateEofPollinationsVideoClip({
      prompt: 'a cartoon footballer',
      outPath: join(tmpDir, 'no-key.mp4'),
    })
    assert.equal(out, null)
  })

  it('writes the clip and returns metadata on a valid MP4 response', async () => {
    process.env.POLLINATIONS_API_KEY = 'sk_test_key'
    const fakeMp4 = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftyp'),
      Buffer.from('isommp42' + 'x'.repeat(50)),
    ])
    let seenRequest = null
    globalThis.fetch = mock.fn(async (url, init) => {
      seenRequest = { url: String(url), headers: init.headers }
      return {
        ok: true,
        async arrayBuffer() {
          return fakeMp4.buffer.slice(
            fakeMp4.byteOffset,
            fakeMp4.byteOffset + fakeMp4.byteLength,
          )
        },
        async text() {
          return ''
        },
      }
    })
    const outPath = join(tmpDir, 'nested', 'clip.mp4')
    const result = await generateEofPollinationsVideoClip({
      prompt: 'a cartoon footballer scoring',
      outPath,
      durationSec: 5,
    })
    assert.ok(result)
    assert.equal(result.path, outPath)
    assert.equal(result.durationSec, 5)
    assert.match(seenRequest.url, /^https:\/\/gen\.pollinations\.ai\/video\//)
    assert.equal(seenRequest.headers.Authorization, 'Bearer sk_test_key')
    const written = readFileSync(outPath)
    assert.equal(written.toString('ascii', 4, 8), 'ftyp')
  })

  it('returns null when the response is not a 2xx', async () => {
    process.env.POLLINATIONS_API_KEY = 'sk_test_key'
    globalThis.fetch = mock.fn(async () => ({
      ok: false,
      status: 402,
      async text() {
        return 'payment required'
      },
    }))
    const out = await generateEofPollinationsVideoClip({
      prompt: 'prompt',
      outPath: join(tmpDir, 'failed-status.mp4'),
    })
    assert.equal(out, null)
  })

  it('returns null when the response body is not a recognisable MP4', async () => {
    process.env.POLLINATIONS_API_KEY = 'sk_test_key'
    const notVideo = Buffer.from('not a video at all, just text padding here')
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      async arrayBuffer() {
        return notVideo.buffer.slice(notVideo.byteOffset, notVideo.byteOffset + notVideo.byteLength)
      },
      async text() {
        return ''
      },
    }))
    const out = await generateEofPollinationsVideoClip({
      prompt: 'prompt',
      outPath: join(tmpDir, 'bad-buffer.mp4'),
    })
    assert.equal(out, null)
  })

  it('returns null (never throws) when fetch rejects', async () => {
    process.env.POLLINATIONS_API_KEY = 'sk_test_key'
    globalThis.fetch = mock.fn(async () => {
      throw new Error('network down')
    })
    const out = await generateEofPollinationsVideoClip({
      prompt: 'prompt',
      outPath: join(tmpDir, 'network-error.mp4'),
    })
    assert.equal(out, null)
  })

  it('returns null when prompt or outPath is missing', async () => {
    process.env.POLLINATIONS_API_KEY = 'sk_test_key'
    assert.equal(await generateEofPollinationsVideoClip({ outPath: join(tmpDir, 'x.mp4') }), null)
    assert.equal(await generateEofPollinationsVideoClip({ prompt: 'prompt' }), null)
  })
})
