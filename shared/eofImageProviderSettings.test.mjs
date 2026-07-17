import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import {
  normalizeEofImageProvider,
  resolveEofImageProviderAttemptOrder,
  listEofImageProviderOptions,
  eofImageProviderConfigurationNote,
  getEofImageProviderSettings,
  updateEofImageProviderSettings,
} from '../backend/api/lib/eofImageProviderSettings.mjs'

describe('normalizeEofImageProvider', () => {
  it('accepts auto / serpapi / oxylabs and common aliases', () => {
    assert.equal(normalizeEofImageProvider('auto'), 'auto')
    assert.equal(normalizeEofImageProvider('serpapi'), 'serpapi')
    assert.equal(normalizeEofImageProvider('Oxylabs'), 'oxylabs')
    assert.equal(normalizeEofImageProvider('serp'), 'serpapi')
    assert.equal(normalizeEofImageProvider('serp_api'), 'serpapi')
    assert.equal(normalizeEofImageProvider('oxy'), 'oxylabs')
  })

  it('defaults unknown / empty to auto', () => {
    assert.equal(normalizeEofImageProvider(''), 'auto')
    assert.equal(normalizeEofImageProvider(null), 'auto')
    assert.equal(normalizeEofImageProvider('pexels'), 'auto')
  })
})

describe('resolveEofImageProviderAttemptOrder', () => {
  it('auto prefers SerpAPI then Oxylabs when both configured', () => {
    assert.deepEqual(
      resolveEofImageProviderAttemptOrder('auto', { serpapi: true, oxylabs: true }),
      ['serpapi', 'oxylabs'],
    )
  })

  it('serpapi preference puts SerpAPI first with Oxylabs fallback', () => {
    assert.deepEqual(
      resolveEofImageProviderAttemptOrder('serpapi', { serpapi: true, oxylabs: true }),
      ['serpapi', 'oxylabs'],
    )
  })

  it('oxylabs preference puts Oxylabs first with SerpAPI fallback', () => {
    assert.deepEqual(
      resolveEofImageProviderAttemptOrder('oxylabs', { serpapi: true, oxylabs: true }),
      ['oxylabs', 'serpapi'],
    )
  })

  it('skips preferred provider when not configured', () => {
    assert.deepEqual(
      resolveEofImageProviderAttemptOrder('serpapi', { serpapi: false, oxylabs: true }),
      ['oxylabs'],
    )
    assert.deepEqual(
      resolveEofImageProviderAttemptOrder('oxylabs', { serpapi: true, oxylabs: false }),
      ['serpapi'],
    )
  })

  it('returns empty when neither Google Images provider is keyed', () => {
    assert.deepEqual(resolveEofImageProviderAttemptOrder('auto', { serpapi: false, oxylabs: false }), [])
  })
})

describe('listEofImageProviderOptions + notes', () => {
  const prev = {}

  before(() => {
    for (const k of [
      'SERPAPI_API_KEY',
      'SERP_API_KEY',
      'OXYLABS_USERNAME',
      'OXYLABS_USER',
      'OXYLABS_PASSWORD',
      'OXYLABS_PASS',
    ]) {
      prev[k] = process.env[k]
      delete process.env[k]
    }
  })

  after(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  it('marks SerpAPI / Oxylabs configured from env only (never from DB)', () => {
    process.env.SERPAPI_API_KEY = 'test-serp-key'
    process.env.OXYLABS_USERNAME = 'oxy-user'
    process.env.OXYLABS_PASSWORD = 'oxy-pass'
    const opts = listEofImageProviderOptions()
    assert.equal(opts.find((o) => o.id === 'serpapi')?.configured, true)
    assert.equal(opts.find((o) => o.id === 'oxylabs')?.configured, true)
    assert.match(eofImageProviderConfigurationNote('serpapi'), /SerpAPI preferred/i)
    assert.match(eofImageProviderConfigurationNote('oxylabs'), /Oxylabs preferred/i)
  })

  it('warns when preferred provider credentials are missing', () => {
    delete process.env.SERPAPI_API_KEY
    delete process.env.SERP_API_KEY
    delete process.env.OXYLABS_USERNAME
    delete process.env.OXYLABS_PASSWORD
    assert.match(eofImageProviderConfigurationNote('serpapi'), /missing/i)
    assert.match(eofImageProviderConfigurationNote('oxylabs'), /missing/i)
  })
})

describe('eof image provider settings DB read/write', () => {
  let tmpDir
  const prevSqlite = process.env.SQLITE_PATH
  const prevDatabaseUrl = process.env.DATABASE_URL
  const prevPostgresUrl = process.env.POSTGRES_URL

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'eof-img-provider-'))
    process.env.SQLITE_PATH = join(tmpDir, 'test.sqlite')
    delete process.env.DATABASE_URL
    delete process.env.POSTGRES_URL
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
      /* ignore */
    }
  })

  it('defaults to auto and persists serpapi / oxylabs preference (no API keys in DB)', async () => {
    const initial = await getEofImageProviderSettings()
    assert.equal(initial.imageProvider, 'auto')
    assert.equal(initial.imageGenMode, 'auto')
    assert.equal(initial.imageGenProvider, 'auto')

    const serp = await updateEofImageProviderSettings({ imageProvider: 'serpapi' })
    assert.equal(serp.imageProvider, 'serpapi')
    assert.equal((await getEofImageProviderSettings()).imageProvider, 'serpapi')

    const oxy = await updateEofImageProviderSettings({ imageProvider: 'oxylabs' })
    assert.equal(oxy.imageProvider, 'oxylabs')

    const gen = await updateEofImageProviderSettings({
      imageGenMode: 'always',
      imageGenProvider: 'grok',
    })
    assert.equal(gen.imageGenMode, 'always')
    assert.equal(gen.imageGenProvider, 'grok')

    // Settings payload must never include credential fields
    assert.equal(oxy.apiKey, undefined)
    assert.equal(oxy.serpapiKey, undefined)
    assert.equal(oxy.password, undefined)
    assert.deepEqual(
      Object.keys(gen).sort(),
      ['id', 'imageProvider', 'imageGenMode', 'imageGenProvider', 'updatedAt'].sort(),
    )
  })
})
