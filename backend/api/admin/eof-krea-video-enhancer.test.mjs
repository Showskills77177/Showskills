import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { Writable } from 'node:stream'
import { signAdminSession } from '../lib/adminAuth.mjs'
import handler from './eof-krea-video-enhancer.js'

const JOB_ID = '2ed18e18-6680-4d18-94da-fdcac8bbabd6'
const envKeys = [
  'ADMIN_JWT_SECRET',
  'KREA_API_KEY',
  'VERCEL_ENV',
  'BLOB_READ_WRITE_TOKEN',
  'EOF_KREA_ENHANCER_MAX_UPLOAD_BYTES',
]
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
const previousFetch = globalThis.fetch

afterEach(() => {
  for (const key of envKeys) {
    if (previousEnv[key] === undefined) delete process.env[key]
    else process.env[key] = previousEnv[key]
  }
  globalThis.fetch = previousFetch
})

function createResponse() {
  const chunks = []
  const response = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk))
      callback()
    },
  })
  response.headers = {}
  response.setHeader = (name, value) => { response.headers[name.toLowerCase()] = value }
  Object.defineProperty(response, 'body', { get: () => Buffer.concat(chunks).toString('utf8') })
  response.statusCode = 200
  return response
}

async function makeRequest(body, authenticated = true, userId = 'eof-admin') {
  process.env.ADMIN_JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters'
  process.env.VERCEL_ENV = 'preview'
  const token = authenticated ? await signAdminSession({ sub: userId }) : ''
  const request = {
    method: 'POST',
    url: '/api/admin/eof-krea-video-enhancer',
    body,
    headers: authenticated ? { cookie: `admin_session=${token}` } : {},
  }
  const response = createResponse()
  await handler(request, response)
  return response
}

describe('EOF Krea video enhancer API', () => {
  it('requires an authenticated EOF session', async () => {
    process.env.KREA_API_KEY = 'test-krea-key'
    globalThis.fetch = async () => assert.fail('Krea must not be called without authentication')
    const response = await makeRequest({ action: 'enhance' }, false)
    assert.equal(response.statusCode, 401)
    assert.equal(JSON.parse(response.body).error, 'Unauthorized')
  })

  it('rejects non-Blob source URLs before calling Krea', async () => {
    process.env.KREA_API_KEY = 'test-krea-key'
    globalThis.fetch = async () => assert.fail('Invalid sources must not be sent to Krea')
    const response = await makeRequest({ action: 'enhance', videoUrl: 'https://example.com/video.mp4' })
    assert.equal(response.statusCode, 400)
    assert.equal(JSON.parse(response.body).code, 'INVALID_SOURCE_URL')
  })

  it('starts an authenticated SeedVR enhancement and returns a normalized job', async () => {
    process.env.KREA_API_KEY = 'test-krea-key'
    let outgoing
    globalThis.fetch = async (url, options) => {
      outgoing = { url: String(url), options }
      return new Response(JSON.stringify({ job_id: JOB_ID, status: 'queued' }), { status: 200 })
    }
    const sourceUrl = 'https://staging.public.blob.vercel-storage.com/eof-video-enhancer/source.mp4'
    const response = await makeRequest({ action: 'enhance', videoUrl: sourceUrl, model: 'economy' })
    assert.equal(response.statusCode, 200)
    assert.equal(outgoing.url, 'https://api.krea.ai/generate/enhance/bytedance/seedvr-2')
    assert.deepEqual(JSON.parse(outgoing.options.body), { video_url: sourceUrl, noise_scale: 0.1 })
    assert.deepEqual(JSON.parse(response.body).job, {
      jobId: JOB_ID,
      status: 'queued',
      progress: null,
      error: '',
      hasVideo: false,
    })
  })

  it('reports missing Krea configuration without making a provider request', async () => {
    delete process.env.KREA_API_KEY
    globalThis.fetch = async () => assert.fail('Krea must not be called without a key')
    const response = await makeRequest({
      action: 'enhance',
      videoUrl: 'https://staging.public.blob.vercel-storage.com/eof-video-enhancer/source.mp4',
      model: 'economy',
    })
    assert.equal(response.statusCode, 503)
    assert.equal(JSON.parse(response.body).code, 'KREA_NOT_CONFIGURED')
  })

  it('reports missing Vercel Blob configuration for direct uploads', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    globalThis.fetch = async () => assert.fail('A missing Blob token must not start a provider request')
    const response = await makeRequest({ action: 'upload-config' })
    assert.equal(response.statusCode, 503)
    assert.equal(JSON.parse(response.body).code, 'BLOB_NOT_CONFIGURED')
  })

  it('returns the configured upload cap and a user-bound cleanup claim', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'configured-for-test'
    process.env.EOF_KREA_ENHANCER_MAX_UPLOAD_BYTES = String(512 * 1024 * 1024)
    const response = await makeRequest({ action: 'upload-config' })
    const config = JSON.parse(response.body)
    assert.equal(response.statusCode, 200)
    assert.equal(config.maxUploadBytes, 512 * 1024 * 1024)
    assert.match(config.uploadId, /^[0-9a-f-]{36}$/i)
    assert.equal(typeof config.cleanupToken, 'string')
  })

  it('does not allow another authenticated user to delete the staged source', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'configured-for-test'
    process.env.EOF_KREA_ENHANCER_MAX_UPLOAD_BYTES = String(512 * 1024 * 1024)
    const configResponse = await makeRequest({ action: 'upload-config' })
    const { uploadId, cleanupToken } = JSON.parse(configResponse.body)
    const response = await makeRequest(
      {
        action: 'cleanup-source',
        sourceUrl: `https://staging.public.blob.vercel-storage.com/eof-video-enhancer/source-${uploadId}.mp4`,
        cleanupToken,
      },
      true,
      'different-eof-user',
    )
    assert.equal(response.statusCode, 403)
    assert.equal(JSON.parse(response.body).code, 'SOURCE_OWNERSHIP_REQUIRED')
  })

  it('defaults the upload cap to 1 GB and allows a configured override', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'configured-for-test'
    delete process.env.EOF_KREA_ENHANCER_MAX_UPLOAD_BYTES
    const defaultResponse = await makeRequest({ action: 'upload-config' })
    assert.equal(defaultResponse.statusCode, 200)
    assert.equal(JSON.parse(defaultResponse.body).maxUploadBytes, 1024 * 1024 * 1024)

    process.env.EOF_KREA_ENHANCER_MAX_UPLOAD_BYTES = String(256 * 1024 * 1024)
    const configuredResponse = await makeRequest({ action: 'upload-config' })
    assert.equal(configuredResponse.statusCode, 200)
    assert.equal(JSON.parse(configuredResponse.body).maxUploadBytes, 256 * 1024 * 1024)
  })
})
