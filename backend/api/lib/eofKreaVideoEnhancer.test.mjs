import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  buildEofKreaVideoEnhancerRequest,
  createEofKreaVideoEnhancerJob,
  isEofEnhancerBlobUrl,
} from './eofKreaVideoEnhancer.mjs'

const previousKey = process.env.KREA_API_KEY
const previousFetch = globalThis.fetch

afterEach(() => {
  if (previousKey === undefined) delete process.env.KREA_API_KEY
  else process.env.KREA_API_KEY = previousKey
  globalThis.fetch = previousFetch
})

const BLOB_URL = 'https://staging.public.blob.vercel-storage.com/eof-video-enhancer/source.mp4'

describe('EOF Krea video enhancer', () => {
  it('only accepts HTTPS Vercel public Blob source URLs in the enhancer folder', () => {
    assert.equal(isEofEnhancerBlobUrl(BLOB_URL), true)
    assert.equal(isEofEnhancerBlobUrl('http://staging.public.blob.vercel-storage.com/eof-video-enhancer/a.mp4'), false)
    assert.equal(isEofEnhancerBlobUrl('https://example.com/eof-video-enhancer/a.mp4'), false)
    assert.equal(isEofEnhancerBlobUrl('https://staging.public.blob.vercel-storage.com/other/a.mp4'), false)
  })

  it('builds the economy model request without inventing price claims', () => {
    assert.deepEqual(buildEofKreaVideoEnhancerRequest({ videoUrl: BLOB_URL }), {
      model: {
        label: 'SeedVR 2',
        endpoint: '/generate/enhance/bytedance/seedvr-2',
        maxWidth: 3840,
        maxHeight: 2160,
      },
      body: { video_url: BLOB_URL, noise_scale: 0.1 },
    })
  })

  it('builds a Topaz request with validated 8K settings and safe defaults', () => {
    const request = buildEofKreaVideoEnhancerRequest({
      videoUrl: BLOB_URL,
      model: 'quality',
      target: '8k',
    })
    assert.equal(request.model.endpoint, '/generate/enhance/topaz/video-upscale')
    assert.deepEqual(
      {
        width: request.body.target_width,
        height: request.body.target_height,
        crop: request.body.crop_to_fit,
        enhancement: request.body.enhancement,
        interpolation: request.body.frame_interpolation,
        preset: request.body.video_output_preset,
      },
      { width: 7680, height: 4320, crop: false, enhancement: true, interpolation: false, preset: 'h264-high' },
    )
  })

  it('rejects unsupported model options and invalid denoising values', () => {
    assert.throws(
      () => buildEofKreaVideoEnhancerRequest({ videoUrl: BLOB_URL, model: 'unknown' }),
      { code: 'INVALID_ENHANCER_MODEL' },
    )
    assert.throws(
      () => buildEofKreaVideoEnhancerRequest({ videoUrl: BLOB_URL, noiseScale: 2 }),
      { code: 'INVALID_NOISE_SCALE' },
    )
    assert.throws(
      () => buildEofKreaVideoEnhancerRequest({ videoUrl: BLOB_URL, model: 'quality', target: '16k' }),
      { code: 'INVALID_TARGET_SIZE' },
    )
  })

  it('sends the validated enhancer request to Krea with the server key', async () => {
    process.env.KREA_API_KEY = 'test-krea-key'
    let request
    globalThis.fetch = async (url, options) => {
      request = { url: String(url), options }
      return new Response(JSON.stringify({ job_id: '2ed18e18-6680-4d18-94da-fdcac8bbabd6', status: 'queued' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const enhancement = buildEofKreaVideoEnhancerRequest({ videoUrl: BLOB_URL, model: 'economy' })
    const job = await createEofKreaVideoEnhancerJob(enhancement)
    assert.equal(request.url, 'https://api.krea.ai/generate/enhance/bytedance/seedvr-2')
    assert.equal(request.options.method, 'POST')
    assert.equal(request.options.headers.Authorization, 'Bearer test-krea-key')
    assert.deepEqual(JSON.parse(request.options.body), { video_url: BLOB_URL, noise_scale: 0.1 })
    assert.equal(job.status, 'queued')
  })
})
