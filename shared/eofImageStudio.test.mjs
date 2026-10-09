import assert from 'node:assert/strict'
import { describe, it, mock, before, after } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

  it('parseEofReferenceImageDataUrls accepts up to MAX_REFERENCE_IMAGES and rejects more', async () => {
    const { parseEofReferenceImageDataUrls, MAX_REFERENCE_IMAGES } = await import(
      '../backend/api/lib/eofImageStudioReference.mjs'
    )
    const tinyJpegB64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64')
    const oneUrl = `data:image/jpeg;base64,${tinyJpegB64}`

    assert.equal(parseEofReferenceImageDataUrls([]).length, 0)
    assert.equal(parseEofReferenceImageDataUrls([oneUrl, oneUrl]).length, 2)
    assert.equal(parseEofReferenceImageDataUrls(Array(MAX_REFERENCE_IMAGES).fill(oneUrl)).length, MAX_REFERENCE_IMAGES)
    assert.throws(
      () => parseEofReferenceImageDataUrls(Array(MAX_REFERENCE_IMAGES + 1).fill(oneUrl)),
      /Up to 5 reference images/,
    )
  })

  it('describeEofReferenceImages delegates to the singular call for exactly one image', async () => {
    let seen = null
    globalThis.fetch = mock.fn(async (url, init) => {
      seen = { url: String(url), body: JSON.parse(init.body) }
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: 'A single stadium photo.' } }] }
        },
        async text() {
          return ''
        },
      }
    })
    const { describeEofReferenceImages } = await import('../backend/api/lib/eofImageStudioReference.mjs')
    const out = await describeEofReferenceImages({ dataUrls: ['data:image/jpeg;base64,AAAA'] })
    assert.equal(out, 'A single stadium photo.')
    // Singular code path sends a single image_url content block, not an array of N images.
    assert.equal(seen.body.messages[1].content.length, 1)
  })

  it('describeEofReferenceImages posts all images together in one multimodal request', async () => {
    let seen = null
    globalThis.fetch = mock.fn(async (url, init) => {
      seen = { url: String(url), body: JSON.parse(init.body) }
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: '  Three cohesive football photos.  ' } }] }
        },
        async text() {
          return ''
        },
      }
    })
    const { describeEofReferenceImages } = await import('../backend/api/lib/eofImageStudioReference.mjs')
    const dataUrls = ['data:image/jpeg;base64,AAAA', 'data:image/jpeg;base64,BBBB', 'data:image/jpeg;base64,CCCC']
    const out = await describeEofReferenceImages({ dataUrls })
    assert.equal(out, 'Three cohesive football photos.')
    assert.equal(seen.url, 'https://api.x.ai/v1/chat/completions')
    const imageBlocks = seen.body.messages[1].content.filter((c) => c.type === 'image_url')
    assert.equal(imageBlocks.length, 3)
    assert.ok(seen.body.messages[0].content.includes('3 reference images'))
  })

  it('describeEofReferenceImages throws when given more than MAX_REFERENCE_IMAGES or none', async () => {
    const { describeEofReferenceImages, MAX_REFERENCE_IMAGES } = await import(
      '../backend/api/lib/eofImageStudioReference.mjs'
    )
    await assert.rejects(() => describeEofReferenceImages({ dataUrls: [] }), /At least one reference image/)
    await assert.rejects(
      () => describeEofReferenceImages({ dataUrls: Array(MAX_REFERENCE_IMAGES + 1).fill('data:image/jpeg;base64,AAAA') }),
      /Up to 5 reference images/,
    )
  })
})

