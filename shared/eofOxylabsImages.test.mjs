import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isEofOxylabsConfigured,
  extractOxylabsImageRows,
  pickOxylabsImageFromHits,
  listOxylabsImageCandidates,
  orderOxylabsHitsForRotation,
  claimOxylabsPoolHit,
  EOF_OXYLABS_MAX_QUERIES_PER_JOB,
} from '../backend/api/lib/eofOxylabsImages.mjs'
import {
  appendEofImageKeyHistory,
  assertEofVideoPersisted,
  EOF_IMAGE_KEY_HISTORY_LIMIT,
} from '../backend/api/lib/eofProductionRenderVideo.mjs'

function mockHits(n) {
  return Array.from({ length: n }, (_, i) => ({
    url: `https://cdn.example.com/photo-${i}.jpg`,
    title: `Photo ${i}`,
    width: 800,
    height: 1200,
  }))
}

describe('eofOxylabsImages', () => {
  it('reports configured from OXYLABS_USERNAME + OXYLABS_PASSWORD', () => {
    const prevUser = process.env.OXYLABS_USERNAME
    const prevPass = process.env.OXYLABS_PASSWORD
    delete process.env.OXYLABS_USERNAME
    delete process.env.OXYLABS_PASSWORD
    assert.equal(isEofOxylabsConfigured(), false)
    process.env.OXYLABS_USERNAME = 'test-user'
    process.env.OXYLABS_PASSWORD = 'test-pass'
    assert.equal(isEofOxylabsConfigured(), true)
    if (prevUser == null) delete process.env.OXYLABS_USERNAME
    else process.env.OXYLABS_USERNAME = prevUser
    if (prevPass == null) delete process.env.OXYLABS_PASSWORD
    else process.env.OXYLABS_PASSWORD = prevPass
  })

  it('extracts image URLs from Oxylabs organic payload', () => {
    const rows = extractOxylabsImageRows({
      results: [
        {
          content: {
            results: {
              organic: [
                {
                  pos: 1,
                  title: 'Thomas Tuchel England',
                  image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTestThumb&s',
                  link: '/url?q=https://example.com/photo',
                },
                {
                  pos: 2,
                  title: 'Full size',
                  high_res_image: 'https://cdn.example.com/photos/tuchel-england.jpg',
                  image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcOther&s',
                  width: 1200,
                  height: 1600,
                },
              ],
            },
          },
        },
      ],
    })
    assert.ok(rows.length >= 1)
    assert.equal(rows[0].url, 'https://cdn.example.com/photos/tuchel-england.jpg')
    assert.ok(rows.some((r) => r.url.includes('gstatic.com') || r.url.includes('example.com')))
  })

  it('skips avoided URLs across the SERP pool (not just modulo first hit)', () => {
    const hits = mockHits(5)
    const picked = pickOxylabsImageFromHits(hits, {
      index: 0,
      avoidUrls: ['oxylabs:https://cdn.example.com/photo-0.jpg', 'https://cdn.example.com/photo-1.jpg'],
    })
    assert.equal(picked.imgUrl, 'https://cdn.example.com/photo-2.jpg')
    assert.equal(picked.reused, false)
  })

  it('simulates 20 rebuild picks with growing avoidKeys from one SERP pool', () => {
    const hits = mockHits(20)
    const history = []
    const pickedUrls = []
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const picked = pickOxylabsImageFromHits(hits, {
        index: attempt * 7,
        avoidUrls: history,
      })
      assert.ok(picked, `attempt ${attempt} should still find a hit`)
      pickedUrls.push(picked.imgUrl)
      history.push(`oxylabs:${picked.imgUrl}`)
      // Until the pool is exhausted, every pick must be fresh.
      if (attempt < 20) assert.equal(picked.reused, false, `attempt ${attempt} should be unused`)
    }
    assert.equal(new Set(pickedUrls).size, 20, '20 rebuilds should use 20 distinct URLs from a 20-hit SERP')

    // 21st pick must fall back (entire pool avoided).
    const overflow = pickOxylabsImageFromHits(hits, { index: 21 * 7, avoidUrls: history })
    assert.ok(overflow)
    assert.equal(overflow.reused, true)
  })

  it('caps billable Google Images queries to 1 per Short job', () => {
    assert.equal(EOF_OXYLABS_MAX_QUERIES_PER_JOB, 1)
  })

  it('claims unique pool URLs across 7 concurrent scenes (one SERP, seven stills)', () => {
    const hits = mockHits(12)
    const claimed = new Set()
    const keys = []
    for (let scene = 0; scene < 7; scene += 1) {
      const hit = claimOxylabsPoolHit({ hits, claimed, index: scene })
      assert.ok(hit, `scene ${scene}`)
      keys.push(hit.key)
    }
    assert.equal(new Set(keys).size, 7)
    assert.equal(claimed.size, 7)
  })

  it('lists fresh candidates before avoided ones for download retries', () => {
    const hits = mockHits(4)
    const list = listOxylabsImageCandidates(hits, {
      index: 0,
      avoidUrls: ['https://cdn.example.com/photo-0.jpg'],
    })
    assert.equal(list[0].imgUrl, 'https://cdn.example.com/photo-1.jpg')
    assert.equal(list[0].reused, false)
    assert.equal(list.at(-1).imgUrl, 'https://cdn.example.com/photo-0.jpg')
    assert.equal(list.at(-1).reused, true)
    assert.deepEqual(
      orderOxylabsHitsForRotation(hits, 2).map((h) => h.url),
      [
        'https://cdn.example.com/photo-2.jpg',
        'https://cdn.example.com/photo-3.jpg',
        'https://cdn.example.com/photo-0.jpg',
        'https://cdn.example.com/photo-1.jpg',
      ],
    )
  })
})

describe('eof rebuild image history + persist guard', () => {
  it(`retains last ${32} image keys so 20 rebuilds stay in the avoid set`, () => {
    assert.ok(EOF_IMAGE_KEY_HISTORY_LIMIT >= 24)
    let history = []
    for (let i = 0; i < 40; i += 1) {
      history = appendEofImageKeyHistory(history, `oxylabs:https://cdn.example.com/p-${i}.jpg`)
    }
    assert.equal(history.length, EOF_IMAGE_KEY_HISTORY_LIMIT)
    assert.ok(history.includes('oxylabs:https://cdn.example.com/p-39.jpg'))
    assert.ok(history.includes('oxylabs:https://cdn.example.com/p-8.jpg'))
    assert.equal(history.includes('oxylabs:https://cdn.example.com/p-7.jpg'), false)
  })

  it('fail-hard when persist cannot store video_base64', () => {
    assert.throws(
      () => assertEofVideoPersisted({ saved: false, bytes: 12_000_000, recompressed: true }),
      /could not be stored for preview/,
    )
    const ok = assertEofVideoPersisted({ saved: true, bytes: 1_000_000, recompressed: false })
    assert.equal(ok.saved, true)
  })
})
