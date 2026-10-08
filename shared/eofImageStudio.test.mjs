import assert from 'node:assert/strict'
import { describe, it, mock, before, after } from 'node:test'

describe('Image Studio — Grok Imagine aspect ratio + buffer fetch (mocked HTTP)', () => {
  const prevFetch = globalThis.fetch
  const prevKey = process.env.XAI_API_KEY

  before(() => {
    process.env.XAI_API_KEY = 'test-xai-key'
  })

  after(() => {
    globalThis.fetch = prevFetch
    if (prevKey === undefined) delete process.env.XAI_API_KEY
    else process.env.XAI_API_KEY = prevKey
  })

  it('normalizeEofImageStudioAspectRatio falls back to 16:9 for unknown values', async () => {
    const { normalizeEofImageStudioAspectRatio, EOF_IMAGE_STUDIO_ASPECT_RATIOS } = await import(
      '../backend/api/lib/eofGrokImagineImages.mjs'
    )
    assert.equal(normalizeEofImageStudioAspectRatio('9:16'), '9:16')
    assert.equal(normalizeEofImageStudioAspectRatio('16:9'), '16:9')
    assert.equal(normalizeEofImageStudioAspectRatio('bogus'), '16:9')
    assert.equal(normalizeEofImageStudioAspectRatio(''), '16:9')
    assert.ok(EOF_IMAGE_STUDIO_ASPECT_RATIOS.includes('16:9'))
    assert.ok(EOF_IMAGE_STUDIO_ASPECT_RATIOS.includes('9:16'))
  })

  it('requestGrokImagineImage still defaults to 9:16 when aspectRatio is omitted (scene-image callers unaffected)', async () => {
    let seen = null
    globalThis.fetch = mock.fn(async (url, init) => {
      seen = { url: String(url), body: JSON.parse(init.body) }
      return {
        ok: true,
        async json() {
          return { data: [{ url: 'https://cdn.x.ai/fake.jpg' }] }
        },
        async text() {
          return ''
        },
      }
    })
    const { requestGrokImagineImage } = await import('../backend/api/lib/eofGrokImagineImages.mjs')
    await requestGrokImagineImage({ prompt: 'Wayne Rooney press photo' })
    assert.equal(seen.body.aspect_ratio, '9:16')
  })

  it('requestGrokImagineImage honors an explicit aspectRatio (Image Studio thumbnails)', async () => {
    let seen = null
    globalThis.fetch = mock.fn(async (url, init) => {
      seen = { url: String(url), body: JSON.parse(init.body) }
      return {
        ok: true,
        async json() {
          return { data: [{ url: 'https://cdn.x.ai/fake.jpg' }] }
        },
        async text() {
          return ''
        },
      }
    })
    const { requestGrokImagineImage } = await import('../backend/api/lib/eofGrokImagineImages.mjs')
    await requestGrokImagineImage({ prompt: 'YouTube thumbnail of a stadium at night', aspectRatio: '16:9' })
    assert.equal(seen.body.aspect_ratio, '16:9')
  })

  it('fetchEofGrokImagineBuffer returns raw bytes + mime without writing to disk', async () => {
    const fakeJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(8_100, 1)])
    globalThis.fetch = mock.fn(async (url) => {
      if (String(url).includes('api.x.ai')) {
        return {
          ok: true,
          async json() {
            return { data: [{ url: 'https://cdn.x.ai/fake.jpg' }] }
          },
          async text() {
            return ''
          },
        }
      }
      return {
        ok: true,
        async arrayBuffer() {
          return fakeJpeg.buffer.slice(fakeJpeg.byteOffset, fakeJpeg.byteOffset + fakeJpeg.byteLength)
        },
      }
    })
    const { fetchEofGrokImagineBuffer } = await import('../backend/api/lib/eofGrokImagineImages.mjs')
    const out = await fetchEofGrokImagineBuffer({ prompt: 'a thumbnail', aspectRatio: '16:9' })
    assert.equal(out.mime, 'image/jpeg')
    assert.equal(out.promptUsed, 'a thumbnail')
    assert.ok(Buffer.isBuffer(out.buffer))
    assert.ok(out.buffer.length >= 8_000)
  })

  it('fetchEofGrokImagineBuffer throws when prompt is empty', async () => {
    const { fetchEofGrokImagineBuffer } = await import('../backend/api/lib/eofGrokImagineImages.mjs')
    await assert.rejects(() => fetchEofGrokImagineBuffer({ prompt: '  ' }), /Prompt is required/)
  })
})
