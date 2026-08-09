/**
 * Unit tests for EOF Railway / external worker dispatch helpers.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  eofWorkerBaseUrl,
  eofWorkerSecret,
  isEofExternalWorkerConfigured,
  scheduleEofVideoOnWorker,
  EOF_STALE_WORKER_MAX_AGE_SEC,
} from '../backend/api/lib/eofProductionWorkerDispatch.mjs'
import { resolveEofStaleWindows } from '../backend/api/lib/eofProductionJobs.mjs'

describe('eofProductionWorkerDispatch', () => {
  it('is configured only when URL + secret are both set', () => {
    const prevUrl = process.env.EOF_WORKER_URL
    const prevSecret = process.env.EOF_WORKER_SECRET
    try {
      delete process.env.EOF_WORKER_URL
      delete process.env.EOF_WORKER_SECRET
      assert.equal(isEofExternalWorkerConfigured(), false)

      process.env.EOF_WORKER_URL = 'https://eof-worker.example'
      assert.equal(isEofExternalWorkerConfigured(), false)

      process.env.EOF_WORKER_SECRET = 'test-secret'
      assert.equal(isEofExternalWorkerConfigured(), true)
      assert.equal(eofWorkerBaseUrl(), 'https://eof-worker.example')
      assert.equal(eofWorkerSecret(), 'test-secret')

      process.env.EOF_WORKER_URL = 'https://eof-worker.example/'
      assert.equal(eofWorkerBaseUrl(), 'https://eof-worker.example')
    } finally {
      if (prevUrl === undefined) delete process.env.EOF_WORKER_URL
      else process.env.EOF_WORKER_URL = prevUrl
      if (prevSecret === undefined) delete process.env.EOF_WORKER_SECRET
      else process.env.EOF_WORKER_SECRET = prevSecret
    }
  })

  it('scheduleEofVideoOnWorker POSTs bearer + jobId and accepts 202', async () => {
    const prevUrl = process.env.EOF_WORKER_URL
    const prevSecret = process.env.EOF_WORKER_SECRET
    const prevFetch = globalThis.fetch
    try {
      process.env.EOF_WORKER_URL = 'https://eof-worker.example'
      process.env.EOF_WORKER_SECRET = 'shared-secret'
      let seen
      globalThis.fetch = async (url, init) => {
        seen = { url: String(url), init }
        return { ok: false, status: 202 }
      }
      const result = await scheduleEofVideoOnWorker('job-1', {
        imageProvider: 'serpapi',
        forceFreshImages: true,
        qualityGateMode: 'manual',
      })
      assert.equal(result.ok, true)
      assert.equal(result.status, 202)
      assert.equal(seen.url, 'https://eof-worker.example/eof-worker/render')
      assert.equal(seen.init.method, 'POST')
      assert.equal(seen.init.headers.Authorization, 'Bearer shared-secret')
      const body = JSON.parse(seen.init.body)
      assert.equal(body.jobId, 'job-1')
      assert.equal(body.step, 'video')
      assert.equal(body.imageProvider, 'serpapi')
      assert.equal(body.forceFreshImages, true)
      assert.equal(body.qualityGateMode, 'manual')
    } finally {
      globalThis.fetch = prevFetch
      if (prevUrl === undefined) delete process.env.EOF_WORKER_URL
      else process.env.EOF_WORKER_URL = prevUrl
      if (prevSecret === undefined) delete process.env.EOF_WORKER_SECRET
      else process.env.EOF_WORKER_SECRET = prevSecret
    }
  })

  it('forwards mode: voiceover-regen so voiceover regeneration remuxes on the worker (has yt-dlp), not Vercel', async () => {
    const prevUrl = process.env.EOF_WORKER_URL
    const prevSecret = process.env.EOF_WORKER_SECRET
    const prevFetch = globalThis.fetch
    try {
      process.env.EOF_WORKER_URL = 'https://eof-worker.example'
      process.env.EOF_WORKER_SECRET = 'shared-secret'
      let seen
      globalThis.fetch = async (url, init) => {
        seen = { url: String(url), init }
        return { ok: false, status: 202 }
      }
      const result = await scheduleEofVideoOnWorker('job-2', { mode: 'voiceover-regen' })
      assert.equal(result.ok, true)
      const body = JSON.parse(seen.init.body)
      assert.equal(body.mode, 'voiceover-regen')
    } finally {
      globalThis.fetch = prevFetch
      if (prevUrl === undefined) delete process.env.EOF_WORKER_URL
      else process.env.EOF_WORKER_URL = prevUrl
      if (prevSecret === undefined) delete process.env.EOF_WORKER_SECRET
      else process.env.EOF_WORKER_SECRET = prevSecret
    }
  })

  it('widens Pro stale windows when the worker is configured', () => {
    const prevUrl = process.env.EOF_WORKER_URL
    const prevSecret = process.env.EOF_WORKER_SECRET
    try {
      delete process.env.EOF_WORKER_URL
      delete process.env.EOF_WORKER_SECRET
      const local = resolveEofStaleWindows({ slim: false })
      assert.ok(local.maxAgeSec <= 400)

      process.env.EOF_WORKER_URL = 'https://eof-worker.example'
      process.env.EOF_WORKER_SECRET = 'shared-secret'
      const worker = resolveEofStaleWindows({ slim: false })
      assert.equal(worker.worker, true)
      assert.ok(worker.maxAgeSec >= EOF_STALE_WORKER_MAX_AGE_SEC)
      assert.ok(worker.maxQuietSec >= 240)
    } finally {
      if (prevUrl === undefined) delete process.env.EOF_WORKER_URL
      else process.env.EOF_WORKER_URL = prevUrl
      if (prevSecret === undefined) delete process.env.EOF_WORKER_SECRET
      else process.env.EOF_WORKER_SECRET = prevSecret
    }
  })
})
