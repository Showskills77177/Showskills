import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { Writable } from 'node:stream'
import { signAdminSession } from '../lib/adminAuth.mjs'
import handler from './eof-krea-video.js'

const JOB_ID = '2ed18e18-6680-4d18-94da-fdcac8bbabd6'
const envKeys = ['ADMIN_JWT_SECRET', 'KREA_API_KEY', 'VERCEL_ENV']
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
const previousFetch = globalThis.fetch

afterEach(() => {
  for (const key of envKeys) {
    if (previousEnv[key] === undefined) delete process.env[key]
    else process.env[key] = previousEnv[key]
  }
  globalThis.fetch = previousFetch
})

async function makeRequest(method, url, body) {
  process.env.ADMIN_JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters'
  process.env.VERCEL_ENV = 'preview'
  const token = await signAdminSession({ sub: 'eof-admin' })
  const req = {
    method,
    url,
    body,
    headers: { cookie: `admin_session=${token}` },
  }
  const response = createResponse()
  await handler(req, response)
  if (response.completion) await response.completion
  return response
}

function createResponse() {
  const chunks = []
  const response = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk))
      callback()
    },
  })
  response.headers = {}
  response.completion = new Promise((resolve) => response.once('finish', resolve))
  response.setHeader = (name, value) => {
    response.headers[name.toLowerCase()] = value
  }
  Object.defineProperty(response, 'body', {
    get: () => Buffer.concat(chunks).toString('utf8'),
  })
  response.statusCode = 200
  return response
}

describe('EOF Krea video API', () => {
  it('requires an authenticated EOF session and never calls Krea without one', async () => {
    process.env.ADMIN_JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters'
    process.env.KREA_API_KEY = 'test-krea-key'
    process.env.VERCEL_ENV = 'preview'
    globalThis.fetch = async () => {
      assert.fail('Krea must not be called without admin authentication')
    }

    const response = createResponse()
    await handler({ method: 'POST', url: '/api/admin/eof-krea-video', headers: {}, body: {} }, response)

    assert.equal(response.statusCode, 401)
    assert.equal(JSON.parse(response.body).error, 'Unauthorized')
  })

  it('passes the original prompt and selected settings directly to Krea', async () => {
    process.env.KREA_API_KEY = 'test-krea-key'
    let request
    globalThis.fetch = async (url, options) => {
      request = { url: String(url), options }
      return new Response(
        JSON.stringify({ job_id: JOB_ID, status: 'queued', created_at: '2026-10-16T12:00:00Z' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const prompt = '  keep this wording exactly as written  '
    const response = await makeRequest('POST', '/api/admin/eof-krea-video', {
      prompt,
      duration: 8,
      aspectRatio: '9:16',
      resolution: '720p',
    })

    assert.equal(response.statusCode, 200)
    assert.equal(request.url, 'https://api.krea.ai/generate/video/bytedance/seedance-1.0-pro-fast')
    assert.equal(request.options.method, 'POST')
    assert.equal(request.options.headers.Authorization, 'Bearer test-krea-key')
    assert.deepEqual(JSON.parse(request.options.body), {
      prompt,
      duration: 8,
      aspect_ratio: '9:16',
      resolution: '720p',
    })
    assert.deepEqual(JSON.parse(response.body).job, {
      jobId: JOB_ID,
      status: 'queued',
      progress: null,
      error: '',
      hasVideo: false,
    })
    assert.equal(response.body.includes('test-krea-key'), false)
  })

  it('returns an actionable missing-key error without making a provider request', async () => {
    delete process.env.KREA_API_KEY
    globalThis.fetch = async () => {
      assert.fail('Krea must not be called without a configured key')
    }

    const response = await makeRequest('POST', '/api/admin/eof-krea-video', {
      prompt: 'A close-up football in a stadium',
      duration: 6,
      aspectRatio: '9:16',
      resolution: '720p',
    })

    assert.equal(response.statusCode, 503)
    assert.match(JSON.parse(response.body).error, /KREA_API_KEY/)
    assert.match(JSON.parse(response.body).error, /Vercel staging/)
  })

  it('rejects invalid prompts and settings before calling Krea', async () => {
    process.env.KREA_API_KEY = 'test-krea-key'
    globalThis.fetch = async () => {
      assert.fail('Invalid requests must not be sent to Krea')
    }

    const response = await makeRequest('POST', '/api/admin/eof-krea-video', {
      prompt: '   ',
      duration: 6,
      aspectRatio: '9:16',
      resolution: '720p',
    })

    assert.equal(response.statusCode, 400)
    assert.match(JSON.parse(response.body).error, /prompt/i)
  })

  it('returns Krea rate-limit errors as actionable retry guidance', async () => {
    process.env.KREA_API_KEY = 'test-krea-key'
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: 'rate limited' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })

    const response = await makeRequest('POST', '/api/admin/eof-krea-video', {
      prompt: 'A close-up football in a stadium',
      duration: 6,
      aspectRatio: '9:16',
      resolution: '720p',
    })

    assert.equal(response.statusCode, 429)
    assert.match(JSON.parse(response.body).error, /Wait and retry/)
  })

  it('polls a job and only exposes normalized status data', async () => {
    process.env.KREA_API_KEY = 'test-krea-key'
    let requestedUrl = ''
    globalThis.fetch = async (url) => {
      requestedUrl = String(url)
      return new Response(
        JSON.stringify({
          job_id: JOB_ID,
          status: 'completed',
          progress: 1,
          result: { urls: [{ type: 'preview', url: 'https://media.krea.ai/video.mp4' }] },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const response = await makeRequest(
      'GET',
      `/api/admin/eof-krea-video?action=status&jobId=${JOB_ID}`,
    )

    assert.equal(requestedUrl, `https://api.krea.ai/jobs/${JOB_ID}`)
    assert.equal(response.statusCode, 200)
    assert.deepEqual(JSON.parse(response.body).job, {
      jobId: JOB_ID,
      status: 'completed',
      progress: 1,
      error: '',
      hasVideo: true,
    })
  })

  it('streams completed videos through the authenticated API for preview/download', async () => {
    process.env.KREA_API_KEY = 'test-krea-key'
    const mp4 = Buffer.from('fake-mp4-content')
    let calls = 0
    globalThis.fetch = async (url) => {
      calls += 1
      if (String(url) === `https://api.krea.ai/jobs/${JOB_ID}`) {
        return new Response(
          JSON.stringify({
            job_id: JOB_ID,
            status: 'completed',
            result: {
              urls: [
                { type: 'preview', url: 'https://media.krea.ai/thumbnail.jpg' },
                { type: 'model', url: 'https://media.krea.ai/video.mp4' },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      assert.equal(String(url), 'https://media.krea.ai/video.mp4')
      return new Response(mp4, { status: 200, headers: { 'Content-Type': 'video/mp4' } })
    }

    const response = await makeRequest(
      'GET',
      `/api/admin/eof-krea-video?action=download&jobId=${JOB_ID}`,
    )

    assert.equal(calls, 2)
    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['content-type'], 'video/mp4')
    assert.match(response.headers['content-disposition'], /attachment/)
    assert.deepEqual(Buffer.from(response.body, 'utf8'), mp4)
  })
})
