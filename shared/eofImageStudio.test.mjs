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

describe('Image Studio — reference image description + prompt composition (mocked HTTP)', () => {
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

  it('parseEofReferenceImageDataUrl accepts a valid JPEG data URL and rejects garbage', async () => {
    const { parseEofReferenceImageDataUrl } = await import('../backend/api/lib/eofImageStudioReference.mjs')
    const tinyJpegB64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64')
    const out = parseEofReferenceImageDataUrl(`data:image/jpeg;base64,${tinyJpegB64}`)
    assert.equal(out.mime, 'image/jpeg')
    assert.ok(Buffer.isBuffer(out.buffer))

    assert.throws(() => parseEofReferenceImageDataUrl('not-a-data-url'), /JPEG, PNG, or WEBP/)
    assert.throws(() => parseEofReferenceImageDataUrl('data:application/pdf;base64,AAAA'), /JPEG, PNG, or WEBP/)
  })

  it('parseEofReferenceImageDataUrl rejects oversized images', async () => {
    const { parseEofReferenceImageDataUrl, MAX_REFERENCE_IMAGE_BYTES } = await import(
      '../backend/api/lib/eofImageStudioReference.mjs'
    )
    const big = Buffer.alloc(MAX_REFERENCE_IMAGE_BYTES + 10, 1).toString('base64')
    assert.throws(() => parseEofReferenceImageDataUrl(`data:image/png;base64,${big}`), /too large/)
  })

  it('truncateEofDocumentText caps long text and leaves short text untouched', async () => {
    const { truncateEofDocumentText, MAX_DOCUMENT_TEXT_CHARS } = await import(
      '../backend/api/lib/eofImageStudioReference.mjs'
    )
    assert.equal(truncateEofDocumentText('  hello  '), 'hello')
    assert.equal(truncateEofDocumentText(''), '')
    const long = 'x'.repeat(MAX_DOCUMENT_TEXT_CHARS + 500)
    const out = truncateEofDocumentText(long)
    assert.ok(out.length <= MAX_DOCUMENT_TEXT_CHARS + 1)
    assert.ok(out.endsWith('…'))
  })

  it('describeEofReferenceImage posts a multimodal chat/completions request and returns the text', async () => {
    let seen = null
    globalThis.fetch = mock.fn(async (url, init) => {
      seen = { url: String(url), body: JSON.parse(init.body) }
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: '  A dramatic stadium at night.  ' } }] }
        },
        async text() {
          return ''
        },
      }
    })
    const { describeEofReferenceImage } = await import('../backend/api/lib/eofImageStudioReference.mjs')
    const out = await describeEofReferenceImage({ dataUrl: 'data:image/jpeg;base64,AAAA' })
    assert.equal(out, 'A dramatic stadium at night.')
    assert.equal(seen.url, 'https://api.x.ai/v1/chat/completions')
    const imageBlock = seen.body.messages[1].content.find((c) => c.type === 'image_url')
    assert.equal(imageBlock.image_url.url, 'data:image/jpeg;base64,AAAA')
  })

  it('describeEofReferenceImage throws on a non-ok response', async () => {
    globalThis.fetch = mock.fn(async () => ({
      ok: false,
      status: 500,
      async text() {
        return 'boom'
      },
    }))
    const { describeEofReferenceImage } = await import('../backend/api/lib/eofImageStudioReference.mjs')
    await assert.rejects(() => describeEofReferenceImage({ dataUrl: 'data:image/jpeg;base64,AAAA' }), /xAI vision 500/)
  })

  it('buildEofImageStudioPrompt weaves prompt + document + reference description together', async () => {
    const { buildEofImageStudioPrompt } = await import('../backend/api/lib/eofImageStudioReference.mjs')
    const onlyPrompt = buildEofImageStudioPrompt({ prompt: 'A bold thumbnail' })
    assert.equal(onlyPrompt, 'A bold thumbnail')

    const full = buildEofImageStudioPrompt({
      prompt: 'A bold thumbnail',
      documentExcerpt: 'Arsenal beat Brighton 3-1',
      referenceDescription: 'A moody blue-toned stadium photo',
    })
    assert.ok(full.startsWith('A bold thumbnail'))
    assert.ok(full.includes('Arsenal beat Brighton 3-1'))
    assert.ok(full.includes('A moody blue-toned stadium photo'))
  })
})