describe('Image Studio — per-user persistent history store (SQLite)', () => {
  let tmpDir
  let store
  const prevSqlite = process.env.SQLITE_PATH
  const prevDatabaseUrl = process.env.DATABASE_URL
  const prevPostgresUrl = process.env.POSTGRES_URL

  before(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'eof-image-studio-history-'))
    process.env.SQLITE_PATH = join(tmpDir, 'test.sqlite')
    delete process.env.DATABASE_URL
    delete process.env.POSTGRES_URL
    store = await import('../backend/api/lib/eofImageStudioHistoryStore.mjs')
  })

  after(() => {
    if (prevSqlite === undefined) delete process.env.SQLITE_PATH
    else process.env.SQLITE_PATH = prevSqlite
    if (prevDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = prevDatabaseUrl
    if (prevPostgresUrl === undefined) delete process.env.POSTGRES_URL
    else process.env.POSTGRES_URL = prevPostgresUrl
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // best-effort cleanup
    }
  })

  it('adds, lists (newest first), and scopes history per user', async () => {
    const saved1 = await store.addEofImageStudioHistoryEntry({
      username: 'alice',
      prompt: 'final prompt 1',
      userPrompt: 'prompt 1',
      aspectRatio: '16:9',
      mime: 'image/jpeg',
      bytes: 100,
      imageBase64: 'AAAA',
    })
    assert.ok(saved1.id)
    assert.equal(saved1.username, 'alice')

    await new Promise((r) => setTimeout(r, 5))
    const saved2 = await store.addEofImageStudioHistoryEntry({
      username: 'alice',
      prompt: 'final prompt 2',
      userPrompt: 'prompt 2',
      aspectRatio: '9:16',
      mime: 'image/jpeg',
      bytes: 200,
      imageBase64: 'BBBB',
      referenceImageUsed: true,
      referenceImageCount: 2,
    })

    await store.addEofImageStudioHistoryEntry({
      username: 'bob',
      prompt: 'bobs prompt',
      userPrompt: 'bobs prompt',
      aspectRatio: '1:1',
      mime: 'image/jpeg',
      bytes: 50,
      imageBase64: 'CCCC',
    })

    const aliceHistory = await store.listEofImageStudioHistory('alice')
    assert.equal(aliceHistory.length, 2)
    assert.equal(aliceHistory[0].id, saved2.id) // newest first
    assert.equal(aliceHistory[1].id, saved1.id)
    assert.equal(aliceHistory[0].referenceImageUsed, true)
    assert.equal(aliceHistory[0].referenceImageCount, 2)

    const bobHistory = await store.listEofImageStudioHistory('bob')
    assert.equal(bobHistory.length, 1)
    assert.equal(bobHistory[0].username, 'bob')
  })

  it('deleteEofImageStudioHistoryEntry only removes the owning user\'s entry', async () => {
    const saved = await store.addEofImageStudioHistoryEntry({
      username: 'carol',
      prompt: 'p',
      userPrompt: 'p',
      aspectRatio: '16:9',
      mime: 'image/jpeg',
      bytes: 10,
      imageBase64: 'DDDD',
    })

    const deletedByWrongUser = await store.deleteEofImageStudioHistoryEntry('mallory', saved.id)
    assert.equal(deletedByWrongUser, false)
    assert.equal((await store.listEofImageStudioHistory('carol')).length, 1)

    const deletedByOwner = await store.deleteEofImageStudioHistoryEntry('carol', saved.id)
    assert.equal(deletedByOwner, true)
    assert.equal((await store.listEofImageStudioHistory('carol')).length, 0)
  })

  it('clearEofImageStudioHistory removes all of one user\'s entries only', async () => {
    for (let i = 0; i < 3; i++) {
      await store.addEofImageStudioHistoryEntry({
        username: 'dave',
        prompt: `p${i}`,
        userPrompt: `p${i}`,
        aspectRatio: '16:9',
        mime: 'image/jpeg',
        bytes: 10,
        imageBase64: 'EEEE',
      })
    }
    await store.addEofImageStudioHistoryEntry({
      username: 'erin',
      prompt: 'erins prompt',
      userPrompt: 'erins prompt',
      aspectRatio: '16:9',
      mime: 'image/jpeg',
      bytes: 10,
      imageBase64: 'FFFF',
    })

    const deletedCount = await store.clearEofImageStudioHistory('dave')
    assert.equal(deletedCount, 3)
    assert.equal((await store.listEofImageStudioHistory('dave')).length, 0)
    assert.equal((await store.listEofImageStudioHistory('erin')).length, 1)
  })
})
