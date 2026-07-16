import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { rankWikimediaCandidates } from '../backend/api/lib/eofWikimediaImages.mjs'

describe('eofWikimediaImages ranking', () => {
  it('prefers the current England Tuchel portrait over Mainz 2014', () => {
    const ranked = rankWikimediaCandidates(
      [
        {
          title: 'Thomas Tuchel coach Mainz05 at away match in Leverkusen 2014.jpg',
          imgUrl: 'https://example.com/old.jpg',
          year: 2014,
          dateMs: Date.UTC(2014, 4, 4),
        },
        {
          title: 'ThomasTuchel2014.jpg',
          imgUrl: 'https://example.com/old2.jpg',
          year: 2014,
          dateMs: Date.UTC(2014, 4, 4),
        },
        {
          title: 'Thomas Tuchel England v Ghana 23 June 2026-081.jpg',
          imgUrl: 'https://example.com/new.jpg',
          year: 2026,
          dateMs: Date.UTC(2026, 5, 23),
        },
      ],
      'Thomas Tuchel',
      'Thomas Tuchel manager',
    )
    assert.ok(ranked.length >= 1)
    assert.match(ranked[0].title, /2026|England/i)
    assert.ok(!/mainz|2014/i.test(ranked[0].title))
  })

  it('drops junk / off-topic commons hits', () => {
    const ranked = rankWikimediaCandidates(
      [
        {
          title: 'Prisoners of the great war England.jpg',
          imgUrl: 'https://example.com/junk.jpg',
          year: 2020,
          dateMs: Date.UTC(2020, 0, 1),
        },
        {
          title: 'Thomas Tuchel Chelsea.jpg',
          imgUrl: 'https://example.com/ok.jpg',
          year: 2021,
          dateMs: Date.UTC(2021, 8, 14),
        },
        {
          title: 'Thomas Tuchel England v Ghana 23 June 2026-081.jpg',
          imgUrl: 'https://example.com/new.jpg',
          year: 2026,
          dateMs: Date.UTC(2026, 5, 23),
        },
      ],
      'Thomas Tuchel',
    )
    assert.ok(ranked.every((c) => !/prisoners/i.test(c.title)))
    assert.ok(ranked.some((c) => /Tuchel/i.test(c.title)))
    assert.match(ranked[0].title, /2026|England/i)
  })

  it('preferRecentCandidates keeps only current/last-year when available', async () => {
    const { preferRecentCandidates } = await import('../backend/api/lib/eofWikimediaImages.mjs')
    const year = new Date().getFullYear()
    const pool = preferRecentCandidates([
      { title: 'old', year: year - 5, relevance: 20 },
      { title: 'current', year, relevance: 30 },
      { title: 'last', year: year - 1, relevance: 28 },
      { title: 'club-world-cup', year: year - 5, relevance: 25 },
    ])
    assert.equal(pool.length, 2)
    assert.ok(pool.every((c) => c.year >= year - 1))
  })
})
