import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pathFromRequest, pathFromSlugParam } from './vercelApiDispatch.mjs'

describe('vercelApiDispatch routing', () => {
  it('builds nested paths from Vercel slug arrays', () => {
    assert.equal(pathFromSlugParam('/api/admin', ['competitions']), '/api/admin/competitions')
  })

  it('prefers pathname over ?slug= competition query param', () => {
    const req = {
      url: '/api/competitions?slug=ronaldo_legacy_bundle',
      query: { slug: 'ronaldo_legacy_bundle' },
    }
    assert.equal(pathFromRequest(req, '/api'), '/api/competitions')
  })

  it('prefers pathname for admin competition detail', () => {
    const req = {
      url: '/api/admin/competitions?slug=ronaldo_legacy_bundle',
      query: { slug: 'ronaldo_legacy_bundle' },
    }
    assert.equal(pathFromRequest(req, '/api/admin'), '/api/admin/competitions')
  })

  it('uses slug segments when pathname is only the prefix', () => {
    const req = {
      url: '/api/admin/login',
      query: { slug: ['login'] },
    }
    assert.equal(pathFromRequest(req, '/api/admin'), '/api/admin/login')
  })

  it('routes newsletter subscribe under /api/newsletter prefix', () => {
    const req = { url: '/api/newsletter/subscribe', query: { slug: ['subscribe'] } }
    assert.equal(pathFromRequest(req, '/api/newsletter'), '/api/newsletter/subscribe')
  })
})
